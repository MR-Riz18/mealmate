import { useCallback, useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import { ErrorState } from '../../components/Skeleton';
import { adminApi } from '../../api';

const inputCls = 'field';
const blankForm = {
  title: '', description: '', image: '', cuisine: '', servings: 2,
  preparationTime: 0, cookingTime: 0, mealTypes: '', dietaryTags: '', allergens: '',
  ingredients: '', instructions: '', calories: '',
};

function toForm(recipe) {
  return {
    title: recipe.title || '', description: recipe.description || '', image: recipe.image || '',
    cuisine: recipe.cuisine || '', servings: recipe.servings || 2,
    preparationTime: recipe.preparationTime || 0, cookingTime: recipe.cookingTime || 0,
    mealTypes: (recipe.mealTypes || []).join(', '), dietaryTags: (recipe.dietaryTags || []).join(', '),
    allergens: (recipe.allergens || []).join(', '),
    ingredients: (recipe.ingredients || []).map((i) => `${i.quantity ?? ''} ${i.unit || ''} ${i.name || ''}`.trim()).join('\n'),
    // The server stores instructions as plain strings (Recipe model:
    // instructions: [String]). An earlier version read `s.instruction`
    // here, which is undefined for a string — so opening any recipe for
    // editing blanked every instruction, and saving wiped them.
    instructions: (recipe.instructions || []).map((s) => (typeof s === 'string' ? s : (s.instruction || ''))).join('\n'),
    calories: recipe.nutrition?.calories ?? '',
  };
}

function toBody(form) {
  const split = (s) => String(s).split(',').map((x) => x.trim()).filter(Boolean);
  const ingredients = String(form.ingredients).split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
    const parts = line.split(/\s+/);
    const quantity = Number(parts[0]);
    if (parts.length >= 3 && !Number.isNaN(quantity)) {
      return { quantity, unit: parts[1], name: parts.slice(2).join(' ') };
    }
    return { quantity: null, unit: '', name: line };
  });
  return {
    title: form.title.trim(),
    description: form.description,
    image: form.image,
    cuisine: form.cuisine.trim(),
    servings: Number(form.servings) || 2,
    preparationTime: Number(form.preparationTime) || 0,
    cookingTime: Number(form.cookingTime) || 0,
    mealTypes: split(form.mealTypes),
    dietaryTags: split(form.dietaryTags),
    allergens: split(form.allergens),
    ingredients,
    // Instructions are sent as plain strings — the shape the server
    // stores (Recipe.instructions is [String]). An earlier version sent
    // [{ step, instruction }] objects, which Mongoose cast to the literal
    // string "[object Object]" on every step.
    instructions: String(form.instructions).split('\n').map((l) => l.trim()).filter(Boolean),
    nutrition: form.calories === '' ? {} : { calories: Number(form.calories) },
  };
}

