import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { ErrorState } from '../../components/Skeleton';
import { adminApi } from '../../api';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [logs, setLogs] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setErr(''); setLoading(true);
    try {
      const [s, h, l] = await Promise.all([adminApi.stats(), adminApi.health(), adminApi.logs()]);
      setStats(s); setHealth(h); setLogs(l.logs || []);
    } catch (ex) { setErr(ex.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Admin overview</h1>
        <p className="mt-1 text-sm text-slate-500">
          <Link to="/admin/recipes" className="font-medium text-brand-700">Manage recipes</Link>
          {' · '}
          <Link to="/admin/categories" className="font-medium text-brand-700">Manage categories</Link>
        </p>
        {loading && <p className="mt-6 text-slate-500">Loading admin data…</p>}
        {err && !loading && <div className="mt-6"><ErrorState message={err} onRetry={load} /></div>}
        {stats && (
          <>
            <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200/80 shadow-sm bg-white p-5"><p className="text-sm text-slate-500">Users</p><p className="mt-1 text-3xl font-bold text-slate-900">{stats.users.total}</p><p className="mt-1 text-xs text-slate-500">{Object.entries(stats.users.byRole).map(([r, c]) => `${r}: ${c}`).join(' · ')}</p></div>
              <div className="rounded-2xl border border-slate-200/80 shadow-sm bg-white p-5"><p className="text-sm text-slate-500">Recipes</p><p className="mt-1 text-3xl font-bold text-slate-900">{stats.recipes.total}</p><p className="mt-1 text-xs text-slate-500">seeded: {stats.recipes.seeded} · admin-created: {stats.recipes.adminCreated}</p></div>
              <div className="rounded-2xl border border-slate-200/80 shadow-sm bg-white p-5"><p className="text-sm text-slate-500">Favorites / plans / lists / pantry</p><p className="mt-1 text-3xl font-bold text-slate-900">{stats.favorites}</p><p className="mt-1 text-xs text-slate-500">plans: {stats.mealPlans} · lists: {stats.shoppingLists} · pantry items: {stats.pantryItems}</p></div>
              <div className="rounded-2xl border border-slate-200/80 shadow-sm bg-white p-5"><p className="text-sm text-slate-500">Discovery cache</p><p className="mt-1 text-3xl font-bold text-slate-900">{stats.cache.size} entries</p><p className="mt-1 text-xs text-slate-500">hits: {stats.cache.hits} · misses: {stats.cache.misses} · TTL {stats.cache.ttlSeconds}s</p></div>
            </section>
            <section className="mt-6 rounded-2xl border border-slate-200/80 shadow-sm bg-white p-5">
              <h2 className="text-lg font-semibold text-slate-900">Server health</h2>
              {health && (
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                  <div><dt className="text-slate-500">Status</dt><dd className="font-semibold text-slate-900">{health.status}</dd></div>
                  <div><dt className="text-slate-500">Database</dt><dd className="font-semibold text-slate-900">{health.database}</dd></div>
                  <div><dt className="text-slate-500">External provider</dt><dd className="font-semibold text-slate-900">{health.provider.enabled ? 'Enabled' : 'Disabled'}</dd></div>
                  <div><dt className="text-slate-500">Uptime</dt><dd className="font-semibold text-slate-900">{health.uptimeSeconds}s</dd></div>
                </dl>
              )}
            </section>
            <section className="mt-6 rounded-2xl border border-slate-200/80 shadow-sm bg-white p-5">
              <h2 className="text-lg font-semibold text-slate-900">Recent server errors</h2>
              <p className="mt-1 text-xs text-slate-500">At most the last 50, newest first. These entries never include passwords, tokens, cookies or secrets.</p>
              {logs.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No server errors recorded since the server started.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {logs.map((log, i) => (
                    <li key={i} className="rounded-lg bg-red-50 p-3">
                      <p className="font-medium text-red-800">{log.status} — {log.message}</p>
                      <p className="text-xs text-red-600">{new Date(log.timestamp).toLocaleString()} · {log.method} {log.path}</p>
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
