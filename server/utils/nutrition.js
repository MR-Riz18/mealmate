/**
 * Per-day nutrition summaries for a meal plan — Phase 3.
 *
 * SCALING RULE: stored nutrition is PER SERVING (see RecipeCard /
 * RecipeDetails, which label it "per serving"). A planned meal therefore
 * contributes storedNutrition × plannedServings for every nutrient —
 * NOT × (plannedServings / recipe.servings). That old factor only made
 * sense if stored nutrition were per whole recipe, which it is not:
 * e.g. a 4-serving recipe at 420 kcal/serving planned for 4 servings is
 * 1680 kcal, not 420. Ingredient quantities, by contrast, ARE per whole
 * recipe, so shopping-list scaling correctly uses planned/recipe — see
 * utils/shopping.js. Do not reintroduce the divided factor here.
 *
 * INCOMPLETE-DATA RULE: a day is flagged incomplete when any planned
 * recipe on that day has no nutrition object, or is missing any of the
 * four nutrients. Missing values are NEVER silently treated as zero in
 * the sense of "complete" — the totals only sum the values that exist,
 * and the response says exactly which recipes/nutrients are missing, so
 * the UI can show the totals as partial.
 */

const NUTRIENTS = ['calories', 'protein', 'carbohydrates', 'fat'];

function computeDaySummaries(meals, recipesById) {
  const summaries = [];
  for (let day = 0; day < 7; day++) {
    const dayMeals = meals.filter((m) => m.day === day);
    const totals = { calories: 0, protein: 0, carbohydrates: 0, fat: 0 };
    const missingRecipes = [];
    const missingNutrients = new Set();
    let hasMeals = dayMeals.length > 0;

    for (const meal of dayMeals) {
      // meal.recipe may already be a populated document (planner responses)
      // or a bare ObjectId (unpopulated meals) — handle both.
      const recipe = meal.recipe && meal.recipe.ingredients
        ? meal.recipe
        : recipesById.get(String(meal.recipe && meal.recipe._id ? meal.recipe._id : meal.recipe));
      if (!recipe) {
        missingRecipes.push('Unknown recipe');
        continue;
      }
      const factor = meal.servings || recipe.servings || 1; // per-serving nutrition × servings planned
      const nut = recipe.nutrition;
      if (!nut) {
        missingRecipes.push(recipe.title);
        NUTRIENTS.forEach((n) => missingNutrients.add(n));
        continue;
      }
      for (const n of NUTRIENTS) {
        if (nut[n] == null) {
          missingNutrients.add(n);
          if (!missingRecipes.includes(recipe.title)) missingRecipes.push(recipe.title);
        } else {
          totals[n] += nut[n] * factor;
        }
      }
    }

    // Round totals to 1 decimal place for display.
    for (const n of NUTRIENTS) totals[n] = Math.round(totals[n] * 10) / 10;

    summaries.push({
      day,
      hasMeals,
      mealCount: dayMeals.length,
      totals,
      incomplete: missingRecipes.length > 0,
      missingRecipes,
      missingNutrients: [...missingNutrients],
    });
  }
  return summaries;
}

module.exports = { NUTRIENTS, computeDaySummaries };
