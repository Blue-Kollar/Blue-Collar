import { MMKV } from "react-native-mmkv";
import {
  CacheEntry,
  QueuedAction,
  NetworkState,
  CacheConfig,
  WorkerProfileCache,
  CategoryCache,
  UserProfileCache,
  SyncStatus,
} from "./types";

const DEFAULT_CONFIG: CacheConfig = {
  defaultTTL: 24 * 60 * 60 * 1000,
  defaultStaleTime: 60 * 60 * 1000,
  maxCacheSize: 100,
  maxQueueSize: 50,
  retryDelay: 5000,
};

export class CacheStore {
  private storage: MMKV;
  private config: CacheConfig;
  private networkState: NetworkState;
  private syncStatus: SyncStatus;
  private syncListeners: Set<(status: SyncStatus) => void> = new Set();
  private networkListeners: Set<(state: NetworkState) => void> = new Set();

  constructor(config?: Partial<CacheConfig>) {
    this.storage = new MMKV();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.networkState = {
      isConnected: true,
      isInternetReachable: null,
      lastConnected: Date.now(),
    };
    this.syncStatus = "idle";
  }

  setCacheEntry<T>(key: string, data: T, ttl?: number, staleTime?: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.config.defaultTTL,
      staleTime: staleTime ?? this.config.defaultStaleTime,
    };
    this.storage.set(key, JSON.stringify(entry));
    this.enforceCacheSizeLimit();
  }

  getCacheEntry<T>(key: string): CacheEntry<T> | null {
    const raw = this.storage.getString(key);
    if (!raw) return null;
    try {
      const entry: CacheEntry<T> = JSON.parse(raw);
      const age = Date.now() - entry.timestamp;
      if (age > entry.ttl) {
        this.storage.delete(key);
        return null;
      }
      return entry;
    } catch {
      this.storage.delete(key);
      return null;
    }
  }

  getCachedData<T>(key: string): T | null {
    const entry = this.getCacheEntry<T>(key);
    return entry?.data ?? null;
  }

  isStale(key: string): boolean {
    const entry = this.getCacheEntry(key);
    if (!entry) return true;
    const age = Date.now() - entry.timestamp;
    return age > entry.staleTime;
  }

  deleteCacheEntry(key: string): void {
    this.storage.delete(key);
  }

  clearCache(): void {
    const keys = this.storage.getAllKeys();
    keys.forEach((key) => {
      if (key.startsWith("cache:")) this.storage.delete(key);
    });
  }

  private enforceCacheSizeLimit(): void {
    const keys = this.storage.getAllKeys().filter((k) => k.startsWith("cache:"));
    if (keys.length <= this.config.maxCacheSize) return;
    const entries: { key: string; timestamp: number }[] = [];
    keys.forEach((key) => {
      const raw = this.storage.getString(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          entries.push({ key, timestamp: parsed.timestamp });
        } catch {}
      }
    });
    entries.sort((a, b) => a.timestamp - b.timestamp);
    const toRemove = entries.slice(0, entries.length - this.config.maxCacheSize);
    toRemove.forEach(({ key }) => this.storage.delete(key));
  }

  cacheWorkerProfile(profile: WorkerProfileCache): void {
    this.setCacheEntry(`cache:worker:${profile.id}`, profile);
  }

  getWorkerProfile(workerId: string): WorkerProfileCache | null {
    return this.getCachedData<WorkerProfileCache>(`cache:worker:${workerId}`);
  }

  getAllCachedWorkerProfiles(): WorkerProfileCache[] {
    const keys = this.storage.getAllKeys().filter((k) => k.startsWith("cache:worker:"));
    return keys.map((key) => this.getCachedData<WorkerProfileCache>(key)).filter(Boolean) as WorkerProfileCache[];
  }

  cacheCategories(categories: CategoryCache[]): void {
    this.setCacheEntry("cache:categories", categories);
  }

  getCategories(): CategoryCache[] | null {
    return this.getCachedData<CategoryCache[]>("cache:categories");
  }

  cacheUserProfile(profile: UserProfileCache): void {
    this.setCacheEntry(`cache:user:${profile.id}`, profile);
  }

  getUserProfile(userId: string): UserProfileCache | null {
    return this.getCachedData<UserProfileCache>(`cache:user:${userId}`);
  }

  queueAction(action: Omit<QueuedAction, "id" | "createdAt" | "retries" | "maxRetries">): string {
    const queue = this.getQueue();
    if (queue.length >= this.config.maxQueueSize) {
      throw new Error(`Queue size limit reached (${this.config.maxQueueSize})`);
    }
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const queuedAction: QueuedAction = {
      ...action,
      id,
      createdAt: Date.now(),
      retries: 0,
      maxRetries: 3,
    };
    queue.push(queuedAction);
    this.saveQueue(queue);
    if (this.networkState.isConnected) this.processQueue();
    return id;
  }

  getQueue(): QueuedAction[] {
    const raw = this.storage.getString("queue:actions");
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  }

  removeQueuedAction(id: string): void {
    this.saveQueue(this.getQueue().filter((a) => a.id !== id));
  }

  private saveQueue(queue: QueuedAction[]): void {
    this.storage.set("queue:actions", JSON.stringify(queue));
  }

  clearQueue(): void {
    this.storage.delete("queue:actions");
  }

  async processQueue(): Promise<void> {
    if (!this.networkState.isConnected || this.syncStatus === "syncing") return;
    const queue = this.getQueue();
    if (queue.length === 0) return;
    this.setSyncStatus("syncing");
    for (const action of queue) {
      try {
        const { api } = await import("../lib/api");
        const response = await api.request({ url: action.endpoint, method: action.method, data: action.payload });
        if (response.ok) {
          this.removeQueuedAction(action.id);
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "Unknown error";
        const updated = this.getQueue().map((a) => a.id === action.id ? { ...a, retries: a.retries + 1, lastError: errMsg } : a);
        this.saveQueue(updated);
        if (action.retries + 1 >= action.maxRetries) {
          console.error(`Action ${action.id} failed after ${action.maxRetries} retries: ${errMsg}`);
        }
      }
    }
    this.setSyncStatus(this.getQueue().length > 0 ? "error" : "idle");
  }

  setNetworkState(state: Partial<NetworkState>): void {
    const wasConnected = this.networkState.isConnected;
    this.networkState = { ...this.networkState, ...state };
    if (!wasConnected && this.networkState.isConnected) {
      this.networkState.lastConnected = Date.now();
      this.processQueue();
    }
    this.networkListeners.forEach((l) => l(this.networkState));
  }

  getNetworkState(): NetworkState {
    return { ...this.networkState };
  }

  onNetworkChange(listener: (state: NetworkState) => void): () => void {
    this.networkListeners.add(listener);
    return () => this.networkListeners.delete(listener);
  }

  setSyncStatus(status: SyncStatus): void {
    this.syncStatus = status;
    this.syncListeners.forEach((l) => l(status));
  }

  getSyncStatus(): SyncStatus {
    return this.syncStatus;
  }

  onSyncStatusChange(listener: (status: SyncStatus) => void): () => void {
    this.syncListeners.add(listener);
    return () => this.syncListeners.delete(listener);
  }

  getStats() {
    const keys = this.storage.getAllKeys().filter((k) => k.startsWith("cache:"));
    return {
      cacheSize: keys.length,
      queueSize: this.getQueue().length,
      isOnline: this.networkState.isConnected,
      syncStatus: this.syncStatus,
    };
  }

  isOffline(): boolean {
    return !this.networkState.isConnected;
  }

  getPendingActionsCount(): number {
    return this.getQueue().length;
  }
}

export const cacheStore = new CacheStore();