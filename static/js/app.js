// Simple multi-step flow and recipe generation mock to resemble provided screenshots

const COMMON_SPICES = [
  'Salt','Black Pepper','Garlic Powder','Onion Powder','Paprika','Cumin','Oregano','Basil','Thyme','Rosemary','Cinnamon','Ginger'
];

const COMMON_VEG = [
  'Onions','Garlic','Tomatoes','Bell Peppers','Carrots','Celery','Potatoes','Mushrooms','Spinach','Broccoli','Cauliflower','Zucchini'
];

const state = {
  spices: [],
  vegetables: []
};

function showStep(id) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('step-active'));
  document.getElementById(id).classList.add('step-active');
}

function addChip(container, label, onClick) {
  const chip = document.createElement('button');
  chip.className = 'chip';
  chip.type = 'button';
  chip.textContent = label;
  chip.addEventListener('click', onClick);
  container.appendChild(chip);
}

function renderQuickAdds() {
  const spiceQuick = document.getElementById('spice-quick');
  const vegQuick = document.getElementById('veg-quick');
  spiceQuick.innerHTML = '';
  vegQuick.innerHTML = '';
  COMMON_SPICES.forEach(s => addChip(spiceQuick, s, () => {
    // On tap, put into the spice input for confirmation and also add directly
    const spiceInput = document.getElementById('spice-input');
    spiceInput.value = s;
    addItem('spices', s);
  }));
  COMMON_VEG.forEach(v => addChip(vegQuick, v, () => {
    const vegInput = document.getElementById('veg-input');
    vegInput.value = v;
    addItem('vegetables', v);
  }));
}

function addItem(kind, value) {
  const list = kind === 'spices' ? state.spices : state.vegetables;
  const val = String(value || '').trim();
  if (!val) return;
  const exists = list.some(x => x.toLowerCase() === val.toLowerCase());
  if (!exists) list.push(val);
  updateReview();
}

function updateReview() {
  const spiceList = document.getElementById('spice-list');
  const spiceSelected = document.getElementById('spice-selected');
  const vegList = document.getElementById('veg-list');
  const vegSelected = document.getElementById('veg-selected');
  const spiceCount = document.getElementById('spice-count');
  const vegCount = document.getElementById('veg-count');
  const totalCount = document.getElementById('total-count');
  spiceList.innerHTML = '';
  if (spiceSelected) spiceSelected.innerHTML = '';
  vegList.innerHTML = '';
  if (vegSelected) vegSelected.innerHTML = '';
  state.spices.forEach(s => {
    addChip(spiceList, s, () => {});
    if (spiceSelected) addChip(spiceSelected, s, () => {});
  });
  state.vegetables.forEach(v => {
    addChip(vegList, v, () => {});
    if (vegSelected) addChip(vegSelected, v, () => {});
  });
  spiceCount.textContent = String(state.spices.length);
  vegCount.textContent = String(state.vegetables.length);
  totalCount.textContent = String(state.spices.length + state.vegetables.length);
}

function wireInputs() {
  const spiceInput = document.getElementById('spice-input');
  const vegInput = document.getElementById('veg-input');
  document.getElementById('add-spice').addEventListener('click', () => { addItem('spices', spiceInput.value); spiceInput.value=''; });
  document.getElementById('add-veg').addEventListener('click', () => { addItem('vegetables', vegInput.value); vegInput.value=''; });
  spiceInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { addItem('spices', spiceInput.value); spiceInput.value=''; }});
  vegInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { addItem('vegetables', vegInput.value); vegInput.value=''; }});
}

function wireNav() {
  document.querySelectorAll('[data-next]').forEach(btn => {
    btn.addEventListener('click', () => showStep(btn.dataset.next));
  });
  document.querySelectorAll('[data-prev]').forEach(btn => {
    btn.addEventListener('click', () => showStep(btn.dataset.prev));
  });
  document.getElementById('restart').addEventListener('click', () => {
    state.spices = [];
    state.vegetables = [];
    updateReview();
    renderQuickAdds();
    showStep('step-landing');
  });
}

function sampleRecipesFromQuery(query) {
  // Placeholder results that look like the screenshots; normally call backend
  const titles = [
    'Mediterranean Quinoa Salad',
    'Garlic Herb Roasted Salmon',
    'Hearty Lentil Soup'
  ];
  const desc = [
    'A refreshing salad with vibrant vegetables and a lemon-herb dressing.',
    'Salmon roasted with garlic, herbs, and a hint of lemon.',
    'Comforting and nutritious soup, packed with vegetables and aromatic spices.'
  ];
  return titles.map((t, i) => ({ title: t, image_url: `https://source.unsplash.com/featured/800x600/?${encodeURIComponent(t)}`, instructions_preview: desc[i], match_percent: 0 }));
}

