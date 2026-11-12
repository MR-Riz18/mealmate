# MealMate — Recipe Finder & Smart Meal Planner (Phases 1–5)

Phase 1 delivers: project scaffolding, cookie-JWT authentication, recipe discovery
(search, filters, sort, pagination) and recipe details, plus a seeded fallback
recipe dataset. Phase 2 adds: favorites and collections, profile/preferences
editing, ingredient-based search with have/missing/match %, and a serving
calculator on the recipe details page. Phase 3 adds: a weekly meal planner
(7 days × breakfast/lunch/dinner/snacks, with per-day nutrition summaries)
and automatic shopping-list generation from a week's plan. Phase 4 adds:
pantry management with expiry indicators, transparent rule-based
recommendations, and a pantry flag on shopping lists. Phase 5 adds: a
personalised dashboard (the logged-in home page), the admin section
(stats, health, error logs, recipe and category management), a discovery
cache with observable stats, rate limiting on expensive endpoints, an
accessibility/mobile pass, and deployment documentation.

## Dietary disclaimer

Dietary tags such as `halal-friendly` are search filters only. They are **not**
a certification that a recipe is halal or allergen-free. Always check the full
ingredient list and the allergen information shown on each recipe details page.

## Prerequisites

- Node.js 18 or newer
- A MongoDB **server** (local `mongod`, or a MongoDB Atlas cluster). MongoDB
  Compass alone is only a viewer — it is not a database server.

## Setup (Windows)

Open two terminals (Command Prompt or PowerShell). In both, first go to the
project folder you unzipped/created.

### 1. Server

```
cd server
copy .env.example .env
npm install
```

PowerShell alternative for the copy step:

```
Copy-Item .env.example .env
```

Edit `server\.env` and set at least:

```
MONGO_URI=mongodb://localhost:27017/mealmate
JWT_SECRET=a-long-random-string-you-make-up
```

For Atlas, use your Atlas connection string instead of the localhost one.

Seed the database (creates the recipes and the accounts below):

```
npm run seed
```

Then start the server:

```
npm run dev
```

The API runs at http://localhost:5000 (`/api/health` should return success).

### 2. Client (second terminal)

```
cd client
npm install
npm run dev
```

The app runs at http://localhost:5173. The Vite dev server proxies `/api`
to http://localhost:5000, so no backend URL is needed for local development.

## Seed logins (local development only — never use these in production)

- Admin: `admin@mealmate.local` / `Admin123!`
- Demo user: `user@mealmate.local` / `User123!`

The seed creates 29 recipes across Pakistani, Italian, Mexican, Chinese,
Mediterranean and International cuisines, covering breakfast, lunch, dinner and
snacks, with vegetarian, vegan, gluten-free, dairy-free, high-protein and
halal-friendly tags. Three recipes deliberately have no nutrition data, so the
UI shows “Nutrition not available for this recipe yet.” instead of inventing
numbers.

## External recipe API (optional)

Leave `RECIPE_API_KEY` empty in `server/.env` to use seeded recipes only —
this is the default and the app runs fully without a key. If you set a
Spoonacular key, the backend tries the external API first (5-second timeout)
and falls back to local seeded recipes on any failure or empty result. The
key lives only in the backend `.env`; it is never sent to, or used by,
frontend code.

## API (Phase 5)

### Dashboard

- `GET /api/dashboard` — one aggregated, logged-in-user-only view:
  profile/welcome info, today's planned meals (from the current Monday-week
  plan, days numbered 0 = Monday), this week's meal-plan overview (meal
  count, per-day summaries with the Phase 3 incomplete-data flag and
  `caloriesVsTarget`), shopping-list progress (checked/total for the
  user's latest list, or `null` when none), pantry items expiring soon
  (the Phase 4 7-day rule), today's nutrition summary (per-serving
  nutrition × planned servings, with the incomplete flag), a few favorite
  recipes, a few recommendations (the Phase 4 scoring logic, reused), and
  recently viewed recipes. The endpoint is never cached: it is
  user-specific and must reflect the latest plan, pantry and views.
