import React, { useState } from 'react';
import { User, Building2, Bell, Shield, Database, Palette, Globe, Save } from 'lucide-react';

interface SettingsViewProps {
  onSave?: (settings: any) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onSave }) => {
  const [activeSection, setActiveSection] = useState<'profile' | 'company' | 'notifications' | 'security' | 'data' | 'appearance'>('profile');

  // Profile settings
  const [profileSettings, setProfileSettings] = useState({
    fullName: 'Admin User',
    email: 'admin@plumbpro.com',
    phone: '(555) 123-4567',
    role: 'Administrator'
  });

  // Company settings
  const [companySettings, setCompanySettings] = useState({
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
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    lowStockAlerts: true,
    jobUpdates: true,
    orderConfirmations: true,
    systemUpdates: false
  });

  // Appearance settings
  const [appearanceSettings, setAppearanceSettings] = useState({
    theme: 'light',
    language: 'en',
    dateFormat: 'DD/MM/YYYY',
    currency: 'AUD'
  });

  const handleSaveSettings = () => {
    const allSettings = {
      profile: profileSettings,
      company: companySettings,
      notifications: notificationSettings,
      appearance: appearanceSettings
    };

    if (onSave) {
      onSave(allSettings);
    }

    // Show success message (you could use toast here)
    alert('Settings saved successfully!');
  };

  const sections = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'company', label: 'Company', icon: Building2 },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'data', label: 'Data & Backup', icon: Database },
    { id: 'appearance', label: 'Appearance', icon: Palette }
  ];

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <div className="w-64 bg-white rounded-xl shadow-sm border border-slate-100 p-4 h-fit">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Settings</h3>
        <nav className="space-y-1">
          {sections.map(section => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id as any)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  activeSection === section.id
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50'
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
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        {/* Profile Settings */}
        {activeSection === 'profile' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Profile Settings</h2>
              <p className="text-slate-500">Manage your personal information and preferences</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Full Name</label>
                <input
                  type="text"
                  value={profileSettings.fullName}
                  onChange={(e) => setProfileSettings({ ...profileSettings, fullName: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
