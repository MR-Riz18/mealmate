import { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import { ErrorState } from '../../components/Skeleton';
import { adminApi } from '../../api';

const inputCls = 'field';

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [notice, setNotice] = useState('');
  const [formErr, setFormErr] = useState('');

  const load = async () => {
    setErr(''); setLoading(true);
    try { const d = await adminApi.categories(); setCategories(d.categories || []); }
    catch (ex) { setErr(ex.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const rename = async (e) => {
    e.preventDefault(); setFormErr(''); setNotice('');
    try {
      const d = await adminApi.renameCategory(from, { cuisine: to });
      setNotice(`Renamed "${d.from}" to "${d.to}" on ${d.modifiedCount} recipe${d.modifiedCount === 1 ? '' : 's'}.`);
      setFrom(''); setTo(''); load();
    } catch (ex) { setFormErr(ex.message); }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Manage categories</h1>
        <p className="mt-1 text-sm text-slate-500">
          Categories are cuisines: each recipe's cuisine field. Renaming one renames it across every
          recipe that uses it. Renaming to a name that already exists merges the two groups.
        </p>
        {loading && <p className="mt-6 text-slate-500">Loading categories…</p>}
        {err && !loading && <div className="mt-6"><ErrorState message={err} onRetry={load} /></div>}
        {!loading && !err && (
          <>
            <ul className="mt-6 space-y-2">
              {categories.map((c) => (
                <li key={c.cuisine} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 shadow-sm bg-white p-4">
                  <span className="font-medium text-slate-900">{c.cuisine || '(no cuisine)'}</span>
                  <span className="text-sm text-slate-500">{c.count} recipe{c.count === 1 ? '' : 's'}</span>
                  <button onClick={() => setFrom(c.cuisine)} className="rounded-lg border px-3 py-1.5 text-sm">Rename this</button>
                </li>
              ))}
            </ul>
            <form onSubmit={rename} className="mt-6 rounded-2xl border border-slate-200/80 shadow-sm bg-white p-6">
              <h2 className="text-lg font-semibold text-slate-900">Rename a cuisine</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">Current name
                  <select value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} mt-1`} required>
                    <option value="">Choose a cuisine…</option>
                    {categories.map((c) => <option key={c.cuisine} value={c.cuisine}>{c.cuisine} ({c.count})</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">New name<input required value={to} onChange={(e) => setTo(e.target.value)} placeholder="e.g. South Asian" className={`${inputCls} mt-1`} /></label>
              </div>
              {formErr && <p className="mt-3 text-sm text-red-600">{formErr}</p>}
              {notice && <p className="mt-3 text-sm text-emerald-700">{notice}</p>}
              <button type="submit" className="mt-4 btn-primary">Rename across recipes</button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
