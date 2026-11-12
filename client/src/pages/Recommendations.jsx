import { useCallback, useEffect, useState } from 'react';
import { recipeApi } from '../api';
import Navbar from '../components/Navbar';
import RecipeCard from '../components/RecipeCard';
import { CardSkeleton, ErrorState } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

export default function Recommendations() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await recipeApi.recommendations({ limit: 12 });
      setRecipes(d.recipes || []);
      setErr('');
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Recommended for you</h1>
        <p className="mt-1 text-sm text-slate-500">
          Simple, transparent rules — no black box: your dietary preferences, pantry
          ingredients, preferred cuisines, recipes you saved, and cooking time decide
          the order. Recipes already planned this week are pushed down, not hidden.
          Dietary tags are filters, not certified halal or allergen-free guarantees —
          always check the full ingredient list.
        </p>
        {err && <div className="mt-4"><ErrorState message={err} onRetry={load} /></div>}
        {loading ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>
        ) : recipes.length === 0 ? (
          <div className="mt-6"><EmptyState title="No recommendations yet" message="Add pantry items, save a few favorites, or set preferences on your profile to get personalised suggestions." /></div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recipes.map((r) => (
              <RecipeCard key={r._id} recipe={r} reasons={r.reasons} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
