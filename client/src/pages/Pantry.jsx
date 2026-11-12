import { useCallback, useEffect, useState } from 'react';
import { pantryApi, recipeApi } from '../api';
import Navbar from '../components/Navbar';
import RecipeCard from '../components/RecipeCard';
import { CardSkeleton, ErrorState } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

const inputCls = 'field';

const badgeCls = {
  expired: 'bg-red-100 text-red-800',
  'expiring-soon': 'bg-amber-100 text-amber-800',
  fresh: 'bg-emerald-100 text-emerald-800',
  none: 'bg-slate-100 text-slate-600',
};
const badgeLabel = {
  expired: 'Expired',
  'expiring-soon': 'Expiring soon',
  fresh: 'Fresh',
  none: 'No expiry date',
};

export default function Pantry() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [form, setForm] = useState({ name: '', quantity: '', unit: '', category: '', expirationDate: '' });
  const [editing, setEditing] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [suggLoading, setSuggLoading] = useState(false);

  const load = useCallback(async (q) => {
    setLoading(true);
    try {
      const d = await pantryApi.list(q ? { q } : {});
      setItems(d.items || []);
      setErr('');
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(applied); }, [applied, load]);

  const loadSuggestions = useCallback(async () => {
    setSuggLoading(true);
    try {
      const d = await recipeApi.recommendations({ mode: 'expiring', limit: 6 });
      setSuggestions(d.recipes || []);
    } catch {
      setSuggestions([]);
    } finally {
      setSuggLoading(false);
    }
  }, []);

  useEffect(() => { loadSuggestions(); }, [loadSuggestions]);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const payload = {
        name: form.name.trim(),
        quantity: form.quantity === '' ? null : Number(form.quantity),
        unit: form.unit.trim(),
        category: form.category.trim() || undefined,
        expirationDate: form.expirationDate || null,
      };
      if (editing) {
        await pantryApi.update(editing._id, payload);
        setNotice('Pantry item updated.');
        setEditing(null);
      } else {
        await pantryApi.create(payload);
        setNotice('Pantry item added.');
      }
      setForm({ name: '', quantity: '', unit: '', category: '', expirationDate: '' });
      load(applied);
      loadSuggestions();
    } catch (e2) {
      setErr(e2.message);
    }
  };

  const startEdit = (item) => {
    setEditing(item);
    setForm({
      name: item.name,
      quantity: item.quantity ?? '',
      unit: item.unit || '',
      category: item.category || '',
      expirationDate: item.expirationDate ? item.expirationDate.slice(0, 10) : '',
    });
  };

  const remove = async (item) => {
    if (!window.confirm(`Remove "${item.name}" from your pantry?`)) return;
    try {
      await pantryApi.remove(item._id);
      setNotice('Pantry item removed.');
      load(applied);
      loadSuggestions();
    } catch (e) {
      setErr(e.message);
    }
  };

  const expiringCount = items.filter((i) => i.expiryStatus === 'expired' || i.expiryStatus === 'expiring-soon').length;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Pantry</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ingredients you have at home. Expiry labels are a guide only — an item can be
          unsafe before its date, and a date that has not passed does not make food safe.
          Check food by look, smell and storage, not by the date alone.
        </p>

        {notice && <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{notice}</p>}
        {err && <div className="mt-4"><ErrorState message={err} onRetry={() => load(applied)} /></div>}

        <form onSubmit={submit} className="mt-6 grid gap-3 rounded-2xl border border-slate-200/80 shadow-sm bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
          <input placeholder="Ingredient name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} aria-label="Ingredient name" required />
          <input placeholder="Quantity (optional)" type="number" min="0" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className={inputCls} aria-label="Quantity" />
          <input placeholder="Unit (optional)" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={inputCls} aria-label="Unit" />
          <input placeholder="Category (optional)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls} aria-label="Category" />
          <input type="date" value={form.expirationDate} onChange={(e) => setForm({ ...form, expirationDate: e.target.value })} className={inputCls} aria-label="Expiration date" />
          <button type="submit" className="btn-primary sm:col-span-2 lg:col-span-1">
            {editing ? 'Save changes' : 'Add to pantry'}
          </button>
          {editing && (
            <button type="button" onClick={() => { setEditing(null); setForm({ name: '', quantity: '', unit: '', category: '', expirationDate: '' }); }} className="rounded-lg border px-4 py-2 text-sm">
              Cancel edit
            </button>
          )}
        </form>

        <form
          onSubmit={(e) => { e.preventDefault(); setApplied(search.trim()); }}
          className="mt-6 flex gap-3"
        >
          <input placeholder="Search pantry…" value={search} onChange={(e) => setSearch(e.target.value)} className={inputCls} aria-label="Search pantry" />
          <button type="submit" className="btn-primary">Search</button>
          {applied && <button type="button" onClick={() => { setSearch(''); setApplied(''); }} className="rounded-lg border px-4 py-2 text-sm">Clear</button>}
        </form>

        {loading ? (
          <div className="mt-6"><CardSkeleton /></div>
        ) : items.length === 0 ? (
          <div className="mt-6"><EmptyState title="Pantry is empty" message="Add ingredients you have at home — they power recommendations and shopping-list flags." /></div>
        ) : (
          <ul className="mt-6 divide-y divide-slate-100 rounded-2xl border border-slate-200/80 shadow-sm bg-white">
            {items.map((item) => (
              <li key={item._id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="flex-1 text-sm font-medium text-slate-900">
                  {item.name}
                  {item.quantity != null && <span className="ml-2 font-normal text-slate-500">{item.quantity}{item.unit ? ` ${item.unit}` : ''}</span>}
                  <span className="ml-2 text-xs text-slate-400">{item.category}</span>
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeCls[item.expiryStatus] || badgeCls.none}`}>
                  {badgeLabel[item.expiryStatus] || 'No expiry date'}
                  {item.expirationDate ? ` · ${item.expirationDate.slice(0, 10)}` : ''}
                  {item.daysUntilExpiry != null && item.daysUntilExpiry >= 0 && item.expiryStatus === 'expiring-soon' ? ` · in ${item.daysUntilExpiry} day${item.daysUntilExpiry === 1 ? '' : 's'}` : ''}
                </span>
                <button onClick={() => startEdit(item)} className="rounded-lg border px-2 py-1 text-xs">Edit</button>
                <button onClick={() => remove(item)} className="rounded-lg border px-2 py-1 text-xs text-red-700">Remove</button>
              </li>
            ))}
          </ul>
        )}

        <section className="mt-10">
          <h2 className="text-xl font-bold text-slate-900">Use expiring ingredients</h2>
          <p className="mt-1 text-sm text-slate-500">
            {expiringCount > 0
              ? `You have ${expiringCount} item${expiringCount > 1 ? 's' : ''} expired or expiring within 7 days. These recipes use them first.`
              : 'No expired or soon-to-expire items right now — these are your general recommendations instead.'}
          </p>
          {suggLoading ? (
            <div className="mt-4"><CardSkeleton /></div>
          ) : suggestions.length === 0 ? (
            <div className="mt-4"><EmptyState title="No suggestions yet" message="Add pantry items with expiry dates, or check the recommendations page." /></div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {suggestions.map((r) => (
                <RecipeCard key={r._id} recipe={r} reasons={r.reasons} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
