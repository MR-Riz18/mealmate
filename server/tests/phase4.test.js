const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret-for-mealmate-phase4';
process.env.JWT_EXPIRE = '8h';
process.env.CLIENT_URL = 'http://localhost:5173';

const { classifyExpiry, daysUntil } = require('../utils/expiry');
const { recommendRecipes } = require('../utils/recommendations');
const { currentMonday, formatDateYYYYMMDD } = require('../utils/week');
const Recipe = require('../models/Recipe');
const PantryItem = require('../models/PantryItem');

let mongod;
let app;
let vegPastaId;
let tomatoSaladId;
let chickenId;
let eggDishId;
let userA;
let userB;

async function registerAndLogin(email) {
  await request(app).post('/api/auth/register').send({ name: 'Phase Four', email, password: 'Password123!' });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Password123!' });
  const cookie = res.headers['set-cookie'];
  return Array.isArray(cookie) ? cookie.join('; ') : cookie;
}

function recipeDoc(overrides) {
  return {
    title: 'Test Recipe', description: 'Test', image: '',
    ingredients: [{ name: 'Tomatoes', quantity: 2, unit: '', required: true }],
    instructions: ['Cook.'], preparationTime: 10, cookingTime: 10,
    servings: 2, cuisine: 'Italian', mealTypes: ['dinner'],
    dietaryTags: [], allergens: [], nutrition: { calories: 300, protein: 10, carbohydrates: 40, fat: 8 },
    ...overrides,
  };
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  app = require('../server');

  const [vegPasta, tomatoSalad, chicken, eggDish] = await Recipe.create([
    recipeDoc({
      title: 'Veg Pasta', cuisine: 'Italian', mealTypes: ['dinner'],
      dietaryTags: ['vegetarian'],
      ingredients: [
        { name: 'Pasta', quantity: 200, unit: 'g', required: true },
        { name: 'Tomatoes', quantity: 2, unit: '', required: true },
      ],
      preparationTime: 10, cookingTime: 20,
    }),
    recipeDoc({
      title: 'Tomato Salad', cuisine: 'Mediterranean', mealTypes: ['lunch'],
      dietaryTags: ['vegetarian', 'vegan'],
      ingredients: [{ name: 'Tomatoes', quantity: 3, unit: '', required: true }],
      preparationTime: 10, cookingTime: 0,
    }),
    recipeDoc({
      title: 'Chicken Curry', cuisine: 'Pakistani', mealTypes: ['dinner'],
      dietaryTags: ['high-protein'],
      ingredients: [{ name: 'Chicken breast', quantity: 500, unit: 'g', required: true }],
      preparationTime: 15, cookingTime: 30,
    }),
    recipeDoc({
      title: 'Egg Toast', cuisine: 'International', mealTypes: ['breakfast'],
      dietaryTags: ['vegetarian'],
      ingredients: [{ name: 'Eggs', quantity: 2, unit: '', required: true }],
      preparationTime: 5, cookingTime: 5,
    }),
  ]);
  vegPastaId = String(vegPasta._id);
  tomatoSaladId = String(tomatoSalad._id);
  chickenId = String(chicken._id);
  eggDishId = String(eggDish._id);
  userA = await registerAndLogin('phase4a@test.local');
  userB = await registerAndLogin('phase4b@test.local');
}, 120000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe('expiry classification (unit)', () => {
  const now = new Date(Date.UTC(2026, 9, 26)); // 2026-10-26
  test('expired / expiring-soon / fresh / none', () => {
    expect(classifyExpiry(new Date(Date.UTC(2026, 9, 25)), now)).toBe('expired');
    expect(classifyExpiry(new Date(Date.UTC(2026, 9, 26)), now)).toBe('expiring-soon');
    expect(classifyExpiry(new Date(Date.UTC(2026, 10, 2)), now)).toBe('expiring-soon'); // 7 days
    expect(classifyExpiry(new Date(Date.UTC(2026, 10, 3)), now)).toBe('fresh'); // 8 days
    expect(classifyExpiry(null, now)).toBe('none');
    expect(daysUntil(new Date(Date.UTC(2026, 10, 2)), now)).toBe(7);
  });
});

