import { CacheStore } from "../CacheStore";

jest.mock("react-native-mmkv", () => {
  let storage: Map<string, string> = new Map();
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      set: jest.fn((key: string, value: string) => storage.set(key, value)),
      getString: jest.fn((key: string) => storage.get(key) || null),
      delete: jest.fn((key: string) => storage.delete(key)),
      getAllKeys: jest.fn(() => Array.from(storage.keys())),
      clear: jest.fn(() => storage.clear()),
    })),
  };
});

describe("CacheStore", () => {
  let cacheStore: CacheStore;
  let mockStorage: Map<string, string>;

  beforeEach(() => {
    mockStorage = new Map();
    const MMKV = require("react-native-mmkv").MMKV;
    MMKV.mockImplementation(() => ({
      set: jest.fn((key: string, value: string) => mockStorage.set(key, value)),
      getString: jest.fn((key: string) => mockStorage.get(key) || null),
      delete: jest.fn((key: string) => mockStorage.delete(key)),
      getAllKeys: jest.fn(() => Array.from(mockStorage.keys())),
      clear: jest.fn(() => mockStorage.clear()),
    }));
    cacheStore = new CacheStore();
  });

  afterEach(() => mockStorage.clear());

  describe("Generic Cache Operations", () => {
    it("should set and get cache entry", () => {
      const testData = { id: "1", name: "Test Worker" };
      cacheStore.setCacheEntry("test:key", testData, 10000, 5000);
      expect(cacheStore.getCachedData("test:key")).toEqual(testData);
    });

    it("should return null for expired cache", () => {
      cacheStore.setCacheEntry("test:expired", { data: "test" }, 100, 50);
      jest.advanceTimersByTime(150);
      expect(cacheStore.getCachedData("test:expired")).toBeNull();
    });

    it("should detect stale data", () => {
      cacheStore.setCacheEntry("test:stale", { data: "test" }, 10000, 100);
      jest.advanceTimersByTime(150);
      expect(cacheStore.isStale("test:stale")).toBe(true);
    });

    it("should delete cache entry", () => {
      cacheStore.setCacheEntry("test:delete", { data: "test" });
      cacheStore.deleteCacheEntry("test:delete");
      expect(cacheStore.getCachedData("test:delete")).toBeNull();
    });

    it("should clear only cache entries", () => {
      cacheStore.setCacheEntry("cache:item1", { data: "1" });
      cacheStore.setCacheEntry("cache:item2", { data: "2" });
      cacheStore.setCacheEntry("queue:item", { data: "3" });
      cacheStore.clearCache();
      expect(cacheStore.getCachedData("cache:item1")).toBeNull();
      expect(cacheStore.getCachedData("cache:item2")).toBeNull();
      expect(cacheStore.getCachedData("queue:item")).not.toBeNull();
    });
  });

  describe("Worker Profile Cache", () => {
    it("should cache and retrieve worker profile", () => {
      const profile = { id: "worker-1", name: "John Doe", category: "Plumber", location: "Lagos", rating: 4.5, reviewCount: 10, isVerified: true, bio: "Experienced plumber", availability: {}, cachedAt: Date.now() };
      cacheStore.cacheWorkerProfile(profile);
      expect(cacheStore.getWorkerProfile("worker-1")).toEqual(profile);
    });

    it("should get all cached worker profiles", () => {
      const p1 = { id: "w1", name: "John", category: "Plumber", location: "Lagos", rating: 4.5, reviewCount: 10, isVerified: true, bio: "", availability: {}, cachedAt: Date.now() };
      const p2 = { id: "w2", name: "Jane", category: "Electrician", location: "Abuja", rating: 4.8, reviewCount: 15, isVerified: true, bio: "", availability: {}, cachedAt: Date.now() };
      cacheStore.cacheWorkerProfile(p1);
      cacheStore.cacheWorkerProfile(p2);
      const all = cacheStore.getAllCachedWorkerProfiles();
      expect(all).toHaveLength(2);
    });
  });

  describe("Category Cache", () => {
    it("should cache and retrieve categories", () => {
      const categories = [{ id: "cat-1", name: "Plumber", icon: "🔧", workerCount: 10 }];
      cacheStore.cacheCategories(categories);
      expect(cacheStore.getCategories()).toEqual(categories);
    });
  });

  describe("User Profile Cache", () => {
    it("should cache and retrieve user profile", () => {
      const profile = { id: "user-1", email: "test@test.com", firstName: "Test", lastName: "User", role: "user" as const, bookmarks: ["w1"], cachedAt: Date.now() };
      cacheStore.cacheUserProfile(profile);
      expect(cacheStore.getUserProfile("user-1")).toEqual(profile);
    });
  });

  describe("Offline Action Queue", () => {
    it("should queue an action", () => {
      const id = cacheStore.queueAction({ type: "contact_request", endpoint: "/api/contact-requests", method: "POST", payload: { workerId: "w1" } });
      expect(id).toBeDefined();
      expect(cacheStore.getPendingActionsCount()).toBe(1);
    });

    it("should clear queue", () => {
      cacheStore.queueAction({ type: "bookmark", endpoint: "/api/bookmarks", method: "POST", payload: { workerId: "w1" } });
      cacheStore.clearQueue();
      expect(cacheStore.getPendingActionsCount()).toBe(0);
    });
  });

  describe("Network State Management", () => {
    it("should update network state", () => {
      cacheStore.setNetworkState({ isConnected: false });
      expect(cacheStore.isOffline()).toBe(true);
      cacheStore.setNetworkState({ isConnected: true });
      expect(cacheStore.isOffline()).toBe(false);
    });

    it("should notify listeners on network change", () => {
      const listener = jest.fn();
      cacheStore.onNetworkChange(listener);
      cacheStore.setNetworkState({ isConnected: false });
      expect(listener).toHaveBeenCalled();
    });
  });

  describe("Sync Status Management", () => {
    it("should update sync status", () => {
      cacheStore.setSyncStatus("syncing");
      expect(cacheStore.getSyncStatus()).toBe("syncing");
      cacheStore.setSyncStatus("idle");
      expect(cacheStore.getSyncStatus()).toBe("idle");
    });

    it("should notify listeners on sync status change", () => {
      const listener = jest.fn();
      cacheStore.onSyncStatusChange(listener);
      cacheStore.setSyncStatus("syncing");
      expect(listener).toHaveBeenCalledWith("syncing");
    });
  });

  describe("Statistics", () => {
    it("should return cache statistics", () => {
      cacheStore.setCacheEntry("cache:item1", { data: "1" });
      cacheStore.queueAction({ type: "bookmark", endpoint: "/api/bookmarks", method: "POST", payload: { workerId: "w1" } });
      const stats = cacheStore.getStats();
      expect(stats.cacheSize).toBeGreaterThan(0);
      expect(stats.queueSize).toBe(1);
    });
  });
});