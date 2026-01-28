import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Cloud, CloudOff, CheckCircle, AlertCircle, RefreshCw, Database } from 'lucide-react';

interface SyncQueueItem {
  id: string;
  type: string;
  status: 'pending' | 'syncing' | 'synced' | 'error';
  timestamp: number;
  retryCount: number;
}

interface OfflineSyncStatusProps {
  variant?: 'compact' | 'full';
}

export function OfflineSyncStatus({ variant = 'compact' }: OfflineSyncStatusProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [queueItems, setQueueItems] = useState<SyncQueueItem[]>([]);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Listen for online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial queue load
    loadQueueFromStorage();

    // Listen for sync events from service worker
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'SYNC_STATUS') {
        setIsSyncing(event.data.isSyncing);
        if (event.data.lastSync) {
          setLastSync(new Date(event.data.lastSync));
        }
      }
      if (event.data.type === 'QUEUE_UPDATED') {
        setQueueItems(event.data.queue);
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleMessage);

    // Periodic queue check
    const interval = setInterval(loadQueueFromStorage, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
      clearInterval(interval);
    };
  }, []);

  const loadQueueFromStorage = async () => {
    try {
      // Check IndexedDB for offline queue
      const db = await openDB();
      const queue = await getQueueFromDB(db);
      setQueueItems(queue);
    } catch (err) {
      console.error('Error loading queue:', err);
    }
  };

  const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('PlumbProDB', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('offlineQueue')) {
          db.createObjectStore('offlineQueue', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  };

  const getQueueFromDB = (db: IDBDatabase): Promise<SyncQueueItem[]> => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['offlineQueue'], 'readonly');
      const store = transaction.objectStore('offlineQueue');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  const triggerSync = async () => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    try {
      // Trigger background sync
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('sync-offline-queue');
    } catch (err) {
      console.error('Sync registration failed:', err);
    }
  };

  const getStatusColor = () => {
    if (!isOnline) return 'text-orange-500';
    if (isSyncing) return 'text-blue-500';
    if (queueItems.length > 0) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getStatusIcon = () => {
    if (!isOnline) return <WifiOff className="w-4 h-4" />;
    if (isSyncing) return <RefreshCw className="w-4 h-4 animate-spin" />;
    if (queueItems.length > 0) return <Cloud className="w-4 h-4" />;
    return <CheckCircle className="w-4 h-4" />;
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (isSyncing) return 'Syncing...';
    if (queueItems.length > 0) return `${queueItems.length} pending`;
    return 'Synced';
  };

  const pendingCount = queueItems.filter(i => i.status === 'pending').length;
  const errorCount = queueItems.filter(i => i.status === 'error').length;

  if (variant === 'compact') {
    return (
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
          !isOnline 
            ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
            : isSyncing
            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            : queueItems.length > 0
            ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
            : 'bg-green-100 text-green-700 hover:bg-green-200'
        }`}
      >
        {getStatusIcon()}
        <span>{getStatusText()}</span>
        
        {expanded && (
          <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50">
            <CompactPanel 
              isOnline={isOnline}
              isSyncing={isSyncing}
              pendingCount={pendingCount}
              errorCount={errorCount}
              lastSync={lastSync}
              onSync={triggerSync}
            />
          </div>
        )}
      </button>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            !isOnline ? 'bg-orange-100' : 
            isSyncing ? 'bg-blue-100' : 
            queueItems.length > 0 ? 'bg-yellow-100' : 'bg-green-100'
          }`}>
            {!isOnline ? <WifiOff className="w-5 h-5 text-orange-600" /> :
             isSyncing ? <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" /> :
             queueItems.length > 0 ? <Cloud className="w-5 h-5 text-yellow-600" /> :
             <CheckCircle className="w-5 h-5 text-green-600" />}
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Sync Status</h3>
            <p className="text-sm text-gray-500">
              {isOnline ? 'Connected to server' : 'Working offline'}
            </p>
          </div>
        </div>
        
        {isOnline && (
          <button
            onClick={triggerSync}
            disabled={isSyncing || queueItems.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <StatCard 
          icon={<Database className="w-4 h-4" />}
          label="Pending"
          value={pendingCount}
          color="yellow"
        />
        <StatCard 
          icon={<CheckCircle className="w-4 h-4" />}
          label="Synced"
          value={queueItems.filter(i => i.status === 'synced').length}
          color="green"
        />
        <StatCard 
          icon={<AlertCircle className="w-4 h-4" />}
          label="Errors"
          value={errorCount}
          color="red"
        />
      </div>

      {/* Last Sync */}
      {lastSync && (
        <p className="text-xs text-gray-500 text-center">
          Last synced: {lastSync.toLocaleString()}
        </p>
      )}

      {/* Queue Items */}
      {queueItems.length > 0 && (
        <div className="mt-4 border-t border-gray-200 pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Queue</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {queueItems.slice(0, 10).map((item) => (
              <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
                <div className="flex items-center gap-2">
                  {item.status === 'pending' && <Cloud className="w-4 h-4 text-yellow-500" />}
                  {item.status === 'syncing' && <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />}
                  {item.status === 'synced' && <CheckCircle className="w-4 h-4 text-green-500" />}
                  {item.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                  <span className="capitalize text-gray-700">{item.type}</span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
            {queueItems.length > 10 && (
              <p className="text-xs text-gray-500 text-center">
                +{queueItems.length - 10} more items
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CompactPanel({ 
  isOnline, 
  isSyncing, 
  pendingCount, 
  errorCount, 
  lastSync, 
  onSync 
}: {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  errorCount: number;
  lastSync: Date | null;
  onSync: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="font-medium text-gray-900">Sync Details</span>
        <div className={`flex items-center gap-1 text-xs ${isOnline ? 'text-green-600' : 'text-orange-600'}`}>
          {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {isOnline ? 'Online' : 'Offline'}
        </div>
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Pending items:</span>
          <span className="font-medium">{pendingCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Errors:</span>
          <span className={`font-medium ${errorCount > 0 ? 'text-red-600' : ''}`}>{errorCount}</span>
        </div>
        {lastSync && (
          <div className="flex justify-between">
            <span className="text-gray-500">Last sync:</span>
            <span className="text-gray-700">{lastSync.toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      {isOnline && pendingCount > 0 && (
        <button
          onClick={onSync}
          disabled={isSyncing}
          className="w-full mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
        >
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </button>
      )}
    </div>
  );
}

function StatCard({ 
  icon, 
  label, 
  value, 
  color 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: number; 
  color: 'yellow' | 'green' | 'red';
}) {
  const colorClasses = {
    yellow: 'bg-yellow-50 text-yellow-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700'
  };

  return (
    <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-medium opacity-80">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

export default OfflineSyncStatus;
