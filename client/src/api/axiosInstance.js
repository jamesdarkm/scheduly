import axios from 'axios';

// In dev, Vite proxy forwards /api → localhost:3001
// In production, VITE_API_URL points to the Railway backend (e.g. https://scheduly-api.up.railway.app)
const API_URL = import.meta.env.VITE_API_URL || '';
const baseURL = API_URL ? `${API_URL}/api` : '/api';

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Rewrite relative /uploads/... URLs in API responses to absolute backend URLs,
// so <img src> tags resolve against the backend, not the Vercel frontend origin.
function rewriteUploadUrls(value) {
  if (!API_URL || value == null) return value;
  if (typeof value === 'string') {
    return value.startsWith('/uploads/') ? `${API_URL}${value}` : value;
  }
  if (Array.isArray(value)) return value.map(rewriteUploadUrls);
  if (typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) out[k] = rewriteUploadUrls(value[k]);
    return out;
  }
  return value;
}

api.interceptors.response.use(
  (response) => {
    response.data = rewriteUploadUrls(response.data);
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