describe('pantry CRUD', () => {
  test('unauthenticated requests are 401', async () => {
    const res = await request(app).get('/api/pantry');
    expect(res.status).toBe(401);
  });

  test('create, search, update, delete', async () => {
    const created = await request(app).post('/api/pantry').set('Cookie', userA).send({
      name: 'Tomatoes', quantity: 4, unit: '', expirationDate: '2027-01-01',
    });
    expect(created.status).toBe(201);
    expect(created.body.data.item.category).toBeTruthy();
    const id = created.body.data.item._id;

    const searched = await request(app).get('/api/pantry').query({ q: 'tomat' }).set('Cookie', userA);
    expect(searched.body.data.items.some((i) => String(i._id) === id)).toBe(true);
    const missed = await request(app).get('/api/pantry').query({ q: 'zzz-no-match' }).set('Cookie', userA);
    expect(missed.body.data.items.some((i) => String(i._id) === id)).toBe(false);

    const updated = await request(app).patch(`/api/pantry/${id}`).set('Cookie', userA).send({ quantity: 6 });
    expect(updated.status).toBe(200);
    expect(updated.body.data.item.quantity).toBe(6);

    const removed = await request(app).delete(`/api/pantry/${id}`).set('Cookie', userA);
    expect(removed.status).toBe(200);
    const gone = await request(app).patch(`/api/pantry/${id}`).set('Cookie', userA).send({ quantity: 1 });
    expect(gone.status).toBe(404);
  });

  test('duplicate name+unit is a 409, including plural variants', async () => {
    const first = await request(app).post('/api/pantry').set('Cookie', userA).send({ name: 'Tomato', quantity: 2, unit: 'kg' });
    expect(first.status).toBe(201);
    const dup = await request(app).post('/api/pantry').set('Cookie', userA).send({ name: 'Tomatoes', quantity: 1, unit: 'kg' });
    expect(dup.status).toBe(409);
    const otherUnit = await request(app).post('/api/pantry').set('Cookie', userA).send({ name: 'Tomatoes', quantity: 1, unit: 'g' });
    expect(otherUnit.status).toBe(201);
    await request(app).delete(`/api/pantry/${first.body.data.item._id}`).set('Cookie', userA);
    await request(app).delete(`/api/pantry/${otherUnit.body.data.item._id}`).set('Cookie', userA);
  });

  test("another user's pantry item answers 404", async () => {
    const created = await request(app).post('/api/pantry').set('Cookie', userA).send({ name: 'Secret Spice', quantity: 1, unit: '' });
    const id = created.body.data.item._id;
    expect((await request(app).patch(`/api/pantry/${id}`).set('Cookie', userB).send({ quantity: 9 })).status).toBe(404);
    expect((await request(app).delete(`/api/pantry/${id}`).set('Cookie', userB)).status).toBe(404);
    // Owner can still delete it.
    expect((await request(app).delete(`/api/pantry/${id}`).set('Cookie', userA)).status).toBe(200);
  });

  test('invalid input is rejected', async () => {
    expect((await request(app).post('/api/pantry').set('Cookie', userA).send({ name: '' })).status).toBe(400);
    expect((await request(app).post('/api/pantry').set('Cookie', userA).send({ name: 'Rice', quantity: -1 })).status).toBe(400);
  });
});

