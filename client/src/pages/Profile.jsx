import { useEffect, useState } from 'react';
import { profileApi } from '../api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import { ErrorState } from '../components/Skeleton';

const inputCls = 'field';
const DIETARY = ['vegetarian', 'vegan', 'halal-friendly', 'gluten-free', 'dairy-free', 'high-protein'];
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snacks'];
const CUISINES = ['Pakistani', 'Italian', 'Mexican', 'Chinese', 'Mediterranean', 'International'];

function toggle(list, value) {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

export default function Profile() {
  const { setUser } = useAuth();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const d = await profileApi.get();
      const u = d.user;
      setForm({
        name: u.name || '',
        dietaryPreferences: u.dietaryPreferences || [],
        allergies: (u.allergies || []).join(', '),
        preferredCuisines: u.preferredCuisines || [],
        preferredMealTypes: u.preferredMealTypes || [],
        calorieTarget: u.calorieTarget ?? 2000,
        servingPreference: u.servingPreference ?? 2,
        email: u.email || '',
        role: u.role || '',
      });
      setErr('');
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setErr(''); setNotice('');
    try {
      const payload = {
        name: form.name.trim(),
        dietaryPreferences: form.dietaryPreferences,
        allergies: form.allergies.split(',').map((s) => s.trim()).filter(Boolean),
        preferredCuisines: form.preferredCuisines,
        preferredMealTypes: form.preferredMealTypes,
        calorieTarget: Number(form.calorieTarget),
        servingPreference: Number(form.servingPreference),
      };
      const d = await profileApi.update(payload);
      setUser(d.user);
      setNotice('Profile saved.');
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Profile &amp; preferences</h1>
        <p className="mt-1 text-sm text-slate-500">
          These preferences are used as recipe filters. They are not safety guarantees:
          dietary tags do not certify a recipe as halal or allergen-free — always check the
          full ingredient list and allergen information on each recipe.
        </p>
        {loading && <p className="mt-6 text-slate-500">Loading profile…</p>}
        {err && <div className="mt-4"><ErrorState message={err} onRetry={load} /></div>}
        {notice && <p className="mt-4 text-sm font-medium text-emerald-700" role="status">{notice}</p>}
        {form && (
          <form onSubmit={save} className="mt-6 space-y-6 rounded-2xl border border-slate-200/80 shadow-sm bg-white p-5">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="profile-name">Name</label>
              <input id="profile-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`${inputCls} mt-1`} />
              <p className="mt-1 text-xs text-slate-400">Email ({form.email}) and role ({form.role}) cannot be changed here.</p>
            </div>

            <fieldset>
              <legend className="text-sm font-medium text-slate-700">Dietary preferences</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {DIETARY.map((d) => (
                  <label key={d} className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium ${form.dietaryPreferences.includes(d) ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                    <input type="checkbox" className="sr-only" checked={form.dietaryPreferences.includes(d)} onChange={() => setForm({ ...form, dietaryPreferences: toggle(form.dietaryPreferences, d) })} />
                    {d}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="profile-allergies">Allergies (comma-separated)</label>
              <input id="profile-allergies" placeholder="e.g. peanuts, gluten" value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} className={`${inputCls} mt-1`} />
            </div>

            <fieldset>
              <legend className="text-sm font-medium text-slate-700">Preferred cuisines</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {CUISINES.map((c) => (
                  <label key={c} className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium ${form.preferredCuisines.includes(c) ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                    <input type="checkbox" className="sr-only" checked={form.preferredCuisines.includes(c)} onChange={() => setForm({ ...form, preferredCuisines: toggle(form.preferredCuisines, c) })} />
                    {c}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-medium text-slate-700">Preferred meal types</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {MEAL_TYPES.map((m) => (
                  <label key={m} className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium ${form.preferredMealTypes.includes(m) ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                    <input type="checkbox" className="sr-only" checked={form.preferredMealTypes.includes(m)} onChange={() => setForm({ ...form, preferredMealTypes: toggle(form.preferredMealTypes, m) })} />
                    {m}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="profile-calories">Daily calorie target</label>
                <input id="profile-calories" type="number" min="0" max="10000" value={form.calorieTarget} onChange={(e) => setForm({ ...form, calorieTarget: e.target.value })} className={`${inputCls} mt-1`} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="profile-servings">Usual servings to cook for</label>
                <input id="profile-servings" type="number" min="1" max="20" value={form.servingPreference} onChange={(e) => setForm({ ...form, servingPreference: e.target.value })} className={`${inputCls} mt-1`} />
              </div>
            </div>

            <button type="submit" disabled={saving} className="btn-primary px-5">
              {saving ? 'Saving…' : 'Save profile'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
