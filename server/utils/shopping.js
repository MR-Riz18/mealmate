/**
 * Shopping-list generation — Phase 3.
 *
 * COMBINING RULE: ingredients combine ONLY when their normalised name
 * and normalised unit are identical (e.g. grams with grams). Differing
 * units (grams vs cups, ml vs tbsp, …) are NEVER auto-converted and
 * stay as separate lines, because no reliable conversion data exists
 * for arbitrary ingredients. Quantities scale by
 * plannedServings / recipe.servings — correct here because ingredient
 * quantities are per whole recipe (unlike nutrition, which is per
 * serving, so planner totals use plannedServings alone). Ingredients
 * with no quantity keep a null quantity and are
 * grouped together (one line, no amount) rather than summed.
 *
 * REGENERATION RULE (used by the controller): a regenerated list keeps
 * every manual item unchanged, keeps the checked state of any auto item
 * that still exists (same normalised name + unit), drops auto items no
 * longer in the plan, and adds new auto items unchecked.
 *
 * CATEGORY MAPPING: a documented keyword list, checked in order. The
 * first matching category wins, so e.g. "chicken breast" is meat even
 * though it also appears in no other list. Anything unmatched is
 * "other". This is deliberately simple and transparent — Phase 4 can
 * refine it or add pantry detection on top without changing the
 * generation shape.
 */

const { normalizeIngredient, ingredientMatches } = require('./ingredientMatch');

const CATEGORY_KEYWORDS = [
  ['meat', ['chicken', 'beef', 'lamb', 'pork', 'mince', 'sausage', 'bacon', 'fish', 'salmon', 'tuna', 'prawn', 'shrimp', 'turkey', 'duck', 'ham']],
  ['dairy', ['milk', 'cheese', 'butter', 'yogurt', 'yoghurt', 'cream', 'mozzarella', 'feta', 'cheddar', 'parmesan', 'egg', 'ghee']],
  ['produce', ['tomato', 'onion', 'garlic', 'ginger', 'potato', 'carrot', 'cucumber', 'lettuce', 'pepper', 'chilli', 'chili', 'coriander', 'parsley', 'mint', 'basil', 'lemon', 'lime', 'avocado', 'mushroom', 'spinach', 'cabbage', 'cauliflower', 'broccoli', 'aubergine', 'eggplant', 'courgette', 'zucchini', 'celery', 'leek', 'spring onion', 'banana', 'apple', 'orange', 'berry', 'berries', 'grape', 'mango', 'peach', 'pear', 'melon', 'salad', 'herb', 'fruit', 'vegetable']],
  ['grains', ['rice', 'pasta', 'spaghetti', 'penne', 'noodle', 'flour', 'oat', 'bread', 'tortilla', 'pita', 'dough', 'couscous', 'quinoa', 'barley', 'bulgur', 'wrap']],
  ['pantry', ['oil', 'salt', 'sugar', 'spice', 'masala', 'sauce', 'vinegar', 'honey', 'syrup', 'tahini', 'peanut butter', 'stock', 'paste', 'seasoning', 'cumin', 'turmeric', 'paprika', 'oregano', 'cinnamon', 'cardamom', 'clove', 'bay leaf', 'mustard', 'mayonnaise', 'ketchup', 'salsa', 'chocolate', 'cocoa', 'coffee', 'tea']],
];

function normalizeName(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeUnit(unit) {
  return String(unit || '').trim().toLowerCase();
}

function categorize(name) {
  const n = normalizeName(name);
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    for (const kw of keywords) {
      // Match on word boundaries, tolerating simple plurals: "chicken"
      // matches "chicken breast", "onion" matches "onions", "tomato"
      // matches "tomatoes", and "berry" matches "berries".
      const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const forms = [esc, `${esc}s`, `${esc}es`];
      if (kw.endsWith('y')) forms.push(`${esc.slice(0, -1)}ies`);
      const re = new RegExp(`\\b(?:${forms.join('|')})\\b`);
      if (re.test(n)) return category;
    }
  }
  return 'other';
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

/**
 * Build auto shopping items from a populated meal plan.
 * plan.meals: [{ recipe (populated doc or id), servings }]
 * recipesById: Map id -> recipe doc (used when meals are not populated).
 */
function generateAutoItems(meals, recipesById) {
  const grouped = new Map(); // key -> item
  const order = [];
  for (const meal of meals) {
    const recipe = meal.recipe && meal.recipe.ingredients ? meal.recipe : recipesById.get(String(meal.recipe));
    if (!recipe) continue;
    const factor = (meal.servings || recipe.servings || 1) / (recipe.servings || 1);
    for (const ing of recipe.ingredients || []) {
      const name = String(ing.name || '').trim();
      if (!name) continue;
      const unit = normalizeUnit(ing.unit);
      const hasQty = ing.quantity != null;
      const key = `${normalizeName(name)}|${unit}|${hasQty ? 'q' : 'none'}`;
      if (!grouped.has(key)) {
        const item = {
          name,
          quantity: hasQty ? round2(ing.quantity * factor) : null,
          unit: ing.unit || '',
          category: categorize(name),
          checked: false,
          manual: false,
          sources: [recipe.title],
        };
        grouped.set(key, item);
        order.push(key);
      } else {
        const item = grouped.get(key);
        if (hasQty) item.quantity = round2(item.quantity + ing.quantity * factor);
        if (!item.sources.includes(recipe.title)) item.sources.push(recipe.title);
      }
    }
  }
  return order.map((k) => grouped.get(k));
}

/**
 * Merge freshly generated auto items into an existing item list.
 * Manual items are preserved verbatim and in their original order.
 * Auto items that still exist (same name + unit) keep their checked
 * state; dropped auto items disappear; new auto items are unchecked.
 */
function mergeRegeneratedItems(existingItems, newAutoItems) {
  const manual = existingItems.filter((i) => i.manual);
  const existingAuto = new Map();
  for (const item of existingItems.filter((i) => !i.manual)) {
    existingAuto.set(`${normalizeName(item.name)}|${normalizeUnit(item.unit)}`, item);
  }
  const mergedAuto = newAutoItems.map((item) => {
    const key = `${normalizeName(item.name)}|${normalizeUnit(item.unit)}`;
    const kept = existingAuto.get(key);
    if (kept) {
      return { ...item, checked: kept.checked };
    }
    return item;
  });
  return [...manual, ...mergedAuto];
}

/**
 * Phase 4 pantry flag: mark each item inPantry when its name matches a
 * pantry item name (same tolerant matching as ingredient search).
 * This is display only — it never removes the line and never subtracts
 * quantities, because the pantry record does not reliably say how much
 * of the item is actually available for this recipe.
 */
function markInPantry(items, pantryNames) {
  const pantry = (pantryNames || []).map((n) => normalizeIngredient(n)).filter(Boolean);
  return (items || []).map((item) => ({
    ...item,
    inPantry: pantry.some((p) => ingredientMatches(p, item.name)),
  }));
}

module.exports = { normalizeName, normalizeUnit, categorize, generateAutoItems, mergeRegeneratedItems, markInPantry, CATEGORY_KEYWORDS };
