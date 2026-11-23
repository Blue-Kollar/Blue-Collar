/**
 * Error-path tests for the main API controllers (issue #1872).
 *
 * Every test drives a real controller handler with mocked service/repository
 * dependencies, captures the error forwarded to `next()`, and passes it
 * through the real `errorHandler` middleware. Assertions therefore cover the
 * complete client-visible envelope:
 *   { status: 'error', message, code, errorCode, traceId, details? }
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

// ─── Infrastructure mocks (hoisted) ──────────────────────────────────────────

vi.mock('../config/logger.js', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../config/env.js', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-key-for-testing',
    APP_URL: 'http://localhost:3000',
    DATABASE_URL: 'postgresql://localhost:5432/bluecollar_test',
  },
}));

vi.mock('../services/job.service.js', () => ({}));
vi.mock('../services/wallet.service.js', () => ({}));
vi.mock('../services/payment.service.js', () => ({ paymentService: {} }));

vi.mock('../services/category.service.js', () => ({
  listCategoriesWithPagination: vi.fn(),
  getCategory: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

vi.mock('../services/user.service.js', () => ({
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
  deleteAccount: vi.fn(),
  savePushSubscription: vi.fn(),
  deletePushSubscription: vi.fn(),
  completeOnboarding: vi.fn(),
}));

vi.mock('../services/auth.service.js', () => ({
  loginUser: vi.fn(),
  registerUser: vi.fn(),
  verifyAccount: vi.fn(),
  rotateRefreshToken: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  resendVerificationEmail: vi.fn(),
  revokeAllRefreshTokens: vi.fn(),
}));

vi.mock('../services/review.service.js', () => ({
  createReview: vi.fn(),
  listReviews: vi.fn(),
  flagReview: vi.fn(),
  approveReview: vi.fn(),
  rejectReview: vi.fn(),
}));

vi.mock('../services/messaging.service.js', () => ({
  getUserConversations: vi.fn(),
  getConversation: vi.fn(),
  createConversation: vi.fn(),
  searchMessages: vi.fn(),
  deleteMessage: vi.fn(),
  markConversationAsRead: vi.fn(),
  getUnreadCount: vi.fn(),
}));

vi.mock('../db.js', () => ({
  db: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    review: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn(), aggregate: vi.fn() },
  },
}));

vi.mock('../resources/index.js', () => ({
  CategoryResource: vi.fn((value: unknown) => value),
  CategoryCollection: vi.fn((value: unknown) => value),
  UserResource: vi.fn((value: unknown) => value),
}));

vi.mock('../models/user.model.js', () => ({
  sanitizeUser: (value: unknown) => value,
}));

vi.mock('../mailer/index.js', () => ({
  sendModerationEmail: vi.fn().mockResolvedValue(undefined),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { AppError, ErrorCode } from '../utils/app-error.js';
import { ErrorMessages } from '../constants/index.js';
import { createJobsController, validateCreateJob } from './jobs.js';
import { createWalletController } from './wallet.js';
import { createPaymentController } from './payment.js';
import { getCategory, createCategory, listCategories, updateCategory } from './categories.js';
import * as usersController from './users.js';
import * as authController from './auth.js';
import * as reviewsController from './reviews.js';
import * as messagesController from './messages.js';
import * as categoryService from '../services/category.service.js';
import * as userService from '../services/user.service.js';
import * as authService from '../services/auth.service.js';
import * as reviewService from '../services/review.service.js';
import * as messagingService from '../services/messaging.service.js';
import { db } from '../db.js';
import {
  captureHandlerError,
  expectErrorEnvelope,
  makeNext,
  makeReq,
  makeRes,
  serializeError,
} from '../__tests__/helpers/error-envelope-harness.js';

const user = { id: 'user-1', role: 'user', email: 'user@example.com' };

const prismaError = (code: string) => Object.assign(new Error(code), { code });

beforeEach(() => vi.clearAllMocks());

// ─── Jobs ─────────────────────────────────────────────────────────────────────

describe('jobs controller error paths', () => {
  it('showJob forwards a 404 NOT_FOUND envelope when the job is missing', async () => {
    const controller = createJobsController({
      getJob: vi
        .fn()
        .mockRejectedValue(new AppError('Job not found', 404, true, ErrorCode.NOT_FOUND)),
    } as never);

    const captured = await captureHandlerError(controller.showJob, { params: { id: 'missing' } });

    expectErrorEnvelope(captured, {
      message: 'Job not found',
      code: 404,
      errorCode: ErrorCode.NOT_FOUND,
    });
  });

  it('myApplications rejects a missing workerId with 400 VALIDATION_ERROR', async () => {
    const controller = createJobsController({} as never);

    const captured = await captureHandlerError(controller.myApplications, { query: {} });

    expectErrorEnvelope(captured, {
      message: ErrorMessages.WORKER_ID_REQUIRED,
      code: 400,
      errorCode: ErrorCode.VALIDATION_ERROR,
    });
  });

  it('withdrawApplication rejects a missing workerId with 400 VALIDATION_ERROR', async () => {
    const controller = createJobsController({} as never);

    const captured = await captureHandlerError(controller.withdrawApplication, {
      params: { id: 'job-1' },
      body: {},
    });

    expectErrorEnvelope(captured, {
      message: ErrorMessages.WORKER_ID_REQUIRED,
      code: 400,
      errorCode: ErrorCode.VALIDATION_ERROR,
    });
  });

  it('deleteJob forwards a 403 FORBIDDEN envelope for a non-owner', async () => {
    const controller = createJobsController({
      deleteJob: vi
        .fn()
        .mockRejectedValue(new AppError('Forbidden', 403, true, ErrorCode.FORBIDDEN)),
    } as never);

    const captured = await captureHandlerError(controller.deleteJob, {
      params: { id: 'job-1' },
      user,
    });

    expectErrorEnvelope(captured, {
      message: 'Forbidden',
      code: 403,
      errorCode: ErrorCode.FORBIDDEN,
    });
  });

  it('applyToJob forwards a 409 CONFLICT envelope for a duplicate application', async () => {
    const controller = createJobsController({
      applyToJob: vi
        .fn()
        .mockRejectedValue(
          new AppError('Already applied to this job', 409, true, ErrorCode.CONFLICT),
        ),
    } as never);

    const captured = await captureHandlerError(controller.applyToJob, {
      params: { id: 'job-1' },
      body: { workerId: 'worker-1' },
    });

    expectErrorEnvelope(captured, {
      message: 'Already applied to this job',
      code: 409,
      errorCode: ErrorCode.CONFLICT,
    });
  });

  it('createJob converts an unexpected service error into a generic 500 envelope', async () => {
    const controller = createJobsController({
      createJob: vi.fn().mockRejectedValue(new Error('DB password is hunter2')),
    } as never);

    const captured = await captureHandlerError(controller.createJob, {
      body: { title: 'A valid title', description: 'A valid description' },
      user,
    });

    expectErrorEnvelope(captured, {
      message: ErrorMessages.INTERNAL_SERVER_ERROR,
      code: 500,
      errorCode: ErrorCode.INTERNAL_ERROR,
    });
    expect(JSON.stringify(captured.body)).not.toContain('hunter2');
  });

  it('validateCreateJob produces 400 VALIDATION_ERROR with field details', () => {
    const res = makeRes();
    const next = makeNext();

    validateCreateJob(makeReq({ body: {} }) as never, res as never, next as never);

    const err = next.mock.calls[0][0];
    expectErrorEnvelope(serializeError(err), {
      message: 'Validation failed',
      code: 400,
      errorCode: ErrorCode.VALIDATION_ERROR,
      details: expect.objectContaining({ title: expect.any(Array), categoryId: expect.any(Array) }),
    });
  });

  it('a ZodError becomes 400 VALIDATION_ERROR with flattened issue details', () => {
    const parsed = z.string().min(3).safeParse('x');
    const zodError = parsed.error!;

    expectErrorEnvelope(serializeError(zodError), {
      message: 'Validation failed',
      code: 400,
      errorCode: ErrorCode.VALIDATION_ERROR,
      details: zodError.flatten(),
    });
  });
});

// ─── Wallet ───────────────────────────────────────────────────────────────────

describe('wallet controller error paths', () => {
  it('getBalance rejects an unauthenticated request with 401 UNAUTHORIZED', async () => {
    const controller = createWalletController({} as never);

    const captured = await captureHandlerError(controller.getBalance, { user: undefined });

    expectErrorEnvelope(captured, {
      message: ErrorMessages.UNAUTHORIZED,
      code: 401,
      errorCode: ErrorCode.UNAUTHORIZED,
    });
  });

  it('linkWallet rejects an unauthenticated request with 401 UNAUTHORIZED', async () => {
    const controller = createWalletController({} as never);

    const captured = await captureHandlerError(controller.linkWallet, {
      user: undefined,
      body: {},
    });

    expectErrorEnvelope(captured, {
      message: ErrorMessages.UNAUTHORIZED,
      code: 401,
      errorCode: ErrorCode.UNAUTHORIZED,
    });
  });

  it('getBalance forwards a 404 NOT_FOUND envelope for an unlinked account', async () => {
    const controller = createWalletController({
      getUserBalance: vi
        .fn()
        .mockRejectedValue(
          new AppError('Stellar account not linked', 404, true, ErrorCode.NOT_FOUND),
        ),
    } as never);

    const captured = await captureHandlerError(controller.getBalance, { user });

    expectErrorEnvelope(captured, {
      message: 'Stellar account not linked',
      code: 404,
      errorCode: ErrorCode.NOT_FOUND,
    });
  });

  it('linkWallet maps a Prisma P2002 rejection to a 409 CONFLICT envelope', async () => {
    const controller = createWalletController({
      linkStellarAccount: vi.fn().mockRejectedValue(prismaError('P2002')),
    } as never);

    const captured = await captureHandlerError(controller.linkWallet, {
      user,
      body: { publicKey: 'GABC' },
    });

    expectErrorEnvelope(captured, {
      message: ErrorMessages.DB_DUPLICATE_VALUE,
      code: 409,
      errorCode: ErrorCode.CONFLICT,
    });
  });

  it('broadcastTx converts a Horizon failure into a generic 500 envelope', async () => {
    const controller = createWalletController({
      broadcastTransaction: vi.fn().mockRejectedValue(new Error('horizon connection refused')),
    } as never);

    const captured = await captureHandlerError(controller.broadcastTx, {
      user,
      body: { signedXdr: 'AAAAAA==' },
    });

    expectErrorEnvelope(captured, {
      message: ErrorMessages.INTERNAL_SERVER_ERROR,
      code: 500,
      errorCode: ErrorCode.INTERNAL_ERROR,
    });
  });
});

// ─── Payments ─────────────────────────────────────────────────────────────────

describe('payment controller error paths', () => {
  it('processTip rejects missing fields with 400 VALIDATION_ERROR', async () => {
    const controller = createPaymentController({} as never);

    const captured = await captureHandlerError(controller.processTip, {
      body: { to: 'BOB', amount: 10 },
    });

    expectErrorEnvelope(captured, {
      message: ErrorMessages.TIP_FIELDS_REQUIRED,
      code: 400,
      errorCode: ErrorCode.VALIDATION_ERROR,
    });
  });

  it('createEscrow rejects a missing expiryDate with 400 VALIDATION_ERROR', async () => {
    const controller = createPaymentController({} as never);

    const captured = await captureHandlerError(controller.createEscrow, {
      body: { from: 'A', to: 'B', amount: 100 },
    });

    expectErrorEnvelope(captured, {
      message: ErrorMessages.ESCROW_FIELDS_REQUIRED,
      code: 400,
      errorCode: ErrorCode.VALIDATION_ERROR,
    });
  });

  it('updateFee rejects a missing fee_bps with 400 VALIDATION_ERROR', async () => {
    const controller = createPaymentController({} as never);

    const captured = await captureHandlerError(controller.updateFee, { body: {}, user });

    expectErrorEnvelope(captured, {
      message: ErrorMessages.FEE_BPS_REQUIRED,
      code: 400,
      errorCode: ErrorCode.VALIDATION_ERROR,
    });
  });

  it('updateFee forwards a service 403 FORBIDDEN envelope for non-admins', async () => {
    const controller = createPaymentController({
      setFeeBps: vi.fn(() => {
        throw new AppError('Only admins can update the fee', 403, true, ErrorCode.FORBIDDEN);
      }),
    } as never);

    const captured = await captureHandlerError(controller.updateFee, {
      body: { fee_bps: 100 },
      user,
    });

    expectErrorEnvelope(captured, {
      message: 'Only admins can update the fee',
      code: 403,
      errorCode: ErrorCode.FORBIDDEN,
    });
  });

  it('processTip maps a Prisma P2002 rejection to a 409 CONFLICT envelope', async () => {
    const controller = createPaymentController({
      tip: vi.fn(() => {
        throw prismaError('P2002');
      }),
    } as never);

    const captured = await captureHandlerError(controller.processTip, {
      body: { from: 'A', to: 'B', amount: 100 },
    });

    expectErrorEnvelope(captured, {
      message: ErrorMessages.DB_DUPLICATE_VALUE,
      code: 409,
      errorCode: ErrorCode.CONFLICT,
    });
  });
});

// ─── Categories ───────────────────────────────────────────────────────────────

describe('category controller error paths', () => {
  it('getCategory returns a 404 NOT_FOUND envelope for an unknown id', async () => {
    vi.mocked(categoryService.getCategory).mockResolvedValue(null);

    const captured = await captureHandlerError(getCategory, { params: { id: 'missing' } });

    expectErrorEnvelope(captured, {
      message: ErrorMessages.CATEGORY_NOT_FOUND,
      code: 404,
      errorCode: ErrorCode.NOT_FOUND,
    });
  });

  it('createCategory maps a Prisma P2002 rejection to 409 CONFLICT', async () => {
    vi.mocked(categoryService.createCategory).mockRejectedValue(prismaError('P2002'));

    const captured = await captureHandlerError(createCategory, { body: { name: 'Plumbing' } });

    expectErrorEnvelope(captured, {
      message: ErrorMessages.DB_DUPLICATE_VALUE,
      code: 409,
      errorCode: ErrorCode.CONFLICT,
    });
  });

  it('updateCategory maps a Prisma P2025 rejection to 404 NOT_FOUND', async () => {
    vi.mocked(categoryService.updateCategory).mockRejectedValue(prismaError('P2025'));

    const captured = await captureHandlerError(updateCategory, {
      params: { id: 'missing' },
      body: { name: 'Plumbing' },
    });

    expectErrorEnvelope(captured, {
      message: ErrorMessages.DB_RECORD_NOT_FOUND,
      code: 404,
      errorCode: ErrorCode.NOT_FOUND,
    });
  });

  it('listCategories converts an unexpected error into a generic 500 envelope', async () => {
    vi.mocked(categoryService.listCategoriesWithPagination).mockRejectedValue(
      new Error('db offline'),
    );

    const captured = await captureHandlerError(listCategories, { query: {} });

    expectErrorEnvelope(captured, {
      message: ErrorMessages.INTERNAL_SERVER_ERROR,
      code: 500,
      errorCode: ErrorCode.INTERNAL_ERROR,
    });
  });
});

// ─── Users ────────────────────────────────────────────────────────────────────

describe('users controller error paths', () => {
  it('updateProfile rejects an unauthenticated request with 401 UNAUTHORIZED', async () => {
    const captured = await captureHandlerError(usersController.updateProfile, { user: undefined });

    expectErrorEnvelope(captured, {
      message: ErrorMessages.UNAUTHORIZED,
      code: 401,
      errorCode: ErrorCode.UNAUTHORIZED,
    });
  });

  it('changePassword rejects missing passwords with 400 VALIDATION_ERROR', async () => {
    const captured = await captureHandlerError(usersController.changePassword, {
      user,
      body: { currentPassword: 'old' },
    });

    expectErrorEnvelope(captured, {
      message: ErrorMessages.CURRENT_PASSWORD_REQUIRED,
      code: 400,
      errorCode: ErrorCode.VALIDATION_ERROR,
    });
  });

  it('updateMe forwards a service 404 NOT_FOUND envelope', async () => {
    vi.mocked(userService.updateProfile).mockRejectedValue(
      new AppError(ErrorMessages.USER_NOT_FOUND, 404, true, ErrorCode.NOT_FOUND),
    );

    const captured = await captureHandlerError(usersController.updateMe, { user, body: {} });

    expectErrorEnvelope(captured, {
      message: ErrorMessages.USER_NOT_FOUND,
      code: 404,
      errorCode: ErrorCode.NOT_FOUND,
    });
  });

  it('savePushSubscription rejects an incomplete payload with 400 VALIDATION_ERROR', async () => {
    const captured = await captureHandlerError(usersController.savePushSubscription, {
      user,
      body: { endpoint: 'https://push.example.com' },
    });

    expectErrorEnvelope(captured, {
      message: ErrorMessages.INVALID_PUSH_SUBSCRIPTION,
      code: 400,
      errorCode: ErrorCode.VALIDATION_ERROR,
    });
  });

  it('deleteAccount converts an unexpected service error into a generic 500 envelope', async () => {
    vi.mocked(userService.deleteAccount).mockRejectedValue(new Error('connection lost'));

    const captured = await captureHandlerError(usersController.deleteAccount, { user });

    expectErrorEnvelope(captured, {
      message: ErrorMessages.INTERNAL_SERVER_ERROR,
      code: 500,
      errorCode: ErrorCode.INTERNAL_ERROR,
    });
  });
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe('auth controller error paths', () => {
  it('verifyAccount rejects a missing token with 400 VALIDATION_ERROR', async () => {
    const captured = await captureHandlerError(authController.verifyAccount, {
      body: {},
      query: {},
    });

    expectErrorEnvelope(captured, {
      message: ErrorMessages.VERIFICATION_TOKEN_REQUIRED,
      code: 400,
      errorCode: ErrorCode.VALIDATION_ERROR,
    });
  });

  it('refresh rejects a missing refresh token with 400 VALIDATION_ERROR', async () => {
    const captured = await captureHandlerError(authController.refresh, { body: {} });

    expectErrorEnvelope(captured, {
      message: ErrorMessages.REFRESH_TOKEN_REQUIRED,
      code: 400,
      errorCode: ErrorCode.VALIDATION_ERROR,
    });
  });

  it('resetPassword rejects a missing password with 400 VALIDATION_ERROR', async () => {
    const captured = await captureHandlerError(authController.resetPassword, {
      body: { token: 'abc' },
    });

    expectErrorEnvelope(captured, {
      message: 'Token and password are required',
      code: 400,
      errorCode: ErrorCode.VALIDATION_ERROR,
    });
  });

  it('unsubscribeReminders rejects a missing token with 400 VALIDATION_ERROR', async () => {
    const captured = await captureHandlerError(authController.unsubscribeReminders, { query: {} });

    expectErrorEnvelope(captured, {
      message: ErrorMessages.TOKEN_REQUIRED,
      code: 400,
      errorCode: ErrorCode.VALIDATION_ERROR,
    });
  });

  it('login forwards a service 401 INVALID_CREDENTIALS envelope', async () => {
    vi.mocked(authService.loginUser).mockRejectedValue(
      new AppError('Invalid credentials', 401, true, ErrorCode.INVALID_CREDENTIALS),
    );

    const captured = await captureHandlerError(authController.login, {
      body: { email: 'a@b.com', password: 'wrong' },
      get: vi.fn(),
    } as never);

    expectErrorEnvelope(captured, {
      message: 'Invalid credentials',
      code: 401,
      errorCode: ErrorCode.INVALID_CREDENTIALS,
    });
  });

  it('register forwards a service 409 CONFLICT envelope for a duplicate email', async () => {
    vi.mocked(authService.registerUser).mockRejectedValue(
      new AppError('Email already in use', 409, true, ErrorCode.CONFLICT),
    );

    const captured = await captureHandlerError(authController.register, { body: {} });

    expectErrorEnvelope(captured, {
      message: 'Email already in use',
      code: 409,
      errorCode: ErrorCode.CONFLICT,
    });
  });

  it('me returns a 404 NOT_FOUND envelope when the user no longer exists', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null);

    const captured = await captureHandlerError(authController.me, { user });

    expectErrorEnvelope(captured, {
      message: ErrorMessages.USER_NOT_FOUND,
      code: 404,
      errorCode: ErrorCode.NOT_FOUND,
    });
  });

  it('forgotPassword converts an unexpected service error into a generic 500 envelope', async () => {
    vi.mocked(authService.requestPasswordReset).mockRejectedValue(new Error('mailer down'));

    const captured = await captureHandlerError(authController.forgotPassword, {
      body: { email: 'a@b.com' },
    });

    expectErrorEnvelope(captured, {
      message: ErrorMessages.INTERNAL_SERVER_ERROR,
      code: 500,
      errorCode: ErrorCode.INTERNAL_ERROR,
    });
  });
});

// ─── Reviews ──────────────────────────────────────────────────────────────────

describe('review controller error paths', () => {
  it('flagReview rejects a missing reason with 400 VALIDATION_ERROR', async () => {
    const captured = await captureHandlerError(reviewsController.flagReview, {
      params: { id: 'review-1' },
      body: {},
      user,
    });

    expectErrorEnvelope(captured, {
      message: 'reason is required',
      code: 400,
      errorCode: ErrorCode.VALIDATION_ERROR,
    });
  });

  it('reportReview rejects a missing reason with 400 VALIDATION_ERROR', async () => {
    const captured = await captureHandlerError(reviewsController.reportReview, {
      params: { reviewId: 'review-1' },
      body: {},
      user,
    });

    expectErrorEnvelope(captured, {
      message: 'reason is required',
      code: 400,
      errorCode: ErrorCode.VALIDATION_ERROR,
    });
  });

  it('moderateReview rejects an invalid action with 400 VALIDATION_ERROR', async () => {
    const captured = await captureHandlerError(reviewsController.moderateReview, {
      params: { id: 'review-1' },
      body: { action: 'delete' },
      user,
    });

    expectErrorEnvelope(captured, {
      message: 'action must be approve or reject',
      code: 400,
      errorCode: ErrorCode.VALIDATION_ERROR,
    });
  });

  it('moderateReview returns a 404 NOT_FOUND envelope for an unknown review', async () => {
    vi.mocked(db.review.findUnique).mockResolvedValue(null);

    const captured = await captureHandlerError(reviewsController.moderateReview, {
      params: { id: 'missing' },
      body: { action: 'approve' },
      user,
    });

    expectErrorEnvelope(captured, {
      message: 'Review not found',
      code: 404,
      errorCode: ErrorCode.NOT_FOUND,
    });
  });

  it('createReview forwards a service 400 VALIDATION_ERROR envelope', async () => {
    vi.mocked(reviewService.createReview).mockRejectedValue(
      new AppError(ErrorMessages.RATING_INVALID, 400, true, ErrorCode.VALIDATION_ERROR),
    );

    const captured = await captureHandlerError(reviewsController.createReview, {
      params: { workerId: 'worker-1' },
      body: { rating: 9 },
      user,
    });

    expectErrorEnvelope(captured, {
      message: ErrorMessages.RATING_INVALID,
      code: 400,
      errorCode: ErrorCode.VALIDATION_ERROR,
    });
  });

  it('listReviews converts an unexpected error into a generic 500 envelope', async () => {
    vi.mocked(reviewService.listReviews).mockRejectedValue(new Error('index unavailable'));

    const captured = await captureHandlerError(reviewsController.listReviews, {
      params: { workerId: 'worker-1' },
      query: {},
      user,
    });

    expectErrorEnvelope(captured, {
      message: ErrorMessages.INTERNAL_SERVER_ERROR,
      code: 500,
      errorCode: ErrorCode.INTERNAL_ERROR,
    });
  });
});

// ─── Messaging ────────────────────────────────────────────────────────────────

describe('messaging controller error paths', () => {
  it('getConversation forwards a service 404 NOT_FOUND envelope', async () => {
    vi.mocked(messagingService.getConversation).mockRejectedValue(
      new AppError('Conversation not found', 404, true, ErrorCode.NOT_FOUND),
    );

    const captured = await captureHandlerError(messagesController.getConversation, {
      params: { conversationId: 'missing' },
      user,
    });

    expectErrorEnvelope(captured, {
      message: 'Conversation not found',
      code: 404,
      errorCode: ErrorCode.NOT_FOUND,
    });
  });

  it('deleteMessage forwards a service 403 FORBIDDEN envelope', async () => {
    vi.mocked(messagingService.deleteMessage).mockRejectedValue(
      new AppError('Not the message author', 403, true, ErrorCode.FORBIDDEN),
    );

    const captured = await captureHandlerError(messagesController.deleteMessage, {
      params: { messageId: 'msg-1' },
      user,
    });

    expectErrorEnvelope(captured, {
      message: 'Not the message author',
      code: 403,
      errorCode: ErrorCode.FORBIDDEN,
    });
  });

  it('createConversation rejects invalid participantIds with a 400 VALIDATION_ERROR envelope', async () => {
    const captured = await captureHandlerError(messagesController.createConversation, {
      body: { participantIds: [], subject: 'Hi' },
      user,
    });

    expectErrorEnvelope(captured, {
      message: 'participantIds must be a non-empty array',
      code: 400,
      errorCode: ErrorCode.VALIDATION_ERROR,
    });
  });

  it('getConversations converts an unexpected error into a generic 500 envelope', async () => {
    vi.mocked(messagingService.getUserConversations).mockRejectedValue(new Error('redis down'));

    const captured = await captureHandlerError(messagesController.getConversations, {
      query: {},
      user,
    });

    expectErrorEnvelope(captured, {
      message: ErrorMessages.INTERNAL_SERVER_ERROR,
      code: 500,
      errorCode: ErrorCode.INTERNAL_ERROR,
    });
  });
});
