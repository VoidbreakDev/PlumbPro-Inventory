// ─── Constants ───────────────────────────────────────────────────────────────

const OFFLINE_QUEUE_DB_NAME = 'PlumbProDB';
const OFFLINE_QUEUE_STORE_NAME = 'offlineQueue';
const OFFLINE_QUEUE_DB_VERSION = 2;

const RETRY_BASE_DELAY_MS = 2_000;
const RETRY_MAX_DELAY_MS = 5 * 60_000; // 5 minutes
const RETRY_MAX_ATTEMPTS = 8;

// ─── Types ───────────────────────────────────────────────────────────────────

export type QueueItemStatus =
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'failed'
  | 'conflict';

export interface OfflineQueueItem {
  /** Auto-assigned by IndexedDB */
  id?: number;
  /** Stable client-generated ID for deduplication */
  clientId: string;
  /** The API endpoint to call, e.g. "inventory" */
  entityType: string;
  /** The entity's server ID (null for creates) */
  entityId: string | null;
  /** HTTP method */
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Request body */
  payload: Record<string, unknown>;
  /** ISO timestamp when this mutation was created locally */
  mutatedAt: string;
  /**
   * The server-side `updated_at` value known at mutation time.
   * Used for conflict detection: if the server's current `updated_at`
   * is newer than this value, another client has changed the record.
   */
  knownServerVersion: string | null;
  status: QueueItemStatus;
  retryCount: number;
  /** ISO timestamp — earliest time the next retry should fire */
  nextRetryAt: string | null;
  lastError: string | null;
  /** Populated when status === 'conflict' */
  conflict?: {
    serverVersion: string;
    serverData: Record<string, unknown>;
    localData: Record<string, unknown>;
  };
}

/** Lightweight shape kept for backward-compat with older callers */
export type OfflineQueueRecord = Record<string, unknown>;

// ─── Sync logger ─────────────────────────────────────────────────────────────

type SyncEventKind =
  | 'enqueue'
  | 'dequeue'
  | 'retry'
  | 'conflict'
  | 'resolution'
  | 'error'
  | 'success';

export function logSyncEvent(
  kind: SyncEventKind,
  detail: Record<string, unknown>,
): void {
  const entry = {
    ts: new Date().toISOString(),
    kind,
    ...detail,
  };
  // Structured log — easy to ingest by any log aggregator
  console.info('[offline-sync]', JSON.stringify(entry));
}

// ─── IndexedDB helpers ────────────────────────────────────────────────────────

const hasIndexedDbSupport = () => typeof indexedDB !== 'undefined';

const openOfflineQueueDb = (): Promise<IDBDatabase | null> => {
  if (!hasIndexedDbSupport()) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_QUEUE_DB_NAME, OFFLINE_QUEUE_DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // v1 store (may already exist)
      if (!db.objectStoreNames.contains(OFFLINE_QUEUE_STORE_NAME)) {
        db.createObjectStore(OFFLINE_QUEUE_STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
      }
    };
  });
};

// ─── Public queue CRUD ────────────────────────────────────────────────────────

/** Read all items from the queue */
export const getOfflineQueueItems = async (): Promise<OfflineQueueItem[]> => {
  const db = await openOfflineQueueDb();
  if (!db) return [];

  return new Promise((resolve, reject) => {
    const tx = db.transaction([OFFLINE_QUEUE_STORE_NAME], 'readonly');
    const store = tx.objectStore(OFFLINE_QUEUE_STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as OfflineQueueItem[]) ?? []);
    req.onerror = () => reject(req.error);
  });
};

