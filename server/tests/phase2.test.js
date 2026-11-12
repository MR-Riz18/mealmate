const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret-for-mealmate';
process.env.JWT_EXPIRE = '8h';
process.env.CLIENT_URL = 'http://localhost:5173';

let mongod;
let app;
const Recipe = require('../models/Recipe');
const { scaleQuantity, formatQuantity, scaleIngredient } = require('../utils/servings');
const { matchRecipe } = require('../utils/ingredientMatch');

let eggRecipeId;
let chickenRecipeId;
let saladRecipeId;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  app = require('../server');
  const [egg, chicken, salad] = await Recipe.create([
    {
      title: 'Egg Tomato Rice', description: 'Simple rice bowl', image: '',
      ingredients: [
        { name: 'eggs', quantity: 2, unit: '', required: true },
        { name: 'tomatoes', quantity: 2, unit: '', required: true },
        { name: 'rice', quantity: 1, unit: 'cup', required: true },
        { name: 'salt', quantity: null, unit: '', required: false },
      ],
      instructions: ['Cook rice.', 'Fry eggs and tomatoes.', 'Combine.'],
      preparationTime: 5, cookingTime: 15, servings: 2, cuisine: 'Chinese',
      mealTypes: ['lunch'], dietaryTags: [], allergens: ['egg'],
      nutrition: { calories: 400, protein: 15, carbohydrates: 55, fat: 12 },
    },
    {
      title: 'Chicken Pasta', description: 'Creamy pasta', image: '',
      ingredients: [
        { name: 'chicken breast', quantity: 200, unit: 'g', required: true },
        { name: 'pasta', quantity: 200, unit: 'g', required: true },
        { name: 'cream', quantity: 100, unit: 'ml', required: false },
      ],
      instructions: ['Boil pasta.', 'Cook chicken.', 'Combine.'],
      preparationTime: 10, cookingTime: 20, servings: 2, cuisine: 'Italian',
      mealTypes: ['dinner'], dietaryTags: ['high-protein'], allergens: ['gluten', 'dairy'],
      nutrition: { calories: 600, protein: 40, carbohydrates: 50, fat: 20 },
    },
    {
      title: 'Veg Salad', description: 'Fresh salad', image: '',
      ingredients: [
        { name: 'lettuce', quantity: 1, unit: 'head', required: true },
        { name: 'cucumber', quantity: 1, unit: '', required: true },
        { name: 'tomatoes', quantity: 2, unit: '', required: true },
      ],
      instructions: ['Chop.', 'Toss.'],
      preparationTime: 10, cookingTime: 0, servings: 2, cuisine: 'Mediterranean',
      mealTypes: ['lunch'], dietaryTags: ['vegetarian', 'vegan'], allergens: [],
      nutrition: { calories: 120, protein: 3, carbohydrates: 15, fat: 4 },
    },
  ]);
  eggRecipeId = String(egg._id);
  chickenRecipeId = String(chicken._id);
  saladRecipeId = String(salad._id);
}, 120000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

async function registerAndLogin(email) {
  await request(app).post('/api/auth/register').send({ name: 'Phase Two', email, password: 'Password123!' });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Password123!' });
  const cookie = res.headers['set-cookie'];
  return Array.isArray(cookie) ? cookie.join('; ') : cookie;
}

describe('serving scaling utility', () => {
  it('scales quantities proportionally', () => {
    expect(scaleQuantity(2, 2, 4)).toBe(4);
    expect(scaleQuantity(1, 4, 2)).toBe(0.5);
    expect(scaleQuantity(200, 2, 3)).toBe(300);
  });
  it('formats common kitchen fractions', () => {
    expect(formatQuantity(0.5)).toBe('1/2');
    expect(formatQuantity(0.25)).toBe('1/4');
    expect(formatQuantity(1.5)).toBe('1 1/2');
    expect(formatQuantity(2)).toBe('2');
    expect(formatQuantity(0.75)).toBe('3/4');
  });
  it('leaves quantity-less ingredients alone', () => {
    expect(scaleQuantity(null, 2, 4)).toBeNull();
    expect(formatQuantity(null)).toBeNull();
    const scaled = scaleIngredient({ name: 'salt', quantity: null, unit: '', required: false }, 2, 4);
    expect(scaled.displayQuantity).toBeNull();
    expect(scaled.name).toBe('salt');
  });
});

describe('ingredient matching utility', () => {
  it('counts only required ingredients as missing', () => {
    const recipe = {
      ingredients: [
        { name: 'eggs', required: true },
        { name: 'tomatoes', required: true },
        { name: 'rice', required: true },
        { name: 'salt', required: false },
      ],
    };
    const m = matchRecipe(recipe, ['eggs', 'tomatoes']);
    expect(m.have).toEqual(['eggs', 'tomatoes']);
    expect(m.missing).toEqual(['rice']);
    expect(m.optionalMissing).toEqual(['salt']);
    expect(m.matchPercentage).toBe(67);
    expect(m.isPerfectMatch).toBe(false);
    expect(m.additionalIngredientsRequired).toBe(1);
  });
  it('only calls a recipe a perfect match when all required ingredients are present', () => {
    const recipe = { ingredients: [{ name: 'eggs', required: true }] };
    expect(matchRecipe(recipe, ['eggs']).isPerfectMatch).toBe(true);
    expect(matchRecipe(recipe, ['milk']).isPerfectMatch).toBe(false);
  });
});

