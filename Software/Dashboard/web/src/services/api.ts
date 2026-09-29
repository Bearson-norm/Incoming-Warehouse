import axios from 'axios';

// Detect Electron environment
const isElectron = typeof window !== 'undefined' && (window as any).electron?.isElectron === true;

// API base URL - in Electron, use localhost directly
// Use the IPv4 loopback explicitly in Electron. On some Windows hosts,
// `localhost` resolves to IPv6 first while the packaged local services are
// reachable only through IPv4.
const API_BASE_URL = isElectron ? 'http://127.0.0.1:4123/api' : '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Function to get token from localStorage
const getTokenFromStorage = (): string | null => {
  try {
    const token = localStorage.getItem('auth-storage');
    if (token) {
      const parsed = JSON.parse(token);
      return parsed.state?.token || null;
    }
  } catch (e) {
    // Ignore parse errors
  }
  return null;
};

// Set initial token if available
const initialToken = getTokenFromStorage();
if (initialToken) {
  api.defaults.headers.common['Authorization'] = `Bearer ${initialToken}`;
}

// Request interceptor to add token dynamically
api.interceptors.request.use(
  (config) => {
    const token = getTokenFromStorage();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth-storage');
      delete api.defaults.headers.common['Authorization'];
      const onLogin =
        window.location.hash.includes('/login') ||
        window.location.pathname.endsWith('/login');
      if (!onLogin) {
        if (window.location.protocol === 'file:' || window.location.hash.startsWith('#/')) {
          window.location.hash = '/login';
        } else {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
