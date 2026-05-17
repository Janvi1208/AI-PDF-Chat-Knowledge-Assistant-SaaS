import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────
export const authAPI = {
  register: (data: { email: string; password: string; full_name: string }) =>
    api.post('/api/auth/register', data).then((r) => r.data),
  login: (email: string, password: string) => {
    const form = new URLSearchParams();
    form.append('username', email);
    form.append('password', password);
    return api.post('/api/auth/login', form, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }).then((r) => r.data);
  },
  me: () => api.get('/api/auth/me').then((r) => r.data),
};

// ── Documents ─────────────────────────────────────────────────
export const docsAPI = {
  upload: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/api/documents/upload', fd).then((r) => r.data);
  },
  list: () => api.get('/api/documents/').then((r) => r.data),
  get:  (id: string) => api.get(`/api/documents/${id}`).then((r) => r.data),
  del:  (id: string) => api.delete(`/api/documents/${id}`).then((r) => r.data),
};

// ── Sessions ──────────────────────────────────────────────────
export const sessionsAPI = {
  create: (title: string, document_ids: string[]) =>
    api.post('/api/sessions/', { title, document_ids }).then((r) => r.data),
  list: () => api.get('/api/sessions/').then((r) => r.data),
  del:  (id: string) => api.delete(`/api/sessions/${id}`).then((r) => r.data),
};

// ── Chat ──────────────────────────────────────────────────────
export const chatAPI = {
  send: (session_id: string, message: string, document_ids: string[]) =>
    api.post('/api/chat/message', { session_id, message, document_ids }).then((r) => r.data),
  messages: (session_id: string) =>
    api.get(`/api/chat/sessions/${session_id}/messages`).then((r) => r.data),
};

export default api;