export default function AdminRecipes() {
  const [recipes, setRecipes] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [formErr, setFormErr] = useState('');
  const [editing, setEditing] = useState(null); // null = list only, 'new' = create, id = edit
  const [form, setForm] = useState(blankForm);

  const load = useCallback(async (p = page, q = appliedQuery) => {
    setErr(''); setLoading(true);
    try {
      const d = await adminApi.recipes({ page: p, limit: 12, q });
      setRecipes(d.recipes || []); setTotalPages(d.totalPages || 1); setTotal(d.total || 0); setPage(d.page || p);
    } catch (ex) { setErr(ex.message); }
    finally { setLoading(false); }
  }, [page, appliedQuery]);

  useEffect(() => { load(); }, [load]);

  const startCreate = () => { setEditing('new'); setForm(blankForm); setFormErr(''); };
  const startEdit = (recipe) => { setEditing(recipe._id); setForm(toForm(recipe)); setFormErr(''); };

  const save = async (e) => {
    e.preventDefault(); setFormErr('');
    try {
      if (editing === 'new') await adminApi.createRecipe(toBody(form));
      else await adminApi.updateRecipe(editing, toBody(form));
      setEditing(null); load();
    } catch (ex) { setFormErr(ex.message); }
  };

  const remove = async (recipe) => {
    if (!window.confirm(`Delete "${recipe.title}"? Favorites and planner slots that reference it will keep the id and show "recipe unavailable" — nothing is cascade-deleted from users' data.`)) return;
    try { await adminApi.deleteRecipe(recipe._id); load(); }
    catch (ex) { setErr(ex.message); }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Manage recipes</h1>
        <p className="mt-1 text-sm text-slate-500">
          Creating, editing or deleting a recipe clears the discovery cache so the next search sees the change.
        </p>
        {editing && (
          <form onSubmit={save} className="mt-6 space-y-4 rounded-2xl border border-slate-200/80 shadow-sm bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">{editing === 'new' ? 'New recipe' : 'Edit recipe'}</h2>
            <label className="block text-sm font-medium text-slate-700">Title<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={`${inputCls} mt-1`} /></label>
            <label className="block text-sm font-medium text-slate-700">Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${inputCls} mt-1`} rows={3} /></label>
            <label className="block text-sm font-medium text-slate-700">Image URL<input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} className={`${inputCls} mt-1`} /></label>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block text-sm font-medium text-slate-700">Cuisine<input value={form.cuisine} onChange={(e) => setForm({ ...form, cuisine: e.target.value })} className={`${inputCls} mt-1`} /></label>
              <label className="block text-sm font-medium text-slate-700">Servings<input type="number" min="1" max="20" value={form.servings} onChange={(e) => setForm({ ...form, servings: e.target.value })} className={`${inputCls} mt-1`} /></label>
              <label className="block text-sm font-medium text-slate-700">Prep time (min)<input type="number" min="0" value={form.preparationTime} onChange={(e) => setForm({ ...form, preparationTime: e.target.value })} className={`${inputCls} mt-1`} /></label>
              <label className="block text-sm font-medium text-slate-700">Cook time (min)<input type="number" min="0" value={form.cookingTime} onChange={(e) => setForm({ ...form, cookingTime: e.target.value })} className={`${inputCls} mt-1`} /></label>
            </div>
            <label className="block text-sm font-medium text-slate-700">Meal types (comma-separated)<input value={form.mealTypes} onChange={(e) => setForm({ ...form, mealTypes: e.target.value })} placeholder="breakfast, dinner" className={`${inputCls} mt-1`} /></label>
            <label className="block text-sm font-medium text-slate-700">Dietary tags (comma-separated)<input value={form.dietaryTags} onChange={(e) => setForm({ ...form, dietaryTags: e.target.value })} placeholder="vegetarian, halal-friendly" className={`${inputCls} mt-1`} /></label>
            <label className="block text-sm font-medium text-slate-700">Allergens (comma-separated)<input value={form.allergens} onChange={(e) => setForm({ ...form, allergens: e.target.value })} className={`${inputCls} mt-1`} /></label>
            <label className="block text-sm font-medium text-slate-700">Calories per serving<input type="number" min="0" value={form.calories} onChange={(e) => setForm({ ...form, calories: e.target.value })} className={`${inputCls} mt-1`} /></label>
            <label className="block text-sm font-medium text-slate-700">Ingredients (one per line: “quantity unit name”)<textarea value={form.ingredients} onChange={(e) => setForm({ ...form, ingredients: e.target.value })} className={`${inputCls} mt-1`} rows={6} placeholder={'2 cups rice\n1 tbsp oil'} /></label>
            <label className="block text-sm font-medium text-slate-700">Instructions (one step per line)<textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} className={`${inputCls} mt-1`} rows={6} /></label>
            {formErr && <p className="text-sm text-red-600">{formErr}</p>}
            <div className="flex gap-2">
              <button type="submit" className="btn-primary">{editing === 'new' ? 'Create recipe' : 'Save changes'}</button>
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
            </div>
          </form>
        )}
        {!editing && (
          <>
            <form
              className="mt-6 flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => { e.preventDefault(); setAppliedQuery(query); setPage(1); load(1, query); }}
            >
              <label className="sr-only" htmlFor="admin-recipe-search">Search recipes</label>
              <input id="admin-recipe-search" placeholder="Search recipes…" value={query} onChange={(e) => setQuery(e.target.value)} className={`${inputCls} flex-1`} />
              <button type="submit" className="btn-primary">Search</button>
              <button type="button" onClick={startCreate} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">+ New recipe</button>
            </form>
            {loading && <p className="mt-6 text-slate-500">Loading recipes…</p>}
            {err && !loading && <div className="mt-6"><ErrorState message={err} onRetry={() => load()} /></div>}
            {!loading && !err && (
              <>
                <p className="mt-4 text-sm text-slate-500">{total} recipe{total === 1 ? '' : 's'} · page {page} of {totalPages}</p>
                <ul className="mt-3 space-y-2">
                  {recipes.map((r) => (
                    <li key={r._id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 shadow-sm bg-white p-4">
                      <div>
                        <p className="font-medium text-slate-900">{r.title}</p>
                        <p className="text-xs text-slate-500">{r.cuisine || '—'} · {r.isSeeded ? 'seeded' : 'admin-created'} · {r.servings} servings</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(r)} className="rounded-lg border px-3 py-1.5 text-sm">Edit</button>
                        <button onClick={() => remove(r)} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700">Delete</button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex gap-2">
                  <button disabled={page <= 1} onClick={() => load(page - 1)} className="rounded-lg border bg-white px-4 py-2 text-sm disabled:opacity-50">Previous</button>
                  <button disabled={page >= totalPages} onClick={() => load(page + 1)} className="rounded-lg border bg-white px-4 py-2 text-sm disabled:opacity-50">Next</button>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
