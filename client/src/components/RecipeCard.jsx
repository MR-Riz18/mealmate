import { Link } from 'react-router-dom';

export function totalTime(r) {
  return (r.preparationTime || 0) + (r.cookingTime || 0);
}

function RecipeImage({ recipe, className }) {
  const fallback = `https://picsum.photos/seed/mealmate-${encodeURIComponent(recipe.title)}/800/600`;
  return (
    <img
      src={recipe.image || fallback}
      alt={recipe.title}
      loading="lazy"
      className={className}
      onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = fallback; }}
    />
  );
}

/**
 * Recipe card. `match` is optional (ingredient search only): when present it
 * shows the match percentage, have/missing counts, and a "Perfect match"
 * badge — but only when every required ingredient is present.
 * `isFavorite` / `onToggleFavorite` wire the heart button; when
 * onToggleFavorite is absent the button is not rendered.
 */
export default function RecipeCard({ recipe, match, reasons, isFavorite, onToggleFavorite, collectionSlot }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-lift">
      <Link to={`/recipes/${recipe._id}`} className="relative block overflow-hidden">
        <RecipeImage recipe={recipe} className="h-44 w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
        <span className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-slate-900/30 to-transparent" aria-hidden="true" />
      </Link>
      {onToggleFavorite && (
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={isFavorite ? 'Remove from favorites' : 'Save to favorites'}
          title={isFavorite ? 'Remove from favorites' : 'Save to favorites'}
          className={`absolute right-3 top-3 rounded-full px-3 py-1.5 text-sm font-semibold shadow ${
            isFavorite ? 'bg-red-600 text-white' : 'bg-white/95 text-slate-700'
          }`}
        >
          {isFavorite ? '♥ Saved' : '♡ Save'}
        </button>
      )}
      <div className="flex flex-1 flex-col p-5">
        <Link to={`/recipes/${recipe._id}`}>
          <h3 className="text-base font-semibold leading-snug text-slate-900 group-hover:text-brand-700">{recipe.title}</h3>
        </Link>
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-500">{recipe.description}</p>
        {reasons && reasons.length > 0 && (
          <div className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
            <span className="font-semibold">Why this one?</span>
            <ul className="mt-1 list-inside list-disc">
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            {recipe.plannedThisWeek && <p className="mt-1 text-amber-700">Already planned this week — shown lower in the list.</p>}
          </div>
        )}
        {match && (
          <div className="mt-3 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">
            <span className="font-semibold">{match.matchPercentage}% match</span>
            {' · '}You have {match.have.length} · still need {match.additionalIngredientsRequired}
            {match.isPerfectMatch && <span className="ml-2 rounded-full bg-emerald-600 px-2 py-0.5 font-semibold text-white">Perfect match</span>}
            {match.missing.length > 0 && (
              <span className="mt-1 block text-emerald-700">Missing: {match.missing.join(', ')}</span>
            )}
          </div>
        )}
        <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-3 text-xs font-medium text-slate-600">
          <span>⏱ {totalTime(recipe)} min</span>
          <span>👥 {recipe.servings} servings</span>
          <span>{recipe.cuisine || '—'}</span>
        </p>
        <p className="mt-1 text-xs capitalize text-slate-500">
          {(recipe.mealTypes || []).join(' · ') || '—'}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(recipe.dietaryTags || []).slice(0, 3).map((t) => (
            <span key={t} className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">{t}</span>
          ))}
        </div>
        <p className="mt-3 text-xs font-medium text-slate-600">
          {recipe.nutrition && recipe.nutrition.calories != null
            ? `${recipe.nutrition.calories} kcal per serving`
            : 'Nutrition not available for this recipe yet.'}
        </p>
        {collectionSlot}
      </div>
    </article>
  );
}
