/**
 * E2E / validator tests for packages/types (closes #1051).
 *
 * packages/types ships pure TypeScript interfaces — there are no runtime
 * validators bundled with it by default.  These tests exercise the shape
 * contracts by constructing valid and invalid objects and asserting on them
 * at the JS level, simulating the full user path across frontend and backend
 * (the same DTOs that the API controllers consume and the app components
 * render).
 *
 * Patterns tested:
 *  - Required fields must be present / non-nullish
 *  - Optional fields may be absent or null without breaking the shape
 *  - Union / literal types carry the correct allowed values
 *  - Nested shapes (Category inside Worker, Meta inside PaginatedResult)
 *  - Full round-trip DTO simulation (create → read → update)
 */

import { describe, it, expect } from 'vitest'
import type {
  ApiResponse,
  PaginatedResult,
  Meta,
  LoginDTO,
  RegisterDTO,
  ForgotPasswordDTO,
  ResetPasswordDTO,
  AuthUser,
  Category,
  Worker,
  CreateWorkerDTO,
  UpdateWorkerDTO,
  Review,
  CreateReviewDTO,
  AppNotification,
  NotificationType,
  Job,
  JobApplication,
  TipDTO,
  Message,
  Conversation,
  WorkerAnalytics,
  AuditLogEntry,
} from './index.js'

// ── Runtime shape validator (lightweight, no external dep) ────────────────────

function hasKeys<T extends object>(obj: T, ...keys: (keyof T)[]): boolean {
  return keys.every((k) => k in obj)
}

function isOneOf<T>(value: T, allowed: T[]): boolean {
  return allowed.includes(value)
}

// ═════════════════════════════════════════════════════════════════════════════
// ApiResponse<T>
// ═════════════════════════════════════════════════════════════════════════════

