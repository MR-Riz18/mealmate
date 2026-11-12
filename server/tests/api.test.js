const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret-for-mealmate';
process.env.JWT_EXPIRE = '8h';
process.env.CLIENT_URL = 'http://localhost:5173';

let mongod;
let app;
const Recipe = require('../models/Recipe');

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  app = require('../server');
  await Recipe.create([
    {
      title: 'Test Daal', description: 'Lentils', image: '', ingredients: [{ name: 'lentils', quantity: 1, unit: 'cup', required: true }],
      instructions: ['Cook.'], preparationTime: 10, cookingTime: 20, servings: 2, cuisine: 'Pakistani',
      mealTypes: ['lunch'], dietaryTags: ['vegetarian', 'vegan'], allergens: [], nutrition: { calories: 200, protein: 10, carbohydrates: 30, fat: 3 },
    },
    {
      title: 'Test Pasta', description: 'Pasta', image: '', ingredients: [{ name: 'pasta', quantity: 200, unit: 'g', required: true }],
      instructions: ['Boil.'], preparationTime: 5, cookingTime: 10, servings: 2, cuisine: 'Italian',
      mealTypes: ['dinner'], dietaryTags: ['vegetarian'], allergens: ['gluten'], nutrition: null,
    },
  ]);
}, 120000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

async function registerAndLogin(email) {
  await request(app).post('/api/auth/register').send({ name: 'Test User', email, password: 'Password123!' });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Password123!' });
  const cookie = res.headers['set-cookie'];
  return Array.isArray(cookie) ? cookie.join('; ') : cookie;
}

describe('auth', () => {
  it('registers and logs in', async () => {
    const cookie = await registerAndLogin('phase1@test.local');
    expect(cookie).toBeTruthy();
    const me = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe('phase1@test.local');
  });

  it('rejects invalid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@test.local', password: 'Wrong123!' });
    expect(res.status).toBe(401);
  });

  it('rejects weak registration input', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'A', email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('blocks protected routes without auth', async () => {
    const res = await request(app).get('/api/recipes');
    expect(res.status).toBe(401);
  });
});

describe('recipes', () => {
  let cookie;
  beforeAll(async () => { cookie = await registerAndLogin('cook@test.local'); });

  it('lists recipes and filters by cuisine and dietary tag', async () => {
    const all = await request(app).get('/api/recipes').set('Cookie', cookie);
    expect(all.status).toBe(200);
    expect(all.body.data.total).toBeGreaterThanOrEqual(2);

    const filtered = await request(app).get('/api/recipes?cuisine=Pakistani&dietary=vegan').set('Cookie', cookie);
    expect(filtered.body.data.recipes.every((r) => r.cuisine === 'Pakistani')).toBe(true);
    expect(filtered.body.data.recipes.length).toBe(1);
  });

  it('searches by name and by maxTime', async () => {
    const byName = await request(app).get('/api/recipes/search?q=Daal').set('Cookie', cookie);
    expect(byName.body.data.recipes.some((r) => r.title.includes('Daal'))).toBe(true);

    const quick = await request(app).get('/api/recipes?maxTime=20').set('Cookie', cookie);
    expect(quick.body.data.recipes.every((r) => (r.preparationTime + r.cookingTime) <= 20)).toBe(true);
  });

  it('returns a single recipe and 404 for unknown ids', async () => {
    const list = await request(app).get('/api/recipes').set('Cookie', cookie);
    const id = list.body.data.recipes[0]._id;
    const one = await request(app).get(`/api/recipes/${id}`).set('Cookie', cookie);
    expect(one.status).toBe(200);
    expect(one.body.data.recipe._id).toBe(id);

    const missing = await request(app).get('/api/recipes/000000000000000000000000').set('Cookie', cookie);
    expect(missing.status).toBe(404);
  });
});
