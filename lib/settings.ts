import type { AppSettings } from '../types';
import { storage } from './storage';

const LEGACY_SETTINGS_KEY = 'plumbpro-settings';

export const defaultSettings: AppSettings = {
  profile: {
    fullName: 'Admin User',
    email: 'admin@plumbpro.com',
    phone: '(555) 123-4567',
    role: 'Administrator'
  },
  company: {
    companyName: 'PlumbPro Industries',
    address: '123 Main Street',
    city: 'Sydney',
    state: 'NSW',
    postcode: '2000',
    abn: '12 345 678 901',
    phone: '(02) 9876 5432',
    email: 'info@plumbpro.com'
  },
  notifications: {
    emailNotifications: true,
    lowStockAlerts: true,
    jobUpdates: true,
    orderConfirmations: true,
    systemUpdates: false
  },
  appearance: {
    theme: 'light',
    language: 'en',
    dateFormat: 'DD/MM/YYYY',
    currency: 'AUD'
  },
  ai: {
    subscriptionTier: 'solo',
    preferredProvider: 'auto',
    preferredModel: 'auto',
    hasCustomApiKey: false,
    dailyQuotaUsed: 0,
    dailyQuotaReset: new Date().toISOString(),
    featureProviders: {
      forecast: 'auto',
      search: 'auto',
      template: 'auto',
      anomaly: 'auto',
      purchaseOrders: 'auto',
      insights: 'auto',
      jobCompletion: 'auto'
    }
  }
};

const mergeSettings = (incoming?: Partial<AppSettings> | null): AppSettings => ({
  profile: { ...defaultSettings.profile, ...incoming?.profile },
  company: { ...defaultSettings.company, ...incoming?.company },
  notifications: { ...defaultSettings.notifications, ...incoming?.notifications },
  appearance: { ...defaultSettings.appearance, ...incoming?.appearance },
  ai: {
    ...defaultSettings.ai,
    ...incoming?.ai,
    featureProviders: {
      ...defaultSettings.ai.featureProviders,
      ...incoming?.ai?.featureProviders
    }
  }
});

const readLegacySettings = (): AppSettings | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const savedSettings = window.localStorage.getItem(LEGACY_SETTINGS_KEY);
    if (!savedSettings) {
      return null;
    }

    const parsed = JSON.parse(savedSettings) as Partial<AppSettings>;
    return mergeSettings(parsed);
  } catch (error) {
    console.error('Failed to read legacy settings:', error);
    return null;
  }
};

const clearLegacySettings = () => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(LEGACY_SETTINGS_KEY);
  } catch (error) {
    console.error('Failed to clear legacy settings:', error);
  }
};

export const loadSettings = async (): Promise<AppSettings> => {
  const legacySettings = readLegacySettings();
  const stored = await storage.getSettings();

  if (legacySettings) {
    if (!stored) {
      await storage.setSettings(legacySettings);
      clearLegacySettings();
      return legacySettings;
    }
    clearLegacySettings();
  }

  if (stored) {
    return mergeSettings(stored);
  }

  return legacySettings ?? defaultSettings;
};

export const saveSettings = async (settings: AppSettings): Promise<void> => {
  const merged = mergeSettings(settings);
  await storage.setSettings(merged);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('settings-changed', { detail: merged }));
  }
};
