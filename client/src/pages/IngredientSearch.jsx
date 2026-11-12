import { useState } from 'react';
import { recipeApi, favoriteApi } from '../api';
import Navbar from '../components/Navbar';
import RecipeCard from '../components/RecipeCard';
import { CardSkeleton, ErrorState } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

const inputCls = 'field';

export default function IngredientSearch() {
  const [draft, setDraft] = useState('');
  const [ingredients, setIngredients] = useState([]);
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [searched, setSearched] = useState(false);
  const [sort, setSort] = useState('match');
  const [favoriteIds, setFavoriteIds] = useState(new Set());

  const addIngredient = () => {
    const value = draft.trim().toLowerCase();
    if (!value) return;
    const parts = value.split(',').map((s) => s.trim()).filter(Boolean);
    setIngredients((prev) => [...prev, ...parts.filter((p) => !prev.includes(p))]);
    setDraft('');
  };

  const search = async (list = ingredients, sortValue = sort) => {
    if (!list.length) { setErr('Add at least one ingredient first.'); return; }
    setLoading(true); setErr('');
    try {
      const d = await recipeApi.byIngredients({ ingredients: list.join(','), sort: sortValue, limit: 50 });
      setResults(d.recipes || []);
      setTotal(d.total || 0);
      setSearched(true);
      const favs = await favoriteApi.list({ limit: 100 }).catch(() => ({ favorites: [] }));
      setFavoriteIds(new Set((favs.favorites || []).map((f) => String(f.recipe?._id || f.recipe))));
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (recipe) => {
    const id = String(recipe._id);
    try {
      if (favoriteIds.has(id)) {
        await favoriteApi.removeByRecipe(id);
        setFavoriteIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      } else {
        await favoriteApi.create({ recipeId: id });
        setFavoriteIds((prev) => new Set(prev).add(id));
      }
    } catch (e) { setErr(e.message); }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Cook with what you have</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter ingredients you already have, separated by commas. We match them against each
          recipe&apos;s required ingredients — optional ingredients never count as missing, and a
          recipe is only called a perfect match when you have everything it requires.
        </p>

        <div className="mt-6 rounded-2xl border border-slate-200/80 shadow-sm bg-white p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              placeholder="e.g. eggs, tomatoes, onions"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addIngredient(); } }}
              className={inputCls} aria-label="Add ingredient"
            />
            <button type="button" onClick={addIngredient} className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">Add</button>
            <select value={sort} onChange={(e) => { setSort(e.target.value); if (searched) search(ingredients, e.target.value); }} className={inputCls} aria-label="Sort ingredient results">
              <option value="match">Sort: best match first</option>
              <option value="fewest-missing">Sort: fewest missing first</option>
            </select>
            <button type="button" onClick={() => search()} className="btn-primary">Find recipes</button>
          </div>
          {ingredients.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {ingredients.map((ing) => (
                <button key={ing} type="button" onClick={() => setIngredients((prev) => prev.filter((x) => x !== ing))} title="Remove ingredient" aria-label={`Remove ${ing}`} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                  {ing} ✕
                </button>
              ))}
              <button type="button" onClick={() => { setIngredients([]); setResults([]); setSearched(false); }} className="text-xs font-medium text-slate-500 underline">Clear all</button>
            </div>
          )}
        </div>

        {err && <div className="mt-4"><ErrorState message={err} onRetry={() => search()} /></div>}
        {loading ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : searched && results.length === 0 ? (
          <div className="mt-4"><EmptyState title="No recipes matched" message="Try fewer or more common ingredients." /></div>
        ) : searched ? (
          <>
            <p className="mt-6 text-sm text-slate-500">{total} recipe{total === 1 ? '' : 's'} ranked by ingredient match</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {results.map((r) => (
                <RecipeCard
                  key={r._id} recipe={r} match={r.match}
                  isFavorite={favoriteIds.has(String(r._id))}
                  onToggleFavorite={() => toggleFavorite(r)}
                />
              ))}
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
