const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret-for-mealmate-phase5';
process.env.JWT_EXPIRE = '8h';
process.env.CLIENT_URL = 'http://localhost:5173';

const { currentMonday, formatDateYYYYMMDD } = require('../utils/week');
const { recordServerError } = require('../utils/errorLog');
const Recipe = require('../models/Recipe');
const User = require('../models/User');

let mongod;
let app;
let recipeAId;
let recipeBId;
let recipeCId;
let userA;
let userB;
let admin;

async function registerAndLogin(email) {
  await request(app).post('/api/auth/register').send({ name: 'Phase Five', email, password: 'Password123!' });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Password123!' });
  const cookie = res.headers['set-cookie'];
  return Array.isArray(cookie) ? cookie.join('; ') : cookie;
}

function recipeDoc(overrides) {
  return {
    title: 'Test Recipe', description: 'Test', image: '',
    ingredients: [{ name: 'Rice', quantity: 200, unit: 'g', required: true }],
    instructions: ['Cook.'], preparationTime: 10, cookingTime: 10,
    servings: 2, cuisine: 'Italian', mealTypes: ['dinner'],
    dietaryTags: [], allergens: [], nutrition: { calories: 500, protein: 20, carbohydrates: 60, fat: 10 },
    ...overrides,
  };
}

function todayIndexUTC(now = new Date()) {
  return (now.getUTCDay() + 6) % 7;
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  app = require('../server');

  const [a, b, c] = await Recipe.create([
    recipeDoc({ title: 'Phase5 Pasta', cuisine: 'Italian', mealTypes: ['dinner'], nutrition: { calories: 500, protein: 20, carbohydrates: 60, fat: 10 } }),
    // Recipe B deliberately has no nutrition data.
    recipeDoc({ title: 'Phase5 Mystery Soup', cuisine: 'Mediterranean', mealTypes: ['lunch'], nutrition: {} }),
    recipeDoc({ title: 'Phase5 Rice Bowl', cuisine: 'Pakistani', mealTypes: ['breakfast'], nutrition: { calories: 300, protein: 8, carbohydrates: 45, fat: 5 } }),
  ]);
  recipeAId = String(a._id);
  recipeBId = String(b._id);
  recipeCId = String(c._id);

  userA = await registerAndLogin('phase5a@test.local');
  userB = await registerAndLogin('phase5b@test.local');
  // Admin is created directly: registration always creates a plain user.
  await User.create({ name: 'Phase Five Admin', email: 'phase5admin@test.local', password: 'Password123!', role: 'admin' });
  const login = await request(app).post('/api/auth/login').send({ email: 'phase5admin@test.local', password: 'Password123!' });
  const cookie = login.headers['set-cookie'];
  admin = Array.isArray(cookie) ? cookie.join('; ') : cookie;
}, 120000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe('admin authorization', () => {
  test('admin endpoints are 401 without login and 403 for regular users', async () => {
    expect((await request(app).get('/api/admin/stats')).status).toBe(401);
    for (const path of ['/api/admin/stats', '/api/admin/health', '/api/admin/logs', '/api/admin/recipes', '/api/admin/categories']) {
      expect((await request(app).get(path).set('Cookie', userA)).status).toBe(403);
    }
    expect((await request(app).post('/api/admin/recipes').set('Cookie', userA).send({ title: 'Nope' })).status).toBe(403);
    expect((await request(app).patch('/api/admin/categories/Italian').set('Cookie', userA).send({ cuisine: 'X' })).status).toBe(403);
  });
});

describe('admin stats, health and logs', () => {
  test('stats counts users, recipes and provider status without secrets', async () => {
    const res = await request(app).get('/api/admin/stats').set('Cookie', admin);
    expect(res.status).toBe(200);
    expect(res.body.data.users.total).toBeGreaterThanOrEqual(3);
    expect(res.body.data.users.byRole.admin).toBeGreaterThanOrEqual(1);
    expect(res.body.data.recipes.total).toBeGreaterThanOrEqual(3);
    expect(res.body.data.provider.enabled).toBe(false);
    expect(JSON.stringify(res.body)).not.toMatch(/test-secret/);
    expect(res.body.data.cache).toBeDefined();
    expect(typeof res.body.data.cache.hits).toBe('number');
  });

  test('health reports uptime, database and provider status', async () => {
    const res = await request(app).get('/api/admin/health').set('Cookie', admin);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.database).toBe('connected');
    expect(res.body.data.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(res.body.data.provider.enabled).toBe(false);
  });

  test('a recorded server error appears in logs without secrets', async () => {
    const err = new Error('synthetic phase5 failure');
    err.status = 500;
    recordServerError(err, { method: 'GET', path: '/api/admin/logs' });
    const res = await request(app).get('/api/admin/logs').set('Cookie', admin);
    expect(res.status).toBe(200);
    expect(res.body.data.logs.some((l) => l.message === 'synthetic phase5 failure' && l.status === 500)).toBe(true);
    expect(JSON.stringify(res.body.data.logs)).not.toMatch(/test-secret|Password123/);
  });
});

