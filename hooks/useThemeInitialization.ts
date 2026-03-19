import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { loadSettings } from '../lib/settings';

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface ThemeInitializationState {
  theme: ThemeMode;
  setTheme: Dispatch<SetStateAction<ThemeMode>>;
}

/**
 * Loads theme settings once, keeps document classes in sync, and listens for
 * settings updates broadcast from the rest of the app.
 */
export function useThemeInitialization(): ThemeInitializationState {
  const [theme, setTheme] = useState<ThemeMode>('light');

  useEffect(() => {
    let isMounted = true;

    const fetchSettings = async () => {
      try {
        const settings = await loadSettings();
        if (isMounted && settings.appearance?.theme) {
          setTheme(settings.appearance.theme);
        }
      } catch (error) {
        console.error('Failed to load theme settings:', error);
      }
    };

    void fetchSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [theme]);

  useEffect(() => {
    const handleSettingsChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ appearance?: { theme?: ThemeMode } }>;
      if (customEvent.detail?.appearance?.theme) {
        setTheme(customEvent.detail.appearance.theme);
      }
    };

    window.addEventListener('settings-changed', handleSettingsChange);
    return () => {
      window.removeEventListener('settings-changed', handleSettingsChange);
    };
  }, []);

  return { theme, setTheme };
}
