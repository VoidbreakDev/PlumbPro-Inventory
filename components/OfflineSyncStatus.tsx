import React, { useState, useEffect, useCallback } from 'react';
import {
  Wifi, WifiOff, Cloud, CheckCircle, AlertCircle,
  RefreshCw, Database, AlertTriangle, X, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  getOfflineQueueItems,
  processQueue,
  resolveConflictKeepServer,
  resolveConflictKeepLocal,
  type OfflineQueueItem,
  type ConflictInfo,
} from '../lib/offlineQueue';

// ─── Types ───────────────────────────────────────────────────────────────────

interface OfflineSyncStatusProps {
  variant?: 'compact' | 'full';
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OfflineSyncStatus({ variant = 'compact' }: OfflineSyncStatusProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [queueItems, setQueueItems] = useState<OfflineQueueItem[]>([]);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [activeConflict, setActiveConflict] = useState<ConflictInfo | null>(null);

  const loadQueue = useCallback(async () => {
    try {
      const items = await getOfflineQueueItems();
      setQueueItems(items);
    } catch {
      setQueueItems([]);
    }
  }, []);

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);
    try {
      await processQueue({
        syncFn: async (item) => {
          // Delegate to Background Sync API if available
          try {
            const registration = await navigator.serviceWorker?.ready;
            const syncManager = (registration as any)?.sync;
            if (syncManager && 'register' in syncManager) {
              await syncManager.register('sync-offline-queue');
              return { success: true };
            }
          } catch {
            // fall through to simple network check
          }
          // Fallback: just mark success so the SW can pick it up later
          return { success: false, error: 'Background sync not available' };
        },
        onConflict: (conflict) => {
          setActiveConflict(conflict);
        },
      });
      setLastSync(new Date());
    } finally {
      setIsSyncing(false);
      await loadQueue();
    }
  }, [isSyncing, loadQueue]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_STATUS') {
        setIsSyncing(event.data.isSyncing);
        if (event.data.lastSync) setLastSync(new Date(event.data.lastSync));
      }
      if (event.data?.type === 'QUEUE_UPDATED') loadQueue();
    };

    navigator.serviceWorker?.addEventListener('message', handleMessage);
    const interval = setInterval(loadQueue, 5_000);
    loadQueue();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
      clearInterval(interval);
    };
  }, [loadQueue, triggerSync]);

  const pendingCount = queueItems.filter((i) => i.status === 'pending').length;
  const errorCount = queueItems.filter(
    (i) => i.status === 'error' || i.status === 'failed',
  ).length;
  const conflictCount = queueItems.filter((i) => i.status === 'conflict').length;

  const handleKeepServer = async (itemId: number) => {
    await resolveConflictKeepServer(itemId);
    setActiveConflict(null);
    await loadQueue();
  };

  const handleKeepLocal = async (itemId: number) => {
    await resolveConflictKeepLocal(itemId);
    setActiveConflict(null);
    await loadQueue();
  };

  // ── Status helpers ──────────────────────────────────────────────────────────

  const statusColor = !isOnline
    ? 'text-orange-500'
    : isSyncing
    ? 'text-blue-500'
    : conflictCount > 0
    ? 'text-purple-500'
    : queueItems.length > 0
    ? 'text-yellow-500'
    : 'text-green-500';

  const statusBadge = !isOnline
    ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
    : isSyncing
    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
    : conflictCount > 0
    ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
    : queueItems.length > 0
    ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
    : 'bg-green-100 text-green-700 hover:bg-green-200';

  const StatusIcon = !isOnline
    ? WifiOff
    : isSyncing
    ? RefreshCw
    : conflictCount > 0
    ? AlertTriangle
    : queueItems.length > 0
    ? Cloud
    : CheckCircle;

  const statusText = !isOnline
    ? 'Offline'
    : isSyncing
    ? 'Syncing…'
    : conflictCount > 0
    ? `${conflictCount} conflict${conflictCount !== 1 ? 's' : ''}`
    : pendingCount > 0
    ? `${pendingCount} pending`
    : 'Synced';

  // ── Conflict modal ──────────────────────────────────────────────────────────

  const ConflictModal = activeConflict ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900 text-lg">Sync conflict</h3>
          </div>
          <button onClick={() => setActiveConflict(null)}>
            <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-5">
          <strong>{activeConflict.item.entityType}</strong>{' '}
          {activeConflict.item.entityId
            ? `(ID: ${activeConflict.item.entityId})`
            : ''}{' '}
          was modified on another device. Choose which version to keep.
        </p>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <VersionPanel
            label="Your local changes"
            mutatedAt={activeConflict.item.mutatedAt}
            data={activeConflict.item.conflict?.localData ?? activeConflict.item.payload}
          />
          <VersionPanel
            label="Server version"
            mutatedAt={activeConflict.serverVersion}
            data={activeConflict.serverData}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => handleKeepServer(activeConflict.item.id!)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Use server version
          </button>
          <button
            onClick={() => handleKeepLocal(activeConflict.item.id!)}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Keep my changes
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // ── Compact variant ─────────────────────────────────────────────────────────

  if (variant === 'compact') {
    return (
      <>
        {ConflictModal}
        <div className="relative">
          <button
            onClick={() => setExpanded(!expanded)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${statusBadge}`}
          >
            <StatusIcon className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{statusText}</span>
            {expanded ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>

          {expanded && (
            <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50">
              <CompactPanel
                isOnline={isOnline}
                isSyncing={isSyncing}
                pendingCount={pendingCount}
                errorCount={errorCount}
                conflictCount={conflictCount}
                lastSync={lastSync}
                onSync={triggerSync}
                onShowConflict={
                  conflictCount > 0
                    ? () => {
                        const first = queueItems.find(
                          (i) => i.status === 'conflict',
                        );
                        if (first?.conflict) {
                          setActiveConflict({
                            item: first,
                            serverVersion: first.conflict.serverVersion,
                            serverData: first.conflict.serverData,
                          });
                        }
                      }
                    : undefined
                }
              />
            </div>
          )}
        </div>
      </>
    );
  }

  // ── Full variant ────────────────────────────────────────────────────────────

  return (
    <>
      {ConflictModal}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${
                !isOnline
                  ? 'bg-orange-100'
                  : isSyncing
                  ? 'bg-blue-100'
                  : conflictCount > 0
                  ? 'bg-purple-100'
                  : queueItems.length > 0
                  ? 'bg-yellow-100'
                  : 'bg-green-100'
              }`}
            >
              <StatusIcon
                className={`w-5 h-5 ${statusColor} ${isSyncing ? 'animate-spin' : ''}`}
              />
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
              disabled={isSyncing || (pendingCount === 0 && conflictCount === 0)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {isSyncing ? 'Syncing…' : 'Sync Now'}
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <StatCard icon={<Database className="w-4 h-4" />} label="Pending" value={pendingCount} color="yellow" />
          <StatCard icon={<CheckCircle className="w-4 h-4" />} label="Synced" value={queueItems.filter((i) => i.status === 'synced').length} color="green" />
          <StatCard icon={<AlertCircle className="w-4 h-4" />} label="Errors" value={errorCount} color="red" />
          <StatCard icon={<AlertTriangle className="w-4 h-4" />} label="Conflicts" value={conflictCount} color="purple" />
        </div>

        {/* Last sync */}
        {lastSync && (
          <p className="text-xs text-gray-500 text-center mb-3">
            Last synced: {lastSync.toLocaleString()}
          </p>
        )}

        {/* Conflict banner */}
        {conflictCount > 0 && (
          <button
            onClick={() => {
              const first = queueItems.find((i) => i.status === 'conflict');
              if (first?.conflict) {
                setActiveConflict({
                  item: first,
                  serverVersion: first.conflict.serverVersion,
                  serverData: first.conflict.serverData,
                });
              }
            }}
            className="w-full mb-3 flex items-center gap-2 px-4 py-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-700 hover:bg-purple-100 transition-colors"
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">
              {conflictCount} conflict{conflictCount !== 1 ? 's' : ''} need your attention
            </span>
            <span className="ml-auto text-xs underline">Resolve</span>
          </button>
        )}

        {/* Queue list */}
        {queueItems.length > 0 && (
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Queue</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {queueItems.slice(0, 10).map((item) => (
                <QueueRow key={item.id} item={item} />
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
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CompactPanel({
  isOnline,
  isSyncing,
  pendingCount,
  errorCount,
  conflictCount,
  lastSync,
  onSync,
  onShowConflict,
}: {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  errorCount: number;
  conflictCount: number;
  lastSync: Date | null;
  onSync: () => void;
  onShowConflict?: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="font-medium text-gray-900">Sync Details</span>
        <div
          className={`flex items-center gap-1 text-xs ${isOnline ? 'text-green-600' : 'text-orange-600'}`}
        >
          {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {isOnline ? 'Online' : 'Offline'}
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Pending:</span>
          <span className="font-medium">{pendingCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Errors:</span>
          <span className={`font-medium ${errorCount > 0 ? 'text-red-600' : ''}`}>
            {errorCount}
          </span>
        </div>
        {conflictCount > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-500">Conflicts:</span>
            <button
              onClick={onShowConflict}
              className="font-medium text-purple-600 underline text-xs"
            >
              {conflictCount} — resolve
            </button>
          </div>
        )}
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
          {isSyncing ? 'Syncing…' : 'Sync Now'}
        </button>
      )}
    </div>
  );
}

function QueueRow({ item }: { item: OfflineQueueItem }) {
  const statusIcons: Record<string, React.ReactNode> = {
    pending: <Cloud className="w-4 h-4 text-yellow-500" />,
    syncing: <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />,
    synced: <CheckCircle className="w-4 h-4 text-green-500" />,
    failed: <AlertCircle className="w-4 h-4 text-red-500" />,
    error: <AlertCircle className="w-4 h-4 text-red-500" />,
    conflict: <AlertTriangle className="w-4 h-4 text-purple-500" />,
  };

  return (
    <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
      <div className="flex items-center gap-2">
        {statusIcons[item.status] ?? <Cloud className="w-4 h-4 text-gray-400" />}
        <span className="capitalize text-gray-700">
          {item.entityType.replace(/_/g, ' ')}
        </span>
        {item.retryCount > 0 && (
          <span className="text-xs text-gray-400">
            (retry {item.retryCount}/{8})
          </span>
        )}
      </div>
      <span className="text-xs text-gray-400">
        {new Date(item.mutatedAt).toLocaleTimeString()}
      </span>
    </div>
  );
}

function VersionPanel({
  label,
  mutatedAt,
  data,
}: {
  label: string;
  mutatedAt: string;
  data: Record<string, unknown>;
}) {
  const preview = Object.entries(data)
    .filter(([k]) => !['id', 'created_at', 'updated_at', 'user_id'].includes(k))
    .slice(0, 4);

  return (
    <div className="border border-gray-200 rounded-lg p-3 text-sm">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      <p className="text-xs text-gray-400 mb-2">
        {new Date(mutatedAt).toLocaleString()}
      </p>
      <div className="space-y-1">
        {preview.map(([k, v]) => (
          <div key={k} className="flex gap-1">
            <span className="text-gray-500 truncate">{k}:</span>
            <span className="font-medium truncate">{String(v ?? '')}</span>
          </div>
        ))}
        {Object.keys(data).length > 4 && (
          <p className="text-xs text-gray-400">…and more fields</p>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'yellow' | 'green' | 'red' | 'purple';
}) {
  const colors = {
    yellow: 'bg-yellow-50 text-yellow-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
    purple: 'bg-purple-50 text-purple-700',
  };

  return (
    <div className={`p-3 rounded-lg ${colors[color]}`}>
      <div className="flex items-center gap-1 mb-1">
        {icon}
        <span className="text-xs font-medium opacity-80">{label}</span>
      </div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

export default OfflineSyncStatus;

// ── Compatibility re-export (legacy callers used the old shape) ───────────────

/** @deprecated Use getOfflineQueueItems from lib/offlineQueue */
export { getOfflineQueueItems as getLegacyQueueItems };
