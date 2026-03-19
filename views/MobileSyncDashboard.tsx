import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Wifi,
  WifiOff,
  Database,
  Image,
  Mic,
  FileText,
  CheckCircle,
  AlertCircle,
  Trash2,
  Download,
  Clock,
  HardDrive
} from 'lucide-react';
import { mobileAPI, type SyncQueueItem } from '../lib/mobileAPI';
import { useStore } from '../store/useStore';
import { getErrorMessage } from '../lib/errors';
import { useToast } from '../components/ToastNotification';
import { ConfirmationModal } from '../components/ConfirmationModal';

interface SyncStats {
  total: number;
  pending: number;
  synced: number;
  failed: number;
  byType: Record<string, number>;
}

export function MobileSyncDashboard() {
  const toast = useToast();
  const [queue, setQueue] = useState<SyncQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showClearQueueModal, setShowClearQueueModal] = useState(false);
  const [stats, setStats] = useState<SyncStats>({
    total: 0,
    pending: 0,
    synced: 0,
    failed: 0,
    byType: {}
  });
  const [storageUsage, setStorageUsage] = useState({ used: 0, total: 0 });
  const setError = useStore((state) => state.setError);

  useEffect(() => {
    loadQueue();
    calculateStorageUsage();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Refresh every 30 seconds
    const interval = setInterval(loadQueue, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const loadQueue = async (options?: { notify?: boolean }) => {
    setIsLoading(true);

    try {
      const data = await mobileAPI.getSyncQueue();
      setQueue(data);
      calculateStats(data);
      if (options?.notify) {
        toast.success('Sync queue refreshed');
      }
    } catch (error) {
      try {
        const localQueue = await mobileAPI.getLocalSyncQueue();
        setQueue(localQueue);
        calculateStats(localQueue);
        if (options?.notify) {
          toast.info('Loaded locally cached sync data');
        }
      } catch (localError) {
        const message = getErrorMessage(localError, 'Failed to load sync queue');
        setError(message);
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStats = (items: SyncQueueItem[]) => {
    const byType: Record<string, number> = {};
    items.forEach(item => {
      byType[item.entity_type] = (byType[item.entity_type] || 0) + 1;
    });

    setStats({
      total: items.length,
      pending: items.filter(i => i.status === 'pending').length,
      synced: items.filter(i => i.status === 'synced').length,
      failed: items.filter(i => i.status === 'failed' || i.status === 'error').length,
      byType
    });
  };

  const calculateStorageUsage = async () => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        setStorageUsage({
          used: estimate.usage || 0,
          total: estimate.quota || 0
        });
      } catch (error) {
        console.error('Failed to get storage estimate:', error);
      }
    }
  };

  const handleSyncAll = async () => {
    if (!isOnline) {
      setError('Cannot sync while offline');
      toast.warning('Reconnect to sync queued items');
      return;
    }

    setIsSyncing(true);
    try {
      await mobileAPI.processSyncQueue();
      await loadQueue();
      toast.success('Sync queue processed');
    } catch (error) {
      const message = getErrorMessage(error, 'Sync failed');
      setError(message);
      toast.error(message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearQueue = async () => {
    try {
      await mobileAPI.clearSyncQueue();
      await loadQueue();
      setShowClearQueueModal(false);
      toast.success('Sync queue cleared');
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to clear queue');
      setError(message);
      toast.error(message);
    }
  };

  const handleRefresh = async () => {
    await Promise.all([
      loadQueue({ notify: true }),
      calculateStorageUsage()
    ]);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'photo': return <Image className="w-4 h-4" />;
      case 'voice_memo': return <Mic className="w-4 h-4" />;
      case 'note': return <FileText className="w-4 h-4" />;
      default: return <Database className="w-4 h-4" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'synced': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
      case 'failed': return <AlertCircle className="w-4 h-4 text-red-600" />;
      default: return <Clock className="w-4 h-4 text-yellow-600" />;
    }
  };

  const actionableItemsCount = queue.filter((item) => item.status !== 'synced').length;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sync Dashboard</h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage offline data and synchronization
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isOnline ? (
              <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                <Wifi className="w-4 h-4" />
                Online
              </span>
            ) : (
              <span className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm">
                <WifiOff className="w-4 h-4" />
                Offline
              </span>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <p className="text-sm text-gray-600">Total Items</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <p className="text-sm text-gray-600">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <p className="text-sm text-gray-600">Synced</p>
            <p className="text-2xl font-bold text-green-600">{stats.synced}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <p className="text-sm text-gray-600">Failed</p>
            <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
          </div>
        </div>

        {/* Storage Usage */}
        {storageUsage.total > 0 && (
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Storage Usage</h3>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${(storageUsage.used / storageUsage.total) * 100}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {formatFileSize(storageUsage.used)} of {formatFileSize(storageUsage.total)} used
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleSyncAll}
            disabled={!isOnline || isSyncing || actionableItemsCount === 0}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync All'}
          </button>
          <button
            onClick={() => setShowClearQueueModal(true)}
            disabled={actionableItemsCount === 0}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-5 h-5" />
            Clear
          </button>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 text-white rounded-lg font-medium"
          >
            <Download className={`w-5 h-5 ${isLoading ? 'animate-pulse' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Queue List */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Sync Queue</h3>
          </div>

          {isLoading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-gray-400" />
              <p className="text-gray-600 mt-2">Loading...</p>
            </div>
          ) : queue.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-2" />
              <p className="text-gray-600">All caught up! No items in queue.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {queue.map((item) => (
                <div
                  key={item.id}
                  className="p-4 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      {getEntityIcon(item.entity_type)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 capitalize">
                        {item.entity_type}
                      </p>
                      <p className="text-sm text-gray-600">
                        {new Date(item.created_at).toLocaleString()}
                      </p>
                      {item.error && (
                        <p className="text-xs text-red-600 mt-1">{item.error}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(item.status)}
                    <span className="text-sm capitalize text-gray-600">
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Entity Type Breakdown */}
        {Object.keys(stats.byType).length > 0 && (
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">By Type</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(stats.byType).map(([type, count]) => (
                <div key={type} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  {getEntityIcon(type)}
                  <div>
                    <p className="text-lg font-bold text-gray-900">{count}</p>
                    <p className="text-xs text-gray-600 capitalize">{type}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={showClearQueueModal}
        title="Clear Sync Queue"
        description="This will remove all unsynced items from the local queue. This action cannot be undone."
        confirmLabel="Clear Queue"
        variant="danger"
        onConfirm={handleClearQueue}
        onClose={() => setShowClearQueueModal(false)}
      />
    </div>
  );
}