/** Overwrite the entire queue (used for bulk updates after a sync pass) */
export const replaceOfflineQueueItems = async (
  items: OfflineQueueItem[],
): Promise<void> => {
  const db = await openOfflineQueueDb();
  if (!db) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction([OFFLINE_QUEUE_STORE_NAME], 'readwrite');
    const store = tx.objectStore(OFFLINE_QUEUE_STORE_NAME);

    store.clear().onsuccess = () => {
      items.forEach((item) => store.put(item));
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const clearOfflineQueueItems = async (): Promise<void> => {
  await replaceOfflineQueueItems([]);
};

/** Enqueue a new mutation */
export const enqueueMutation = async (
  mutation: Omit<
    OfflineQueueItem,
    'id' | 'status' | 'retryCount' | 'nextRetryAt' | 'lastError'
  >,
): Promise<void> => {
  const db = await openOfflineQueueDb();
  if (!db) return;

  const item: OfflineQueueItem = {
    ...mutation,
    status: 'pending',
    retryCount: 0,
    nextRetryAt: null,
    lastError: null,
  };

  logSyncEvent('enqueue', {
    entityType: item.entityType,
    entityId: item.entityId,
    method: item.method,
    clientId: item.clientId,
  });

  return new Promise((resolve, reject) => {
    const tx = db.transaction([OFFLINE_QUEUE_STORE_NAME], 'readwrite');
    tx.objectStore(OFFLINE_QUEUE_STORE_NAME).add(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

/** Update a single item in the queue */
const updateQueueItem = async (item: OfflineQueueItem): Promise<void> => {
  const db = await openOfflineQueueDb();
  if (!db) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction([OFFLINE_QUEUE_STORE_NAME], 'readwrite');
    tx.objectStore(OFFLINE_QUEUE_STORE_NAME).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

/** Remove a successfully synced item */
const removeQueueItem = async (id: number): Promise<void> => {
  const db = await openOfflineQueueDb();
  if (!db) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction([OFFLINE_QUEUE_STORE_NAME], 'readwrite');
    tx.objectStore(OFFLINE_QUEUE_STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

// ─── Exponential backoff ─────────────────────────────────────────────────────

const backoffDelayMs = (retryCount: number): number => {
  const jitter = Math.random() * 1_000;
  const delay = RETRY_BASE_DELAY_MS * 2 ** retryCount + jitter;
  return Math.min(delay, RETRY_MAX_DELAY_MS);
};

const isDue = (item: OfflineQueueItem): boolean => {
  if (!item.nextRetryAt) return true;
  return new Date(item.nextRetryAt) <= new Date();
};

// ─── Conflict detection ───────────────────────────────────────────────────────

export interface ConflictInfo {
  item: OfflineQueueItem;
  serverVersion: string;
  serverData: Record<string, unknown>;
}

/**
 * Fetch the server's current version of an entity and check for conflicts.
 * Returns ConflictInfo if the server has been updated since the mutation was
 * enqueued, null otherwise.
 */
const checkConflict = async (
  item: OfflineQueueItem,
  fetchServerState: (
    entityType: string,
    entityId: string,
  ) => Promise<Record<string, unknown> | null>,
): Promise<ConflictInfo | null> => {
  if (!item.entityId || !item.knownServerVersion || item.method === 'POST') {
    return null; // Creates can't conflict; unknown baseline → skip
  }

  try {
    const serverData = await fetchServerState(item.entityType, item.entityId);
    if (!serverData) return null;

    const serverVersion =
      (serverData['updated_at'] as string | undefined) ?? '';

    if (serverVersion && serverVersion > item.knownServerVersion) {
      logSyncEvent('conflict', {
        entityType: item.entityType,
        entityId: item.entityId,
        clientId: item.clientId,
        knownServerVersion: item.knownServerVersion,
        serverVersion,
      });
      return { item, serverVersion, serverData };
    }
  } catch {
    // Network error during conflict check — treat as no conflict, let the
    // sync attempt surface the real error.
  }

  return null;
};

// ─── Queue processor ──────────────────────────────────────────────────────────

export interface SyncFunctionResult {
  success: boolean;
  /** Set to true when the server returned a 409 / version mismatch */
  isConflict?: boolean;
  serverData?: Record<string, unknown>;
  serverVersion?: string;
  error?: string;
}

export interface ProcessQueueOptions {
  /**
   * Called once per pending item with the mutation payload.
   * Implementors should make the real API call and return a result.
   */
  syncFn: (item: OfflineQueueItem) => Promise<SyncFunctionResult>;
  /**
   * Optional: fetch current server state for conflict detection.
   * If not provided, pre-flight conflict checks are skipped.
   */
  fetchServerState?: (
    entityType: string,
    entityId: string,
  ) => Promise<Record<string, unknown> | null>;
  onConflict?: (conflict: ConflictInfo) => void;
}

/**
 * Process all due queue items with conflict detection and exponential backoff.
 * Safe to call multiple times concurrently — duplicate calls bail out after
 * items are marked `syncing`.
 */
export const processQueue = async ({
  syncFn,
  fetchServerState,
  onConflict,
}: ProcessQueueOptions): Promise<void> => {
  const items = await getOfflineQueueItems();
  const due = items.filter(
    (i) => (i.status === 'pending' || i.status === 'failed') && isDue(i),
  );

  for (const item of due) {
    // Mark in-flight
    await updateQueueItem({ ...item, status: 'syncing' });

    // Pre-flight conflict detection
    if (fetchServerState && item.entityId) {
      const conflict = await checkConflict(item, fetchServerState);
      if (conflict) {
        const conflicted: OfflineQueueItem = {
          ...item,
          status: 'conflict',
          conflict: {
            serverVersion: conflict.serverVersion,
            serverData: conflict.serverData,
            localData: item.payload,
          },
        };
        await updateQueueItem(conflicted);
        onConflict?.(conflict);
        continue;
      }
    }

    // Attempt sync
    let result: SyncFunctionResult;
    try {
      result = await syncFn(item);
    } catch (err) {
      result = {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    if (result.success) {
      logSyncEvent('success', {
        entityType: item.entityType,
        entityId: item.entityId,
        clientId: item.clientId,
        retryCount: item.retryCount,
      });
      await removeQueueItem(item.id!);
      continue;
    }

    if (result.isConflict) {
      const conflicted: OfflineQueueItem = {
        ...item,
        status: 'conflict',
        conflict: {
          serverVersion: result.serverVersion ?? '',
          serverData: result.serverData ?? {},
          localData: item.payload,
        },
      };
      logSyncEvent('conflict', {
        entityType: item.entityType,
        entityId: item.entityId,
        clientId: item.clientId,
        source: 'syncFn',
      });
      await updateQueueItem(conflicted);
      onConflict?.({ item, serverVersion: result.serverVersion ?? '', serverData: result.serverData ?? {} });
      continue;
    }

    // Failure — apply backoff
    const newRetryCount = item.retryCount + 1;
    const giveUp = newRetryCount >= RETRY_MAX_ATTEMPTS;
    const nextRetryAt = giveUp
      ? null
      : new Date(Date.now() + backoffDelayMs(newRetryCount)).toISOString();

    logSyncEvent(giveUp ? 'error' : 'retry', {
      entityType: item.entityType,
      entityId: item.entityId,
      clientId: item.clientId,
      retryCount: newRetryCount,
      nextRetryAt,
      error: result.error,
    });

    await updateQueueItem({
      ...item,
      status: giveUp ? 'failed' : 'pending',
      retryCount: newRetryCount,
      nextRetryAt,
      lastError: result.error ?? null,
    });
  }
};

// ─── Conflict resolution ──────────────────────────────────────────────────────

/** Accept the server's version — discard local mutation */
export const resolveConflictKeepServer = async (
  itemId: number,
): Promise<void> => {
  logSyncEvent('resolution', { itemId, resolution: 'keep-server' });
  await removeQueueItem(itemId);
};

/** Keep local — re-enqueue as pending, clearing conflict state */
export const resolveConflictKeepLocal = async (
  itemId: number,
): Promise<void> => {
  const items = await getOfflineQueueItems();
  const item = items.find((i) => i.id === itemId);
  if (!item) return;

  logSyncEvent('resolution', { itemId, resolution: 'keep-local' });

  await updateQueueItem({
    ...item,
    status: 'pending',
    retryCount: 0,
    nextRetryAt: null,
    lastError: null,
    knownServerVersion: item.conflict?.serverVersion ?? item.knownServerVersion,
    conflict: undefined,
  });
};
