const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret-for-mealmate';
process.env.JWT_EXPIRE = '8h';
process.env.CLIENT_URL = 'http://localhost:5173';

let mongod;
let app;
const Recipe = require('../models/Recipe');

let pastaId;
let sideId;
let saladId;
let userA;
let userB;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  app = require('../server');
  const [pasta, side, salad] = await Recipe.create([
    {
      title: 'Test Pasta', description: 'Pasta test', image: '',
      ingredients: [
        { name: 'Pasta', quantity: 200, unit: 'g', required: true },
        { name: 'Tomatoes', quantity: 2, unit: '', required: true },
      ],
      instructions: ['Cook.'],
      preparationTime: 5, cookingTime: 15, servings: 2, cuisine: 'Italian',
      mealTypes: ['dinner'], dietaryTags: [], allergens: [],
      nutrition: { calories: 500, protein: 20, carbohydrates: 60, fat: 15 },
    },
    {
      title: 'Test Pasta Side', description: 'Side test', image: '',
      ingredients: [
        { name: 'Pasta', quantity: 100, unit: 'g', required: true },
        { name: 'Tomatoes', quantity: 1, unit: 'cup', required: true },
      ],
      instructions: ['Cook.'],
      preparationTime: 5, cookingTime: 10, servings: 4, cuisine: 'Italian',
      mealTypes: ['lunch'], dietaryTags: [], allergens: [],
      nutrition: { calories: 300, protein: 10, carbohydrates: 40, fat: 8 },
    },
    {
      title: 'No Nutrition Salad', description: 'Salad test', image: '',
      ingredients: [{ name: 'Lettuce', quantity: 1, unit: 'head', required: true }],
      instructions: ['Toss.'],
      preparationTime: 5, cookingTime: 0, servings: 2, cuisine: 'Mediterranean',
      mealTypes: ['lunch'], dietaryTags: ['vegetarian'], allergens: [],
      nutrition: null,
    },
  ]);
  pastaId = String(pasta._id);
  sideId = String(side._id);
  saladId = String(salad._id);
  userA = await registerAndLogin('phase3a@test.local');
  userB = await registerAndLogin('phase3b@test.local');
}, 120000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

async function registerAndLogin(email) {
  await request(app).post('/api/auth/register').send({ name: 'Phase Three', email, password: 'Password123!' });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Password123!' });
  const cookie = res.headers['set-cookie'];
  return Array.isArray(cookie) ? cookie.join('; ') : cookie;
}

async function createPlan(cookie, weekStartDate) {
  const res = await request(app).post('/api/meal-plans').set('Cookie', cookie).send({ weekStartDate });
  expect([200, 201]).toContain(res.status);
  // POST returns the plan object itself as data (single-plan endpoints),
  // unlike GET-for-week which wraps it as { plan, ... }.
  return res.body.data;
}

async function setSlot(cookie, planId, body) {
  return request(app).patch(`/api/meal-plans/${planId}`).set('Cookie', cookie).send(body);
}

