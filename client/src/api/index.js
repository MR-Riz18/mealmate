import api from './axios';

export const authApi = {
  register: (payload) => api.post('/auth/register', payload).then((r) => r.data.data),
  login: (payload) => api.post('/auth/login', payload).then((r) => r.data.data),
  logout: () => api.post('/auth/logout').then((r) => r.data.data),
  me: () => api.get('/auth/me').then((r) => r.data.data),
};

export const recipeApi = {
  list: (params) => api.get('/recipes', { params }).then((r) => r.data.data),
  get: (id) => api.get(`/recipes/${id}`).then((r) => r.data.data),
  byIngredients: (params) => api.get('/recipes/by-ingredients', { params }).then((r) => r.data.data),
  recommendations: (params) => api.get('/recipes/recommendations', { params }).then((r) => r.data.data),
};

export const dashboardApi = {
  get: () => api.get('/dashboard').then((r) => r.data.data),
};

export const adminApi = {
  stats: () => api.get('/admin/stats').then((r) => r.data.data),
  health: () => api.get('/admin/health').then((r) => r.data.data),
  logs: () => api.get('/admin/logs').then((r) => r.data.data),
  recipes: (params) => api.get('/admin/recipes', { params }).then((r) => r.data.data),
  createRecipe: (body) => api.post('/admin/recipes', body).then((r) => r.data.data),
  updateRecipe: (id, body) => api.patch(`/admin/recipes/${id}`, body).then((r) => r.data.data),
  deleteRecipe: (id) => api.delete(`/admin/recipes/${id}`).then((r) => r.data.data),
  categories: () => api.get('/admin/categories').then((r) => r.data.data),
  renameCategory: (cuisine, body) => api.patch(`/admin/categories/${encodeURIComponent(cuisine)}`, body).then((r) => r.data.data),
};

export const pantryApi = {
  list: (params) => api.get('/pantry', { params }).then((r) => r.data.data),
  create: (payload) => api.post('/pantry', payload).then((r) => r.data.data),
  update: (id, payload) => api.patch(`/pantry/${id}`, payload).then((r) => r.data.data),
  remove: (id) => api.delete(`/pantry/${id}`).then((r) => r.data.data),
};

export const favoriteApi = {
  list: (params) => api.get('/favorites', { params }).then((r) => r.data.data),
  create: (payload) => api.post('/favorites', payload).then((r) => r.data.data),
  removeByRecipe: (recipeId) => api.delete(`/favorites/${recipeId}`).then((r) => r.data.data),
  assign: (recipeId, collectionId) => api.patch(`/favorites/${recipeId}`, { collectionId }).then((r) => r.data.data),
  collections: () => api.get('/favorites/collections').then((r) => r.data.data),
  createCollection: (name) => api.post('/favorites/collections', { name }).then((r) => r.data.data),
  renameCollection: (id, name) => api.patch(`/favorites/collections/${id}`, { name }).then((r) => r.data.data),
  deleteCollection: (id) => api.delete(`/favorites/collections/${id}`).then((r) => r.data.data),
};

export const profileApi = {
  get: () => api.get('/profile').then((r) => r.data.data),
  update: (payload) => api.patch('/profile', payload).then((r) => r.data.data),
};

export const mealPlanApi = {
  forWeek: (weekStartDate) => api.get('/meal-plans', { params: weekStartDate ? { weekStartDate } : {} }).then((r) => r.data.data),
  list: () => api.get('/meal-plans/list').then((r) => r.data.data),
  get: (id) => api.get(`/meal-plans/${id}`).then((r) => r.data.data),
  create: (payload) => api.post('/meal-plans', payload || {}).then((r) => r.data.data),
  patch: (id, payload) => api.patch(`/meal-plans/${id}`, payload).then((r) => r.data.data),
  remove: (id) => api.delete(`/meal-plans/${id}`).then((r) => r.data.data),
};

export const shoppingApi = {
  generate: (payload) => api.post('/shopping-lists/generate', payload).then((r) => r.data.data),
  list: () => api.get('/shopping-lists').then((r) => r.data.data),
  get: (id) => api.get(`/shopping-lists/${id}`).then((r) => r.data.data),
  addItem: (id, payload) => api.post(`/shopping-lists/${id}/items`, payload).then((r) => r.data.data),
  patchItem: (id, itemId, payload) => api.patch(`/shopping-lists/${id}/items/${itemId}`, payload).then((r) => r.data.data),
  deleteItem: (id, itemId) => api.delete(`/shopping-lists/${id}/items/${itemId}`).then((r) => r.data.data),
  remove: (id) => api.delete(`/shopping-lists/${id}`).then((r) => r.data.data),
};

export default api;