describe('favorites and collections', () => {
  let cookieA;
  let cookieB;
  beforeAll(async () => {
    cookieA = await registerAndLogin('fav-a@test.local');
    cookieB = await registerAndLogin('fav-b@test.local');
  });

  it('creates, lists and removes a favorite', async () => {
    const created = await request(app).post('/api/favorites').set('Cookie', cookieA).send({ recipeId: eggRecipeId });
    expect(created.status).toBe(201);
    expect(created.body.data.favorite.recipe._id).toBe(eggRecipeId);

    const list = await request(app).get('/api/favorites').set('Cookie', cookieA);
    expect(list.status).toBe(200);
    expect(list.body.data.favorites.some((f) => String(f.recipe._id) === eggRecipeId)).toBe(true);

    const removed = await request(app).delete(`/api/favorites/${eggRecipeId}`).set('Cookie', cookieA);
    expect(removed.status).toBe(200);
    const gone = await request(app).delete(`/api/favorites/${eggRecipeId}`).set('Cookie', cookieA);
    expect(gone.status).toBe(404);
  });

  it('treats a duplicate favorite idempotently', async () => {
    const first = await request(app).post('/api/favorites').set('Cookie', cookieA).send({ recipeId: chickenRecipeId });
    expect(first.status).toBe(201);
    const second = await request(app).post('/api/favorites').set('Cookie', cookieA).send({ recipeId: chickenRecipeId });
    expect(second.status).toBe(200);
    expect(second.body.data.favorite.recipe._id).toBe(chickenRecipeId);
    const list = await request(app).get('/api/favorites').set('Cookie', cookieA);
    expect(list.body.data.favorites.filter((f) => String(f.recipe._id) === chickenRecipeId).length).toBe(1);
    await request(app).delete(`/api/favorites/${chickenRecipeId}`).set('Cookie', cookieA);
  });

  it('keeps favorites and collections private between users (404, not a leak)', async () => {
    await request(app).post('/api/favorites').set('Cookie', cookieA).send({ recipeId: saladRecipeId });
    const col = await request(app).post('/api/favorites/collections').set('Cookie', cookieA).send({ name: 'A Lunches' });
    expect(col.status).toBe(201);

    const bList = await request(app).get('/api/favorites').set('Cookie', cookieB);
    expect(bList.body.data.favorites.some((f) => String(f.recipe._id) === saladRecipeId)).toBe(false);

    const bDelete = await request(app).delete(`/api/favorites/${saladRecipeId}`).set('Cookie', cookieB);
    expect(bDelete.status).toBe(404);
    const bRename = await request(app).patch(`/api/favorites/collections/${col.body.data.collection._id}`).set('Cookie', cookieB).send({ name: 'Stolen' });
    expect(bRename.status).toBe(404);
    const bCols = await request(app).get('/api/favorites/collections').set('Cookie', cookieB);
    expect(bCols.body.data.collections.some((c) => c.name === 'A Lunches')).toBe(false);

    await request(app).delete(`/api/favorites/${saladRecipeId}`).set('Cookie', cookieA);
    await request(app).delete(`/api/favorites/collections/${col.body.data.collection._id}`).set('Cookie', cookieA);
  });

  it('manages collections: create, assign, filter, rename, delete', async () => {
    const col = await request(app).post('/api/favorites/collections').set('Cookie', cookieA).send({ name: 'Quick Meals' });
    expect(col.status).toBe(201);
    const colId = col.body.data.collection._id;

    const dup = await request(app).post('/api/favorites/collections').set('Cookie', cookieA).send({ name: 'Quick Meals' });
    expect(dup.status).toBe(409);

    await request(app).post('/api/favorites').set('Cookie', cookieA).send({ recipeId: eggRecipeId, collectionId: colId });
    const filtered = await request(app).get(`/api/favorites?collection=${colId}`).set('Cookie', cookieA);
    expect(filtered.body.data.favorites.some((f) => String(f.recipe._id) === eggRecipeId)).toBe(true);
    const none = await request(app).get('/api/favorites?collection=none').set('Cookie', cookieA);
    expect(none.body.data.favorites.some((f) => String(f.recipe._id) === eggRecipeId)).toBe(false);

    const renamed = await request(app).patch(`/api/favorites/collections/${colId}`).set('Cookie', cookieA).send({ name: 'Fast Meals' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.collection.name).toBe('Fast Meals');

    const deleted = await request(app).delete(`/api/favorites/collections/${colId}`).set('Cookie', cookieA);
    expect(deleted.status).toBe(200);
    const after = await request(app).get('/api/favorites').set('Cookie', cookieA);
    const fav = after.body.data.favorites.find((f) => String(f.recipe._id) === eggRecipeId);
    expect(fav).toBeTruthy();
    expect(fav.collection).toBeNull();
    await request(app).delete(`/api/favorites/${eggRecipeId}`).set('Cookie', cookieA);
  });

  it('searches within saved recipes', async () => {
    await request(app).post('/api/favorites').set('Cookie', cookieA).send({ recipeId: eggRecipeId });
    await request(app).post('/api/favorites').set('Cookie', cookieA).send({ recipeId: saladRecipeId });
    const res = await request(app).get('/api/favorites?q=Salad').set('Cookie', cookieA);
    expect(res.body.data.favorites.every((f) => f.recipe.title.includes('Salad'))).toBe(true);
    expect(res.body.data.favorites.length).toBe(1);
    await request(app).delete(`/api/favorites/${eggRecipeId}`).set('Cookie', cookieA);
    await request(app).delete(`/api/favorites/${saladRecipeId}`).set('Cookie', cookieA);
  });
});

describe('profile', () => {
  let cookie;
  beforeAll(async () => { cookie = await registerAndLogin('profile@test.local'); });

  it('returns and updates the logged-in user profile', async () => {
    const get = await request(app).get('/api/profile').set('Cookie', cookie);
    expect(get.status).toBe(200);
    expect(get.body.data.user.email).toBe('profile@test.local');

    const updated = await request(app).patch('/api/profile').set('Cookie', cookie).send({
      name: 'Profile Tester',
      dietaryPreferences: ['vegetarian', 'gluten-free'],
      allergies: ['peanuts'],
      preferredCuisines: ['Italian'],
      preferredMealTypes: ['dinner'],
      calorieTarget: 2200,
      servingPreference: 4,
      role: 'admin',
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data.user.name).toBe('Profile Tester');
    expect(updated.body.data.user.dietaryPreferences).toEqual(['vegetarian', 'gluten-free']);
    expect(updated.body.data.user.calorieTarget).toBe(2200);
    expect(updated.body.data.user.role).toBe('user'); // role cannot be changed via profile
  });

  it('rejects invalid profile input', async () => {
    const badDiet = await request(app).patch('/api/profile').set('Cookie', cookie).send({ dietaryPreferences: ['carnivore'] });
    expect(badDiet.status).toBe(400);
    const badCalories = await request(app).patch('/api/profile').set('Cookie', cookie).send({ calorieTarget: -5 });
    expect(badCalories.status).toBe(400);
    const badServings = await request(app).patch('/api/profile').set('Cookie', cookie).send({ servingPreference: 99 });
    expect(badServings.status).toBe(400);
  });

  it('blocks profile access without auth', async () => {
    const res = await request(app).get('/api/profile');
    expect(res.status).toBe(401);
  });
});

describe('ingredient-based search endpoint', () => {
  let cookie;
  beforeAll(async () => { cookie = await registerAndLogin('ingredients@test.local'); });

  it('returns have/missing/match % and excludes optional ingredients from missing', async () => {
    const res = await request(app)
      .get('/api/recipes/by-ingredients?ingredients=eggs,tomatoes')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    const egg = res.body.data.recipes.find((r) => r.title === 'Egg Tomato Rice');
    expect(egg).toBeTruthy();
    expect(egg.match.have).toEqual(expect.arrayContaining(['eggs', 'tomatoes']));
    expect(egg.match.missing).toEqual(['rice']);
    expect(egg.match.optionalMissing).toEqual(['salt']);
    expect(egg.match.matchPercentage).toBe(67);
    expect(egg.match.isPerfectMatch).toBe(false);
  });

  it('matches singular/plural forms and labels a full match as perfect', async () => {
    const res = await request(app)
      .get('/api/recipes/by-ingredients?ingredients=egg,tomato,rice')
      .set('Cookie', cookie);
    const egg = res.body.data.recipes.find((r) => r.title === 'Egg Tomato Rice');
    expect(egg.match.isPerfectMatch).toBe(true);
    expect(egg.match.matchPercentage).toBe(100);
    expect(egg.match.missing).toEqual([]);
  });

  it('sorts by fewest missing ingredients when asked', async () => {
    const res = await request(app)
      .get('/api/recipes/by-ingredients?ingredients=lettuce,cucumber,tomatoes&sort=fewest-missing')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.recipes[0].title).toBe('Veg Salad');
    expect(res.body.data.recipes[0].match.additionalIngredientsRequired).toBe(0);
  });

  it('requires ingredients and requires auth', async () => {
    const empty = await request(app).get('/api/recipes/by-ingredients').set('Cookie', cookie);
    expect(empty.status).toBe(400);
    const anon = await request(app).get('/api/recipes/by-ingredients?ingredients=eggs');
    expect(anon.status).toBe(401);
  });
});