async function generateRecipes() {
  const query = [...state.spices, ...state.vegetables];
  const chips = document.getElementById('query-chips');
  const grid = document.getElementById('recipes');
  chips.innerHTML = '';
  grid.innerHTML = '';
  query.forEach(q => addChip(chips, q.toLowerCase(), () => {}));

  const params = new URLSearchParams({ ingredients: query.join(',') });
  let data;
  try {
    const res = await fetch(`/api/recipes?${params.toString()}`);
    data = await res.json();
  } catch (e) {
    data = { results: sampleRecipesFromQuery(query).map(x => ({ title: x.title, image_url: x.img, instructions_preview: x.desc, match_percent: 0 })) };
  }
  let results = (data.results || []);
  // If the user provided ingredients (a search), sort by match_percent desc so highest matches appear first
  if (query.length > 0) {
    results = results.slice().sort((a, b) => {
      const ma = typeof a.match_percent === 'number' ? a.match_percent : 0;
      const mb = typeof b.match_percent === 'number' ? b.match_percent : 0;
      if (mb !== ma) return mb - ma; // descending
      // tie-breaker: title alphabetical
      return String(a.title || '').localeCompare(String(b.title || ''));
    });
  }

  results.forEach(r => {
    const card = document.createElement('article');
    card.className = 'recipe-card';
    const img = document.createElement('img');
    img.className = 'recipe-img';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.alt = r.title;
    const fallback = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&q=80&auto=format&fit=crop';
    img.onerror = () => { if (img.src !== fallback) img.src = fallback; };
    img.src = r.image_url || fallback;
    const body = document.createElement('div');
    body.className = 'recipe-body';
    const h = document.createElement('div');
    h.className = 'recipe-title';
    h.textContent = r.title;
    const p = document.createElement('div');
    p.className = 'recipe-desc';
    p.textContent = (r.instructions_preview || '').trim() || 'A delicious recipe tailored to your ingredients.';
    const meta = document.createElement('div');
    meta.style.marginTop = '6px';
    meta.style.color = '#ffffff';
    meta.style.fontSize = '12px';
    meta.textContent = r.match_percent != null ? `Match: ${r.match_percent}%` : '';
    body.appendChild(h);
    body.appendChild(p);
    body.appendChild(meta);
    // Add match badge if available
    if (r.match_percent != null) {
      const badge = document.createElement('div');
      badge.className = 'match-badge';
      badge.textContent = `${r.match_percent}%`;
      card.appendChild(badge);
    }
    card.appendChild(img);
    card.appendChild(body);
    card.addEventListener('click', () => openDetail(r.id, query));
    grid.appendChild(card);
  });
  showStep('step-results');
}

function wireGenerate() {
  document.getElementById('generate').addEventListener('click', () => generateRecipes());
  // hero search removed from homepage; keep other handlers intact
  const allBtn = document.getElementById('all-recipes');
  if (allBtn) {
    allBtn.addEventListener('click', async () => {
      // Clear selection and fetch all recipes A→Z
      state.spices = [];
      state.vegetables = [];
      updateReview();
      const grid = document.getElementById('recipes');
      const chips = document.getElementById('query-chips');
      if (chips) chips.innerHTML = '';
      if (grid) grid.innerHTML = '';
      try {
        const res = await fetch('/api/recipes');
        const data = await res.json();
        (data.results || []).forEach(r => {
          const card = document.createElement('article');
          card.className = 'recipe-card';
          const img = document.createElement('img');
          img.className = 'recipe-img';
          img.loading = 'lazy';
          img.alt = r.title;
          const fallback = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&q=80&auto=format&fit=crop';
          img.onerror = () => { if (img.src !== fallback) img.src = fallback; };
          img.src = r.image_url || fallback;
          const body = document.createElement('div');
          body.className = 'recipe-body';
          const h = document.createElement('div');
          h.className = 'recipe-title';
          h.textContent = r.title;
          const p = document.createElement('div');
          p.className = 'recipe-desc';
          p.textContent = (r.instructions_preview || '').trim() || 'A delicious recipe tailored to your ingredients.';
          body.appendChild(h);
          body.appendChild(p);
          // Add match badge if available
          if (r.match_percent != null) {
            const badge = document.createElement('div');
            badge.className = 'match-badge';
            badge.textContent = `${r.match_percent}%`;
            card.appendChild(badge);
          }
          card.appendChild(img);
          card.appendChild(body);
          card.addEventListener('click', () => openDetail(r.id, []));
          grid.appendChild(card);
        });
        showStep('step-results');
      } catch (e) {
        console.error(e);
      }
    });
  }
}

