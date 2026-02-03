import React, { useState, useEffect } from 'react';
import { User, Building2, Bell, Shield, Database, Palette, Globe, Save, Brain, Cloud, Trash2, Link2, RefreshCw, Check, X, AlertCircle, Clock, Users, FileText, CreditCard } from 'lucide-react';
import api from '../lib/api';
import { useStore } from '../store/useStore';
import { getErrorMessage } from '../lib/errors';
import { defaultSettings } from '../lib/settings';
import { xeroAPI, XeroConnection, XeroSyncLog, XeroSettings } from '../lib/xeroAPI';

interface SettingsViewProps {
  onSave?: (settings: any) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onSave }) => {
  const [activeSection, setActiveSection] = useState<'profile' | 'company' | 'notifications' | 'security' | 'data' | 'appearance' | 'ai' | 'integrations'>('profile');
  const setError = useStore((state) => state.setError);

  // Load settings from localStorage on mount
  const loadSettings = () => {
    const saved = localStorage.getItem('plumbpro-settings');
    if (saved) {
      return JSON.parse(saved);
    }
    return null;
  };

  const savedSettings = loadSettings();
  const savedAiSettings = savedSettings?.ai || {};

  // Profile settings
  const [profileSettings, setProfileSettings] = useState(defaultSettings.profile);

  // Company settings
  const [companySettings, setCompanySettings] = useState(defaultSettings.company);

  // Notification settings
  const [notificationSettings, setNotificationSettings] = useState(defaultSettings.notifications);

  // Appearance settings
  const [appearanceSettings, setAppearanceSettings] = useState(defaultSettings.appearance);

  // AI settings - Tier-based cloud AI (Ollama removed)
  const [aiSettings, setAiSettings] = useState({
    subscriptionTier: savedAiSettings.subscriptionTier || 'solo',
    preferredProvider: savedAiSettings.preferredProvider || 'auto',
    preferredModel: savedAiSettings.preferredModel || 'auto',
    hasCustomApiKey: savedAiSettings.hasCustomApiKey || false,
    geminiApiKey: '',
    featureProviders: savedAiSettings.featureProviders || {
      forecast: 'auto',
      search: 'auto',
      template: 'auto',
      anomaly: 'auto',
      purchaseOrders: 'auto',
      insights: 'auto',
      jobCompletion: 'auto'
    }
  });

  // Available models based on tier
  const TIER_MODELS = {
    solo: {
      name: 'Solo',
      dailyQuota: 100,
      models: [
        { provider: 'gemini', model: 'gemini-2.0-flash-exp', name: 'Gemini Flash (Free)' }
      ]
    },
    team: {
      name: 'Team',
      dailyQuota: 500,
      models: [
        { provider: 'gemini', model: 'gemini-2.0-flash-exp', name: 'Gemini Flash' },
        { provider: 'gemini', model: 'gemini-1.5-pro', name: 'Gemini Pro' },
        { provider: 'openai', model: 'gpt-4o-mini', name: 'GPT-4o Mini' }
      ]
    },
    business: {
      name: 'Business',
      dailyQuota: null, // Unlimited
      models: [
        { provider: 'gemini', model: 'gemini-2.0-flash-exp', name: 'Gemini Flash' },
        { provider: 'gemini', model: 'gemini-1.5-pro', name: 'Gemini Pro' },
        { provider: 'openai', model: 'gpt-4o-mini', name: 'GPT-4o Mini' },
        { provider: 'openai', model: 'gpt-4o', name: 'GPT-4o' },
        { provider: 'anthropic', model: 'claude-3-haiku-20240307', name: 'Claude Haiku' }
      ]
    }
  };

  const currentTier = TIER_MODELS[aiSettings.subscriptionTier as keyof typeof TIER_MODELS];

  const [geminiKeyStatus, setGeminiKeyStatus] = useState({
    hasKey: false,
    loading: true
  });

  // Xero integration state
  const [xeroStatus, setXeroStatus] = useState<{
    connected: boolean;
    connection?: XeroConnection;
    lastSync?: XeroSyncLog;
    loading: boolean;
  }>({ connected: false, loading: true });
  const [xeroSettings, setXeroSettings] = useState<XeroSettings>({
    sync_contacts: true,
    sync_invoices: true,
    sync_payments: true,
    auto_sync_enabled: false,
    sync_frequency_minutes: 60
  });
  const [xeroSyncing, setXeroSyncing] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadGeminiKeyStatus = async () => {
      try {
        const { data } = await api.get('/settings/ai-keys');
        if (!isMounted) {
          return;
        }
        setGeminiKeyStatus({
          hasKey: Boolean(data?.providers?.gemini?.hasKey),
          loading: false
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }
        console.error('Failed to load AI key status:', error);
        setGeminiKeyStatus({ hasKey: false, loading: false });
      }
    };

    loadGeminiKeyStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  // Load Xero connection status
  useEffect(() => {
    let isMounted = true;

    const loadXeroStatus = async () => {
      try {
        const status = await xeroAPI.getStatus();
        if (!isMounted) return;
        setXeroStatus({
          connected: status.connected,
          connection: status.connection,
          lastSync: status.lastSync,
          loading: false
        });
        if (status.connection) {
          setXeroSettings({
            sync_contacts: status.connection.sync_contacts,
            sync_invoices: status.connection.sync_invoices,
            sync_payments: status.connection.sync_payments,
            auto_sync_enabled: status.connection.auto_sync_enabled,
            sync_frequency_minutes: status.connection.sync_frequency_minutes
          });
        }
      } catch (error) {
        if (!isMounted) return;
        console.error('Failed to load Xero status:', error);
        setXeroStatus({ connected: false, loading: false });
      }
    };

    loadXeroStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  // Handle Xero OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (code && state && state.startsWith('xero_')) {
      // Handle Xero callback
      (async () => {
        try {
          const result = await xeroAPI.handleCallback(code, state);
          if (result.success) {
            // Reload status
            const status = await xeroAPI.getStatus();
            setXeroStatus({
              connected: status.connected,
              connection: status.connection,
              lastSync: status.lastSync,
              loading: false
            });
            // Clear URL params
            window.history.replaceState({}, '', window.location.pathname);
            alert(`Successfully connected to Xero organization: ${result.tenantName}`);
          }
        } catch (error: any) {
          console.error('Xero callback error:', error);
          alert(`Failed to connect to Xero: ${error.message}`);
          window.history.replaceState({}, '', window.location.pathname);
        }
      })();
    }
  }, []);

  const handleXeroConnect = async () => {
    try {
      const { authUrl } = await xeroAPI.getAuthUrl();
      window.location.href = authUrl;
    } catch (error: any) {
      setError(getErrorMessage(error, 'Failed to start Xero connection'));
    }
  };

  const handleXeroDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect from Xero? This will stop all syncing.')) {
      return;
    }
    try {
      await xeroAPI.disconnect();
      setXeroStatus({ connected: false, loading: false });
      alert('Successfully disconnected from Xero');
    } catch (error: any) {
      setError(getErrorMessage(error, 'Failed to disconnect from Xero'));
    }
  };

  const handleXeroSync = async (syncType: 'contacts' | 'invoices') => {
    setXeroSyncing(syncType);
    try {
      let result;
      if (syncType === 'contacts') {
        result = await xeroAPI.syncContacts('bidirectional');
      } else {
        result = await xeroAPI.syncInvoices();
      }
      alert(`Sync completed: ${result.synced} records synced (${result.created} created, ${result.updated} updated)`);
      // Refresh status
      const status = await xeroAPI.getStatus();
      setXeroStatus({
        connected: status.connected,
        connection: status.connection,
        lastSync: status.lastSync,
        loading: false
      });
    } catch (error: any) {
      setError(getErrorMessage(error, `Failed to sync ${syncType}`));
    } finally {
      setXeroSyncing(null);
    }
  };

  const handleXeroSettingsSave = async () => {
    try {
      await xeroAPI.updateSettings(xeroSettings);
      alert('Xero settings saved successfully');
    } catch (error: any) {
      setError(getErrorMessage(error, 'Failed to save Xero settings'));
    }
  };

  const handleSaveSettings = async () => {
    const aiSettingsToStore = {
      ...aiSettings,
      geminiApiKey: ''
    };

    const allSettings = {
      profile: profileSettings,
      company: companySettings,
      notifications: notificationSettings,
      appearance: appearanceSettings,
      ai: aiSettingsToStore
    };

    // Save non-secret settings to localStorage
    localStorage.setItem('plumbpro-settings', JSON.stringify(allSettings));

    // Dispatch event to notify App.tsx of settings changes
    window.dispatchEvent(new CustomEvent('settings-changed', { detail: allSettings }));

    if (onSave) {
      onSave(allSettings);
    }

    let savedApiKey = false;
    const trimmedApiKey = aiSettings.geminiApiKey.trim();
    if (trimmedApiKey.length > 0) {
      try {
        await api.put('/settings/ai-keys/gemini', { apiKey: trimmedApiKey });
        savedApiKey = true;
        setGeminiKeyStatus({ hasKey: true, loading: false });
        setAiSettings((prev) => ({ ...prev, geminiApiKey: '' }));
      } catch (error: any) {
        console.error('Failed to save Gemini API key:', error);
        alert(`Failed to save Gemini API key: ${error.message || 'Unknown error'}`);
        return;
      }
    }

    const alertMessage = savedApiKey
      ? 'Settings saved successfully! Your Gemini API key was stored securely.'
      : 'Settings saved successfully!';
    alert(alertMessage);
  };

  const sections = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'company', label: 'Company', icon: Building2 },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'integrations', label: 'Integrations', icon: Link2 },
    { id: 'ai', label: 'AI Integration', icon: Brain },
    { id: 'data', label: 'Data & Backup', icon: Database },
    { id: 'appearance', label: 'Appearance', icon: Palette }
  ];

  const hasGeminiKey = aiSettings.geminiApiKey.trim().length > 0 || geminiKeyStatus.hasKey;

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <div className="w-64 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 h-fit">
        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Settings</h3>
        <nav className="space-y-1">
          {sections.map(section => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id as any)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  activeSection === section.id
                    ? 'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{section.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
        {/* Profile Settings */}
        {activeSection === 'profile' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Profile Settings</h2>
              <p className="text-slate-500 dark:text-slate-400">Manage your personal information and preferences</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Full Name</label>
                <input
                  type="text"
                  value={profileSettings.fullName}
                  onChange={(e) => setProfileSettings({ ...profileSettings, fullName: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Email</label>
                <input
                  type="email"
                  value={profileSettings.email}
                  onChange={(e) => setProfileSettings({ ...profileSettings, email: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Phone</label>
                <input
                  type="tel"
                  value={profileSettings.phone}
                  onChange={(e) => setProfileSettings({ ...profileSettings, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Role</label>
                <select
                  value={profileSettings.role}
                  onChange={(e) => setProfileSettings({ ...profileSettings, role: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white shadow-sm"
                >
                  <option value="Administrator">Administrator</option>
                  <option value="Manager">Manager</option>
                  <option value="User">User</option>
                  <option value="Viewer">Viewer</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Company Settings */}
        {activeSection === 'company' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Company Settings</h2>
              <p className="text-slate-500">Update your company information</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Company Name</label>
                <input
                  type="text"
                  value={companySettings.companyName}
                  onChange={(e) => setCompanySettings({ ...companySettings, companyName: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Address</label>
                  <input
                    type="text"
                    value={companySettings.address}
                    onChange={(e) => setCompanySettings({ ...companySettings, address: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">City</label>
                  <input
                    type="text"
                    value={companySettings.city}
                    onChange={(e) => setCompanySettings({ ...companySettings, city: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">State</label>
                  <input
                    type="text"
                    value={companySettings.state}
                    onChange={(e) => setCompanySettings({ ...companySettings, state: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Postcode</label>
                  <input
                    type="text"
                    value={companySettings.postcode}
                    onChange={(e) => setCompanySettings({ ...companySettings, postcode: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">ABN</label>
                  <input
                    type="text"
                    value={companySettings.abn}
                    onChange={(e) => setCompanySettings({ ...companySettings, abn: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Phone</label>
                  <input
                    type="tel"
                    value={companySettings.phone}
                    onChange={(e) => setCompanySettings({ ...companySettings, phone: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Email</label>
                  <input
                    type="email"
                    value={companySettings.email}
                    onChange={(e) => setCompanySettings({ ...companySettings, email: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notification Settings */}
        {activeSection === 'notifications' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Notification Settings</h2>
              <p className="text-slate-500">Choose what notifications you want to receive</p>
            </div>

            <div className="space-y-4">
              {Object.entries(notificationSettings).map(([key, value]) => (
                <label key={key} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                  <div>
                    <p className="font-semibold text-slate-800 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                    <p className="text-sm text-slate-500">Receive notifications for this category</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, [key]: e.target.checked })}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Security Settings */}
        {activeSection === 'security' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Security Settings</h2>
              <p className="text-slate-500">Manage your account security</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Current Password</label>
                <input
                  type="password"
                  placeholder="Enter current password"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">New Password</label>
                <input
                  type="password"
                  placeholder="Enter new password"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Confirm New Password</label>
                <input
                  type="password"
                  placeholder="Confirm new password"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <button className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg">
                Update Password
              </button>
            </div>
          </div>
        )}

        {/* Data & Backup Settings */}
        {activeSection === 'data' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Data & Backup</h2>
              <p className="text-slate-500">Manage your data and backups</p>
            </div>

            <div className="space-y-4">
              <div className="p-6 bg-blue-50 border border-blue-200 rounded-xl">
                <h3 className="font-bold text-blue-900 mb-2">Export Data</h3>
                <p className="text-blue-700 text-sm mb-4">Download all your data in CSV or JSON format</p>
                <div className="flex space-x-3">
                  <button className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">
                    Export as CSV
                  </button>
                  <button className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">
                    Export as JSON
                  </button>
                </div>
              </div>

              <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl">
                <h3 className="font-bold text-amber-900 mb-2">Backup Database</h3>
                <p className="text-amber-700 text-sm mb-4">Create a full backup of your database</p>
                <button className="px-4 py-2 bg-amber-600 text-white font-semibold rounded-lg hover:bg-amber-700">
                  Create Backup
                </button>
              </div>

              <div className="p-6 bg-purple-50 border border-purple-200 rounded-xl">
                <h3 className="font-bold text-purple-900 mb-2 flex items-center">
                  <Trash2 className="w-5 h-5 mr-2" />
                  Clear Local Data
                </h3>
                <p className="text-purple-700 text-sm mb-4">
                  Clear all locally stored data (localStorage). This will remove old sample contacts and force the app to reload fresh data from the database. Useful if you're experiencing sync issues.
                </p>
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to clear all local data? This will reload the app with fresh data from the database.')) {
                      localStorage.clear();
                      location.reload();
                    }
                  }}
                  className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 flex items-center space-x-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear Local Data</span>
                </button>
              </div>

              <div className="p-6 bg-red-50 border border-red-200 rounded-xl">
                <h3 className="font-bold text-red-900 mb-2">Danger Zone</h3>
                <p className="text-red-700 text-sm mb-4">Permanently delete all your data. This action cannot be undone.</p>
                <button className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700">
                  Delete All Data
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Appearance Settings */}
        {activeSection === 'appearance' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Appearance Settings</h2>
              <p className="text-slate-500">Customize how the application looks</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Theme</label>
                <select
                  value={appearanceSettings.theme}
                  onChange={(e) => setAppearanceSettings({ ...appearanceSettings, theme: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white shadow-sm"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="auto">Auto (System)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Language</label>
                <select
                  value={appearanceSettings.language}
                  onChange={(e) => setAppearanceSettings({ ...appearanceSettings, language: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white shadow-sm"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Date Format</label>
                <select
                  value={appearanceSettings.dateFormat}
                  onChange={(e) => setAppearanceSettings({ ...appearanceSettings, dateFormat: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white shadow-sm"
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Currency</label>
                <select
                  value={appearanceSettings.currency}
                  onChange={(e) => setAppearanceSettings({ ...appearanceSettings, currency: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white shadow-sm"
                >
                  <option value="AUD">AUD ($)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* AI Integration Settings */}
        {activeSection === 'ai' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">AI Integration Settings</h2>
              <p className="text-slate-500">Configure AI providers for intelligent features</p>
            </div>

            {/* Subscription Tier */}
            <div className="p-6 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center">
                <CreditCard className="w-5 h-5 mr-2 text-purple-600" />
                Subscription Plan
              </h3>
              <select
                value={aiSettings.subscriptionTier}
                onChange={(e) => {
                  const tier = e.target.value;
                  setAiSettings({ 
                    ...aiSettings, 
                    subscriptionTier: tier,
                    preferredModel: 'auto' // Reset model when changing tiers
                  });
                }}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white shadow-sm"
              >
                <option value="solo">Solo - $15/month (100 AI queries/day)</option>
                <option value="team">Team - $50/month (500 AI queries/day)</option>
                <option value="business">Business - $50/month + $12/user (Unlimited)</option>
              </select>
              <div className="mt-4 p-3 bg-white rounded-lg">
                <p className="text-sm font-medium text-slate-700">
                  Current Plan: <span className="text-purple-600">{currentTier.name}</span>
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  Daily Quota: {currentTier.dailyQuota ? `${currentTier.dailyQuota} queries` : 'Unlimited'}
                </p>
              </div>
            </div>

            {/* AI Model Selection */}
            <div className="p-6 bg-white border-2 border-blue-200 rounded-xl">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center">
                <Brain className="w-5 h-5 mr-2 text-blue-600" />
                AI Model Preference
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Preferred Model
                  </label>
                  <select
                    value={aiSettings.preferredModel}
                    onChange={(e) => setAiSettings({ ...aiSettings, preferredModel: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white shadow-sm"
                  >
                    <option value="auto">Auto (Best for task)</option>
                    {currentTier.models.map((model) => (
                      <option key={`${model.provider}-${model.model}`} value={`${model.provider}:${model.model}`}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-2">
                    Auto mode selects the best model for each task automatically
                  </p>
                </div>

                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-800 mb-2">
                    <strong>Available Models:</strong>
                  </p>
                  <ul className="text-xs text-blue-700 space-y-1">
                    {currentTier.models.map((model) => (
                      <li key={`${model.provider}-${model.model}`}>• {model.name}</li>
                    ))}
                  </ul>
                </div>

                {aiSettings.subscriptionTier === 'business' && (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-xs text-amber-800">
                      <strong>Business Tier:</strong> You can provide your own API keys for lower costs.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Feature-Specific Preferences */}
            <div className="p-6 bg-white border-2 border-amber-200 rounded-xl">
              <h3 className="font-bold text-slate-800 mb-4">Feature-Specific AI Preferences</h3>
              <p className="text-sm text-slate-600 mb-4">
                Choose which AI capability to use for each feature. Auto selects the best model for the task.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'forecast', label: 'Demand Forecast' },
                  { key: 'search', label: 'Smart Search' },
                  { key: 'template', label: 'Stock Templates' },
                  { key: 'anomaly', label: 'Anomaly Detection' },
                  { key: 'purchaseOrders', label: 'Purchase Orders' },
                  { key: 'insights', label: 'Business Insights' },
                  { key: 'jobCompletion', label: 'Job Completion' }
                ].map((feature) => (
                  <div key={feature.key}>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      {feature.label}
                    </label>
                    <select
                      value={aiSettings.featureProviders[feature.key]}
                      onChange={(e) => setAiSettings({
                        ...aiSettings,
                        featureProviders: { ...aiSettings.featureProviders, [feature.key]: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-sm"
                    >
                      <option value="auto">Auto</option>
                      {currentTier.models.map((model) => (
                        <option key={`${model.provider}-${model.model}`} value={`${model.provider}:${model.model}`}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* API Key Status (for Business tier) */}
            {aiSettings.subscriptionTier === 'business' && (
              <div className="p-6 bg-white border-2 border-green-200 rounded-xl">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center">
                  <Cloud className="w-5 h-5 mr-2 text-green-600" />
                  Custom API Keys (Optional)
                </h3>
                <p className="text-sm text-slate-600 mb-4">
                  Business tier can use their own API keys to reduce costs. Leave blank to use our managed API access.
                </p>
                <div className="space-y-4">
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-xs text-green-800">
                      <strong>Status:</strong> {aiSettings.hasCustomApiKey ? 'Using custom API keys' : 'Using managed API access'}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveSection('integrations')}
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    Configure API keys in Integrations →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Integrations Settings */}
        {activeSection === 'integrations' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Integrations</h2>
              <p className="text-slate-500 dark:text-slate-400">Connect PlumbPro to external accounting and business systems</p>
            </div>

            {/* Xero Integration */}
            <div className="p-6 bg-white dark:bg-slate-700 border-2 border-blue-200 dark:border-blue-800 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-[#13B5EA] rounded-xl flex items-center justify-center">
                    <span className="text-white font-bold text-xl">X</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Xero</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Accounting & Invoicing</p>
                  </div>
                </div>
                {xeroStatus.loading ? (
                  <div className="flex items-center space-x-2 text-slate-500">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading...</span>
                  </div>
                ) : xeroStatus.connected ? (
                  <span className="flex items-center space-x-2 px-3 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full text-sm font-semibold">
                    <Check className="w-4 h-4" />
                    <span>Connected</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-2 px-3 py-1 bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-full text-sm font-semibold">
                    <X className="w-4 h-4" />
                    <span>Not Connected</span>
                  </span>
                )}
              </div>

              {xeroStatus.connected && xeroStatus.connection ? (
                <div className="space-y-4">
                  {/* Connection Info */}
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Organization:</span>
                        <span className="ml-2 font-semibold text-slate-800 dark:text-slate-200">{xeroStatus.connection.xero_tenant_name}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Type:</span>
                        <span className="ml-2 font-semibold text-slate-800 dark:text-slate-200 capitalize">{xeroStatus.connection.xero_tenant_type}</span>
                      </div>
                      {xeroStatus.lastSync && (
                        <>
                          <div>
                            <span className="text-slate-500 dark:text-slate-400">Last Sync:</span>
                            <span className="ml-2 font-semibold text-slate-800 dark:text-slate-200">
                              {new Date(xeroStatus.lastSync.started_at).toLocaleString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 dark:text-slate-400">Status:</span>
                            <span className={`ml-2 font-semibold ${
                              xeroStatus.lastSync.status === 'completed' ? 'text-green-600 dark:text-green-400' :
                              xeroStatus.lastSync.status === 'failed' ? 'text-red-600 dark:text-red-400' :
                              'text-amber-600 dark:text-amber-400'
                            }`}>
                              {xeroStatus.lastSync.status.charAt(0).toUpperCase() + xeroStatus.lastSync.status.slice(1)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Sync Settings */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200">Sync Settings</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <label className="flex items-center space-x-3 p-3 bg-slate-50 dark:bg-slate-600 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-500 transition-colors">
                        <input
                          type="checkbox"
                          checked={xeroSettings.sync_contacts}
                          onChange={(e) => setXeroSettings({ ...xeroSettings, sync_contacts: e.target.checked })}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <Users className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Contacts</span>
                      </label>
                      <label className="flex items-center space-x-3 p-3 bg-slate-50 dark:bg-slate-600 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-500 transition-colors">
                        <input
                          type="checkbox"
                          checked={xeroSettings.sync_invoices}
                          onChange={(e) => setXeroSettings({ ...xeroSettings, sync_invoices: e.target.checked })}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Invoices</span>
                      </label>
                      <label className="flex items-center space-x-3 p-3 bg-slate-50 dark:bg-slate-600 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-500 transition-colors">
                        <input
                          type="checkbox"
                          checked={xeroSettings.sync_payments}
                          onChange={(e) => setXeroSettings({ ...xeroSettings, sync_payments: e.target.checked })}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <CreditCard className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Payments</span>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-600 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={xeroSettings.auto_sync_enabled}
                          onChange={(e) => setXeroSettings({ ...xeroSettings, auto_sync_enabled: e.target.checked })}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <Clock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Auto-sync</span>
                      </div>
                      {xeroSettings.auto_sync_enabled && (
                        <select
                          value={xeroSettings.sync_frequency_minutes}
                          onChange={(e) => setXeroSettings({ ...xeroSettings, sync_frequency_minutes: parseInt(e.target.value) })}
                          className="px-3 py-1 border border-slate-200 dark:border-slate-500 rounded-lg bg-white dark:bg-slate-700 text-sm text-slate-700 dark:text-slate-300"
                        >
                          <option value={15}>Every 15 minutes</option>
                          <option value={30}>Every 30 minutes</option>
                          <option value={60}>Every hour</option>
                          <option value={120}>Every 2 hours</option>
                          <option value={240}>Every 4 hours</option>
                          <option value={1440}>Daily</option>
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-200 dark:border-slate-600">
                    <button
                      onClick={() => handleXeroSync('contacts')}
                      disabled={xeroSyncing !== null}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {xeroSyncing === 'contacts' ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Users className="w-4 h-4" />
                      )}
                      <span>Sync Contacts</span>
                    </button>
                    <button
                      onClick={() => handleXeroSync('invoices')}
                      disabled={xeroSyncing !== null}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {xeroSyncing === 'invoices' ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileText className="w-4 h-4" />
                      )}
                      <span>Sync Invoices</span>
                    </button>
                    <button
                      onClick={handleXeroSettingsSave}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Settings</span>
                    </button>
                    <button
                      onClick={handleXeroDisconnect}
                      className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 ml-auto"
                    >
                      <X className="w-4 h-4" />
                      <span>Disconnect</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-slate-600 dark:text-slate-400">
                    Connect your Xero account to automatically sync invoices, contacts, and payments between PlumbPro and Xero.
                  </p>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">What gets synced:</h4>
                    <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
                      <li className="flex items-center space-x-2">
                        <Check className="w-4 h-4" />
                        <span>Customer and supplier contacts</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <Check className="w-4 h-4" />
                        <span>Invoices and credit notes</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <Check className="w-4 h-4" />
                        <span>Payment records</span>
                      </li>
                    </ul>
                  </div>
                  <button
                    onClick={handleXeroConnect}
                    className="flex items-center space-x-2 px-6 py-3 bg-[#13B5EA] text-white font-bold rounded-xl hover:bg-[#0FA5D6] shadow-lg"
                  >
                    <Link2 className="w-5 h-5" />
                    <span>Connect to Xero</span>
                  </button>
                </div>
              )}
            </div>

            {/* Other Integrations Coming Soon */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl opacity-60">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold">M</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200">MYOB</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Coming Soon</p>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl opacity-60">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold">QB</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200">QuickBooks</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Coming Soon</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="mt-8 pt-6 border-t border-slate-200 flex justify-end">
          <button
            onClick={handleSaveSettings}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg"
          >
            <Save className="w-5 h-5" />
            <span>Save Changes</span>
          </button>
        </div>
      </div>
    </div>
  );
};