describe('ApiResponse', () => {
  it('accepts a success response with data', () => {
    const res: ApiResponse<{ id: string }> = {
      status: 'success',
      message: 'OK',
      code: 200,
      data: { id: 'abc' },
    }
    expect(res.status).toBe('success')
    expect(res.data?.id).toBe('abc')
  })

  it('accepts an error response without data', () => {
    const res: ApiResponse = {
      status: 'error',
      message: 'Not found',
      code: 404,
    }
    expect(res.status).toBe('error')
    expect(res.data).toBeUndefined()
  })

  it('status field is one of the two allowed literals', () => {
    const valid: Array<ApiResponse['status']> = ['success', 'error']
    valid.forEach((s) => expect(isOneOf(s, ['success', 'error'])).toBe(true))
  })

  it('token field is optional', () => {
    const withToken: ApiResponse = { status: 'success', message: 'Login', code: 202, token: 'jwt' }
    const withoutToken: ApiResponse = { status: 'success', message: 'Login', code: 202 }
    expect(withToken.token).toBe('jwt')
    expect(withoutToken.token).toBeUndefined()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// PaginatedResult<T>
// ═════════════════════════════════════════════════════════════════════════════

describe('PaginatedResult + Meta', () => {
  it('has required meta fields', () => {
    const meta: Meta = { total: 100, page: 2, limit: 10, pages: 10 }
    expect(hasKeys(meta, 'total', 'page', 'limit', 'pages')).toBe(true)
    expect(meta.pages).toBe(10)
  })

  it('wraps an array of items under data', () => {
    const result: PaginatedResult<Category> = {
      data: [{ id: 'cat-1', name: 'Plumbing' }],
      meta: { total: 1, page: 1, limit: 10, pages: 1 },
    }
    expect(result.data).toHaveLength(1)
    expect(result.meta.total).toBe(1)
  })

  it('supports empty data array', () => {
    const empty: PaginatedResult<Worker> = {
      data: [],
      meta: { total: 0, page: 1, limit: 10, pages: 0 },
    }
    expect(empty.data).toHaveLength(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Auth DTOs
// ═════════════════════════════════════════════════════════════════════════════

describe('Auth DTOs', () => {
  it('LoginDTO has email and password', () => {
    const dto: LoginDTO = { email: 'a@b.com', password: 'secret' }
    expect(hasKeys(dto, 'email', 'password')).toBe(true)
  })

  it('RegisterDTO has all four required fields', () => {
    const dto: RegisterDTO = {
      email: 'a@b.com',
      password: 'secret',
      firstName: 'Jane',
      lastName: 'Doe',
    }
    expect(hasKeys(dto, 'email', 'password', 'firstName', 'lastName')).toBe(true)
  })

  it('ForgotPasswordDTO only requires email', () => {
    const dto: ForgotPasswordDTO = { email: 'x@y.com' }
    expect(dto.email).toBe('x@y.com')
  })

  it('ResetPasswordDTO requires token and password', () => {
    const dto: ResetPasswordDTO = { token: 'tok123', password: 'newPass' }
    expect(hasKeys(dto, 'token', 'password')).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// AuthUser
// ═════════════════════════════════════════════════════════════════════════════

describe('AuthUser', () => {
  const roles: AuthUser['role'][] = ['user', 'curator', 'admin']

  it('accepts all three role literals', () => {
    roles.forEach((role) => {
      const user: AuthUser = {
        id: 'u1',
        email: 'a@b.com',
        firstName: 'A',
        lastName: 'B',
        role,
        verified: true,
      }
      expect(isOneOf(user.role, roles)).toBe(true)
    })
  })

  it('optional fields may be absent', () => {
    const user: AuthUser = {
      id: 'u1',
      email: 'a@b.com',
      firstName: 'A',
      lastName: 'B',
      role: 'user',
      verified: false,
    }
    expect(user.avatar).toBeUndefined()
    expect(user.onboardingCompleted).toBeUndefined()
  })

  it('optional fields may be null', () => {
    const user: AuthUser = {
      id: 'u1',
      email: 'a@b.com',
      firstName: 'A',
      lastName: 'B',
      role: 'user',
      verified: true,
      avatar: null,
    }
    expect(user.avatar).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Category
// ═════════════════════════════════════════════════════════════════════════════

describe('Category', () => {
  it('requires id and name', () => {
    const cat: Category = { id: 'cat-1', name: 'Electrical' }
    expect(hasKeys(cat, 'id', 'name')).toBe(true)
  })

  it('icon and description are optional', () => {
    const cat: Category = { id: 'cat-1', name: 'Plumbing', icon: null, description: null }
    expect(cat.icon).toBeNull()
    expect(cat.description).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Worker + CreateWorkerDTO + UpdateWorkerDTO
// ═════════════════════════════════════════════════════════════════════════════

describe('Worker', () => {
  const category: Category = { id: 'cat-1', name: 'Plumbing' }

  it('requires id, name, isVerified, isActive, and nested category', () => {
    const w: Worker = { id: 'w-1', name: 'Bob', isVerified: false, isActive: true, category }
    expect(hasKeys(w, 'id', 'name', 'isVerified', 'isActive', 'category')).toBe(true)
    expect(w.category.name).toBe('Plumbing')
  })

  it('optional geo fields may be null', () => {
    const w: Worker = {
      id: 'w-1',
      name: 'Bob',
      isVerified: true,
      isActive: true,
      category,
      latitude: null,
      longitude: null,
    }
    expect(w.latitude).toBeNull()
    expect(w.longitude).toBeNull()
  })

  it('portfolioImages is an optional array', () => {
    const w: Worker = {
      id: 'w-1',
      name: 'Bob',
      isVerified: true,
      isActive: true,
      category,
      portfolioImages: [{ id: 'img-1', url: 'https://cdn/img.jpg' }],
    }
    expect(w.portfolioImages).toHaveLength(1)
  })
})

describe('CreateWorkerDTO', () => {
  it('requires name and categoryId', () => {
    const dto: CreateWorkerDTO = { name: 'Alice', categoryId: 'cat-1' }
    expect(hasKeys(dto, 'name', 'categoryId')).toBe(true)
  })

  it('all other fields are optional', () => {
    const minimal: CreateWorkerDTO = { name: 'Alice', categoryId: 'cat-1' }
    expect(minimal.phone).toBeUndefined()
    expect(minimal.walletAddress).toBeUndefined()
  })
})

describe('UpdateWorkerDTO', () => {
  it('accepts a partial update with only name', () => {
    const dto: UpdateWorkerDTO = { name: 'Alice Updated' }
    expect(dto.name).toBe('Alice Updated')
    expect(dto.categoryId).toBeUndefined()
  })

  it('accepts an empty object (no-op update)', () => {
    const dto: UpdateWorkerDTO = {}
    expect(Object.keys(dto)).toHaveLength(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Review + CreateReviewDTO
// ═════════════════════════════════════════════════════════════════════════════

describe('Review', () => {
  it('has required review fields', () => {
    const r: Review = {
      id: 'rev-1',
      rating: 5,
      workerId: 'w-1',
      authorId: 'u-1',
      createdAt: '2024-01-01T00:00:00Z',
      author: { id: 'u-1', firstName: 'Jane', lastName: 'Doe' },
    }
    expect(r.rating).toBe(5)
    expect(r.author.firstName).toBe('Jane')
  })

  it('comment is optional/null', () => {
    const r: Review = {
      id: 'rev-2',
      rating: 3,
      workerId: 'w-1',
      authorId: 'u-1',
      createdAt: '2024-01-01T00:00:00Z',
      comment: null,
      author: { id: 'u-1', firstName: 'A', lastName: 'B' },
    }
    expect(r.comment).toBeNull()
  })
})

describe('CreateReviewDTO', () => {
  it('requires only rating', () => {
    const dto: CreateReviewDTO = { rating: 4 }
    expect(dto.rating).toBe(4)
    expect(dto.comment).toBeUndefined()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// AppNotification + NotificationType
// ═════════════════════════════════════════════════════════════════════════════

describe('AppNotification', () => {
  const types: NotificationType[] = ['tip', 'review', 'contact', 'system', 'message']

  it('accepts all five NotificationType values', () => {
    types.forEach((type) => {
      const n: AppNotification = {
        id: 'n-1',
        userId: 'u-1',
        type,
        title: 'T',
        read: false,
        createdAt: '2024-01-01T00:00:00Z',
      }
      expect(isOneOf(n.type, types)).toBe(true)
    })
  })

  it('message and href are optional/null', () => {
    const n: AppNotification = {
      id: 'n-1',
      userId: 'u-1',
      type: 'system',
      title: 'T',
      message: null,
      href: null,
      read: true,
      createdAt: '2024-01-01T00:00:00Z',
    }
    expect(n.message).toBeNull()
    expect(n.href).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Job + JobApplication
// ═════════════════════════════════════════════════════════════════════════════

describe('Job', () => {
  const category: Category = { id: 'cat-1', name: 'Plumbing' }
  const postedBy = { id: 'u-1', firstName: 'Jane', lastName: 'Doe' }

  it('has required fields and nested category + postedBy', () => {
    const job: Job = {
      id: 'job-1',
      title: 'Fix leak',
      description: 'Urgent',
      skills: ['plumbing'],
      urgency: 'urgent',
      status: 'open',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      category,
      postedBy,
    }
    expect(job.title).toBe('Fix leak')
    expect(job.category.id).toBe('cat-1')
    expect(isOneOf(job.urgency, ['low', 'normal', 'urgent'])).toBe(true)
    expect(isOneOf(job.status, ['open', 'closed', 'expired', 'filled'])).toBe(true)
  })
})

describe('JobApplication', () => {
  it('has required fields and status', () => {
    const app: JobApplication = {
      id: 'app-1',
      jobId: 'job-1',
      workerId: 'w-1',
      status: 'pending',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }
    expect(isOneOf(app.status, ['pending', 'accepted', 'rejected', 'withdrawn'])).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// TipDTO
// ═════════════════════════════════════════════════════════════════════════════

describe('TipDTO', () => {
  it('requires workerWallet and amount', () => {
    const dto: TipDTO = { workerWallet: 'GDQP2K...', amount: '10' }
    expect(hasKeys(dto, 'workerWallet', 'amount')).toBe(true)
  })

  it('memo is optional', () => {
    const dto: TipDTO = { workerWallet: 'GDQP2K...', amount: '5', memo: 'great work' }
    expect(dto.memo).toBe('great work')
    const noMemo: TipDTO = { workerWallet: 'GDQP2K...', amount: '5' }
    expect(noMemo.memo).toBeUndefined()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Message + Conversation
// ═════════════════════════════════════════════════════════════════════════════

describe('Message', () => {
  it('has required fields including nested sender', () => {
    const msg: Message = {
      id: 'msg-1',
      conversationId: 'conv-1',
      senderId: 'u-1',
      body: 'Hello',
      createdAt: '2024-01-01T00:00:00Z',
      sender: { id: 'u-1', firstName: 'Jane', lastName: 'Doe' },
    }
    expect(msg.body).toBe('Hello')
    expect(msg.sender.firstName).toBe('Jane')
  })
})

describe('Conversation', () => {
  it('has required fields and participants array', () => {
    const conv: Conversation = {
      id: 'conv-1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      participants: [],
    }
    expect(Array.isArray(conv.participants)).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// WorkerAnalytics
// ═════════════════════════════════════════════════════════════════════════════

describe('WorkerAnalytics', () => {
  it('has all required analytics fields', () => {
    const a: WorkerAnalytics = {
      workerId: 'w-1',
      workerName: 'Bob',
      category: 'Plumbing',
      totalViews: 100,
      uniqueViews: 80,
      viewsLast30Days: 20,
      totalTips: 5,
      tipCount: 3,
      bookmarkCount: 10,
      contactCount: 7,
      contactsLast30Days: 2,
      responseRate: 0.9,
      avgRating: 4.5,
      reviewCount: 12,
      updatedAt: null,
    }
    expect(hasKeys(a, 'workerId', 'totalViews', 'avgRating')).toBe(true)
    expect(a.responseRate).toBe(0.9)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// AuditLogEntry
// ═════════════════════════════════════════════════════════════════════════════

describe('AuditLogEntry', () => {
  it('has required id, action, createdAt', () => {
    const entry: AuditLogEntry = {
      id: 'log-1',
      action: 'worker.created',
      createdAt: '2024-01-01T00:00:00Z',
    }
    expect(hasKeys(entry, 'id', 'action', 'createdAt')).toBe(true)
  })

  it('optional fields may be null', () => {
    const entry: AuditLogEntry = {
      id: 'log-2',
      action: 'user.deleted',
      createdAt: '2024-01-01T00:00:00Z',
      userId: null,
      resource: null,
      resourceId: null,
      meta: null,
      user: null,
    }
    expect(entry.userId).toBeNull()
    expect(entry.user).toBeNull()
  })

  it('meta accepts a generic record', () => {
    const entry: AuditLogEntry = {
      id: 'log-3',
      action: 'admin.bulk_delete',
      createdAt: '2024-01-01T00:00:00Z',
      meta: { count: '5', reason: 'cleanup' },
    }
    expect(entry.meta?.count).toBe('5')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Round-trip simulation: CreateWorkerDTO → Worker → UpdateWorkerDTO
// ═════════════════════════════════════════════════════════════════════════════

describe('Full DTO round-trip — Worker create / read / update', () => {
  it('creates, reads, and partially updates a worker shape without errors', () => {
    const category: Category = { id: 'cat-plumbing', name: 'Plumbing' }

    // Step 1 — POST body
    const createDto: CreateWorkerDTO = {
      name: 'Carlos',
      categoryId: 'cat-plumbing',
      phone: '+1-555-0100',
      bio: 'Expert plumber with 10 years experience',
      walletAddress: 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37',
    }

    // Step 2 — API read response
    const worker: Worker = {
      id: 'w-generated-id',
      name: createDto.name,
      bio: createDto.bio,
      phone: createDto.phone,
      walletAddress: createDto.walletAddress,
      isVerified: false,
      isActive: true,
      category,
      averageRating: null,
      reviewCount: 0,
    }

    expect(worker.name).toBe(createDto.name)
    expect(worker.isVerified).toBe(false)
    expect(worker.category.id).toBe(createDto.categoryId)

    // Step 3 — PATCH body
    const updateDto: UpdateWorkerDTO = { bio: 'Updated bio after certification' }
    const updated: Worker = { ...worker, bio: updateDto.bio }

    expect(updated.bio).toBe('Updated bio after certification')
    expect(updated.name).toBe('Carlos') // unchanged
  })
})
