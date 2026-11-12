import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { recipeApi, favoriteApi } from '../api';
import { scaleIngredient } from '../utils/servings';
import Navbar from '../components/Navbar';
import { ErrorState } from '../components/Skeleton';

export default function RecipeDetails() {
  const { id } = useParams();
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [servings, setServings] = useState(2);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favErr, setFavErr] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const d = await recipeApi.get(id);
      setRecipe(d.recipe);
      setServings(d.recipe.servings || 2);
      setErr('');
    }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]);

  // Favorite state: the list endpoint is the source of truth for "is this saved?".
  useEffect(() => {
    favoriteApi.list({ limit: 100 })
      .then((d) => setIsFavorite((d.favorites || []).some((f) => String(f.recipe?._id || f.recipe) === String(id))))
      .catch(() => {});
  }, [id]);

  const toggleFavorite = async () => {
    setFavErr('');
    try {
      if (isFavorite) { await favoriteApi.removeByRecipe(id); setIsFavorite(false); }
      else { await favoriteApi.create({ recipeId: id }); setIsFavorite(true); }
    } catch (e) { setFavErr(e.message); }
  };

  const fallback = `https://picsum.photos/seed/mealmate-${encodeURIComponent(recipe?.title || id)}/1200/800`;
  const total = recipe ? (recipe.preparationTime || 0) + (recipe.cookingTime || 0) : 0;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Link to="/discover" className="text-sm font-medium text-brand-700">← Back to recipes</Link>
        {loading && <p className="mt-6 text-slate-500">Loading recipe…</p>}
        {err && !loading && <div className="mt-6"><ErrorState message={err} onRetry={load} /></div>}
        {recipe && (
          <article className="mt-6">
            <img
              src={recipe.image || fallback} alt={recipe.title}
              className="h-72 w-full rounded-2xl object-cover sm:h-96"
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = fallback; }}
            />
            <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
              <h1 className="text-3xl font-bold text-slate-900">{recipe.title}</h1>
              <button
                type="button"
                onClick={toggleFavorite}
                className={`rounded-lg px-4 py-2 text-sm font-semibold shadow ${
                  isFavorite ? 'bg-red-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-300'
                }`}
              >
                {isFavorite ? '♥ Saved to favorites' : '♡ Save to favorites'}
              </button>
            </div>
            {favErr && <p className="mt-2 text-sm text-red-700" role="alert">{favErr}</p>}
            <p className="mt-2 text-slate-600">{recipe.description}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-900 ring-1 ring-amber-100">⏱ {total} min total ({recipe.preparationTime} prep + {recipe.cookingTime} cook)</span>
              <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-900 ring-1 ring-amber-100">👥 {recipe.servings} servings</span>
              {recipe.cuisine && <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-900 ring-1 ring-amber-100">{recipe.cuisine}</span>}
              {(recipe.mealTypes || []).map((m) => <span key={m} className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-900 ring-1 ring-amber-100">{m}</span>)}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(recipe.dietaryTags || []).map((t) => <span key={t} className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{t}</span>)}
            </div>

            <section className="mt-8 rounded-2xl border border-slate-200/80 shadow-sm bg-white p-5">
              <h2 className="font-semibold text-slate-900">Nutrition (per serving)</h2>
              {recipe.nutrition && recipe.nutrition.calories != null ? (
                <p className="mt-2 text-sm text-slate-600">
                  {recipe.nutrition.calories} kcal · Protein {recipe.nutrition.protein ?? '—'}g · Carbs {recipe.nutrition.carbohydrates ?? '—'}g · Fat {recipe.nutrition.fat ?? '—'}g
                </p>
              ) : (
                <p className="mt-2 text-sm text-slate-500">Nutrition not available for this recipe yet.</p>
              )}
              <h2 className="mt-5 font-semibold text-slate-900">Allergens</h2>
              <p className="mt-1 text-sm text-slate-600">
                {(recipe.allergens && recipe.allergens.length) ? recipe.allergens.join(', ') : 'No allergens listed for this recipe — always check the full ingredient list.'}
              </p>
            </section>

            <section className="mt-6 rounded-2xl border border-slate-200/80 shadow-sm bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold text-slate-900">Ingredients (for {servings} serving{servings === 1 ? '' : 's'})</h2>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  Servings
                  <button type="button" aria-label="Decrease servings" disabled={servings <= 1} onClick={() => setServings((s) => Math.max(1, s - 1))} className="rounded-lg border border-slate-300 px-2 py-1 disabled:opacity-50">−</button>
                  <input
                    type="number" min="1" max="20" value={servings}
                    onChange={(e) => setServings(Math.min(20, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                    className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center" aria-label="Servings"
                  />
                  <button type="button" aria-label="Increase servings" disabled={servings >= 20} onClick={() => setServings((s) => Math.min(20, s + 1))} className="rounded-lg border border-slate-300 px-2 py-1 disabled:opacity-50">+</button>
                </label>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Quantities scale with servings (original recipe: {recipe.servings} servings).
                Nutrition above is per serving, so it does not change.
              </p>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {(recipe.ingredients || []).map((ing, i) => {
                  const scaled = scaleIngredient(ing, recipe.servings, servings);
                  return (
                    <li key={i} className="flex justify-between gap-4 border-b border-slate-100 pb-2 last:border-0">
                      <span>{ing.name}{ing.note ? ` — ${ing.note}` : ''}{ing.required === false ? ' (optional)' : ''}</span>
                      <span className="whitespace-nowrap font-medium">
                        {scaled.displayQuantity != null ? `${scaled.displayQuantity} ${ing.unit}`.trim() : 'to taste'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="mt-6 rounded-2xl border border-slate-200/80 shadow-sm bg-white p-5">
              <h2 className="font-semibold text-slate-900">Instructions</h2>
              <ol className="mt-3 space-y-3 text-sm text-slate-700">
                {(recipe.instructions || []).map((step, i) => (
                  <li key={i} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{i + 1}</span><span>{step}</span></li>
                ))}
              </ol>
            </section>

            {recipe.sourceUrl && (
              <p className="mt-6 text-sm"><a href={recipe.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-brand-700">View original source →</a></p>
            )}
          </article>
        )}
      </main>
    </div>
  );
}