- **Recently viewed:** viewing a recipe detail page upserts a backend
  `RecentView` record (user + recipe + viewedAt, one per user per recipe),
  pruned to the latest 10 per user. It is backend-stored, not a
  localStorage-only list.

### Admin (all endpoints require the `admin` role on the backend)

A regular user gets **403** on every admin endpoint, no matter what URL
they type; the frontend also hides the admin pages and redirects
non-admins to the dashboard, but the backend gate is what counts.

- `GET /api/admin/stats` — user counts (total and by role), recipe counts
  (total, seeded, admin-created), counts of favorites, meal plans,
  shopping lists and pantry items, discovery-cache stats (hits, misses,
  size, TTL), and external-provider status (enabled/disabled only — never
  a key or secret)
- `GET /api/admin/health` — server status, uptime in seconds, database
  connection status, provider status
- `GET /api/admin/logs` — the most recent server errors (in-memory ring
  buffer, capped at 50, newest first). Entries carry timestamp, method,
  path, status and message only — no bodies, headers, cookies, tokens or
  secrets. The central error handler records 5xx errors into this buffer.
- `GET /api/admin/recipes?page=&limit=&q=&cuisine=` — paginated, searchable
  admin recipe list
- `POST /api/admin/recipes` — create a recipe (server-validated;
  `isSeeded: false`, `createdBy` set to the admin). Clears the discovery
  cache.
- `PATCH /api/admin/recipes/:id` — edit a recipe (server-validated).
  Clears the discovery cache.
- `DELETE /api/admin/recipes/:id` — delete a recipe. Clears the discovery
  cache. See the reference rule below.
- `GET /api/admin/categories` — distinct cuisines with recipe counts
  (cuisines are the recipe category field in this codebase)
- `PATCH /api/admin/categories/:cuisine` — rename a cuisine across every
  recipe that uses it (body `{ cuisine: "<new name>" }`). Renaming to a
  name that already exists merges the two groups. Clears the discovery
  cache.

### Phase 5 design decisions (documented, tested)

- **Recipe-delete reference rule:** the recipe row is removed, but
  favorites, meal-plan slots, recent views and shopping-list sources that
  referenced it are **kept** — nothing is cascade-deleted from a user's
  private data. References resolve gracefully: the favorites list returns
  the favorite with `recipe: null` (the favorites page skips null recipes),
  the planner shows "Recipe unavailable" for the slot, recently viewed
  drops missing recipes, and shopping items keep their names (they are
  plain text). This is tested: a favorite of a deleted recipe still
  exists and resolves to `null`.
- **Dashboard route choice:** `/` is the dashboard for a logged-in user
  and the public landing page for a logged-out visitor; `/dashboard` is
  the same page directly. The dashboard is deliberately lightweight —
  lists and summaries, no decorative charts.
- **Discovery cache:** an in-memory cache for `GET /api/recipes` and
  `/search` only, keyed by the full request URL (query string included),
  60-second TTL. It is never used for user-specific endpoints (favorites,
  plans, pantry, dashboard). Admin recipe create/update/delete and
  category rename clear it. Hits, misses and size are visible in
  `/api/admin/stats`, so the cache is observable, not claimed. See
  `server/utils/cache.js`.
- **Rate limiting:** authentication is limited to 100 requests per
  15 minutes per IP, recipe search to 300 per 15 minutes, the expensive
  endpoints (`/api/recipes/by-ingredients` and
  `/api/recipes/recommendations`) to 200 per 15 minutes on top of the
  search limit, and shopping-list generation to 60 per 15 minutes. Limits
  return the standard `{ success: false, message }` shape. Rate limits
  are per IP in memory, so they reset on server restart and do not
  survive multiple server instances — they are abuse protection, not a
  distributed quota.
- **Accessibility/mobile pass (Phase 5):** the existing pages already had
  alt text on recipe images, labelled form inputs (labels or aria-labels)
  and aria-labels on icon-only buttons; the pass fixed the remaining gap
  (ingredient-chip remove buttons now carry an aria-label), kept heading
  order (one `h1` per page, sections under `h2`), and kept pages usable
  on small screens (stacked grids, wrapping navigation). No UI redesign.