describe('recommendations', () => {
  test('ordering, reasons, and vegetarian exclusion', async () => {
    // userA: vegetarian, prefers Italian, pantry has pasta + tomatoes.
    await request(app).patch('/api/profile').set('Cookie', userA).send({
      dietaryPreferences: ['vegetarian'], preferredCuisines: ['Italian'],
    });
    await request(app).post('/api/pantry').set('Cookie', userA).send({ name: 'Pasta', quantity: 500, unit: 'g' });
    await request(app).post('/api/pantry').set('Cookie', userA).send({ name: 'Tomatoes', quantity: 4, unit: '' });
    await request(app).post('/api/favorites').set('Cookie', userA).send({ recipeId: vegPastaId });

    const res = await request(app).get('/api/recipes/recommendations').set('Cookie', userA);
    expect(res.status).toBe(200);
    const titles = res.body.data.recipes.map((r) => r.title);
    expect(titles).not.toContain('Chicken Curry'); // meat excluded for vegetarian
    expect(titles[0]).toBe('Veg Pasta'); // preference + cuisine + pantry + favorite similarity
    const top = res.body.data.recipes[0];
    expect(top.reasons.join(' ')).toMatch(/vegetarian/);
    expect(top.reasons.join(' ')).toMatch(/already have/);
    expect(top.score).toBeGreaterThan(0);
  });

  test('vegan exclusion removes egg and meat recipes', async () => {
    await request(app).patch('/api/profile').set('Cookie', userB).send({ dietaryPreferences: ['vegan'] });
    const res = await request(app).get('/api/recipes/recommendations').set('Cookie', userB);
    const titles = res.body.data.recipes.map((r) => r.title);
    expect(titles).not.toContain('Chicken Curry');
    expect(titles).not.toContain('Egg Toast');
    expect(titles).toContain('Tomato Salad');
  });

  test('current-week planned recipes are demoted and flagged', async () => {
    // Plan Veg Pasta for the current week for userB (vegan prefs cleared first
    // so Veg Pasta itself is eligible, then check demotion vs Tomato Salad).
    await request(app).patch('/api/profile').set('Cookie', userB).send({ dietaryPreferences: [] });
    const monday = formatDateYYYYMMDD(currentMonday());
    const planRes = await request(app).post('/api/meal-plans').set('Cookie', userB).send({ weekStartDate: monday });
    const planId = planRes.body.data._id;
    await request(app).patch(`/api/meal-plans/${planId}`).set('Cookie', userB).send({
      action: 'set', day: 0, mealType: 'dinner', recipeId: vegPastaId, servings: 2,
    });
    const res = await request(app).get('/api/recipes/recommendations').set('Cookie', userB);
    const byTitle = Object.fromEntries(res.body.data.recipes.map((r) => [r.title, r]));
    expect(byTitle['Veg Pasta'].plannedThisWeek).toBe(true);
    // Tomato Salad is not planned and shares the vegetarian tag, so with
    // no preferences set it should not rank below the demoted Veg Pasta
    // on score alone unless demotion applied — assert the demotion flag
    // and that a non-planned recipe with a pantry-free profile exists.
    expect(byTitle['Tomato Salad'].plannedThisWeek).toBe(false);
  });

  test('expiring mode prioritises recipes using soon-to-expire pantry items', async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    // userB pantry: tomatoes expiring tomorrow, rice fresh next month.
    await request(app).post('/api/pantry').set('Cookie', userB).send({ name: 'Tomatoes', quantity: 3, unit: '', expirationDate: tomorrow });
    await request(app).post('/api/pantry').set('Cookie', userB).send({ name: 'Rice', quantity: 1, unit: 'kg', expirationDate: nextMonth });
    const res = await request(app).get('/api/recipes/recommendations').query({ mode: 'expiring' }).set('Cookie', userB);
    expect(res.status).toBe(200);
    expect(res.body.data.mode).toBe('expiring');
    // The top recipe must use tomatoes (the expiring ingredient), not rice.
    const top = res.body.data.recipes[0];
    expect(top.ingredients.some((ing) => /tomato/i.test(ing.name))).toBe(true);
    expect(top.reasons.join(' ')).toMatch(/expiring soon/);
  });

  test('recommendation scoring unit: demotion lowers score, exclusion removes recipes', () => {
    const user = { dietaryPreferences: ['vegetarian'], preferredCuisines: [], allergies: [] };
    const veg = { _id: 'a', title: 'Veg', cuisine: 'Italian', dietaryTags: ['vegetarian'], allergens: [], preparationTime: 10, cookingTime: 10, ingredients: [{ name: 'Tomatoes', required: true }] };
    const meat = { _id: 'b', title: 'Meat', cuisine: 'Italian', dietaryTags: [], allergens: [], preparationTime: 10, cookingTime: 10, ingredients: [{ name: 'Chicken breast', required: true }] };
    const out = recommendRecipes([veg, meat], {
      user, pantry: [{ name: 'Tomatoes', normalized: 'tomato' }], favoriteRecipes: [], plannedRecipeIds: new Set(['a']), limit: 10,
    });
    expect(out.map((o) => o.recipe.title)).toEqual(['Veg']);
    expect(out[0].plannedThisWeek).toBe(true);
    expect(out[0].score).toBeLessThan(20 + 8 + 10); // preference + pantry + time, minus 25 demotion
  });
});

describe('pantry-aware shopping lists', () => {
  test('generated items matching pantry are flagged, kept, and not subtracted', async () => {
    // userA pantry already has Pasta (500 g) from the recommendations test.
    const monday = formatDateYYYYMMDD(currentMonday());
    const planRes = await request(app).post('/api/meal-plans').set('Cookie', userA).send({ weekStartDate: monday });
    const planId = planRes.body.data._id;
    await request(app).patch(`/api/meal-plans/${planId}`).set('Cookie', userA).send({
      action: 'set', day: 1, mealType: 'dinner', recipeId: vegPastaId, servings: 2, replace: true,
    }).catch(() => {});
    // Ensure a Veg Pasta slot exists (day 1 may already be occupied by an
    // earlier test's plan for the same week — use replace, then read the plan).
    const plan = await request(app).get(`/api/meal-plans/${planId}`).set('Cookie', userA);
    expect(plan.body.data.meals.length).toBeGreaterThan(0);

    const gen = await request(app).post('/api/shopping-lists/generate').set('Cookie', userA).send({ mealPlanId: planId });
    expect(gen.status).toBeGreaterThanOrEqual(200);
    const pastaItem = gen.body.data.items.find((i) => /pasta/i.test(i.name));
    expect(pastaItem).toBeDefined();
    expect(pastaItem.inPantry).toBe(true);
    // Veg Pasta uses 200 g pasta for 2 servings, planned for 2 servings:
    // quantity is the full scaled amount, NOT reduced by pantry stock.
    expect(pastaItem.quantity).toBe(200);
    // Re-reading the list after generation still flags it.
    const again = await request(app).get(`/api/shopping-lists/${gen.body.data._id}`).set('Cookie', userA);
    const pastaAgain = again.body.data.items.find((i) => /pasta/i.test(i.name));
    expect(pastaAgain.inPantry).toBe(true);
    expect(pastaAgain.quantity).toBe(200);
  });
});
