// Re-export shared types from @bluecollar/types
export type {
  Category,
  PortfolioImage,
  Worker,
  Review,
  User,
  AuthUser,
  Meta,
  RatingDistributionEntry,
  ApiResponse,
  PaginatedResponse,
  LoginForm,
  RegisterForm,
  WorkerForm,
  AuditLogEntry,
  Job,
  JobApplication,
  Conversation,
  Message,
  AppNotification,
  NotificationType,
  TipDTO,
  WorkerAnalytics
} from '@bluecollar/types'

// ─── Analytics types (app-only views) ────────────────────────────────────────

export interface WorkerSummary {
  id: string;
  name: string;
  category: string;
  isActive: boolean;
  views: number;
  uniqueViews: number;
  tips: number;
  tipCount: number;
  bookmarks: number;
  contacts: number;
}

export interface CuratorAnalytics {
  totalWorkers: number;
  activeWorkers: number;
  workers: WorkerSummary[];
  totals: {
    views: number;
    uniqueViews: number;
    tips: number;
    tipCount: number;
    bookmarks: number;
    contacts: number;
    avgRating: number;
    reviewCount: number;
    contactsThisMonth: number;
    viewsThisMonth: number;
  };
}

export interface PlatformAnalytics {
  overview: {
    totalWorkers: number;
    activeWorkers: number;
    totalUsers: number;
    totalCurators: number;
  };
  engagement: {
    totalViews: number;
    viewsThisMonth: number;
    totalReviews: number;
    reviewsThisMonth: number;
    totalContacts: number;
    contactsThisMonth: number;
  };
  revenue: {
    totalTips: number;
    totalTipCount: number;
  };
  growth: {
    workersThisMonth: number;
    workersLastMonth: number;
    workerGrowthPct: number;
    usersThisMonth: number;
    usersLastMonth: number;
    userGrowthPct: number;
  };
  trends: {
    userGrowth: Array<{ month: string; count: number }>;
    workerGrowth: Array<{ month: string; count: number }>;
  };
  topCategories: Array<{ name: string; count: number }>;
  recentWorkers: Array<{
    id: string;
    name: string;
    createdAt: string;
    category: { name: string };
  }>;
  recentUsers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    createdAt: string;
    role: string;
  }>;
}

export interface ViewTrend {
  date: string;
  views: number;
}

export interface WorkerDashboardSeriesPoint {
  date: string;
  views: number;
  uniqueViews: number;
  tips: number;
  tipCount: number;
  avgRating: number | null;
  reviewCount: number;
  earnings: number;
}

export interface WorkerPersonalDashboard {
  worker: { id: string; name: string; category: string; walletAddress?: string | null };
  range: { startDate: string; endDate: string };
  summary: {
    totalViews: number;
    uniqueViews: number;
    tipsReceived: number;
    tipCount: number;
    avgRating: number;
    reviewCount: number;
    earnings: number;
    contacts: number;
  };
  deltas: {
    totalViews: number;
    uniqueViews: number;
    tipsReceived: number;
    avgRating: number;
    earnings: number;
  };
  charts: {
    series: WorkerDashboardSeriesPoint[];
    ratingDistribution: Array<{ rating: number; count: number }>;
  };
}

export interface TopWorker {
  rank: number;
  workerId: string;
  workerName: string;
  category: string;
  totalViews: number;
  totalTips: number;
  bookmarkCount: number;
  avgRating: number;
}

export interface JobMessage {
  id: string;
  jobId: string;
  body: string;
  readAt?: string | null;
  createdAt: string;
  sender: { id: string; firstName: string; lastName: string; avatar?: string | null };
  recipient: { id: string; firstName: string; lastName: string; avatar?: string | null };
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export type InvoiceStatus = "draft" | "issued" | "paid" | "overdue" | "void";

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  /** Price per unit, in the invoice's currency. */
  unitAmount: number;
}

export interface InvoiceParty {
  id: string;
  name: string;
}

export interface Invoice {
  id: string;
  number: string;
  status: InvoiceStatus;
  issuedAt: string;
  dueAt?: string | null;
  currency: string;
  worker: InvoiceParty;
  client: InvoiceParty;
  lineItems: InvoiceLineItem[];
  /** Platform fee in the invoice's currency. */
  platformFee: number;
  notes?: string | null;
  transactionHash?: string | null;
}
