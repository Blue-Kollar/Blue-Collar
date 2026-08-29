// ─── Core domain types ────────────────────────────────────────────────────────
// ─── API Response Contracts ───────────────────────────────────────────────────

/** Standard API envelope returned by all endpoints. */
export interface ApiResponse<T = undefined> {
  data?: T;
  meta?: Meta;
  status: "success" | "error" | string;
  code: number;
  message?: string;
  token?: string;
}

export interface Meta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/** Paginated list response. */
export interface PaginatedResult<T> {
  data: T[];
  meta: Meta;
}

/** Paginated list response. */
export type PaginatedResponse<T> = ApiResponse<T[]> & { meta: Meta };

// ─── Auth DTOs ────────────────────────────────────────────────────────────────

export interface LoginDTO {
  email: string;
  password: string;
}

export interface RegisterDTO {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface ForgotPasswordDTO {
  email: string;
}

export interface ResetPasswordDTO {
  token: string;
  password: string;
}

// ─── Auth types ───────────────────────────────────────────────────────────────

/** Authenticated user shape returned from /auth/me and stored in AuthContext. */
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "user" | "curator" | "admin";
  verified: boolean;
  avatar?: string | null;
  onboardingCompleted?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

/** Alias for backward compatibility */
export interface AuthUser extends User {}

// ─── Category ─────────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  icon?: string | null;
  description?: string | null;
}

// ─── Worker DTOs ──────────────────────────────────────────────────────────────

export interface PortfolioImage {
  id: string;
  url: string;
  caption?: string | null;
  order?: number;
}

export interface Worker {
  id: string;
  name: string;
  bio?: string | null;
  avatar?: string | null;
  phone?: string | null;
  email?: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isVerified: boolean;
  isActive: boolean;
  locationId?: string | null;
  walletAddress?: string | null;
  categoryId?: string;
  category: Category;
  averageRating?: number | null;
  reviewCount?: number;
  portfolioImages?: PortfolioImage[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface CreateWorkerDTO {
  name: string;
  categoryId: string;
  phone?: string;
  email?: string;
  bio?: string;
  walletAddress?: string;
  locationId?: string;
}

export interface UpdateWorkerDTO extends Partial<CreateWorkerDTO> {}

// ─── Review ───────────────────────────────────────────────────────────────────

export interface Review {
  id: string;
  rating: number;
  comment?: string | null;
  workerId: string;
  authorId: string;
  createdAt: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string | null;
  };
}

export interface CreateReviewDTO {
  rating: number;
  comment?: string;
}

export interface RatingDistributionEntry {
  rating: number;
  count: number;
  percentage: number;
}

// ─── Form types ───────────────────────────────────────────────────────────────

export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface WorkerForm {
  name: string;
  bio?: string;
  phone?: string;
  email?: string;
  location?: string;
  categoryId: string;
  walletAddress?: string;
}

// ─── Stellar/SDK types ───────────────────────────────────────────────────────

export interface AccountInfo {
  publicKey: string;
  balance: number;
  sequence: bigint;
}

export interface BroadcastResult {
  txHash: string;
  txId: string;
}

export interface TxStatus {
  status: 'pending' | 'confirmed' | 'failed';
  resultCode?: string;
}

export interface WorkerRegistration {
  workerId: string;
  contractId: string;
}

export interface ReputationSync {
  workerId: string;
  avgRating: number;
  reviewCount: number;
  reputation: number;
}

export interface SdkConfig {
  horizonUrl: string;
  registryContractId?: string;
  marketContractId?: string;
  network: 'testnet' | 'mainnet';
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType = "tip" | "review" | "contact" | "system" | "message";

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message?: string | null;
  href?: string | null;
  read: boolean;
  createdAt: string;
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export type JobStatus = "open" | "closed" | "expired" | "filled";
export type JobUrgency = "low" | "normal" | "urgent";
export type ApplicationStatus = "pending" | "accepted" | "rejected" | "withdrawn";

export interface Job {
  id: string;
  title: string;
  description: string;
  budget?: number | null;
  skills: string[];
  urgency: JobUrgency;
  escrowAmount?: number | null;
  escrowTxId?: string | null;
  status: JobStatus;
  expiresAt?: string | null;
  renewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  category: Category;
  location?: { id: string; city: string; state?: string | null; country: string } | null;
  postedBy: { id: string; firstName: string; lastName: string; avatar?: string | null };
  _count?: { applications: number; messages: number };
}

export interface JobApplication {
  id: string;
  jobId: string;
  workerId: string;
  coverLetter?: string | null;
  proposedRate?: number | null;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
  job?: { id: string; title: string; postedById: string };
  worker?: { id: string; name: string; avatar?: string | null; email?: string | null; category?: Category };
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export interface TipDTO {
  workerWallet: string;
  amount: string;
  memo?: string;
}

// ─── Conversations ────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  readAt?: string | null;
  createdAt: string;
  sender: { id: string; firstName: string; lastName: string; avatar?: string | null };
}

export interface Conversation {
  id: string;
  subject?: string | null;
  createdAt: string;
  updatedAt: string;
  participants: ConversationParticipant[];
  messages?: Message[];
  unreadCount?: number;
}

export interface ConversationParticipant {
  id: string;
  conversationId: string;
  userId: string;
  lastReadAt?: string | null;
  joinedAt: string;
  user: { id: string; firstName: string; lastName: string; avatar?: string | null };
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface WorkerAnalytics {
  workerId: string;
  workerName: string;
  category: string;
  totalViews: number;
  uniqueViews: number;
  viewsLast30Days: number;
  totalTips: number;
  tipCount: number;
  bookmarkCount: number;
  contactCount: number;
  contactsLast30Days: number;
  responseRate: number;
  avgRating: number;
  reviewCount: number;
  updatedAt: string | null;
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  userId?: string | null;
  action: string;
  resource?: string | null;
  resourceId?: string | null;
  meta?: Record<string, unknown> | null;
  createdAt: string;
  user?: { id: string; firstName: string; lastName: string; email: string } | null;
}

// ─── Shared Validation Schemas ────────────────────────────────────────────────
export * from './validations.js'
