import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { mealPlanApi, recipeApi, favoriteApi } from '../api';
import Navbar from '../components/Navbar';
import { CardSkeleton, ErrorState } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snacks'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const inputCls = 'field';

// Monday of the week containing `date`, formatted YYYY-MM-DD (local).
function mondayLabel(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function shiftWeek(label, n) {
  const d = new Date(`${label}T00:00:00`);
  d.setDate(d.getDate() + n * 7);
  return mondayLabel(d);
}

function weekDayLabel(weekLabel, day) {
  const d = new Date(`${weekLabel}T00:00:00`);
  d.setDate(d.getDate() + day);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function MealPlanner() {
  const [week, setWeek] = useState(() => mondayLabel());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [picker, setPicker] = useState(null); // { day, mealType, replace }
  const [pickerTab, setPickerTab] = useState('all');
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerRecipes, setPickerRecipes] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerServings, setPickerServings] = useState(2);
  const [copyTargets, setCopyTargets] = useState({});

  const plan = data?.plan || null;

  // Response-shape normaliser. GET /api/meal-plans returns the wrapper
  // { plan, weekStartDate, daySummaries, calorieTarget }, but POST and
  // PATCH return the plan object itself (planJSON) with no `plan` key.
  // Storing a bare plan object as `data` made `data.plan` undefined, so
  // after any create/add/replace/remove the page wrongly showed
  // "No plan for this week yet" until a reload. Normalise both shapes
  // into the GET wrapper shape.
  const normalizeWeekData = (d) => {
    if (d && d.plan) return d;
    if (!d) return d;
    return {
      plan: d,
      weekStartDate: d.weekStartDateLabel || d.weekStartDate || null,
      weekStartDateLabel: d.weekStartDateLabel || null,
      daySummaries: d.daySummaries || [],
      calorieTarget: d.calorieTarget ?? d.daySummaries?.[0]?.calorieTarget ?? null,
    };
  };

  const fetchWeek = useCallback(async (weekLabel) => {
    setLoading(true);
    try {
      const d = await mealPlanApi.forWeek(weekLabel);
      setData(d);
      setErr('');
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWeek(week); }, [week, fetchWeek]);

  const refresh = async (d) => {
    // PATCH/POST responses already carry the full plan + summaries,
    // but in the bare-plan shape — normalise before storing.
    setData(normalizeWeekData(d));
    setNotice('');
  };

  const ensurePlan = async () => {
    if (plan) return plan;
    const d = await mealPlanApi.create({ weekStartDate: week });
    const normalized = normalizeWeekData(d);
    setData(normalized);
    return normalized.plan;
  };

  const handleCreate = async () => {
    setNotice('');
    try {
      const d = await mealPlanApi.create({ weekStartDate: week });
      setData(normalizeWeekData(d));
    } catch (e) { setErr(e.message); }
  };

  const openPicker = async (day, mealType, replace) => {
    setPicker({ day, mealType, replace: !!replace });
    setPickerTab('all');
    setPickerQuery('');
    setPickerServings(2);
    setPickerLoading(true);
    try {
      const d = await recipeApi.list({ limit: 50 });
      setPickerRecipes(d.recipes || []);
    } catch {
      setPickerRecipes([]);
    } finally {
      setPickerLoading(false);
    }
  };

  const searchPicker = async () => {
    setPickerLoading(true);
    try {
      if (pickerTab === 'favorites') {
        const d = await favoriteApi.list({ q: pickerQuery, limit: 50 });
        setPickerRecipes((d.favorites || []).map((f) => f.recipe).filter(Boolean));
      } else {
        const d = await recipeApi.list({ q: pickerQuery, limit: 50 });
        setPickerRecipes(d.recipes || []);
      }
    } catch {
      setPickerRecipes([]);
    } finally {
      setPickerLoading(false);
    }
  };

  const chooseRecipe = async (recipe) => {
    try {
      const current = await ensurePlan();
      const d = await mealPlanApi.patch(current._id, {
        action: 'set', day: picker.day, mealType: picker.mealType,
        recipeId: recipe._id, servings: pickerServings, replace: picker.replace,
      });
      await refresh(d);
      setPicker(null);
    } catch (e) { setErr(e.message); }
  };

  const removeSlot = async (day, mealType) => {
    if (!plan) return;
    try {
      const d = await mealPlanApi.patch(plan._id, { action: 'remove', day, mealType });
      await refresh(d);
    } catch (e) { setErr(e.message); }
  };

  const copySlot = async (day, mealType) => {
    if (!plan) return;
    const toDay = Number(copyTargets[`${day}-${mealType}`]);
    if (Number.isNaN(toDay)) return;
    try {
      const d = await mealPlanApi.patch(plan._id, { action: 'copy', fromDay: day, mealType, toDay, replace: false });
      await refresh(d);
    } catch (e) { setErr(e.message); }
  };

  const clearDay = async (day) => {
    if (!plan || !window.confirm(`Clear all meals for ${DAY_NAMES[day]}?`)) return;
    try {
      const d = await mealPlanApi.patch(plan._id, { action: 'clearDay', day });
      await refresh(d);
    } catch (e) { setErr(e.message); }
  };

  const clearWeek = async () => {
    if (!plan || !window.confirm('Clear this entire week\'s plan?')) return;
    try {
      await mealPlanApi.remove(plan._id);
      await fetchWeek(week);
    } catch (e) { setErr(e.message); }
  };

  const entriesByDay = useMemo(() => {
    const map = {};
    for (const meal of plan?.meals || []) {
      map[`${meal.day}-${meal.mealType}`] = meal;
    }
    return map;
  }, [plan]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Weekly meal planner</h1>
            <p className="mt-1 text-sm text-slate-500">Week starting Monday {week}. One recipe per slot — replacing a slot asks first, it never duplicates.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setWeek(shiftWeek(week, -1))} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">← Previous week</button>
            <button onClick={() => setWeek(mondayLabel())} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">Current week</button>
            <button onClick={() => setWeek(shiftWeek(week, 1))} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">Next week →</button>
            {plan && <button onClick={clearWeek} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-red-700">Clear week</button>}
            <Link to={`/shopping?week=${week}`} className="btn-primary px-3">Shopping list for this week</Link>
          </div>
        </div>

        {err && <div className="mt-4"><ErrorState message={err} onRetry={() => fetchWeek(week)} /></div>}
        {notice && <p className="mt-4 text-sm text-emerald-700">{notice}</p>}

        {loading ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>
        ) : !plan ? (
          <div className="mt-6">
            <EmptyState title="No plan for this week yet" message="Create a plan for this week, then add a recipe to any slot." />
            <button onClick={handleCreate} className="mt-4 btn-primary">Create this week's plan</button>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {DAY_NAMES.map((dayName, day) => {
              const summary = (data.daySummaries || []).find((s) => s.day === day);
              return (
                <section key={day} className="rounded-2xl border border-slate-200/80 shadow-sm bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-semibold text-slate-900">{dayName} <span className="text-sm font-normal text-slate-500">· {weekDayLabel(week, day)}</span></h2>
                    <div className="flex items-center gap-2">
                      {summary && (
                        <span className="text-xs text-slate-600">
                          {summary.totals.calories} kcal · {summary.totals.protein}g protein · {summary.totals.carbohydrates}g carbs · {summary.totals.fat}g fat
                          {data.calorieTarget != null && ` · target ${data.calorieTarget} kcal (${summary.caloriesVsTarget >= 0 ? '+' : ''}${summary.caloriesVsTarget} kcal)`}
                          {summary.incomplete && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">Partial — nutrition missing</span>}
                        </span>
                      )}
                      <button onClick={() => clearDay(day)} className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600">Clear day</button>
                    </div>
                  </div>
                  {summary?.incomplete && (
                    <p className="mt-1 text-xs text-amber-700">
                      Nutrition totals for this day are incomplete — missing for: {summary.missingRecipes.join(', ')}.
                      Missing values are not treated as zero.
                    </p>
                  )}
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {MEAL_TYPES.map((mealType) => {
                      const entry = entriesByDay[`${day}-${mealType}`];
                      const recipe = entry?.recipe;
                      return (
                        <div key={mealType} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{mealType}</p>
                          {entry && recipe ? (
                            <>
                              <Link to={`/recipes/${recipe._id}`} className="mt-1 block font-medium text-slate-900 hover:text-brand-700">{recipe.title}</Link>
                              <p className="text-xs text-slate-500">{entry.servings} serving{entry.servings === 1 ? '' : 's'}</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <button onClick={() => openPicker(day, mealType, true)} className="rounded-lg bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm">Replace</button>
                                <button onClick={() => removeSlot(day, mealType)} className="rounded-lg bg-white px-2 py-1 text-xs font-medium text-red-700 shadow-sm">Remove</button>
                              </div>
                              <div className="mt-2 flex gap-2">
                                <select
                                  value={copyTargets[`${day}-${mealType}`] ?? ''}
                                  onChange={(e) => setCopyTargets((prev) => ({ ...prev, [`${day}-${mealType}`]: e.target.value }))}
                                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
                                  aria-label={`Copy ${mealType} to day`}
                                >
                                  <option value="">Copy to…</option>
                                  {DAY_NAMES.map((n, d) => d !== day && <option key={d} value={d}>{n}</option>)}
                                </select>
                                <button onClick={() => copySlot(day, mealType)} disabled={copyTargets[`${day}-${mealType}`] == null || copyTargets[`${day}-${mealType}`] === ''} className="rounded-lg bg-white px-2 py-1 text-xs font-medium shadow-sm disabled:opacity-50">Copy</button>
                              </div>
                            </>
                          ) : entry && !recipe ? (
                            <>
                              <p className="mt-1 text-sm text-slate-500">Recipe unavailable</p>
                              <button onClick={() => removeSlot(day, mealType)} className="mt-2 rounded-lg bg-white px-2 py-1 text-xs font-medium text-red-700 shadow-sm">Remove</button>
                            </>
                          ) : (
                            <button onClick={() => openPicker(day, mealType, false)} className="mt-2 btn-primary px-3 py-1.5 text-xs">+ Add recipe</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {picker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
            <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {picker.replace ? 'Replace' : 'Add'} {picker.mealType} — {DAY_NAMES[picker.day]}
                </h2>
                <button onClick={() => setPicker(null)} className="rounded-lg border px-3 py-1 text-sm">Close</button>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => { setPickerTab('all'); }} className={`rounded-lg px-3 py-1.5 text-sm ${pickerTab === 'all' ? 'bg-brand-600 text-white' : 'bg-slate-100'}`}>All recipes</button>
                <button onClick={() => { setPickerTab('favorites'); }} className={`rounded-lg px-3 py-1.5 text-sm ${pickerTab === 'favorites' ? 'bg-brand-600 text-white' : 'bg-slate-100'}`}>Favorites</button>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); searchPicker(); }} className="mt-3 flex gap-2">
                <input value={pickerQuery} onChange={(e) => setPickerQuery(e.target.value)} placeholder="Search recipes…" className={inputCls} aria-label="Search recipes for this slot" />
                <button type="submit" className="btn-primary">Search</button>
              </form>
              <label className="mt-3 block text-sm text-slate-600">
                Servings for this slot
                <input type="number" min="1" max="20" value={pickerServings} onChange={(e) => setPickerServings(Number(e.target.value))} className={`${inputCls} mt-1`} />
              </label>
              {pickerLoading ? (
                <p className="mt-4 text-sm text-slate-500">Loading recipes…</p>
              ) : pickerRecipes.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">No recipes found. Try a different search.</p>
              ) : (
                <ul className="mt-4 divide-y divide-slate-100">
                  {pickerRecipes.map((r) => (
                    <li key={r._id} className="flex items-center justify-between gap-3 py-2">
                      <span className="text-sm font-medium">{r.title} <span className="text-slate-500">· {r.cuisine} · serves {r.servings}</span></span>
                      <button onClick={() => chooseRecipe(r)} className="btn-primary px-3 py-1.5 text-xs">Choose</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