## API (Phases 1–3)

### Meal plans (Phase 3)

- `GET /api/meal-plans?weekStartDate=YYYY-MM-DD` — the plan for a week
  (defaults to the current week). Returns `{ plan, weekStartDate,
  weekStartDateLabel, daySummaries, calorieTarget }`; `plan` is `null`
  when the user has not created one yet. GET never creates a plan.
- `GET /api/meal-plans/list` — all of the user's plans, newest week first
- `GET /api/meal-plans/:id` — one plan, with per-day nutrition summaries
- `POST /api/meal-plans` — body `{ weekStartDate? }`; creates the plan for
  that week, or returns the existing one (200) when one already exists
- `PATCH /api/meal-plans/:id` — body `{ action, ... }`:
  - `set` — `{ day, mealType, recipeId, servings?, replace? }`; setting an
    occupied slot without `replace: true` is a 409 — a slot never silently
    duplicates or overwrites
  - `remove` — `{ day, mealType }`
  - `copy` — `{ fromDay, mealType, toDay, replace? }` (same occupied-slot
    rule for the target slot)
  - `clearDay` — `{ day }`
- `DELETE /api/meal-plans/:id` — clear a whole week's plan

### Shopping lists (Phase 3)

- `POST /api/shopping-lists/generate` — body `{ weekStartDate?, mealPlanId? }`
  (at least one required; `mealPlanId` wins when both are given). Creates a
  list for that week (201), or regenerates the existing list for the week
  (200) — see the regeneration rule below.
- `GET /api/shopping-lists` — the user's lists, newest first
- `GET /api/shopping-lists/:id` — one list, with items grouped by category
  (`groupedItems`)
- `POST /api/shopping-lists/:id/items` — manual entry `{ name, quantity?,
  unit?, category? }` (category is auto-detected when omitted)
- `PATCH /api/shopping-lists/:id/items/:itemId` — check off (`checked`) or
  edit (`name`, `quantity`, `unit`, `category`) an item
- `DELETE /api/shopping-lists/:id/items/:itemId` — remove an item
- `DELETE /api/shopping-lists/:id` — delete a list

All meal-plan and shopping-list routes require authentication, and every
lookup is scoped to the logged-in user — another user's plan or list
answers **404, not 403**.

### Phase 3 design decisions (documented, tested)

- **Week-start rule:** a plan's week always starts on **Monday**. Any date
  supplied by the client is normalised to the Monday of its week (UTC
  midnight) — see `server/utils/week.js`. Days are numbered 0–6, where
  0 = Monday and 6 = Sunday.
- **Slot operations:** one recipe per slot, enforced by the 409 rule above.
  The frontend picker for an occupied slot opens in replace mode.
- **Nutrition totals:** stored nutrition is **per serving**, so each
  planned meal contributes `stored nutrition × plannedServings` for
  calories, protein, carbohydrates and fat. Daily calories are compared
  with the user's `calorieTarget` when one is set (`caloriesVsTarget` in
  the response). (Ingredient quantities, by contrast, are per whole
  recipe, so shopping-list scaling still uses
  `plannedServings / recipe.servings` — do not confuse the two.)
- **Incomplete-data rule (critical):** a day is flagged `incomplete` when
  any planned recipe on that day has no nutrition data, or is missing any
  of the four nutrients. Totals only sum the values that exist, and the
  response names the missing recipes (`missingRecipes`) and nutrients
  (`missingNutrients`) — missing values are never silently treated as
  complete. The planner page shows a "Partial — nutrition missing" badge
  for such days.
- **Unit-combining rule:** ingredients combine only when their normalised
  name **and** normalised unit are identical (grams with grams). Different
  units — grams vs cups, ml vs tbsp — are never auto-converted and stay
  as separate lines. Ingredient quantities scale by
  `plannedServings / recipe.servings`.
- **Category mapping:** a documented keyword list in
  `server/utils/shopping.js` (meat, dairy, produce, grains, pantry,
  other), checked in that order; anything unmatched is `other`. It is
  deliberately simple and transparent so Phase 4 can add pantry detection
  on top without changing the generation shape.
