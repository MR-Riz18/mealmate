# MealMate — modernised (from the supplied `mealmate.zip`)

Same app, same features, same routes and API. Only bugs were fixed and the
UI was refreshed. No backend API contract changed, no rebranding, no
feature added or removed.

## Bugs found and fixed

1. **Admin recipe edit wiped instructions — `client/src/pages/admin/AdminRecipes.jsx`**
   `toForm()` read each instruction as `s.instruction`, but the server stores
   instructions as plain strings (`Recipe.instructions: [String]`), so every
   step became `""` when an admin opened a recipe for editing — and saving
   then deleted the instructions. Fixed to read the string itself
   (tolerating the object shape too).
   The matching `toBody()` sent instructions as `[{ step, instruction }]`
   objects; Mongoose cast each object to the literal string `"[object Object]"`,
   so admin-created recipes had garbage instructions. Fixed to send an array
   of trimmed strings, the shape the server stores.

2. **Meal planner broke after any change — `client/src/pages/MealPlanner.jsx`**
   `GET /api/meal-plans` returns the wrapper `{ plan, weekStartDate,
   daySummaries, calorieTarget }`, but `POST` and `PATCH /api/meal-plans/:id`
   return the plan object itself (no `plan` key). The page stored the
   POST/PATCH response as-is, so after creating a plan or adding / replacing /
   removing / copying a slot, `data.plan` was `undefined` and the page wrongly
   showed "No plan for this week yet" until a manual reload (and creating a
   plan for a fresh week could crash on `current._id` in `ensurePlan`).
   Fixed with a `normalizeWeekData()` helper that wraps the bare-plan shape
   into the GET wrapper shape; used by `refresh()`, `handleCreate()` and
   `ensurePlan()`. Server responses untouched.

3. **Dashboard "Carbs" always showed "—" — `client/src/pages/Dashboard.jsx`**
   The page read `todayNutrition.totals.carbs`, but the server sends the key
   `carbohydrates` (`server/utils/nutrition.js`: `['calories', 'protein',
   'carbohydrates', 'fat']`). Fixed to `totals.carbohydrates`.

4. **Missing `.env.example` files (new files)**
   The README tells you to `copy .env.example .env` in both `server/` and
   `client/`, but neither file existed in the zip. Added
   `server/.env.example` and `client/.env.example` with placeholders only
   (no real secrets). Setup now works exactly as the README describes.

5. **Stale landing-page copy — `client/src/pages/Landing.jsx`**
   Said "Ingredient matching arrives in Phase 2" and "in later phases — plan
   your week…", although Phases 2–5 are all done. Wording updated to describe
   what the app does now. Also the third feature card now describes the
   planner/shopping/pantry flow instead of repeating the seed-data note.

6. **Generic error title — `client/src/components/Skeleton.jsx`**
   `ErrorState` always said "Couldn't load recipes", even on the profile,
   pantry and admin pages. It now takes an optional `title` prop
   (default "Something went wrong").

Checked and found **not** broken: all client API calls match the server
routes and response shapes (recipes, by-ingredients match object, favorites
+ collections, profile, meal plans, shopping lists incl. `mealPlan` /
`groupedItems`, pantry expiry fields, dashboard aggregation, admin
stats/health/logs/recipes/categories); `node --check` passes on every server
file; the client production build passed before and after these changes.

## UI changes (same pages, same features)

- **Theme** (`client/tailwind.config.js`): full warm-amber brand scale
  (50–900), a `shadow-soft` / `shadow-lift` pair, system font stack.
- **Shared building blocks** (`client/src/index.css`): `.btn-primary`,
  `.btn-secondary`, `.btn-danger`, `.btn-ghost`, `.field` (inputs) and
  `.card` classes, so buttons/inputs/cards look the same on every page;
  consistent visible `:focus-visible` rings; warm selection colour; the
  shopping-list print stylesheet is unchanged.
- **Header** (`client/src/components/Navbar.jsx`): dark slate-900 sticky
  header over light content, amber logo mark, active-page highlighting
  (NavLink), links wrap cleanly on small screens, amber Admin badge.
- **Recipe cards** (`client/src/components/RecipeCard.jsx`): hover lift +
  image zoom, soft shadow, gradient under the image, cleaner meta row with a
  divider, ringed dietary chips.
- **Landing** (`client/src/pages/Landing.jsx`): eyebrow label, larger hero
  type with an amber accent, icon feature cards, third card now covers
  planning/shopping/pantry.
- **Auth** (`client/src/pages/Auth.jsx`): deeper card shadow, more padding.
- **Consistency pass**: page headings are now `text-3xl tracking-tight`
  everywhere; cards use a neutral `slate-200/80` border with a soft shadow
  instead of the flat orange border; primary buttons and text inputs use the
  shared classes on all pages; recipe-detail stat pills are amber chips.

## How to run

```bash
# Server (terminal 1)
cd server
cp .env.example .env        # then set MONGO_URI and JWT_SECRET
npm install
npm run seed                # creates 29 recipes + demo accounts
npm run dev                 # http://localhost:5000

# Client (terminal 2)
cd client
npm install
npm run dev                 # http://localhost:5173
```

Demo logins (local development only): admin `admin@mealmate.local` /
`Admin123!`, user `user@mealmate.local` / `User123!`. Production build:
`cd client && npm run build` (output `dist/`).

## What was tested

- **Client build** (`npm install && npm run build` in `client/`): ✅ passes.
  `vite v5.4.21` — 113 modules transformed, `dist/index.html` 0.43 kB,
  CSS 25.32 kB, JS 311.82 kB (gzip 93.70 kB), built in ~6 s.
  (One build failure during the work — Tailwind `@apply` of a custom class
  named `input` created a circular dependency — was fixed by renaming the
  shared input class to `.field` and inlining the utility lists; the final
  build above is the passing one.)
- **Server syntax**: `node --check` on every file under `server/`: ✅ all pass.
- **Server test suite** (`npm test`, Jest + mongodb-memory-server):
  ✅ **60 of 60 tests pass** (5 suites: api, phase2, phase3, phase4, phase5),
  run in 37 s after the fix work.
  Note: the first two attempts in this sandbox failed for an environment
  reason, not a code reason — Jest's default cache lives in `/tmp`, and this
  VM's `/tmp` tmpfs (512 MB) was 94% full, so cache writes failed with
  `ENOSPC: no space left on device`. Re-running with the cache redirected
  to the home disk (`--cacheDirectory=$HOME/.cache/jest-mealmate`,
  `TMPDIR=$HOME/.cache/tmp`) made all 60 pass. If you see `ENOSPC` from
  Jest on your own machine, the same flag (or freeing `/tmp`) fixes it.
- **Live MongoDB / end-to-end**: not run here (no live MongoDB in this
  environment). Still needs the README's final confirmation on a real PC:
  `npm run seed`, log in, and walk through search, favorites, planner,
  shopping list, pantry, recommendations, dashboard and the admin pages.
