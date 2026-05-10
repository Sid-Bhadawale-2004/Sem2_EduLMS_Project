import axios from 'axios';

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Recursively add .id alias for every ._id (MongoDB → frontend compat)
function normalizeIds(data) {
  if (Array.isArray(data)) return data.map(normalizeIds);
  if (data !== null && typeof data === 'object') {
    const out = {};
    for (const key of Object.keys(data)) {
      const val = normalizeIds(data[key]);
      out[key] = val;
      if (key === '_id') out.id = val;
    }
    return out;
  }
  return data;
}

let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => {
    if (response.data) response.data = normalizeIds(response.data);
    return response;
  },
  async (error) => {
    const orig = error.config;
    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && !orig._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }))
          .then((token) => { orig.headers.Authorization = `Bearer ${token}`; return api(orig); });
      }
      orig._retry = true;
      isRefreshing = true;
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) { localStorage.removeItem('accessToken'); window.location.href = '/login'; return Promise.reject(error); }
      try {
        const { data } = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/refresh`, { refreshToken });
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        api.defaults.headers.Authorization = `Bearer ${data.accessToken}`;
        processQueue(null, data.accessToken);
        return api(orig);
      } catch (e) {
        processQueue(e, null);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(e);
      } finally { isRefreshing = false; }
    }
    if (error.response?.status === 403) {
      const url = error.config?.url || '';
      if (['/attendance/my', '/attendance/code', '/attendance/qr'].some(r => url.includes(r))) {
        ['accessToken','refreshToken','user'].forEach(k => localStorage.removeItem(k));
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