- **Regeneration rule:** regenerating a list after a plan change keeps
  every manual item unchanged, keeps the checked state of any auto item
  that still exists (same normalised name + unit), drops auto items no
  longer in the plan, and adds new auto items unchecked.
- **Print view:** the shopping-list page has a print stylesheet that hides
  navigation and controls; the Print button calls `window.print()`.

## API (Phase 4)

- `GET /api/pantry?q=` — the user's pantry items, each with `expiryStatus`
  (`expired`, `expiring-soon`, `fresh`, `none`) and `daysUntilExpiry`
- `POST /api/pantry` — body `{ name, quantity?, unit?, expirationDate?,
  category? }` (category is auto-detected when omitted)
- `PATCH /api/pantry/:id` — edit any pantry field
- `DELETE /api/pantry/:id` — remove an item
- `GET /api/recipes/recommendations?limit=&mode=` — rule-based recommendations
  on local seeded recipes only. `mode=default` (all pantry items) or
  `mode=expiring` (expired + expiring-soon pantry items only, prioritised
  by expiring-ingredient matches). Each recipe carries `score`, a plain
  `reasons` array, `pantryMatches`, and `plannedThisWeek`. Shopping-list
  items also carry `inPantry` (see below).

All pantry routes require authentication, and every lookup is scoped to the
logged-in user — another user's pantry item answers **404, not 403**.

### Phase 4 design decisions (documented, tested)

- **Pantry duplicate rule:** one entry per user per normalised name + unit.
  Normalisation is plural-tolerant (see `utils/ingredientMatch.js`), so
  "Tomato" and "Tomatoes" in the same unit are the same entry. Creating a
  duplicate is a **409** — edit the existing entry's quantity instead.
  The same ingredient in a different unit is a separate entry.
- **Expiry threshold:** "expiring soon" means the expiration date is today
  or within the next **7 days** (calendar days, UTC); before today is
  "expired", later is "fresh", and no date is "none" — see
  `server/utils/expiry.js`. Expiry labels are informational only: an item
  can be unsafe before its date, and a date that has not passed does not
  make food safe. The pantry page carries that wording.
- **Recommendation scoring:** +20 for a dietary tag matching a user
  preference, +8 per required ingredient already in the pantry (capped at
  +40), +15 for a preferred cuisine, +15 for sharing a cuisine with a
  saved recipe (+10 for sharing a dietary tag instead), +10 for total time
  of 30 minutes or less, and −25 for a recipe already planned for the
  current week (demoted, never hidden). In expiring mode each
  expiring-soon ingredient is worth +12 (capped at +60) and results sort
  by expiring-ingredient matches first, then score. Ties break by total
  time, then title. No machine learning is involved.
- **Dietary exclusion rule (hard):** a vegetarian preference excludes any
  recipe with a meat/fish ingredient keyword (chicken, beef, lamb, pork,
  mince, sausage, bacon, fish, salmon, tuna, prawn, shrimp, turkey, duck,
  ham, anchovy, gelatin, meat, oyster). A vegan preference excludes those
  plus dairy/egg/honey keywords (milk, cheese, butter, yogurt, cream, egg,
  honey, ghee, mozzarella, feta, cheddar, parmesan, sour cream, whey).
  A recipe allergen matching a user allergy is also excluded. Other
  preferences (gluten-free, dairy-free, high-protein, halal-friendly) are
  boosts only, never hard exclusions, because the ingredient data cannot
  reliably prove a sauce or stock is gluten-free. Dietary tags remain
  filters, not certified guarantees.
- **Pantry flag on shopping lists:** when a list is generated or read,
  every item whose name matches a pantry item is marked `inPantry: true`
  (same tolerant matching as ingredient search). The line is kept and its
  quantity is **never** reduced or removed automatically, because the
  pantry record does not reliably say how much is available for that
  recipe. The flag is recomputed from the current pantry on every read,
  so pantry changes after generation are reflected. All Phase 3
  generation rules (same-unit combining only, regeneration preserving
  manual items and checked states) are unchanged.
