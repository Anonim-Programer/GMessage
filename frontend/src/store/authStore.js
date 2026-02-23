import { create } from 'zustand';
import api from '../utils/api';
import toast from 'react-hot-toast';

export const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  isLoading: false,

  hydrate: () => {
    const token = localStorage.getItem('token');
    const refreshToken = localStorage.getItem('refreshToken');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (token && user) {
      set({ token, refreshToken, user });
    }
  },

  setAuth: (user, token, refreshToken) => {
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, token, refreshToken });
  },

  login: async (emailOrUsername, password, twoFactorCode) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/login', { emailOrUsername, password, twoFactorCode });
      if (data.requiresTwoFactor) {
        set({ isLoading: false });
        return { requiresTwoFactor: true };
      }
      get().setAuth(data.user, data.accessToken, data.refreshToken);
      toast.success(`Добро пожаловать, ${data.user.first_name || data.user.username}!`);
      return { success: true };
    } catch (err) {
      toast.error(err.response?.data?.error || 'Ошибка входа');
      return { error: true };
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (data) => {
    set({ isLoading: true });
    try {
      const res = await api.post('/auth/register', data);
      get().setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
      toast.success('Регистрация успешна! Проверьте почту для подтверждения.');
      return { success: true };
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors?.length) toast.error(errors[0].msg);
      else toast.error(err.response?.data?.error || 'Ошибка регистрации');
      return { error: true };
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout', { refreshToken: get().refreshToken });
    } catch {}
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    set({ user: null, token: null, refreshToken: null });
  },

  updateUser: (updates) => {
    const user = { ...get().user, ...updates };
    localStorage.setItem('user', JSON.stringify(user));
    set({ user });
  },

  refreshAccessToken: async () => {
    try {
      const { data } = await api.post('/auth/refresh', { refreshToken: get().refreshToken });
      localStorage.setItem('token', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      set({ token: data.accessToken, refreshToken: data.refreshToken });
      return data.accessToken;
    } catch {
      get().logout();
      return null;
    }
  }
}));
