import axios from 'axios';
import { clearAuthSession, getAuthToken } from '../authSession';

export const DEFAULT_API_URL = 'http://localhost:5001/api';
export const DEFAULT_BACKEND_PORT = 5001;

export const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

function getApiBaseUrl(): string {
  if (isElectron) {
    const electronPort = (window as any).__PLUMBPRO_SERVER_PORT__ || 5001;
    return `http://localhost:${electronPort}/api`;
  }

  return import.meta.env.VITE_API_URL || DEFAULT_API_URL;
}

export const API_BASE_URL = getApiBaseUrl();
export const API_ROOT_URL = API_BASE_URL.replace(/\/api\/?$/, '');
export const hasExplicitApiUrl = Boolean(import.meta.env.VITE_API_URL) || isElectron;

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      clearAuthSession();
      window.dispatchEvent(new CustomEvent('auth-error'));
    }
    return Promise.reject(error);
  }
);

export default api;
