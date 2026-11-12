/**
 * Optional external recipe provider (Spoonacular-compatible).
 * Disabled when RECIPE_API_KEY is unset — the app then uses only the
 * seeded local recipes. Any failure (timeout, quota, network) returns
 * null so the caller falls back to local recipes. No key is ever sent
 * to the frontend; this module runs only on the backend.
 */
const TIMEOUT_MS = 5000;

function isExternalEnabled() {
  return Boolean(process.env.RECIPE_API_KEY);
}

function stripHtml(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function mapExternalRecipe(r) {
  const instructions = [];
  if (Array.isArray(r.analyzedInstructions)) {
    for (const block of r.analyzedInstructions) {
      for (const step of block.steps || []) instructions.push(step.step);
    }
  }
  if (!instructions.length && r.instructions) {
    instructions.push(...String(r.instructions).split(/\n+/).map((s) => s.trim()).filter(Boolean));
  }
  const nutrients = {};
  if (r.nutrition && Array.isArray(r.nutrition.nutrients)) {
    for (const n of r.nutrition.nutrients) {
      const key = String(n.name || '').toLowerCase();
      if (key === 'calories') nutrients.calories = n.amount;
      if (key === 'protein') nutrients.protein = n.amount;
      if (key === 'carbohydrates') nutrients.carbohydrates = n.amount;
      if (key === 'fat') nutrients.fat = n.amount;
    }
  }
  return {
    _id: `ext-${r.id}`,
    title: r.title,
    description: stripHtml(r.summary).slice(0, 300),
    image: r.image || '',
    ingredients: (r.extendedIngredients || []).map((ing) => ({
      name: ing.name, quantity: ing.amount ?? null, unit: ing.unit || '', required: true, note: '',
    })),
    instructions,
    preparationTime: 0,
    cookingTime: r.readyInMinutes || 0,
    totalTime: r.readyInMinutes || 0,
    servings: r.servings || 2,
    cuisine: (r.cuisines && r.cuisines[0]) || '',
    mealTypes: r.dishTypes || [],
    dietaryTags: r.diets || [],
    allergens: [],
    nutrition: Object.keys(nutrients).length ? nutrients : null,
    sourceUrl: r.sourceUrl || '',
    externalRecipeId: String(r.id),
    isExternal: true,
  };
}

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`External API responded ${res.status}`);
  return res.json();
}

async function searchExternalRecipes({ q, cuisine, dietary, maxTime, page, limit }) {
  if (!isExternalEnabled()) return null;
  try {
    const params = new URLSearchParams({
      apiKey: process.env.RECIPE_API_KEY,
      addRecipeInformation: 'true',
      fillIngredients: 'true',
      number: String(limit || 12),
      offset: String(((page || 1) - 1) * (limit || 12)),
    });
    if (q) params.set('query', q);
    if (cuisine) params.set('cuisine', cuisine);
    if (dietary) params.set('diet', dietary);
    if (maxTime) params.set('maxReadyTime', String(maxTime));
    const data = await fetchJson(`https://api.spoonacular.com/recipes/complexSearch?${params}`);
    if (!data || !Array.isArray(data.results) || !data.results.length) return null;
    return { recipes: data.results.map(mapExternalRecipe), total: data.totalResults || data.results.length };
  } catch {
    return null; // caller falls back to local seeded recipes
  }
}

async function getExternalRecipe(externalId) {
  if (!isExternalEnabled()) return null;
  try {
    const data = await fetchJson(
      `https://api.spoonacular.com/recipes/${externalId}/information?apiKey=${process.env.RECIPE_API_KEY}&includeNutrition=true`
    );
    return mapExternalRecipe(data);
  } catch {
    return null;
  }
}

module.exports = { isExternalEnabled, searchExternalRecipes, getExternalRecipe };