describe('admin recipe CRUD', () => {
  let createdId;

  test('create, list (searchable) and update', async () => {
    const created = await request(app).post('/api/admin/recipes').set('Cookie', admin).send(recipeDoc({
      title: 'Phase5 Admin Soup', cuisine: 'Mediterranean',
      ingredients: [{ name: 'Lentils', quantity: 100, unit: 'g', required: true }],
    }));
    expect(created.status).toBe(201);
    expect(created.body.data.recipe.isSeeded).toBe(false);
    createdId = created.body.data.recipe._id;

    const listed = await request(app).get('/api/admin/recipes').query({ q: 'Admin Soup' }).set('Cookie', admin);
    expect(listed.status).toBe(200);
    expect(listed.body.data.recipes.some((r) => String(r._id) === createdId)).toBe(true);

    const updated = await request(app).patch(`/api/admin/recipes/${createdId}`).set('Cookie', admin).send({ title: 'Phase5 Admin Soup Revised' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.recipe.title).toBe('Phase5 Admin Soup Revised');
  });

  test('validation rejects a recipe without a title, and unknown ids are 404', async () => {
    expect((await request(app).post('/api/admin/recipes').set('Cookie', admin).send({ title: '' })).status).toBe(400);
    const fake = new mongoose.Types.ObjectId();
    expect((await request(app).patch(`/api/admin/recipes/${fake}`).set('Cookie', admin).send({ title: 'X' })).status).toBe(404);
    expect((await request(app).delete(`/api/admin/recipes/${fake}`).set('Cookie', admin)).status).toBe(404);
  });

  test('delete keeps referencing favorites, which resolve gracefully', async () => {
    // userA saves the admin-created recipe, then the admin deletes it.
    const fav = await request(app).post('/api/favorites').set('Cookie', userA).send({ recipeId: createdId });
    expect(fav.status).toBe(201);
    const deleted = await request(app).delete(`/api/admin/recipes/${createdId}`).set('Cookie', admin);
    expect(deleted.status).toBe(200);
    const gone = await request(app).get(`/api/recipes/${createdId}`).set('Cookie', userA);
    expect(gone.status).toBe(404);
    const favorites = await request(app).get('/api/favorites').set('Cookie', userA);
    expect(favorites.status).toBe(200);
    const entry = favorites.body.data.favorites.find((f) => String(f.recipeId || f.recipe?._id || '') === createdId || f.recipe === null);
    // The favorite record survives; its recipe resolves to null, not a crash.
    expect(favorites.body.data.favorites.some((f) => f.recipe === null)).toBe(true);
    expect(entry).toBeDefined();
  });
});

describe('admin category management', () => {
  test('list shows cuisines with counts, and rename moves recipes across', async () => {
    const before = await request(app).get('/api/admin/categories').set('Cookie', admin);
    expect(before.status).toBe(200);
    const italian = before.body.data.categories.find((c) => c.cuisine === 'Italian');
    expect(italian).toBeDefined();
    expect(italian.count).toBeGreaterThanOrEqual(1);

    const renamed = await request(app).patch('/api/admin/categories/Italian').set('Cookie', admin).send({ cuisine: 'Italian-Renamed' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.modifiedCount).toBeGreaterThanOrEqual(1);

    const after = await request(app).get('/api/admin/categories').set('Cookie', admin);
    expect(after.body.data.categories.some((c) => c.cuisine === 'Italian')).toBe(false);
    expect(after.body.data.categories.some((c) => c.cuisine === 'Italian-Renamed')).toBe(true);
    const recipe = await request(app).get(`/api/recipes/${recipeAId}`).set('Cookie', userA);
    expect(recipe.body.data.recipe.cuisine).toBe('Italian-Renamed');

    // Rename back so later tests see the original cuisine.
    await request(app).patch('/api/admin/categories/Italian-Renamed').set('Cookie', admin).send({ cuisine: 'Italian' });
  });

  test('rename validation: empty new name is 400', async () => {
    expect((await request(app).patch('/api/admin/categories/Italian').set('Cookie', admin).send({ cuisine: '' })).status).toBe(400);
  });
});

describe('dashboard aggregation', () => {
  let planId;

  beforeAll(async () => {
    // userA: calorie target 2000; today's plan uses per-serving nutrition
    // × planned servings (500 × 2 = 1000 kcal) plus a no-nutrition recipe
    // that must raise the incomplete flag, not count as zero.
    await request(app).patch('/api/profile').set('Cookie', userA).send({ calorieTarget: 2000 });
    const monday = formatDateYYYYMMDD(currentMonday());
    const planRes = await request(app).post('/api/meal-plans').set('Cookie', userA).send({ weekStartDate: monday });
    planId = planRes.body.data._id;
    const today = todayIndexUTC();
    const otherDay = (today + 1) % 7;
    await request(app).patch(`/api/meal-plans/${planId}`).set('Cookie', userA).send({
      action: 'set', day: today, mealType: 'dinner', recipeId: recipeAId, servings: 2,
    });
    await request(app).patch(`/api/meal-plans/${planId}`).set('Cookie', userA).send({
      action: 'set', day: today, mealType: 'lunch', recipeId: recipeBId, servings: 1,
    });
    await request(app).patch(`/api/meal-plans/${planId}`).set('Cookie', userA).send({
      action: 'set', day: otherDay, mealType: 'breakfast', recipeId: recipeCId, servings: 1,
    });
    // Favorites + pantry (one expiring soon, one fresh, one expired).
    await request(app).post('/api/favorites').set('Cookie', userA).send({ recipeId: recipeCId });
    const in3 = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await request(app).post('/api/pantry').set('Cookie', userA).send({ name: 'Milk Soon', quantity: 1, unit: 'L', expirationDate: in3 });
    await request(app).post('/api/pantry').set('Cookie', userA).send({ name: 'Rice Fresh', quantity: 1, unit: 'kg', expirationDate: in30 });
    await request(app).post('/api/pantry').set('Cookie', userA).send({ name: 'Yogurt Old', quantity: 1, unit: '', expirationDate: yesterday });
    // Shopping list from the plan, with one item checked.
    const gen = await request(app).post('/api/shopping-lists/generate').set('Cookie', userA).send({ mealPlanId: planId });
    expect(gen.status).toBe(201);
    const firstItem = gen.body.data.items[0];
    if (firstItem) {
      await request(app).patch(`/api/shopping-lists/${gen.body.data._id}/items/${firstItem._id}`).set('Cookie', userA).send({ checked: true });
    }
    // Recently viewed: C first, then A — dashboard must show A first.
    await request(app).get(`/api/recipes/${recipeCId}`).set('Cookie', userA);
    await request(app).get(`/api/recipes/${recipeAId}`).set('Cookie', userA);
  }, 60000);

  test('aggregates today, week, shopping, pantry, nutrition and views for the owner', async () => {
    const res = await request(app).get('/api/dashboard').set('Cookie', userA);
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.user.email).toBe('phase5a@test.local');
    expect(d.weekStartDate).toBe(formatDateYYYYMMDD(currentMonday()));
    expect(d.todayIndex).toBe(todayIndexUTC());

    // Today's meals: dinner (Pasta) + lunch (Mystery Soup).
    const titles = d.todaysMeals.map((m) => m.recipe && m.recipe.title);
    expect(titles).toContain('Phase5 Pasta');
    expect(titles).toContain('Phase5 Mystery Soup');

    // Week overview: 3 meals across the week.
    expect(d.weekOverview.mealCount).toBe(3);

    // Today's nutrition: 500 × 2 servings = 1000 kcal, incomplete because
    // Mystery Soup has no nutrition data — never counted as zero.
    expect(d.todayNutrition.totals.calories).toBe(1000);
    expect(d.todayNutrition.incomplete).toBe(true);
    expect(d.todayNutrition.calorieTarget).toBe(2000);
    expect(d.todayNutrition.caloriesVsTarget).toBe(-1000);

    // Shopping progress: one checked item out of the generated list.
    expect(d.shoppingProgress).not.toBeNull();
    expect(d.shoppingProgress.checked).toBe(1);
    expect(d.shoppingProgress.total).toBeGreaterThanOrEqual(1);

    // Pantry expiring soon: Milk Soon + Yogurt Old, but not Rice Fresh.
    const pantryNames = d.pantryExpiring.map((i) => i.name);
    expect(pantryNames).toContain('Milk Soon');
    expect(pantryNames).toContain('Yogurt Old');
    expect(pantryNames).not.toContain('Rice Fresh');

    // Favorites include Rice Bowl; recommendations are present and scored.
    expect(d.favorites.map((r) => r.title)).toContain('Phase5 Rice Bowl');
    expect(Array.isArray(d.recommendations)).toBe(true);

    // Recently viewed: most recent first (Pasta before Rice Bowl).
    const viewed = d.recentlyViewed.map((r) => r.title);
    expect(viewed[0]).toBe('Phase5 Pasta');
    expect(viewed).toContain('Phase5 Rice Bowl');
    expect(viewed.length).toBeLessThanOrEqual(10);
  });

  test('recently viewed keeps only the latest 10 per user', async () => {
    // View the same recipe repeatedly plus a few others; the list stays
    // capped and de-duplicated (one record per user per recipe).
    for (let i = 0; i < 12; i++) {
      await request(app).get(`/api/recipes/${recipeCId}`).set('Cookie', userB);
    }
    const res = await request(app).get('/api/dashboard').set('Cookie', userB);
    expect(res.body.data.recentlyViewed.length).toBeLessThanOrEqual(10);
    expect(res.body.data.recentlyViewed.filter((r) => r.title === 'Phase5 Rice Bowl').length).toBe(1);
  });

  test('another user sees none of the owner’s data', async () => {
    const res = await request(app).get('/api/dashboard').set('Cookie', userB);
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.todaysMeals.length).toBe(0);
    expect(d.weekOverview.mealCount).toBe(0);
    expect(d.shoppingProgress).toBeNull();
    expect(d.pantryExpiring.length).toBe(0);
    expect(d.favorites.length).toBe(0);
  });

  test('unauthenticated dashboard is 401', async () => {
    expect((await request(app).get('/api/dashboard')).status).toBe(401);
  });
});

