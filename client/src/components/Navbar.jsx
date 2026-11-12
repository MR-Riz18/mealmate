import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Dark header over light content. NavLink highlights the current page;
// on small screens the links wrap under the logo instead of overflowing.
const linkCls = ({ isActive }) =>
  `rounded-lg px-2.5 py-1.5 transition ${
    isActive ? 'bg-white/10 font-semibold text-amber-300' : 'text-slate-300 hover:bg-white/5 hover:text-white'
  }`;

const NAV_LINKS = [
  ['/discover', 'Discover'],
  ['/dashboard', 'Dashboard'],
  ['/ingredients', 'By ingredients'],
  ['/favorites', 'Favorites'],
  ['/planner', 'Planner'],
  ['/shopping', 'Shopping'],
  ['/pantry', 'Pantry'],
  ['/recommendations', 'Recommendations'],
  ['/profile', 'Profile'],
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900 shadow-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 text-xl font-bold tracking-tight text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400 text-lg" aria-hidden="true">🍽️</span>
          Meal<span className="text-amber-400">Mate</span>
        </Link>
        <nav className="flex flex-1 flex-wrap items-center gap-1 text-sm font-medium" aria-label="Main navigation">
          <NavLink to="/discover" end={false} className={linkCls}>Discover</NavLink>
          {user && NAV_LINKS.slice(1).map(([to, label]) => (
            <NavLink key={to} to={to} className={linkCls}>{label}</NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2 text-sm">
          {user ? (
            <>
              <span className="hidden text-slate-400 md:inline">Hi, {user.name}</span>
              {user.role === 'admin' && (
                <Link to="/admin" className="rounded-full bg-amber-400/15 px-2.5 py-1 text-xs font-semibold text-amber-300 ring-1 ring-amber-400/40 hover:bg-amber-400/25">
                  Admin
                </Link>
              )}
              <button onClick={handleLogout} className="rounded-lg bg-amber-400 px-3 py-1.5 font-semibold text-slate-900 transition hover:bg-amber-300">
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={linkCls}>Log in</NavLink>
              <Link to="/register" className="rounded-lg bg-amber-400 px-3 py-1.5 font-semibold text-slate-900 transition hover:bg-amber-300">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
