import axios from 'axios';
import { useAuthStore } from '../stores/authStore.js';
import { getSocketId } from './ws.js';

export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

/** Active share token for unauthenticated shared-board access. Set by SharedBoardPage. */
let activeShareToken: string | null = null;
export function setActiveShareToken(token: string | null) { activeShareToken = token; }
export function getActiveShareToken() { return activeShareToken; }

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Send socket ID so the server can exclude us from broadcasts
  const socketId = getSocketId();
  if (socketId) {
    config.headers['X-Socket-Id'] = socketId;
  }
  // Pass share token for shared-board access (authenticated or not)
  if (activeShareToken) {
    config.headers['X-Share-Token'] = activeShareToken;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true });
        const newToken = data.accessToken;
        useAuthStore.getState().setAccessToken(newToken);

        failedQueue.forEach(({ resolve }) => resolve(newToken));
        failedQueue = [];

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        failedQueue.forEach(({ reject }) => reject(refreshError));
        failedQueue = [];
        useAuthStore.getState().logout();
        // Use soft navigation instead of hard reload to prevent infinite reload loops
        if (
          window.location.pathname !== '/login' &&
          window.location.pathname !== '/register' &&
          !window.location.pathname.startsWith('/shared/')
        ) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
