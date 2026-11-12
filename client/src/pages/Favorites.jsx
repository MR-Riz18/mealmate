import { useCallback, useEffect, useState } from 'react';
import { favoriteApi } from '../api';
import Navbar from '../components/Navbar';
import RecipeCard from '../components/RecipeCard';
import { CardSkeleton, ErrorState } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

const inputCls = 'field';
const DIETARY = ['vegetarian', 'vegan', 'halal-friendly', 'gluten-free', 'dairy-free', 'high-protein'];
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snacks'];

export default function Favorites() {
  const [favorites, setFavorites] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [filters, setFilters] = useState({ q: '', dietary: '', mealType: '', collection: '' });
  const [applied, setApplied] = useState({ ...filters });
  const [newCollection, setNewCollection] = useState('');
  const [renaming, setRenaming] = useState({});

  const load = useCallback(async (params) => {
    setLoading(true);
    try {
      const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null));
      const [favData, colData] = await Promise.all([
        favoriteApi.list({ ...clean, limit: 50 }),
        favoriteApi.collections(),
      ]);
      setFavorites(favData.favorites || []);
      setCollections(colData.collections || []);
      setErr('');
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(applied); }, [applied, load]);

  const removeFavorite = async (recipeId) => {
    try {
      await favoriteApi.removeByRecipe(recipeId);
      setFavorites((prev) => prev.filter((f) => String(f.recipe?._id) !== String(recipeId)));
    } catch (e) { setErr(e.message); }
  };

  const assign = async (recipeId, collectionId) => {
    try {
      await favoriteApi.assign(recipeId, collectionId || null);
      setNotice('Collection updated.');
      load(applied);
    } catch (e) { setErr(e.message); }
  };

  const createCollection = async (e) => {
    e.preventDefault();
    if (!newCollection.trim()) return;
    try {
      await favoriteApi.createCollection(newCollection.trim());
      setNewCollection('');
      setNotice('Collection created.');
      load(applied);
    } catch (e) { setErr(e.message); }
  };

  const deleteCollection = async (id, name) => {
    if (!window.confirm(`Delete the collection "${name}"? Its recipes stay saved, just without a collection.`)) return;
    try {
      await favoriteApi.deleteCollection(id);
      setNotice('Collection deleted.');
      setFilters((f) => ({ ...f, collection: '' }));
      setApplied((a) => ({ ...a, collection: '' }));
    } catch (e) { setErr(e.message); }
  };

  const renameCollection = async (id) => {
    const name = (renaming[id] || '').trim();
    if (!name) return;
    try {
      await favoriteApi.renameCollection(id, name);
      setRenaming((r) => ({ ...r, [id]: undefined }));
      setNotice('Collection renamed.');
      load(applied);
    } catch (e) { setErr(e.message); }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">My favorites</h1>
        <p className="mt-1 text-sm text-slate-500">Recipes you saved, organised into your own collections.</p>
        {notice && <p className="mt-3 text-sm font-medium text-emerald-700" role="status">{notice}</p>}
        {err && <div className="mt-4"><ErrorState message={err} onRetry={() => load(applied)} /></div>}

        <section className="mt-6 rounded-2xl border border-slate-200/80 shadow-sm bg-white p-4">
          <h2 className="font-semibold text-slate-900">Collections</h2>
          <form onSubmit={createCollection} className="mt-3 flex gap-2">
            <input placeholder="New collection, e.g. Quick Meals" value={newCollection} onChange={(e) => setNewCollection(e.target.value)} className={inputCls} aria-label="New collection name" />
            <button type="submit" className="btn-primary">Create</button>
          </form>
          {collections.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No collections yet — create one above, then assign saved recipes to it.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {collections.map((c) => (
                <li key={c._id} className="flex flex-wrap items-center gap-2 text-sm">
                  <input
                    value={renaming[c._id] ?? c.name}
                    onChange={(e) => setRenaming((r) => ({ ...r, [c._id]: e.target.value }))}
                    className="rounded-lg border border-slate-300 px-2 py-1" aria-label={`Rename ${c.name}`}
                  />
                  <button type="button" onClick={() => renameCollection(c._id)} className="rounded-lg border border-slate-300 px-3 py-1 font-medium text-slate-600">Rename</button>
                  <button type="button" onClick={() => deleteCollection(c._id, c.name)} className="rounded-lg border border-red-200 px-3 py-1 font-medium text-red-700">Delete</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <form
          onSubmit={(e) => { e.preventDefault(); setApplied({ ...filters }); }}
          className="mt-6 grid gap-3 rounded-2xl border border-slate-200/80 shadow-sm bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <input placeholder="Search saved recipes…" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} className={inputCls} aria-label="Search favorites" />
          <select value={filters.dietary} onChange={(e) => setFilters({ ...filters, dietary: e.target.value })} className={inputCls} aria-label="Dietary filter">
            <option value="">Any diet</option>
            {DIETARY.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filters.mealType} onChange={(e) => setFilters({ ...filters, mealType: e.target.value })} className={inputCls} aria-label="Meal type filter">
            <option value="">Any meal type</option>
            {MEAL_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={filters.collection} onChange={(e) => setFilters({ ...filters, collection: e.target.value })} className={inputCls} aria-label="Collection filter">
            <option value="">All collections</option>
            <option value="none">No collection</option>
            {collections.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          <button type="submit" className="btn-primary lg:col-span-4">Filter</button>
        </form>

        {loading ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : favorites.length === 0 ? (
          <div className="mt-4"><EmptyState title="No saved recipes yet" message="Tap the heart on any recipe card to save it here." /></div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {favorites.map((f) => f.recipe && (
              <RecipeCard
                key={f._id}
                recipe={f.recipe}
                isFavorite
                onToggleFavorite={() => removeFavorite(f.recipe._id)}
                collectionSlot={(
                  <label className="mt-3 block text-xs text-slate-500">
                    Collection
                    <select
                      value={f.collection?._id || ''}
                      onChange={(e) => assign(f.recipe._id, e.target.value || null)}
                      className="field mt-1 px-2 py-1"
                      aria-label={`Collection for ${f.recipe.title}`}
                    >
                      <option value="">No collection</option>
                      {collections.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                  </label>
                )}
              />
            ))}
          </div>
        )}
        <p className="mt-8 text-xs text-slate-400">
          Dietary tags are search filters, not certifications — they do not mean a recipe is
          certified halal or allergen-free. Always check the full ingredient list.
        </p>
      </main>
    </div>
  );
}
