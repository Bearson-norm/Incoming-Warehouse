import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import api from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

interface User {
  id: number;
  username: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: async (username: string, password: string) => {
        const response = await api.post('/auth/login', { username, password });
        const accessToken = response.data.access_token;
        set({
          user: response.data.user,
          token: accessToken,
          isAuthenticated: true,
        });
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        connectSocket();
      },
      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
        delete api.defaults.headers.common['Authorization'];
        localStorage.removeItem('auth-storage');
        disconnectSocket();
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${state.token}`;
          connectSocket();
        }
      },
    },
  ),
);
