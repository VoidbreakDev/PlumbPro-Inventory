import React, { useState, useEffect } from 'react';
import { User, Building2, Bell, Shield, Database, Palette, Globe, Save, Brain, Cloud, Server } from 'lucide-react';

interface SettingsViewProps {
  onSave?: (settings: any) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onSave }) => {
  const [activeSection, setActiveSection] = useState<'profile' | 'company' | 'notifications' | 'security' | 'data' | 'appearance' | 'ai'>('profile');

  // Load settings from localStorage on mount
  const loadSettings = () => {
    const saved = localStorage.getItem('plumbpro-settings');
    if (saved) {
      return JSON.parse(saved);
    }
    return null;
  };

  const savedSettings = loadSettings();

  // Profile settings
  const [profileSettings, setProfileSettings] = useState(savedSettings?.profile || {
    fullName: 'Admin User',
    email: 'admin@plumbpro.com',
    phone: '(555) 123-4567',
    role: 'Administrator'
  });

  // Company settings
  const [companySettings, setCompanySettings] = useState(savedSettings?.company || {
    companyName: 'PlumbPro Industries',
    address: '123 Main Street',
    city: 'Sydney',
    state: 'NSW',
    postcode: '2000',
    abn: '12 345 678 901',
    phone: '(02) 9876 5432',
    email: 'info@plumbpro.com'
  });

  // Notification settings
  const [notificationSettings, setNotificationSettings] = useState(savedSettings?.notifications || {
    emailNotifications: true,
    lowStockAlerts: true,
    jobUpdates: true,
    orderConfirmations: true,
    systemUpdates: false
  });

  // Appearance settings
  const [appearanceSettings, setAppearanceSettings] = useState(savedSettings?.appearance || {
    theme: 'light',
    language: 'en',
    dateFormat: 'DD/MM/YYYY',
    currency: 'AUD'
  });

  // AI settings
  const [aiSettings, setAiSettings] = useState(savedSettings?.ai || {
    defaultProvider: 'auto',
    geminiApiKey: '',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'llama3',
    featureProviders: {
      forecast: 'gemini',
      search: 'ollama',
      template: 'ollama',
      anomaly: 'gemini',
      purchaseOrders: 'gemini',
      insights: 'gemini',
      jobCompletion: 'ollama'
    }
  });

  const handleSaveSettings = () => {
    const allSettings = {
      profile: profileSettings,
      company: companySettings,
      notifications: notificationSettings,
      appearance: appearanceSettings,
      ai: aiSettings
    };

    // Save to localStorage
    localStorage.setItem('plumbpro-settings', JSON.stringify(allSettings));

    // Debug logging
    console.log('✅ Settings saved to localStorage:', allSettings);
    console.log('🔑 Gemini API Key:', aiSettings.geminiApiKey ? `${aiSettings.geminiApiKey.substring(0, 10)}...` : 'NOT SET');

    // Dispatch event to notify App.tsx of settings changes
    window.dispatchEvent(new CustomEvent('settings-changed', { detail: allSettings }));

    if (onSave) {
      onSave(allSettings);
    }

    // Show a visual confirmation
    alert('Settings saved successfully! Your Gemini API key has been stored.');
  };

  const sections = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'company', label: 'Company', icon: Building2 },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'ai', label: 'AI Integration', icon: Brain },
    { id: 'data', label: 'Data & Backup', icon: Database },
    { id: 'appearance', label: 'Appearance', icon: Palette }
  ];

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

            {/* Global AI Provider */}
            <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl">
              <h3 className="font-bold text-slate-800 mb-3 flex items-center">
                <Brain className="w-5 h-5 mr-2 text-purple-600" />
                Default AI Provider
              </h3>
              <select
                value={aiSettings.defaultProvider}
                onChange={(e) => setAiSettings({ ...aiSettings, defaultProvider: e.target.value })}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white shadow-sm"
              >
                <option value="auto">Auto (Choose best available)</option>
                <option value="gemini">Google Gemini (Cloud)</option>
                <option value="ollama">Ollama (Local)</option>
              </select>
              <p className="text-xs text-slate-600 mt-2">
                Auto mode will prefer Gemini for complex tasks and Ollama for simple tasks
              </p>
            </div>

            {/* Cloud AI (Gemini) */}
            <div className="p-6 bg-white border-2 border-blue-200 rounded-xl">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center">
                <Cloud className="w-5 h-5 mr-2 text-blue-600" />
                Cloud AI - Google Gemini (Free Tier)
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Gemini API Key
                  </label>
                  <input
                    type="password"
                    value={aiSettings.geminiApiKey}
                    onChange={(e) => setAiSettings({ ...aiSettings, geminiApiKey: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-sm"
                    placeholder="Enter your Gemini API key"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Get your free API key from <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google AI Studio</a>
                  </p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-800 mb-2">
                    <strong>Status:</strong> {aiSettings.geminiApiKey ? '✅ API Key Set' : '⚠️ No API Key'}
                  </p>
                  {aiSettings.geminiApiKey && (
                    <button
                      onClick={async () => {
                        try {
                          const response = await fetch(`http://localhost:5001/api/smart-ordering/test-models?apiKey=${encodeURIComponent(aiSettings.geminiApiKey)}`);
                          const data = await response.json();
                          if (data.success) {
                            alert(`✅ API Key Valid!\n\nAvailable models:\n${data.textGenerationModels.map((m: any) => `- ${m.displayName}`).join('\n')}`);
                          } else {
                            alert(`❌ API Key Test Failed:\n\n${JSON.stringify(data, null, 2)}`);
                          }
                        } catch (err: any) {
                          alert(`❌ Error testing API key:\n\n${err.message}`);
                        }
                      }}
                      className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700"
                    >
                      Test API Key
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Local AI (Ollama) */}
            <div className="p-6 bg-white border-2 border-green-200 rounded-xl">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center">
                <Server className="w-5 h-5 mr-2 text-green-600" />
                Local AI - Ollama (100% Free & Private)
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Ollama Server URL
                  </label>
                  <input
                    type="text"
                    value={aiSettings.ollamaUrl}
                    onChange={(e) => setAiSettings({ ...aiSettings, ollamaUrl: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:outline-none font-mono text-sm"
                    placeholder="http://localhost:11434"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Ollama Model
                  </label>
                  <select
                    value={aiSettings.ollamaModel}
                    onChange={(e) => setAiSettings({ ...aiSettings, ollamaModel: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white shadow-sm"
                  >
                    <option value="llama3">Llama 3 (Recommended)</option>
                    <option value="llama3.1">Llama 3.1</option>
                    <option value="llama3.2">Llama 3.2</option>
                    <option value="mistral">Mistral</option>
                    <option value="codellama">Code Llama</option>
                    <option value="phi">Phi</option>
                  </select>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-800 mb-2">
                    <strong>Privacy:</strong> Runs locally on your machine. No data sent to cloud.
                  </p>
                  <p className="text-xs text-slate-600">
                    Download Ollama from <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">ollama.ai</a>
                  </p>
                </div>
              </div>
            </div>

            {/* Feature-Specific AI Providers */}
            <div className="p-6 bg-white border-2 border-amber-200 rounded-xl">
              <h3 className="font-bold text-slate-800 mb-4">Feature-Specific AI Providers</h3>
              <p className="text-sm text-slate-600 mb-4">
                Choose which AI provider to use for each feature. Gemini is better for complex analysis, Ollama is faster for simple tasks.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Demand Forecast
                  </label>
                  <select
                    value={aiSettings.featureProviders.forecast}
                    onChange={(e) => setAiSettings({
                      ...aiSettings,
                      featureProviders: { ...aiSettings.featureProviders, forecast: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-sm"
                  >
                    <option value="gemini">Gemini (Cloud)</option>
                    <option value="ollama">Ollama (Local)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Smart Search
                  </label>
                  <select
                    value={aiSettings.featureProviders.search}
                    onChange={(e) => setAiSettings({
                      ...aiSettings,
                      featureProviders: { ...aiSettings.featureProviders, search: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-sm"
                  >
                    <option value="gemini">Gemini (Cloud)</option>
                    <option value="ollama">Ollama (Local)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Stock Templates
                  </label>
                  <select
                    value={aiSettings.featureProviders.template}
                    onChange={(e) => setAiSettings({
                      ...aiSettings,
                      featureProviders: { ...aiSettings.featureProviders, template: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-sm"
                  >
                    <option value="gemini">Gemini (Cloud)</option>
                    <option value="ollama">Ollama (Local)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Anomaly Detection
                  </label>
                  <select
                    value={aiSettings.featureProviders.anomaly}
                    onChange={(e) => setAiSettings({
                      ...aiSettings,
                      featureProviders: { ...aiSettings.featureProviders, anomaly: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-sm"
                  >
                    <option value="gemini">Gemini (Cloud)</option>
                    <option value="ollama">Ollama (Local)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Purchase Orders
                  </label>
                  <select
                    value={aiSettings.featureProviders.purchaseOrders}
                    onChange={(e) => setAiSettings({
                      ...aiSettings,
                      featureProviders: { ...aiSettings.featureProviders, purchaseOrders: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-sm"
                  >
                    <option value="gemini">Gemini (Cloud)</option>
                    <option value="ollama">Ollama (Local)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Business Insights
                  </label>
                  <select
                    value={aiSettings.featureProviders.insights}
                    onChange={(e) => setAiSettings({
                      ...aiSettings,
                      featureProviders: { ...aiSettings.featureProviders, insights: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-sm"
                  >
                    <option value="gemini">Gemini (Cloud)</option>
                    <option value="ollama">Ollama (Local)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Job Completion Analysis
                  </label>
                  <select
                    value={aiSettings.featureProviders.jobCompletion}
                    onChange={(e) => setAiSettings({
                      ...aiSettings,
                      featureProviders: { ...aiSettings.featureProviders, jobCompletion: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-sm"
                  >
                    <option value="gemini">Gemini (Cloud)</option>
                    <option value="ollama">Ollama (Local)</option>
                  </select>
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