describe('meal planner', () => {
  test('unauthenticated requests are 401', async () => {
    await expect(request(app).get('/api/meal-plans').then((r) => r.status)).resolves.toBe(401);
    const res = await request(app).post('/api/shopping-lists/generate').send({ weekStartDate: '2026-10-26' });
    expect(res.status).toBe(401);
  });

  test('week dates normalise to Monday and one plan per user per week', async () => {
    // 2026-10-28 is a Wednesday; its week starts Monday 2026-10-26.
    const first = await createPlan(userA, '2026-10-28');
    expect(first.weekStartDateLabel).toBe('2026-10-26');
    const again = await createPlan(userA, '2026-10-26');
    expect(again._id).toBe(first._id);
    const otherUser = await createPlan(userB, '2026-10-26');
    expect(otherUser._id).not.toBe(first._id);
    const fetched = await request(app).get('/api/meal-plans').query({ weekStartDate: '2026-10-27' }).set('Cookie', userA);
    expect(fetched.status).toBe(200);
    expect(fetched.body.data.plan._id).toBe(first._id);
  });

  test('occupied slot needs explicit replace; no silent duplicates', async () => {
    const plan = await createPlan(userA, '2026-11-02');
    const ok = await setSlot(userA, plan._id, { action: 'set', day: 0, mealType: 'breakfast', recipeId: pastaId, servings: 2 });
    expect(ok.status).toBe(200);
    expect(ok.body.data.meals).toHaveLength(1);
    const dup = await setSlot(userA, plan._id, { action: 'set', day: 0, mealType: 'breakfast', recipeId: sideId, servings: 2 });
    expect(dup.status).toBe(409);
    const replaced = await setSlot(userA, plan._id, { action: 'set', day: 0, mealType: 'breakfast', recipeId: sideId, servings: 2, replace: true });
    expect(replaced.status).toBe(200);
    expect(replaced.body.data.meals).toHaveLength(1);
    expect(String(replaced.body.data.meals[0].recipe._id)).toBe(sideId);
  });

  test('copy to another day, clear day, and whole-week delete', async () => {
    const plan = await createPlan(userA, '2026-11-09');
    await setSlot(userA, plan._id, { action: 'set', day: 0, mealType: 'dinner', recipeId: pastaId, servings: 2 });
    const copied = await setSlot(userA, plan._id, { action: 'copy', fromDay: 0, mealType: 'dinner', toDay: 2 });
    expect(copied.status).toBe(200);
    expect(copied.body.data.meals).toHaveLength(2);
    const copyAgain = await setSlot(userA, plan._id, { action: 'copy', fromDay: 0, mealType: 'dinner', toDay: 2 });
    expect(copyAgain.status).toBe(409);
    const cleared = await setSlot(userA, plan._id, { action: 'clearDay', day: 0 });
    expect(cleared.body.data.meals).toHaveLength(1);
    const del = await request(app).delete(`/api/meal-plans/${plan._id}`).set('Cookie', userA);
    expect(del.status).toBe(200);
    const gone = await request(app).get(`/api/meal-plans/${plan._id}`).set('Cookie', userA);
    expect(gone.status).toBe(404);
  });

  test("another user's plan answers 404", async () => {
    const plan = await createPlan(userA, '2026-11-16');
    const res = await request(app).get(`/api/meal-plans/${plan._id}`).set('Cookie', userB);
    expect(res.status).toBe(404);
    const patched = await setSlot(userB, plan._id, { action: 'set', day: 0, mealType: 'lunch', recipeId: pastaId, servings: 2 });
    expect(patched.status).toBe(404);
  });

  test('per-day nutrition totals use per-serving nutrition x planned servings and flag incomplete days', async () => {
    const plan = await createPlan(userA, '2026-11-23');
    // Stored nutrition is per serving: Monday = pasta 500x2 + side 300x2
    await setSlot(userA, plan._id, { action: 'set', day: 0, mealType: 'breakfast', recipeId: pastaId, servings: 2 });
    await setSlot(userA, plan._id, { action: 'set', day: 0, mealType: 'lunch', recipeId: sideId, servings: 2 });
    // Tuesday: recipe with no nutrition at all
    await setSlot(userA, plan._id, { action: 'set', day: 1, mealType: 'lunch', recipeId: saladId, servings: 2 });
    const res = await request(app).get(`/api/meal-plans/${plan._id}`).set('Cookie', userA);
    const summaries = res.body.data.daySummaries;
    const monday = summaries.find((s) => s.day === 0);
    expect(monday.totals).toEqual({ calories: 1600, protein: 60, carbohydrates: 200, fat: 46 });
    expect(monday.incomplete).toBe(false);
    const tuesday = summaries.find((s) => s.day === 1);
    expect(tuesday.incomplete).toBe(true);
    expect(tuesday.missingRecipes).toContain('No Nutrition Salad');
    expect(tuesday.totals).toEqual({ calories: 0, protein: 0, carbohydrates: 0, fat: 0 });
  });

  test('invalid slot input is rejected', async () => {
    const plan = await createPlan(userA, '2026-11-30');
    const badDay = await setSlot(userA, plan._id, { action: 'set', day: 7, mealType: 'lunch', recipeId: pastaId, servings: 2 });
    expect(badDay.status).toBe(400);
    const badServings = await setSlot(userA, plan._id, { action: 'set', day: 0, mealType: 'lunch', recipeId: pastaId, servings: 0 });
    expect(badServings.status).toBe(400);
  });
});