- **Nutrition vs shopping scaling (do not confuse):** stored nutrition is
  per serving, so planner totals use per-serving nutrition ×
  plannedServings; ingredient quantities are per whole recipe, so shopping
  scaling uses plannedServings / recipe.servings. A stale comment in
  `utils/shopping.js` that called these "the same factor" was corrected
  in Phase 4.

## API (Phases 1–2)

- `POST /api/auth/register` — name, email, password (min 8 characters)
- `POST /api/auth/login` — email, password
- `POST /api/auth/logout`
- `GET /api/auth/me` — requires the login cookie
- `GET /api/recipes` — `q`, `cuisine`, `dietary`, `mealType`, `maxTime` (total
  prep + cook minutes), `sort` (`time` = quickest first, otherwise newest),
  `page`, `limit`
- `GET /api/recipes/search` — alias for the same list controller
- `GET /api/recipes/by-ingredients` — `ingredients` (comma-separated, required),
  `sort` (`match` = best match first, or `fewest-missing`), `page`, `limit`.
  Each recipe carries a `match` object: `have`, `missing` (required only),
  `optionalHave`, `optionalMissing`, `matchPercentage`, `isPerfectMatch`
  (true only when every required ingredient is present) and
  `additionalIngredientsRequired`. Matching is case-insensitive and tolerant
  of simple plurals and whole-word ingredient names ("chicken" matches
  "chicken breast"). This endpoint works on local recipes only.
- `GET /api/recipes/:id` — recipe details
- `GET /api/favorites` — the logged-in user's saved recipes; filters `q`,
  `cuisine`, `dietary`, `mealType`, `collection` (a collection id, or `none`
  for favorites with no collection), `page`, `limit`
- `POST /api/favorites` — body `{ recipeId, collectionId? }`
- `PATCH /api/favorites/:recipeId` — body `{ collectionId }` (or `null` to
  remove from a collection)
- `DELETE /api/favorites/:recipeId` — remove by recipe id
- `GET /api/favorites/collections` — the user's collections
- `POST /api/favorites/collections` — body `{ name }`
- `PATCH /api/favorites/collections/:id` — rename
- `DELETE /api/favorites/collections/:id` — delete (saved recipes keep the
  recipe, lose the collection)
- `GET /api/profile` — the logged-in user's profile
- `PATCH /api/profile` — name, dietaryPreferences, allergies,
  preferredCuisines, preferredMealTypes, calorieTarget, servingPreference.
  Email, role and password are never changed here.

All responses use one shape: `{ success, message, data }` on success and
`{ success, message, errors? }` on failure. Recipe, favorite and profile
routes require authentication. The frontend has protected routes: the landing
page is public; discovery, recipe details, favorites, by-ingredients and
profile require login.

### Phase 2 design decisions (documented, tested)

- **Duplicate favorite:** idempotent — saving a recipe that is already saved
  returns the existing favorite with 200, so a heart toggle can call it safely.
- **Delete by recipe id:** favorites are deleted as
  `DELETE /api/favorites/:recipeId`, because the frontend toggle knows the
  recipe, not the favorite record id.
- **Other users' records:** favorites and collections are always scoped to the
  logged-in user, and lookups that miss that scope answer **404, not 403**,
  so one user can never learn whether another user's record exists.
- **Serving fractions:** quantities scale proportionally, then display as a
  whole number, or the nearest common kitchen fraction (denominators up to 8,
  including thirds) within 0.04 — e.g. 0.5 → "1/2", 1.5 → "1 1/2" — otherwise
  a decimal rounded to 2 places. Ingredients with no quantity stay "to taste".
  The logic lives in `server/utils/servings.js` and is mirrored in
  `client/src/utils/servings.js`; the server copy is unit-tested.
- **Serving selector range:** 1–20 servings. Nutrition is per serving, so it
  does not change when servings change.

## Pages (Phase 5 additions)

- `/` (logged in) and `/dashboard` — welcome message, search entry point
  (links to `/discover?q=…`), suggested recipes with their reasons,
  recently viewed, favorites, today's meals, week overview, shopping
  progress, pantry expiring soon (with the informational expiry
  disclaimer) and the daily nutrition summary with the incomplete-data
  flag. The public landing page stays at `/` for logged-out visitors.
