// Re-export shared types from @bluecollar/types
export type {
  Category,
  Worker,
  User,
  ApiResponse
} from '@bluecollar/types'

// Mobile-specific cache types
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  staleTime: number;
}

export type QueuedActionType =
  | "contact_request"
  | "bookmark"
  | "review"
  | "tip"
  | "escrow_create"
  | "profile_update";

export interface QueuedAction {
  id: string;
  type: QueuedActionType;
  endpoint: string;
  method: "POST" | "PUT" | "DELETE" | "PATCH";
  payload: unknown;
  createdAt: number;
  retries: number;
  maxRetries: number;
  lastError?: string;
}

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  lastConnected: number | null;
}

export type SyncStatus = "idle" | "syncing" | "error" | "offline";

export interface CacheConfig {
  defaultTTL: number;
  defaultStaleTime: number;
  maxCacheSize: number;
  maxQueueSize: number;
  retryDelay: number;
}

export interface WorkerProfileCache {
  id: string;
  name: string;
  category: string;
  location: string;
  rating: number;
  reviewCount: number;
  isVerified: boolean;
  bio: string;
  availability: Record<string, string[]>;
  avatarUrl?: string;
  cachedAt: number;
}

export interface CategoryCache {
  id: string;
  name: string;
  icon: string;
  workerCount: number;
}

export interface UserProfileCache {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "user" | "worker" | "curator";
  bookmarks: string[];
  cachedAt: number;
}

export interface BookmarkActionPayload {
  workerId: string;
  bookmarked: boolean;
}

export interface ContactRequestActionPayload {
  workerId: string;
  message: string;
  preferredDate?: string;
}

export interface ReviewActionPayload {
  workerId: string;
  rating: number;
  comment: string;
}

export interface TipActionPayload {
  workerId: string;
  amount: string;
  asset: string;
  memo?: string;
}

export interface EscrowCreateActionPayload {
  workerId: string;
  amount: string;
  asset: string;
  description: string;
  expiryHours: number;
}