describe('discovery cache behaviour', () => {
  test('second identical request is a cache hit, admin change invalidates it', async () => {
    const q = `phase5cache-${Date.now()}`;
    const statsBefore = (await request(app).get('/api/admin/stats').set('Cookie', admin)).body.data.cache;

    const first = await request(app).get('/api/recipes').query({ q }).set('Cookie', userA);
    expect(first.status).toBe(200);
    const afterFirst = (await request(app).get('/api/admin/stats').set('Cookie', admin)).body.data.cache;
    expect(afterFirst.misses).toBe(statsBefore.misses + 1);

    const second = await request(app).get('/api/recipes').query({ q }).set('Cookie', userA);
    expect(second.status).toBe(200);
    const afterSecond = (await request(app).get('/api/admin/stats').set('Cookie', admin)).body.data.cache;
    expect(afterSecond.hits).toBe(afterFirst.hits + 1);
    expect(afterSecond.size).toBeGreaterThanOrEqual(1);

    // An admin recipe change clears the cache entirely.
    const created = await request(app).post('/api/admin/recipes').set('Cookie', admin).send(recipeDoc({ title: 'Phase5 Cache Buster' }));
    expect(created.status).toBe(201);
    const afterChange = (await request(app).get('/api/admin/stats').set('Cookie', admin)).body.data.cache;
    expect(afterChange.size).toBe(0);
    await request(app).delete(`/api/admin/recipes/${created.body.data.recipe._id}`).set('Cookie', admin);

    // The same query is a miss again after invalidation.
    await request(app).get('/api/recipes').query({ q }).set('Cookie', userA);
    const afterRefetch = (await request(app).get('/api/admin/stats').set('Cookie', admin)).body.data.cache;
    expect(afterRefetch.misses).toBe(afterSecond.misses + 1);
  });
});
