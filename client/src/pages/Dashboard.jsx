import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import RecipeCard from '../components/RecipeCard';
import EmptyState from '../components/EmptyState';
import { ErrorState } from '../components/Skeleton';
import { dashboardApi } from '../api';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function Card({ title, to, children }) {
  return (
    <section className="card p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {to && <Link to={to} className="text-sm font-medium text-brand-700 hover:underline">View all →</Link>}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = async () => {
    setErr(''); setLoading(true);
    try { setData(await dashboardApi.get()); }
    catch (ex) { setErr(ex.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        {loading && <p className="text-slate-500">Loading your dashboard…</p>}
        {err && !loading && <ErrorState message={err} onRetry={load} />}
        {data && (
          <>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Welcome back, {data.user?.name || 'cook'} 👋
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Week starting Monday {data.weekStartDate} · {data.weekOverview.mealCount} meal
              {data.weekOverview.mealCount === 1 ? '' : 's'} planned this week.
            </p>
            <form
              className="mt-6 flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => { e.preventDefault(); const q = e.target.q.value.trim(); navigate(q ? `/discover?q=${encodeURIComponent(q)}` : '/discover'); }}
            >
              <label className="sr-only" htmlFor="dash-search">Search recipes</label>
              <input id="dash-search" name="q" placeholder="Search recipes — try “chicken” or “pasta”…" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
              <button type="submit" className="btn-primary">Search</button>
            </form>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <Card title="Today's meals" to="/planner">
                {data.todaysMeals.length === 0 ? (
                  <p className="text-sm text-slate-500">Nothing planned for today yet — <Link to="/planner" className="font-medium text-brand-700">add a meal</Link>.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.todaysMeals.map((m) => (
                      <li key={`${m.day}-${m.mealType}`} className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-medium text-slate-700">{m.mealTypeLabel}</span>
                        {m.recipe ? (
                          <Link to={`/recipes/${m.recipe._id}`} className="text-right font-medium text-slate-900 hover:text-brand-700">
                            {m.recipe.title} <span className="font-normal text-slate-500">· {m.servings} serving{m.servings === 1 ? '' : 's'}</span>
                          </Link>
                        ) : <span className="text-slate-500">Recipe unavailable</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card title="Today's nutrition">
                {data.todayNutrition.incomplete && (
                  <p className="mb-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                    Some planned recipes have no nutrition data, so these totals are incomplete — they are
                    minimums, not exact totals. Missing values are never treated as zero.
                  </p>
                )}
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-slate-500">Calories</dt><dd className="font-semibold text-slate-900">{data.todayNutrition.totals.calories ?? '—'} kcal</dd></div>
                  <div><dt className="text-slate-500">Protein</dt><dd className="font-semibold text-slate-900">{data.todayNutrition.totals.protein ?? '—'} g</dd></div>
                  <div><dt className="text-slate-500">Carbs</dt><dd className="font-semibold text-slate-900">{data.todayNutrition.totals.carbohydrates ?? '—'} g</dd></div>
                  <div><dt className="text-slate-500">Fat</dt><dd className="font-semibold text-slate-900">{data.todayNutrition.totals.fat ?? '—'} g</dd></div>
                </dl>
                {data.todayNutrition.calorieTarget != null && (
                  <p className="mt-3 text-sm text-slate-600">
                    Target {data.todayNutrition.calorieTarget} kcal ·{' '}
                    {data.todayNutrition.caloriesVsTarget > 0
                      ? `${data.todayNutrition.caloriesVsTarget} kcal over`
                      : data.todayNutrition.caloriesVsTarget < 0
                        ? `${-data.todayNutrition.caloriesVsTarget} kcal under`
                        : 'exactly on target'}
                  </p>
                )}
              </Card>

              <Card title="This week's plan" to="/planner">
                {!data.weekOverview.hasPlan ? (
                  <p className="text-sm text-slate-500">No plan for this week yet — <Link to="/planner" className="font-medium text-brand-700">create one</Link>.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {data.weekOverview.daySummaries.map((d, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span className="font-medium text-slate-700">{DAY_NAMES[i]}{i === data.todayIndex ? ' (today)' : ''}</span>
                        <span className="text-slate-600">
                          {d.mealCount} meal{d.mealCount === 1 ? '' : 's'} · {d.totals.calories ?? '—'} kcal
                          {d.incomplete && <span className="text-amber-700"> · incomplete</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card title="Shopping progress" to="/shopping">
                {!data.shoppingProgress ? (
                  <p className="text-sm text-slate-500">No shopping list yet — <Link to="/shopping" className="font-medium text-brand-700">generate one from your plan</Link>.</p>
                ) : (
                  <div>
                    <p className="text-sm text-slate-700">
                      {data.shoppingProgress.checked} of {data.shoppingProgress.total} items checked
                      {data.shoppingProgress.weekStartDate && ` · week of ${data.shoppingProgress.weekStartDate}`}
                    </p>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={data.shoppingProgress.checked} aria-valuemin={0} aria-valuemax={data.shoppingProgress.total} aria-label="Shopping list progress">
                      <div
                        className="h-full bg-brand-600"
                        style={{ width: data.shoppingProgress.total ? `${Math.round((data.shoppingProgress.checked / data.shoppingProgress.total) * 100)}%` : '0%' }}
                      />
                    </div>
                  </div>
                )}
              </Card>

              <Card title="Pantry expiring soon" to="/pantry">
                <p className="mb-3 text-xs text-slate-500">Expiry labels are informational only — they do not make food safe or unsafe.</p>
                {data.pantryExpiring.length === 0 ? (
                  <p className="text-sm text-slate-500">Nothing expiring within the next 7 days.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {data.pantryExpiring.map((item) => (
                      <li key={item._id} className="flex justify-between gap-2">
                        <span className="font-medium text-slate-700">{item.name}</span>
                        <span className={item.expiryStatus === 'expired' ? 'font-semibold text-red-700' : 'text-amber-700'}>
                          {item.expiryStatus === 'expired' ? 'Expired' : `${item.daysUntilExpiry} day${item.daysUntilExpiry === 1 ? '' : 's'} left`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card title="Recently viewed">
                {data.recentlyViewed.length === 0 ? (
                  <p className="text-sm text-slate-500">Recipes you open will show up here.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {data.recentlyViewed.map((r) => (
                      <li key={r._id}><Link to={`/recipes/${r._id}`} className="font-medium text-slate-900 hover:text-brand-700">{r.title}</Link></li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            <section className="mt-6">
              <h2 className="text-lg font-semibold text-slate-900">Suggested for you</h2>
              <p className="mt-1 text-sm text-slate-500">Based on your pantry, preferences and saved recipes — dietary tags are search filters, not certifications.</p>
              {data.recommendations.length === 0 ? (
                <div className="mt-3"><EmptyState title="No suggestions yet" message="Save a few recipes or add pantry items and suggestions will appear here." /></div>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {data.recommendations.map((r) => <RecipeCard key={r._id} recipe={r} reasons={r.reasons} />)}
                </div>
              )}
            </section>

            <section className="mt-6">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-900">Your favorites</h2>
                <Link to="/favorites" className="text-sm font-medium text-brand-700 hover:underline">View all →</Link>
              </div>
              {data.favorites.length === 0 ? (
                <div className="mt-3"><EmptyState title="No favorites yet" message="Tap the heart on any recipe card to save it here." /></div>
              ) : (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {data.favorites.map((r) => (
                    <li key={r._id} className="rounded-xl border border-slate-200/80 shadow-sm bg-white p-3 text-sm">
                      <Link to={`/recipes/${r._id}`} className="font-medium text-slate-900 hover:text-brand-700">{r.title}</Link>
                      <p className="text-xs text-slate-500">{r.cuisine || '—'}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
