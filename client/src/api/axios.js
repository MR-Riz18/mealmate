import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
  withCredentials: true,
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message = err?.response?.data?.message
      || err?.response?.data?.errors?.join(', ')
      || err.message || 'Something went wrong.';
    return Promise.reject(new Error(message));
  }
);

export default api;
