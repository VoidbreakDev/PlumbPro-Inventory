import { storage } from './storage';

const LEGACY_RECENT_SEARCHES_KEY = 'plumbpro_recent_searches';

const readLegacyRecentSearches = (): string[] | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const saved = window.localStorage.getItem(LEGACY_RECENT_SEARCHES_KEY);
    if (!saved) {
      return null;
    }
    const parsed = JSON.parse(saved) as string[];
    return Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    console.error('Failed to read legacy recent searches:', error);
    return null;
  }
};

const clearLegacyRecentSearches = () => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(LEGACY_RECENT_SEARCHES_KEY);
  } catch (error) {
    console.error('Failed to clear legacy recent searches:', error);
  }
};

export const loadRecentSearches = async (): Promise<string[]> => {
  const legacy = readLegacyRecentSearches();
  const stored = await storage.getRecentSearches();

  if (legacy) {
    if (!stored) {
      await storage.setRecentSearches(legacy);
      clearLegacyRecentSearches();
      return legacy;
    }
    clearLegacyRecentSearches();
  }

  if (stored) {
    return stored;
  }

  return legacy ?? [];
};

export const saveRecentSearches = async (recentSearches: string[]): Promise<void> => {
  await storage.setRecentSearches(recentSearches);
};
