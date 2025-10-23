const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const RECIPES_PATH = path.join(__dirname, 'recipes_data.json');
const INDEX_PATH = path.join(__dirname, 'recipes_inverted_index.json');

const recipes = JSON.parse(fs.readFileSync(RECIPES_PATH, 'utf8'));
const inverted = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));

// Helper: recommend by token counts (simple ranking)
function recommend(spices = [], limit = 50) {
  const counts = {};
  const tokens = spices.map(s => s.toLowerCase().trim()).filter(Boolean);
  tokens.forEach(tok => {
    for (const indexToken of Object.keys(inverted)) {
      if (indexToken === tok || indexToken.startsWith(tok)) {
        inverted[indexToken].forEach(rid => {
          counts[rid] = (counts[rid] || 0) + 1;
        });
      }
    }
  });
  const ranked = Object.entries(counts)
    .sort((a,b) => b[1] - a[1])
    .slice(0, limit)
    .map(([rid, score]) => {
      const recipe = recipes.find(r => r.id === Number(rid));
      return {
        id: recipe.id,
        title: recipe.title,
        image_name: recipe.image_name,
        match_score: score,
        ingredients: recipe.ingredients.slice(0, 8)
      };
    });
  return ranked;
}

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Spice & Savor API' });
});

app.get('/api/recipes', (req, res) => {
  const spicesParam = req.query.spices || '';
  const spices = spicesParam.split(',').map(s => s.trim()).filter(Boolean);
  if (spices.length === 0) {
    return res.status(400).json({ error: 'Provide spices as comma-separated query: ?spices=cumin,turmeric' });
  }
  const results = recommend(spices, 100);
  res.json({ query: spices, results });
});

// Simple recipe by id endpoint
app.get('/api/recipe/:id', (req, res) => {
  const id = Number(req.params.id);
  const recipe = recipes.find(r => r.id === id);
  if (!recipe) return res.status(404).json({ error: 'Not found' });
  res.json(recipe);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Spice & Savor API running on http://localhost:${PORT}`));