async function openDetail(recipeId, queryArr) {
  const params = new URLSearchParams({ ingredients: (queryArr || []).join(',') });
  const res = await fetch(`/api/recipe/${recipeId}?${params.toString()}`);
  const d = await res.json();
  // Populate detail
  const img = document.getElementById('detail-img');
  const title = document.getElementById('detail-title');
  const sub = document.getElementById('detail-sub');
  const matchPct = document.getElementById('detail-match-pct');
  const matchFill = document.getElementById('detail-match-fill');
  const matched = document.getElementById('detail-matched');
  const ing = document.getElementById('detail-ingredients');
  const ins = document.getElementById('detail-instructions');
  img.src = d.image_url || '';
  img.alt = d.title || 'Recipe image';
  title.textContent = d.title || 'Recipe';
  sub.textContent = 'An aromatic and hearty dish based on your selected ingredients.';
  matched.innerHTML = '';
  (d.matched_ingredients || []).forEach(x => addChip(matched, x, () => {}));
  const pct = typeof d.match_percent === 'number' ? `${d.match_percent}%` : '';
  matchPct.textContent = pct;
  matchFill.style.width = typeof d.match_percent === 'number' ? `${d.match_percent}%` : '0%';
  // Format ingredients: detect Python-style list or separated items and render as a bullet list
  const rawIng = (d.ingredients_text || '').trim();
  function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  let ingHtml = '';
  if (/^\[.*\]$/.test(rawIng) && /'/.test(rawIng)) {
    // Extract items enclosed in single quotes: 'item'
    const items = [];
    const re = /'([^']+)'/g;
    let m;
    while ((m = re.exec(rawIng)) !== null) {
      items.push(m[1].trim());
    }
    if (items.length) {
      ingHtml = '<ul class="ingredient-list">' + items.map(i => '<li>' + escapeHtml(i) + '</li>').join('') + '</ul>';
    }
  }
  if (!ingHtml) {
    // Fallback: split on newlines, semicolons, or commas (prefer line/semicolon)
    let parts = [];
    if (rawIng.includes('\n')) parts = rawIng.split(/\n+/);
    else if (rawIng.includes(';')) parts = rawIng.split(/;+/);
    else if (rawIng.includes(',')) parts = rawIng.split(/,+/);
    parts = parts.map(p => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      ingHtml = '<ul class="ingredient-list">' + parts.map(i => '<li>' + escapeHtml(i) + '</li>').join('') + '</ul>';
    } else {
      // Single paragraph
      ingHtml = '<div class="ingredient-paragraph">' + escapeHtml(rawIng) + '</div>';
    }
  }
  ing.innerHTML = ingHtml;

  // Format instructions into readable paragraphs (split by blank lines or numbered steps)
  const rawIns = (d.instructions || '').trim();
  let insHtml = '';
  if (rawIns) {
    // Try to split on double newlines for paragraphs, otherwise single newlines
    let parts = rawIns.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
    if (parts.length <= 1) parts = rawIns.split(/\n+/).map(s => s.trim()).filter(Boolean);
    // If looks like numbered steps (1. 2. etc), keep ordering
    const isNumbered = parts.every(p => /^\d+\./.test(p));
    if (isNumbered) {
      insHtml = '<ol class="instruction-list">' + parts.map(p => '<li>' + escapeHtml(p.replace(/^\d+\.\s*/, '')) + '</li>').join('') + '</ol>';
    } else {
      insHtml = parts.map(p => '<p class="instruction-paragraph">' + escapeHtml(p) + '</p>').join('');
    }
  }
  ins.innerHTML = insHtml;
  showStep('step-detail');
  document.getElementById('back-to-results').onclick = () => showStep('step-results');
}

// init
renderQuickAdds();
wireInputs();
wireNav();
wireGenerate();
updateReview();

// Also bind top nav "All Recipes"
const navAll = document.getElementById('nav-all-recipes');
if (navAll) {
  navAll.addEventListener('click', (e) => {
    e.preventDefault();
    const btn = document.getElementById('all-recipes');
    if (btn) btn.click();
  });
}

// Auth mocks removed per request