- `/admin` — admin overview: user/recipe/favorite/plan/list/pantry
  counts, discovery-cache stats, server health, and recent server errors.
  The Admin badge in the navigation links here, but only for admins.
- `/admin/recipes` — searchable, paginated recipe list, create/edit form
  (ingredients one per line as "quantity unit name", instructions one step
  per line), and delete with a confirmation dialog that states the
  reference rule (favorites and planner slots keep the id and resolve
  gracefully).
- `/admin/categories` — cuisines with recipe counts and a rename form
  (current name + new name), with a note that renaming merges into an
  existing cuisine when the new name already exists.

## Deployment (free-tier path)

A realistic free setup is: MongoDB Atlas (M0 free cluster) for the
database, a Node host (for example Render's free web service) for the
backend, and a static host (for example Netlify or Vercel) for the
frontend built with `npm run build`.

1. **Database — MongoDB Atlas:** create a free M0 cluster, add a database
   user, and allow your backend host's IP (or `0.0.0.0/0` while testing
   only). Copy the connection string; it becomes `MONGO_URI`. The
   database name in the string can stay `mealmate`.
2. **Backend — Node host:** deploy the `server/` folder. Set the
   environment variables below on the host (never in code, never in git).
   Start command: `npm start`. The backend must be reachable over HTTPS
   in production, because the login cookie is `Secure` when
   `NODE_ENV=production`.
3. **Frontend — static host:** build from the `client/` folder
   (`npm run build`, output `dist/`). Set `VITE_API_URL` to the backend's
   public origin (for example `https://mealmate-api.onrender.com`) — the
   client uses it for API calls when it is set, and falls back to the
   `/api` proxy in local development. Set the backend's `CLIENT_URL` to
   the frontend's public origin so CORS and the cookie work.
4. **Seed once:** run `npm run seed` against the Atlas database (set
   `MONGO_URI` to the Atlas string locally, run the seed, then unset it),
   or run it on the host once. The seed creates the admin and demo
   accounts listed above — change those passwords immediately in
   production, or better, create a fresh admin and delete the demo user.
5. **Free-tier limits to know about:** free Node hosts sleep when idle
   (the first request after sleep is slow, and the in-memory discovery
   cache and error log reset on every restart — that is expected, they
   are not persistent stores), and free Atlas clusters cap storage.
   Nothing in the app requires a paid tier to run.

### Environment variables (full list)

Backend (`server/.env`, from `server/.env.example`):

- `PORT` — backend port (default 5000 locally)
- `NODE_ENV` — `development` or `production` (controls the `Secure`
  cookie flag)
- `MONGO_URI` — MongoDB connection string (required)
- `JWT_SECRET` — long random string for signing login cookies (required)
- `JWT_EXPIRE` — cookie/session lifetime (default `8h`)
- `CLIENT_URL` — frontend origin for CORS (default
  `http://localhost:5173`)
- `RECIPE_API_KEY` — optional Spoonacular key; empty means seeded
  recipes only

Frontend (`client/.env`, from `client/.env.example`):

- `VITE_API_URL` — backend origin in production; unset locally (the Vite
  dev proxy forwards `/api` to `http://localhost:5000`)

**Never commit real credentials.** `.env` files are git-ignored; only
`.env.example` files with placeholders belong in the repository. If a real
secret is ever committed, rotate it (change the JWT secret, the Atlas
password, and the recipe API key) — deleting the commit is not enough.

## Acceptance criteria (spec section 19) — status

