import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function Landing() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 pb-16 pt-14 sm:pt-20">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">Recipe finder &amp; smart meal planner</p>
        <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-[1.08] tracking-tight text-slate-900 sm:text-6xl">
          Find dinner from what&apos;s <span className="text-brand-600">already in your kitchen.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
          MealMate helps you discover recipes by name, cuisine or ingredients, filter by diet,
          cooking time and meal type, plan your week, build a shopping list and track what&apos;s
          in your pantry.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/discover" className="btn-primary rounded-xl px-6 py-3 text-base shadow-md">
            Browse recipes →
          </Link>
          <Link to="/register" className="btn-secondary rounded-xl px-6 py-3 text-base">
            Create an account
          </Link>
        </div>
        <section className="mt-16 grid gap-5 sm:grid-cols-3">
          {[
            ['🥘', 'Search by ingredient', 'Enter what you already have and find recipes that use it — with a match % and a list of what you still need.'],
            ['🥗', 'Filter by diet and time', 'Vegetarian, vegan, gluten-free, dairy-free, high-protein and more, plus a maximum cooking time.'],
            ['📋', 'Plan, shop, repeat', 'Build a weekly plan, generate a shopping list from it, and let your pantry flag what you already own.'],
          ].map(([icon, title, body]) => (
            <div key={title} className="card p-6 transition hover:-translate-y-0.5 hover:shadow-lift">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-xl" aria-hidden="true">{icon}</span>
              <h2 className="mt-4 font-semibold text-slate-900">{title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{body}</p>
            </div>
          ))}
        </section>
        <p className="mt-10 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Dietary note: tags like “halal-friendly” are filters to help you search. They are not a
          certification that a recipe is halal or allergen-free — always check the full ingredient
          list and allergens shown on each recipe.
        </p>
      </main>
    </div>
  );
}