describe('shopping lists', () => {
  test('generation combines same-unit ingredients, never different units, and scales by servings', async () => {
    const plan = await createPlan(userA, '2026-12-07');
    await setSlot(userA, plan._id, { action: 'set', day: 0, mealType: 'breakfast', recipeId: pastaId, servings: 2 });
    await setSlot(userA, plan._id, { action: 'set', day: 0, mealType: 'lunch', recipeId: sideId, servings: 2 });
    const res = await request(app).post('/api/shopping-lists/generate').set('Cookie', userA).send({ mealPlanId: plan._id });
    expect(res.status).toBe(201);
    const items = res.body.data.items;
    const pasta = items.find((i) => i.name === 'Pasta' && i.unit === 'g');
    // 200g (1x) + 100g * 0.5 = 250g combined.
    expect(pasta.quantity).toBe(250);
    expect(pasta.category).toBe('grains');
    const tomatoLines = items.filter((i) => i.name === 'Tomatoes');
    expect(tomatoLines).toHaveLength(2); // 2 (no unit) and 0.5 cup — never merged
    expect(tomatoLines.find((i) => i.unit === 'cup').quantity).toBe(0.5);
    expect(tomatoLines.find((i) => i.unit === 'cup').category).toBe('produce');
  });

  test('regeneration preserves manual items and checked states, drops removed auto items', async () => {
    const plan = await createPlan(userA, '2026-12-14');
    await setSlot(userA, plan._id, { action: 'set', day: 0, mealType: 'breakfast', recipeId: pastaId, servings: 2 });
    await setSlot(userA, plan._id, { action: 'set', day: 0, mealType: 'lunch', recipeId: sideId, servings: 2 });
    const gen = await request(app).post('/api/shopping-lists/generate').set('Cookie', userA).send({ mealPlanId: plan._id });
    const listId = gen.body.data._id;
    const pastaItem = gen.body.data.items.find((i) => i.name === 'Pasta');
    await request(app).patch(`/api/shopping-lists/${listId}/items/${pastaItem._id}`).set('Cookie', userA).send({ checked: true });
    await request(app).post(`/api/shopping-lists/${listId}/items`).set('Cookie', userA).send({ name: 'Milk', quantity: 1, unit: 'litre' });
    // Change the plan: drop the side (its cup tomatoes go away), add the salad.
    await setSlot(userA, plan._id, { action: 'remove', day: 0, mealType: 'lunch' });
    await setSlot(userA, plan._id, { action: 'set', day: 1, mealType: 'lunch', recipeId: saladId, servings: 2 });
    const regen = await request(app).post('/api/shopping-lists/generate').set('Cookie', userA).send({ mealPlanId: plan._id });
    expect(regen.status).toBe(200);
    expect(regen.body.data._id).toBe(listId);
    const items = regen.body.data.items;
    expect(items.find((i) => i.name === 'Milk')).toBeTruthy(); // manual preserved
    expect(items.find((i) => i.name === 'Pasta').checked).toBe(true); // checked preserved
    expect(items.find((i) => i.name === 'Lettuce')).toBeTruthy(); // new auto item, unchecked
    expect(items.find((i) => i.name === 'Lettuce').checked).toBe(false);
    expect(items.find((i) => i.name === 'Tomatoes' && i.unit === 'cup')).toBeUndefined(); // dropped auto item
  });

  test('item check/edit/delete/manual-add and other-user 404', async () => {
    const plan = await createPlan(userA, '2026-12-21');
    await setSlot(userA, plan._id, { action: 'set', day: 0, mealType: 'breakfast', recipeId: pastaId, servings: 2 });
    const gen = await request(app).post('/api/shopping-lists/generate').set('Cookie', userA).send({ mealPlanId: plan._id });
    const listId = gen.body.data._id;
    const other = await request(app).get(`/api/shopping-lists/${listId}`).set('Cookie', userB);
    expect(other.status).toBe(404);
    const added = await request(app).post(`/api/shopping-lists/${listId}/items`).set('Cookie', userA).send({ name: 'Olive Oil', quantity: 1, unit: 'bottle' });
    expect(added.status).toBe(201);
    const newItem = added.body.data.items.find((i) => i.name === 'Olive Oil');
    expect(newItem.manual).toBe(true);
    const edited = await request(app).patch(`/api/shopping-lists/${listId}/items/${newItem._id}`).set('Cookie', userA).send({ checked: true, quantity: 2 });
    expect(edited.body.data.items.find((i) => i._id === newItem._id).checked).toBe(true);
    expect(edited.body.data.items.find((i) => i._id === newItem._id).quantity).toBe(2);
    const deleted = await request(app).delete(`/api/shopping-lists/${listId}/items/${newItem._id}`).set('Cookie', userA);
    expect(deleted.body.data.items.find((i) => i._id === newItem._id)).toBeUndefined();
    const badGen = await request(app).post('/api/shopping-lists/generate').set('Cookie', userA).send({});
    expect(badGen.status).toBe(400);
    const noPlan = await request(app).post('/api/shopping-lists/generate').set('Cookie', userA).send({ weekStartDate: '2027-01-04' });
    expect(noPlan.status).toBe(404);
  });
});
