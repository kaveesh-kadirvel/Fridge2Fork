from flask import Flask, render_template, request, redirect, url_for, send_from_directory, jsonify, session, flash
import os
import csv
import re
import sqlite3
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

DATASET_PATH = os.path.join(os.path.dirname(__file__), 'Food Ingredients and Recipe Dataset with Image Name Mapping.csv')
# Local folder where the dataset's food images are stored (project-relative)
FOOD_IMAGES_DIR = os.path.join(os.path.dirname(__file__), 'Food Images', 'Food Images')

def _normalize_token(text):
    return re.sub(r"[^a-z]+", "", text.lower()).strip()

def _tokenize_ingredients(text):
    if not text:
        return set()
    # Convert list-like strings to plain text and split into tokens
    # Handles inputs like "['salt', 'pepper']" or long text
    lowered = text.lower()
    words = re.split(r"[^a-z]+", lowered)
    return set([w for w in words if w])

def load_dataset():
    recipes = []
    if not os.path.exists(DATASET_PATH):
        return recipes
    # Build an index of available image filenames in the Food Images folder for quick lookup
    available_images = set()
    try:
        if os.path.isdir(FOOD_IMAGES_DIR):
            for fn in os.listdir(FOOD_IMAGES_DIR):
                available_images.add(fn)
    except Exception:
        available_images = set()
    # Precompute lowercase mapping for fast case-insensitive lookup
    available_images_lower = {n.lower(): n for n in available_images}
    available_images_list = list(available_images)
    with open(DATASET_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                rid = int(row.get('', '0')) if row.get('') is not None and row.get('') != '' else None
            except Exception:
                rid = None
            title = (row.get('Title') or '').strip()
            ingredients_text = row.get('Cleaned_Ingredients') or row.get('Ingredients') or ''
            instructions = row.get('Instructions') or ''
            # Dataset may contain an Image_Name (local filename) or a direct Image_URL.
            # Prefer a full URL if available so we can show the original internet image.
            raw_image = (row.get('Image_Name') or '')
            # Common alternate column names for direct URLs
            image_url_field = (row.get('Image_URL') or row.get('ImageURL') or row.get('Image')) or ''
            # Normalize raw image string
            if isinstance(raw_image, str):
                raw_image = raw_image.strip().strip('"').strip("'")
            else:
                raw_image = ''

            # Precompute tokens (used for matching heuristics)
            tokens = _tokenize_ingredients(ingredients_text)

            # If an explicit absolute URL column exists, prefer it
            if image_url_field and isinstance(image_url_field, str) and image_url_field.strip().startswith(('http://', 'https://')):
                resolved_image = image_url_field.strip()
            else:
                # Try several heuristics to match a file in the Food Images folder
                resolved_image = ''
                candidate = None
                def slugify(s: str) -> str:
                    s = re.sub(r"[^a-z0-9\s-]+", "", s.lower())
                    return re.sub(r"\s+", "-", s).strip('-')

                # 1) exact filename (as provided)
                if raw_image:
                    if raw_image in available_images:
                        candidate = raw_image
                    else:
                        # fast case-insensitive lookup
                        ci = raw_image.lower()
                        if ci in available_images_lower:
                            candidate = available_images_lower[ci]

                # 2) slugified title matching: contains / endswith / startswith
                if not candidate and title:
                    s = slugify(title)
                    for n in available_images_list:
                        nl = n.lower()
                        if s and (nl == s or nl.endswith(s) or s in nl or nl.startswith(s)):
                            candidate = n
                            break

                # 3) try tokens (ingredient words) as fallback
                if not candidate and tokens:
                    for t in list(tokens)[:5]:
                        for n in available_images_list:
                            if t in n.lower():
                                candidate = n
                                break
                        if candidate:
                            break

                # 4) try common extensions for raw_image base
                if not candidate and raw_image:
                    base = os.path.splitext(raw_image)[0]
                    for ext in ['.jpg', '.jpeg', '.png', '.webp']:
                        name = f"{base}{ext}"
                        if name in available_images:
                            candidate = name
                            break

                if candidate:
                    # store filename only; _resolve_image_url will convert to /images/<filename>
                    resolved_image = candidate
                else:
                    # Fall back to the raw image token (may be a filename in static/img or a slug for Unsplash)
                    resolved_image = raw_image or ''
            recipes.append({
                'id': rid if rid is not None else len(recipes),
                'title': title,
                'ingredients_text': ingredients_text,
                'instructions': instructions,
                # store resolved_image (absolute URL or /images/filename or original token)
                'image_name': resolved_image,
                'tokens': tokens,
            })
    return recipes

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key-change-me')

DB_PATH = os.path.join(os.path.dirname(__file__), 'app.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()
    finally:
        conn.close()

# Load dataset once at startup
RECIPES = load_dataset()
init_db()

@app.route('/')
def index():
    return render_template('index.html')

# -----------------------------
# Authentication Views
# -----------------------------

def _current_user_email():
    return session.get('user_email')


@app.route('/auth', methods=['GET'])
def auth_page():
    if _current_user_email():
        return redirect(url_for('dashboard'))
    return render_template('auth.html')


@app.route('/signup', methods=['POST'])
def signup():
    email = (request.form.get('email') or '').strip().lower()
    password = request.form.get('password') or ''
    if not email or not password:
        flash('Please provide both email and password.', 'error')
        return redirect(url_for('auth_page'))

    conn = get_db_connection()
    try:
        # Check duplicate
        existing = conn.execute('SELECT id FROM users WHERE email = ?', (email,)).fetchone()
        if existing:
            flash('An account with that email already exists.', 'error')
            return redirect(url_for('auth_page'))

        password_hash = generate_password_hash(password)
        conn.execute(
            'INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)',
            (email, password_hash, datetime.utcnow().isoformat())
        )
        conn.commit()
        flash('Account created. Please log in.', 'success')
        return redirect(url_for('auth_page'))
    finally:
        conn.close()


@app.route('/login', methods=['POST'])
def login():
    email = (request.form.get('email') or '').strip().lower()
    password = request.form.get('password') or ''
    if not email or not password:
        flash('Please provide both email and password.', 'error')
        return redirect(url_for('auth_page'))

    conn = get_db_connection()
    try:
        user = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
        if not user or not check_password_hash(user['password_hash'], password):
            flash('Invalid email or password.', 'error')
            return redirect(url_for('auth_page'))

        session['user_email'] = email
        flash('Welcome back!', 'success')
        return redirect(url_for('dashboard'))
    finally:
        conn.close()


@app.route('/logout', methods=['POST'])
def logout():
    session.clear()
    flash('You have been logged out.', 'success')
    return redirect(url_for('auth_page'))


@app.route('/dashboard', methods=['GET'])
def dashboard():
    user_email = _current_user_email()
    if not user_email:
        flash('Please log in to continue.', 'error')
        return redirect(url_for('auth_page'))
    return render_template('dashboard.html', user_email=user_email)

# Example API endpoint: list spices (in real app, hook a DB)
@app.route('/api/spices', methods=['GET'])
def api_spices():
    sample = [
        {'id': 1, 'name': 'Turmeric', 'flavor': 'Earthy, bitter'},
        {'id': 2, 'name': 'Cumin', 'flavor': 'Warm, nutty'},
        {'id': 3, 'name': 'Cardamom', 'flavor': 'Sweet, floral'},
    ]
    return jsonify(sample)


@app.route('/api/recipes', methods=['GET'])
def api_recipes():
    query = request.args.get('ingredients', '')
    raw_tokens = [
        _normalize_token(tok)
        for tok in query.split(',')
    ]
    user_tokens = [t for t in raw_tokens if t]
    if not user_tokens:
        # Return all recipes alphabetically when no ingredients provided
        results = []
        for r in RECIPES:
            results.append({
                'id': r['id'],
                'title': r['title'],
                'match_score': 0,
                'match_percent': None,
                'image_url': _resolve_image_url(r.get('image_name'), r['title'], r['tokens']),
                'ingredients_preview': sorted(list(r.get('tokens') or []))[:8],
                'instructions_preview': (r.get('instructions') or '').split('\n')[0][:220]
            })
        results.sort(key=lambda x: (x['title'] or '').lower())
        return jsonify({'query': [], 'results': results})

    user_token_set = set(user_tokens)
    ranked = []
    for r in RECIPES:
        if not r['tokens']:
            continue
        overlap = r['tokens'].intersection(user_token_set)
        if not overlap:
            continue
        score = len(overlap)
        match_percent = int(round(100.0 * score / max(1, len(user_token_set))))
        ranked.append({
            'id': r['id'],
            'title': r['title'],
            'match_score': score,
            'match_percent': match_percent,
            'image_url': _resolve_image_url(r.get('image_name'), r['title'], r['tokens']),
            'ingredients_preview': sorted(list(overlap))[:8],
            'instructions_preview': (r.get('instructions') or '').split('\n')[0][:220]
        })

    # Sort alphabetically by title as requested
    ranked.sort(key=lambda x: (x['title'] or '').lower())
    return jsonify({'query': sorted(list(user_token_set)), 'results': ranked[:60]})


def _resolve_image_url(image_name, title: str = "", tokens: set | None = None):
    # Prefer local asset if present
    if image_name:
        # If image_name is already a full URL, use it as-is (original internet image)
        if isinstance(image_name, str) and image_name.startswith(('http://', 'https://')):
            return image_name

        # Otherwise, check for a local image in the project's Food Images folder
        try:
            candidate = os.path.join(FOOD_IMAGES_DIR, image_name)
            if os.path.exists(candidate):
                # Serve via a dedicated route so the frontend can request /images/<filename>
                return f"/images/{image_name}"
        except Exception:
            pass

        # Next, fall back to the project's static img folder if present
        local_path = os.path.join('static', 'img', image_name)
        if os.path.exists(local_path):
            return f"/static/img/{image_name}"
    # Use a featured Unsplash image by semantic query (no API key required).
    # Build a concise query from the title and up to 3 ingredient tokens for better relevance.
    query_parts = []
    if title and isinstance(title, str):
        compact_title = re.sub(r"[^a-z0-9\s]+", "", title.lower()).strip()
        if compact_title:
            # Use the most significant words from the title
            title_words = compact_title.split()
            query_parts.extend(title_words[:5])
    if tokens:
        sample = list(tokens)[:3]
        # tokens are already lowercase from loader
        query_parts.extend(sample)

    if query_parts:
        # Join with commas to give Unsplash multiple keywords; include a short randomizing suffix
        query = ",".join(query_parts)
        # Append the image_name slug as an additional keyword if available (helps specificity)
        if image_name and not image_name.startswith(('http://', 'https://')):
            slug = re.sub(r"[^a-z0-9\s-]+", "", str(image_name).lower()).replace(' ', '-')
            query = f"{query},{slug}"
        return f"https://source.unsplash.com/featured/800x600/?{query}"

    return _placeholder_image()


@app.route('/images/<path:filename>')
def serve_image(filename: str):
    """Serve an image from the workspace 'Food Images/Food Images' directory.

    This keeps the original dataset images available at /images/<filename> and
    prevents having to copy files into the static/ folder.
    """
    # Ensure the file exists and is served from the expected directory
    images_dir = FOOD_IMAGES_DIR
    if not os.path.exists(os.path.join(images_dir, filename)):
        # Let Flask handle 404 for missing files
        return ('', 404)
    return send_from_directory(images_dir, filename)


def _placeholder_image():
    # Elegant food-related placeholder
    return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&q=80&auto=format&fit=crop'


@app.route('/api/recipe/<int:rid>', methods=['GET'])
def api_recipe_detail(rid: int):
    # Optional: compute match against current query
    query = request.args.get('ingredients', '')
    user_tokens = set([_normalize_token(tok) for tok in query.split(',') if _normalize_token(tok)])
    recipe = next((r for r in RECIPES if r['id'] == rid), None)
    if not recipe:
        return jsonify({'error': 'Not found'}), 404
    overlap = recipe['tokens'].intersection(user_tokens) if user_tokens else set()
    match_percent = int(round(100.0 * len(overlap) / max(1, len(user_tokens)))) if user_tokens else None
    return jsonify({
        'id': recipe['id'],
        'title': recipe['title'],
        'image_url': _resolve_image_url(recipe.get('image_name'), recipe['title'], recipe['tokens']),
        'ingredients_text': recipe.get('ingredients_text') or '',
        'instructions': recipe.get('instructions') or '',
        'matched_ingredients': sorted(list(overlap)),
        'match_percent': match_percent
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    # Allow turning debug mode on/off via FLASK_DEBUG env var. When running directly
    # we disable the Werkzeug auto-reloader to avoid loading the large dataset twice
    # which can slow startup and sometimes trigger interrupts in constrained shells.
    flask_debug = os.environ.get('FLASK_DEBUG', 'True').lower() in ('1', 'true', 'yes')
    app.run(host='0.0.0.0', port=port, debug=flask_debug, use_reloader=False)
