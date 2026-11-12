import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

function Field({ label, ...props }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input {...props} className="field mt-1" />
    </label>
  );
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try { await login(form); navigate('/discover'); }
    catch (ex) { setErr(ex.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen"><Navbar />
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Log in</h1>
        <form onSubmit={submit} className="mt-6 space-y-4 card p-6 shadow-lift sm:p-8">
          <Field label="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Field label="Password" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button disabled={busy} className="btn-primary w-full py-2.5">
            {busy ? 'Logging in…' : 'Log in'}
          </button>
          <p className="text-center text-sm text-slate-500">No account? <Link to="/register" className="font-medium text-brand-700">Sign up</Link></p>
          <p className="text-center text-xs text-slate-400">Demo: user@mealmate.local / User123! · Admin: admin@mealmate.local / Admin123!</p>
        </form>
      </main>
    </div>
  );
}

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try { await register(form); navigate('/discover'); }
    catch (ex) { setErr(ex.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen"><Navbar />
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Create an account</h1>
        <form onSubmit={submit} className="mt-6 space-y-4 card p-6 shadow-lift sm:p-8">
          <Field label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Field label="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Field label="Password (at least 8 characters)" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button disabled={busy} className="btn-primary w-full py-2.5">
            {busy ? 'Creating…' : 'Sign up'}
          </button>
          <p className="text-center text-sm text-slate-500">Already have an account? <Link to="/login" className="font-medium text-brand-700">Log in</Link></p>
        </form>
      </main>
    </div>
  );
}
