import { authAPI } from '../lib/api';
import { clearAuthSession, persistAuthSession } from '../lib/authSession';
import { getErrorMessage } from '../lib/errors';
import { storage } from '../lib/storage';
import { initialAppState } from './initialState';
import type { AppState, StoreGet, StoreSet, User } from './storeTypes';

interface AuthResponse {
  token: string;
  user: User;
}

const authenticateUser = async (
  request: () => Promise<AuthResponse>,
  fallbackMessage: string,
  set: StoreSet,
  get: StoreGet
) => {
  try {
    set({ isLoading: true, error: null });

    const response = await request();
    persistAuthSession(response.token, response.user);

    set({
      user: response.user,
      authToken: response.token,
      isAuthenticated: true,
      isLoading: false
    });

    await get().syncWithServer();
  } catch (error) {
    const message = getErrorMessage(error, fallbackMessage);
    set({
      error: message,
      isLoading: false
    });
    throw error;
  }
};

export const createAuthStoreActions = (
  set: StoreSet,
  get: StoreGet
): Pick<AppState, 'login' | 'register' | 'logout' | 'setUser'> => ({
  login: async (email, password) => {
    await authenticateUser(
      () => authAPI.login(email, password),
      'Login failed',
      set,
      get
    );
  },

  register: async (email, password, fullName, companyName, inviteToken) => {
    await authenticateUser(
      () => authAPI.register(email, password, fullName, companyName, inviteToken),
      'Registration failed',
      set,
      get
    );
  },

  logout: () => {
    clearAuthSession();
    void storage.clearAll();
    set({ ...initialAppState });
  },

  setUser: (user, token) => {
    set({
      user,
      authToken: token,
      isAuthenticated: true
    });
  }
});
