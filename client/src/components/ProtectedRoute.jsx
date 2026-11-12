import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Renders children only for a logged-in user; otherwise redirects to /login.
 * `roles`, when given, additionally requires one of those roles — a
 * logged-in user without the role is sent to /dashboard. This is a
 * convenience guard only; the backend enforces admin access with 403
 * on every admin endpoint regardless of what URL is typed.
 */
export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="mx-auto max-w-7xl px-4 py-10 text-slate-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}