| Criterion | Status | Evidence |
|---|---|---|
| A new user can register, log in, and log out | ✅ Implemented and tested | Phase 1 tests: register/login, invalid credentials, protected routes |
| A user can search and filter real or locally seeded recipes | ✅ Implemented and tested | Phase 1 tests + Phase 5 cache tests; external provider optional, falls back to seeded recipes |
| Ingredient-based search identifies available and missing ingredients | ✅ Implemented and tested | Phase 2 tests: have/missing/match %, perfect-match rule |
| Recipe serving changes update ingredient quantities | ✅ Implemented and tested | Phase 2 tests + serving-scaling unit tests |
| Favorites remain saved across sessions | ✅ Implemented and tested | Phase 2 tests: favorites are database records, not browser state |
| Users can create and edit a persistent weekly meal plan | ✅ Implemented and tested | Phase 3 tests: create/get, slot set/replace/copy/clear |
| The shopping list can be generated from planned meals | ✅ Implemented and tested | Phase 3 tests: generation from a plan |
| Matching ingredients are combined only when their measurements are compatible | ✅ Implemented and tested | Phase 3 tests: same-unit combining, different-unit non-combining |
| Pantry data persists and influences recipe suggestions | ✅ Implemented and tested | Phase 4 tests: pantry CRUD + recommendation ordering/reasons |
| Nutrition summaries accurately reflect available data and disclose missing values | ✅ Implemented and tested | Phase 3 tests + Phase 5 dashboard test: per-serving × planned servings, incomplete flag, missing recipes named |
| One user cannot access another user's private data | ✅ Implemented and tested | Phase 2–5 tests: other users' favorites, plans, lists, pantry and dashboard data answer 404 or are absent |
| Admin functionality is protected by backend authorization | ✅ Implemented and tested | Phase 5 tests: 403 for regular users on every admin endpoint, 401 without login |
| The app remains usable when the external recipe API fails or reaches its quota | ✅ Implemented, partially tested | Backend falls back to seeded recipes on any external failure (5s timeout); live failure behaviour still needs a real key to confirm — see caveats |
| Core flows are tested and documented | ✅ Implemented and tested | 60 server tests passing, client production build passing, this README |
| The application works on desktop and mobile | ⚠️ Partially verified | Layouts are responsive (stacked grids, wrapping navigation) and the client build passes, but no real-device or small-screen browser check has been done yet — see caveats |

### Caveats — still needing a live run on a real PC

- **Live MongoDB end-to-end:** all tests run against an in-memory
  database. The seed, login, dashboard, admin pages, cache stats and
  rate limits still need confirming against a real MongoDB server (local
  or Atlas) with `npm run seed` + `npm run dev`.
- **External API without a key:** the no-key path (seeded recipes only)
  is the default and is tested; the with-a-key path and its failure
  fallback have not been exercised against the real Spoonacular API.
- **Recipe image rendering:** seeded recipes use placeholder image URLs
  with an on-error fallback; actual image loading has not been checked
  in a browser.
- **Mobile:** responsive classes are in place but no real phone or
  small-screen browser check has been done.

## Pages (Phase 4 additions)

- `/pantry` — add, edit, remove and search pantry items, with expiry badges
  (Expired / Expiring soon / Fresh / No expiry date) and the informational
  expiry disclaimer, plus a "Use expiring ingredients" section that
  prioritises recipes using expired or soon-to-expire items.
- `/recommendations` — rule-based recommendations with the plain-language
  reasons shown under each card, and a note when a recipe is already
  planned this week. Shopping-list items that match the pantry show an
  "In pantry" badge on `/shopping`, with a note that nothing is removed
  or subtracted automatically.

## Pages (Phase 3 additions)

- `/planner` — the weekly planner: previous/next/current-week navigation,
  7 days each with breakfast/lunch/dinner/snacks slots, a recipe picker
  (all recipes or favorites) with a servings choice, replace/remove/copy
  to another day, clear a day or the whole week, and per-day nutrition
  totals with the incomplete-data badge. Days stack vertically on mobile
  so the page stays usable on a small screen; a link on each week goes to
  that week's shopping list.
- `/shopping` — shopping lists: generate/regenerate from a week's plan,
  pick a saved list, items grouped by category, check-off, manual add,
  edit/remove items, delete a list, and a print-friendly view.

## Pages (Phase 2 additions)

- `/favorites` — saved recipes with search/filter, collection creation,
  renaming and deletion, and a per-recipe collection picker.
- `/ingredients` — enter ingredients you have, see each recipe's match %,
  ingredients you have, ingredients still needed, and a "Perfect match" badge
  only when all required ingredients are present.
