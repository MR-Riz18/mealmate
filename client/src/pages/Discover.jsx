import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { recipeApi, favoriteApi } from '../api';
import Navbar from '../components/Navbar';
import RecipeCard from '../components/RecipeCard';
import { CardSkeleton, ErrorState } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

const CUISINES = ['Pakistani', 'Italian', 'Mexican', 'Chinese', 'Mediterranean', 'International'];
const DIETARY = ['vegetarian', 'vegan', 'halal-friendly', 'gluten-free', 'dairy-free', 'high-protein'];
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snacks'];

const inputCls = 'field';

export default function Discover() {
  const [recipes, setRecipes] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  // Phase 5: the dashboard's search entry point links here with ?q=…
  const [searchParams] = useSearchParams();
  const initialFilters = { q: searchParams.get('q') || '', cuisine: '', dietary: '', mealType: '', maxTime: '', sort: '' };
  const [filters, setFilters] = useState(initialFilters);
  const [applied, setApplied] = useState({ ...initialFilters });
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [favErr, setFavErr] = useState('');

  useEffect(() => {
    favoriteApi.list({ limit: 100 })
      .then((d) => setFavoriteIds(new Set((d.favorites || []).map((f) => String(f.recipe?._id || f.recipe)))))
      .catch(() => {});
  }, []);

  const toggleFavorite = async (recipe) => {
    setFavErr('');
    const id = String(recipe._id);
    try {
      if (favoriteIds.has(id)) {
        await favoriteApi.removeByRecipe(id);
        setFavoriteIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      } else {
        await favoriteApi.create({ recipeId: id });
        setFavoriteIds((prev) => new Set(prev).add(id));
      }
    } catch (e) {
      setFavErr(e.message);
    }
  };

  const fetchRecipes = useCallback(async (params, pg) => {
    setLoading(true);
    try {
      const clean = Object.fromEntries(Object.entries({ ...params, page: pg, limit: 12 }).filter(([, v]) => v !== '' && v != null));
      const d = await recipeApi.list(clean);
      setRecipes(d.recipes || []);
      setTotal(d.total || 0);
      setTotalPages(d.totalPages || 1);
      setErr('');
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecipes(applied, page); }, [applied, page, fetchRecipes]);

  const apply = (e) => {
    e.preventDefault();
    setPage(1);
    setApplied({ ...filters });
  };
  const clear = () => {
    const blank = { q: '', cuisine: '', dietary: '', mealType: '', maxTime: '', sort: '' };
    setFilters(blank); setPage(1); setApplied(blank);
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Discover recipes</h1>
        <p className="mt-1 text-sm text-slate-500">Search by name or ingredient, filter by cuisine, diet, meal type and time.</p>

        <form onSubmit={apply} className="mt-6 grid gap-3 rounded-2xl border border-slate-200/80 shadow-sm bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
          <input placeholder="Search recipes or ingredients…" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} className={inputCls} aria-label="Search recipes" />
          <select value={filters.cuisine} onChange={(e) => setFilters({ ...filters, cuisine: e.target.value })} className={inputCls} aria-label="Cuisine">
            <option value="">All cuisines</option>
            {CUISINES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filters.dietary} onChange={(e) => setFilters({ ...filters, dietary: e.target.value })} className={inputCls} aria-label="Dietary preference">
            <option value="">Any diet</option>
            {DIETARY.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filters.mealType} onChange={(e) => setFilters({ ...filters, mealType: e.target.value })} className={inputCls} aria-label="Meal type">
            <option value="">Any meal type</option>
            {MEAL_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={filters.maxTime} onChange={(e) => setFilters({ ...filters, maxTime: e.target.value })} className={inputCls} aria-label="Maximum time">
            <option value="">Any time</option>
            <option value="15">Up to 15 min</option>
            <option value="30">Up to 30 min</option>
            <option value="45">Up to 45 min</option>
            <option value="60">Up to 60 min</option>
          </select>
          <select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })} className={inputCls} aria-label="Sort">
            <option value="">Sort: newest</option>
            <option value="time">Sort: quickest first</option>
          </select>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
            <button type="submit" className="btn-primary">Search</button>
            <button type="button" onClick={clear} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Clear filters</button>
          </div>
        </form>

        <p className="mt-6 text-sm text-slate-500" aria-live="polite">
          {loading ? 'Loading recipes…' : `${total} recipe${total === 1 ? '' : 's'} found`}
        </p>
        {favErr && <p className="mt-2 text-sm text-red-700" role="alert">{favErr}</p>}

        {err && !loading ? (
          <div className="mt-4"><ErrorState message={err} onRetry={() => fetchRecipes(applied, page)} /></div>
        ) : loading ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : recipes.length === 0 ? (
          <div className="mt-4"><EmptyState title="No recipes found" message="Try a different search term or clear a filter." /></div>
        ) : (
          <>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {recipes.map((r) => (
                <RecipeCard
                  key={r._id}
                  recipe={r}
                  isFavorite={favoriteIds.has(String(r._id))}
                  onToggleFavorite={() => toggleFavorite(r)}
                />
              ))}
            </div>
            <div className="mt-8 flex items-center justify-center gap-3">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm disabled:opacity-50">Previous</button>
              <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm disabled:opacity-50">Next</button>
            </div>
          </>
        )}
        <p className="mt-8 text-xs text-slate-400">
          Dietary tags are search filters, not certifications — they do not mean a recipe is
          certified halal or allergen-free. Always check the full ingredient list.
        </p>
      </main>
    </div>
  );
}
