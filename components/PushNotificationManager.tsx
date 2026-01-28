import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Check, X, Smartphone, AlertCircle, Info } from 'lucide-react';
import { mobileAPI } from '../lib/mobileAPI';

interface PushNotificationManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NotificationSettings {
  jobAssignments: boolean;
  jobUpdates: boolean;
  lowStockAlerts: boolean;
  urgentMessages: boolean;
  completionReminders: boolean;
}

export function PushNotificationManager({ isOpen, onClose }: PushNotificationManagerProps) {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>({
    jobAssignments: true,
    jobUpdates: true,
    lowStockAlerts: true,
    urgentMessages: true,
    completionReminders: true
  });
  const [deviceInfo, setDeviceInfo] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      checkSupport();
      checkPermission();
      loadSettings();
    }
  }, [isOpen]);

  const checkSupport = () => {
    const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);
  };

  const checkPermission = async () => {
    if (!('Notification' in window)) return;
    
    const currentPermission = Notification.permission;
    setPermission(currentPermission);

    if (currentPermission === 'granted') {
      // Check if already subscribed
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
        
        if (subscription) {
          setDeviceInfo({
            endpoint: subscription.endpoint,
            expirationTime: subscription.expirationTime
          });
        }
      } catch (err) {
        console.error('Error checking subscription:', err);
      }
    }
  };

  const loadSettings = async () => {
    try {
      // Load from localStorage or API
      const savedSettings = localStorage.getItem('notificationSettings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    }
  };

  const saveSettings = async (newSettings: NotificationSettings) => {
    setSettings(newSettings);
    localStorage.setItem('notificationSettings', JSON.stringify(newSettings));
    
    // Sync with server if subscribed
    if (isSubscribed) {
      try {
        await mobileAPI.updateNotificationPreferences(newSettings);
      } catch (err) {
        console.error('Error saving settings to server:', err);
      }
    }
  };

  const requestPermission = async () => {
    if (!isSupported) return;
    
    setIsLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        await subscribeToPush();
      }
    } catch (err) {
      console.error('Error requesting permission:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const subscribeToPush = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Get application server key from server
      const response = await fetch('/api/mobile/push-public-key');
      const { publicKey } = await response.json();
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      // Send subscription to server
      await mobileAPI.registerDevice({
        deviceToken: subscription.endpoint,
        deviceType: getDeviceType(),
        deviceName: navigator.platform,
        osVersion: navigator.userAgent,
        subscription: subscription.toJSON()
      });

      setIsSubscribed(true);
      setDeviceInfo({
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime
      });

      // Show test notification
      showTestNotification();
      
    } catch (err) {
      console.error('Error subscribing to push:', err);
    }
  };

  const unsubscribeFromPush = async () => {
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        
        // Notify server
        await mobileAPI.unregisterDevice(subscription.endpoint);
      }
      
      setIsSubscribed(false);
      setDeviceInfo(null);
    } catch (err) {
      console.error('Error unsubscribing:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const showTestNotification = () => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('PlumbPro Notifications Enabled', {
        body: 'You will now receive job updates and alerts',
        icon: '/icon-192.png',
        badge: '/icon-96.png'
      });
    }
  };

  const getDeviceType = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/android/.test(userAgent)) return 'android';
    if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
    return 'web';
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const toggleSetting = (key: keyof NotificationSettings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    saveSettings(newSettings);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Bell className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Push Notifications</h2>
                <p className="text-sm text-blue-100">Stay updated on the go</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
          {!isSupported ? (
            <div className="text-center py-8">
              <AlertCircle className="w-16 h-16 text-orange-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Not Supported</h3>
              <p className="text-gray-600 text-sm">
                Push notifications are not supported on this browser or device.
              </p>
            </div>
          ) : (
            <>
              {/* Status Card */}
              <div className={`p-4 rounded-lg border mb-6 ${
                permission === 'granted' && isSubscribed
                  ? 'bg-green-50 border-green-200'
                  : permission === 'denied'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-yellow-50 border-yellow-200'
              }`}>
                <div className="flex items-center gap-3">
                  {permission === 'granted' && isSubscribed ? (
                    <>
                      <div className="p-2 bg-green-100 rounded-full">
                        <Check className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-green-900">Notifications Enabled</p>
                        <p className="text-sm text-green-700">You'll receive updates and alerts</p>
                      </div>
                    </>
                  ) : permission === 'denied' ? (
                    <>
                      <div className="p-2 bg-red-100 rounded-full">
                        <BellOff className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                        <p className="font-medium text-red-900">Notifications Blocked</p>
                        <p className="text-sm text-red-700">Enable in browser settings</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="p-2 bg-yellow-100 rounded-full">
                        <Bell className="w-5 h-5 text-yellow-600" />
                      </div>
                      <div>
                        <p className="font-medium text-yellow-900">Not Enabled</p>
                        <p className="text-sm text-yellow-700">Enable to receive updates</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Enable/Disable Button */}
              {permission === 'default' && (
                <button
                  onClick={requestPermission}
                  disabled={isLoading}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium mb-6 hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Enabling...
                    </>
                  ) : (
                    <>
                      <Bell className="w-5 h-5" />
                      Enable Push Notifications
                    </>
                  )}
                </button>
              )}

              {permission === 'denied' && (
                <div className="p-4 bg-gray-100 rounded-lg mb-6">
                  <div className="flex items-start gap-2">
                    <Info className="w-5 h-5 text-gray-500 mt-0.5" />
                    <div className="text-sm text-gray-600">
                      <p className="font-medium mb-1">How to enable:</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Click the lock/info icon in your browser's address bar</li>
                        <li>Find "Notifications" settings</li>
                        <li>Change to "Allow"</li>
                        <li>Refresh this page</li>
                      </ol>
                    </div>
                  </div>
                </div>
              )}

              {isSubscribed && (
                <button
                  onClick={unsubscribeFromPush}
                  disabled={isLoading}
                  className="w-full py-3 bg-gray-200 text-gray-700 rounded-lg font-medium mb-6 hover:bg-gray-300 disabled:bg-gray-100 transition-colors"
                >
                  {isLoading ? 'Disabling...' : 'Disable Notifications'}
                </button>
              )}

              {/* Notification Types */}
              {permission === 'granted' && (
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900">Notification Types</h3>
                  
                  <div className="space-y-3">
                    <ToggleItem
                      icon={<Smartphone className="w-5 h-5" />}
                      title="Job Assignments"
                      description="New jobs assigned to you"
                      enabled={settings.jobAssignments}
                      onToggle={() => toggleSetting('jobAssignments')}
                    />
                    
                    <ToggleItem
                      icon={<Bell className="w-5 h-5" />}
                      title="Job Updates"
                      description="Changes to your assigned jobs"
                      enabled={settings.jobUpdates}
                      onToggle={() => toggleSetting('jobUpdates')}
                    />
                    
                    <ToggleItem
                      icon={<AlertCircle className="w-5 h-5" />}
                      title="Low Stock Alerts"
                      description="When inventory items are running low"
                      enabled={settings.lowStockAlerts}
                      onToggle={() => toggleSetting('lowStockAlerts')}
                    />
                    
                    <ToggleItem
                      icon={<Bell className="w-5 h-5" />}
                      title="Urgent Messages"
                      description="Important messages from dispatch"
                      enabled={settings.urgentMessages}
                      onToggle={() => toggleSetting('urgentMessages')}
                    />
                    
                    <ToggleItem
                      icon={<Bell className="w-5 h-5" />}
                      title="Completion Reminders"
                      description="Reminders for jobs approaching deadline"
                      enabled={settings.completionReminders}
                      onToggle={() => toggleSetting('completionReminders')}
                    />
                  </div>
                </div>
              )}

              {/* Device Info */}
              {deviceInfo && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    Device: {getDeviceType()} • {navigator.platform}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface ToggleItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}

function ToggleItem({ icon, title, description, enabled, onToggle }: ToggleItemProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white rounded-lg text-gray-600">
          {icon}
        </div>
        <div>
          <p className="font-medium text-gray-900">{title}</p>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
      <button
        onClick={onToggle}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          enabled ? 'bg-blue-600' : 'bg-gray-300'
        }`}
      >
        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
          enabled ? 'translate-x-7' : 'translate-x-1'
        }`} />
      </button>
    </div>
  );
}

export default PushNotificationManager;