- `/profile` — edit name, dietary preferences, allergies, preferred cuisines
  and meal types, calorie target and usual servings. The page repeats the
  disclaimer: dietary tags are filters, not certifications of halal or
  allergen-free status.

## Tests

```
cd server
npm test
```

Tests cover register/login, invalid credentials, protected routes without
auth, and recipe search/filter (cuisine, dietary tag, name, maxTime) plus a
single-recipe lookup and a 404 — and, in Phase 2: favorite create/list/
remove, duplicate-favorite idempotence, favorite/collection ownership between
users, collection create/assign/filter/rename/delete, favorites search,
profile update and validation (including that role cannot be changed via
profile), ingredient matching (have/missing/match %, optional ingredients
excluded from missing, perfect-match rule, fewest-missing sort), and unit
tests for the serving-scaling utility — and, in Phase 3 (10 new tests):
meal-plan create/get, Monday normalisation, one plan per user per week,
occupied-slot 409 vs explicit replace, copy to another day, clear day/week,
ownership between users (404), per-day nutrition totals and the
incomplete-data flag, shopping-list generation, same-unit combining,
different-unit non-combining, serving-size scaling, regeneration preserving
manual items and checked states, item check/edit/delete/manual-add, and
unauthenticated 401s — and, in Phase 4 (12 new tests): pantry CRUD,
duplicate rule (including plural variants), pantry ownership between
users (404), pantry search, expiry classification unit tests, recommendation
ordering and reasons, vegetarian and vegan exclusion, current-week planned
recipe demotion, expiring-mode prioritisation, recommendation scoring unit
tests, and the shopping-list pantry flag with no quantity subtraction — and,
in Phase 5 (14 new tests): admin authorization (401 unauthenticated, 403
for regular users on every admin endpoint), admin stats/health/logs, admin
recipe CRUD and validation, recipe-delete reference behaviour (favorites
survive and resolve to `null`), category list/rename and validation,
dashboard aggregation (today's meals, week overview, shopping progress,
pantry expiring, nutrition incomplete flag with per-serving × planned
servings, recently viewed ordering and the 10-item cap, ownership between
users), and discovery-cache behaviour (second identical request is a hit,
admin recipe change invalidates it). They
use `mongodb-memory-server` and do not touch your real database.

## Troubleshooting

- `MONGO_URI is not set` — you have not created `server/.env` from
  `server/.env.example` yet.
- `MongooseServerSelectionError` / connection refused — MongoDB server is
  not running (check `mongod`, or your Atlas IP allow-list), or the
  connection string is wrong. Compass being installed does not start a server.
- `Seed failed: Coupon validation failed` — that is a different project
  (ShopNova); MealMate's seed does not use coupons.
- Frontend shows “Couldn’t load recipes” — check the server terminal is
  running on port 5000 and you are logged in; recipe routes require the
  login cookie.
- Port already in use — only one of ShopNova, QueueCare, QuizArena and
  MealMate can use backend port 5000 / frontend port 5173 at a time.
  Stop the other project's servers first.

## Honest status

Phases 1–5 were verified here with the full server test suite
(60 tests passing) and a passing client production build, but not against a
live MongoDB server on a real PC, so the final confirmation step is yours:
run `npm run seed` and `npm run dev` on your machine and confirm the seed log,
login, search, favorites, ingredient search, serving rescaling, profile
saving, the weekly planner (add/replace/copy/clear, nutrition totals and
the incomplete-data badge), and shopping-list generation, check-off,
regeneration and printing all work, plus pantry add/edit/remove and
expiry badges, the recommendations page and its reasons, expiring
suggestions on the pantry page, and the "In pantry" flag on shopping
lists — and, new in Phase 5, the dashboard as the logged-in home page
(today's meals, week overview, shopping progress, pantry expiring soon,
nutrition summary, recently viewed), the admin pages (stats/health/logs,
recipe create/edit/delete with confirmation, category rename), and the
cache stats on the admin overview (hits/misses change as you search).
If any step fails, paste the exact server terminal error and it
can be fixed from that message.
