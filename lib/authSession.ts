const AUTH_TOKEN_KEY = 'authToken';
const AUTH_USER_KEY = 'user';

const hasWindow = () => typeof window !== 'undefined';

const readSessionValue = (key: string): string | null => {
  if (!hasWindow()) {
    return null;
  }

  return window.sessionStorage.getItem(key);
};

const readLegacyValue = (key: string): string | null => {
  if (!hasWindow()) {
    return null;
  }

  return window.localStorage.getItem(key);
};

const writeSessionValue = (key: string, value: string) => {
  if (!hasWindow()) {
    return;
  }

  window.sessionStorage.setItem(key, value);
  window.localStorage.removeItem(key);
};

const clearValue = (key: string) => {
  if (!hasWindow()) {
    return;
  }

  window.sessionStorage.removeItem(key);
  window.localStorage.removeItem(key);
};

export interface AuthSessionUser {
  id: string;
  email: string;
  fullName: string;
  companyName?: string;
  role: string;
}

export const getAuthToken = (): string | null => {
  const sessionToken = readSessionValue(AUTH_TOKEN_KEY);
  if (sessionToken) {
    return sessionToken;
  }

  const legacyToken = readLegacyValue(AUTH_TOKEN_KEY);
  if (legacyToken) {
    writeSessionValue(AUTH_TOKEN_KEY, legacyToken);
    return legacyToken;
  }

  return null;
};

export const getStoredUser = (): AuthSessionUser | null => {
  const sessionUser = readSessionValue(AUTH_USER_KEY);
  if (sessionUser) {
    try {
      return JSON.parse(sessionUser) as AuthSessionUser;
    } catch {
      clearValue(AUTH_USER_KEY);
      return null;
    }
  }

  const legacyUser = readLegacyValue(AUTH_USER_KEY);
  if (!legacyUser) {
    return null;
  }

  try {
    const parsed = JSON.parse(legacyUser) as AuthSessionUser;
    writeSessionValue(AUTH_USER_KEY, legacyUser);
    return parsed;
  } catch {
    clearValue(AUTH_USER_KEY);
    return null;
  }
};

export const persistAuthSession = (token: string, user: AuthSessionUser) => {
  writeSessionValue(AUTH_TOKEN_KEY, token);
  writeSessionValue(AUTH_USER_KEY, JSON.stringify(user));
};

export const clearAuthSession = () => {
  clearValue(AUTH_TOKEN_KEY);
  clearValue(AUTH_USER_KEY);
};
