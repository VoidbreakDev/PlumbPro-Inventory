const OFFLINE_QUEUE_DB_NAME = 'PlumbProDB';
const OFFLINE_QUEUE_STORE_NAME = 'offlineQueue';
const OFFLINE_QUEUE_DB_VERSION = 1;

export type OfflineQueueRecord = Record<string, any>;

const hasIndexedDbSupport = () => typeof indexedDB !== 'undefined';

const openOfflineQueueDb = (): Promise<IDBDatabase | null> => {
  if (!hasIndexedDbSupport()) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_QUEUE_DB_NAME, OFFLINE_QUEUE_DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(OFFLINE_QUEUE_STORE_NAME)) {
        db.createObjectStore(OFFLINE_QUEUE_STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
};

export const getOfflineQueueItems = async <T extends OfflineQueueRecord = OfflineQueueRecord>(): Promise<T[]> => {
  const db = await openOfflineQueueDb();
  if (!db) {
    return [];
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([OFFLINE_QUEUE_STORE_NAME], 'readonly');
    const store = transaction.objectStore(OFFLINE_QUEUE_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve((request.result as T[]) || []);
    request.onerror = () => reject(request.error);
  });
};

export const replaceOfflineQueueItems = async (items: OfflineQueueRecord[]): Promise<void> => {
  const db = await openOfflineQueueDb();
  if (!db) {
    return;
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([OFFLINE_QUEUE_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(OFFLINE_QUEUE_STORE_NAME);
    const clearRequest = store.clear();

    clearRequest.onerror = () => reject(clearRequest.error);
    clearRequest.onsuccess = () => {
      items.forEach((item) => {
        store.put(item);
      });
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const clearOfflineQueueItems = async (): Promise<void> => {
  await replaceOfflineQueueItems([]);
};
