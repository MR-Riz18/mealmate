import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/Landing';
import { Login, Register } from './pages/Auth';
import Discover from './pages/Discover';
import RecipeDetails from './pages/RecipeDetails';
import Favorites from './pages/Favorites';
import IngredientSearch from './pages/IngredientSearch';
import Profile from './pages/Profile';
import MealPlanner from './pages/MealPlanner';
import ShoppingList from './pages/ShoppingList';
import Pantry from './pages/Pantry';
import Recommendations from './pages/Recommendations';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminRecipes from './pages/admin/AdminRecipes';
import AdminCategories from './pages/admin/AdminCategories';

/**
 * Phase 5 logged-in home: the dashboard is the home route for a
 * logged-in user; the public landing page stays for logged-out visitors.
 */
function HomeRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="mx-auto max-w-7xl px-4 py-10 text-slate-500">Loading…</div>;
  return user ? <Dashboard /> : <Landing />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/discover" element={<ProtectedRoute><Discover /></ProtectedRoute>} />
          <Route path="/recipes/:id" element={<ProtectedRoute><RecipeDetails /></ProtectedRoute>} />
          <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
          <Route path="/ingredients" element={<ProtectedRoute><IngredientSearch /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/planner" element={<ProtectedRoute><MealPlanner /></ProtectedRoute>} />
          <Route path="/shopping" element={<ProtectedRoute><ShoppingList /></ProtectedRoute>} />
          <Route path="/pantry" element={<ProtectedRoute><Pantry /></ProtectedRoute>} />
          <Route path="/recommendations" element={<ProtectedRoute><Recommendations /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/recipes" element={<ProtectedRoute roles={['admin']}><AdminRecipes /></ProtectedRoute>} />
          <Route path="/admin/categories" element={<ProtectedRoute roles={['admin']}><AdminCategories /></ProtectedRoute>} />
          <Route path="*" element={<HomeRoute />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
