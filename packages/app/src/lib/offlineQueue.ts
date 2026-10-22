// ─── Offline Action Queue Manager ────────────────────────────────────────────
// Queues failed API requests for background sync when offline

interface OfflineAction {
  id: string;
  timestamp: number;
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
  };
  type: "contact" | "bookmark" | "profile-update";
}

let db: IDBDatabase | null = null;

async function initDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open("bluecollar", 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (e) => {
      const database = (e.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains("offline-actions")) {
        database.createObjectStore("offline-actions", { keyPath: "id" });
      }
    };
  });
}

export async function queueOfflineAction(
  method: string,
  url: string,
  body?: string,
  type: "contact" | "bookmark" | "profile-update" = "contact"
): Promise<string> {
  const database = await initDB();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const action: OfflineAction = {
    id,
    timestamp: Date.now(),
    type,
    request: {
      url,
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${typeof localStorage !== "undefined" ? localStorage.getItem("token") || "" : ""}`,
      },
      body,
    },
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(["offline-actions"], "readwrite");
    const store = transaction.objectStore("offline-actions");
    const request = store.add(action);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      // Attempt to register background sync
      if ("serviceWorker" in navigator && "SyncManager" in window) {
        navigator.serviceWorker.ready
          .then((registration) => {
            const sync = (registration as ServiceWorkerRegistration & {
              sync?: { register: (tag: string) => Promise<void> };
            }).sync;
            return sync?.register("sync-offline-queue");
          })
          .catch((err) => console.warn("[Offline Queue] Sync registration failed:", err));
      }
      resolve(id);
    };
  });
}

export async function getOfflineQueue(): Promise<OfflineAction[]> {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(["offline-actions"], "readonly");
    const store = transaction.objectStore("offline-actions");
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function removeOfflineAction(id: string): Promise<void> {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(["offline-actions"], "readwrite");
    const store = transaction.objectStore("offline-actions");
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function clearOfflineQueue(): Promise<void> {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(["offline-actions"], "readwrite");
    const store = transaction.objectStore("offline-actions");
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
