import { describe, it, expectTypeOf } from 'vitest';
import type { z } from 'zod';
import type {
  ApiResponse,
  AuthUser,
  Booking,
  Job,
  JobApplication,
  JobStatus,
  JobUrgency,
  Meta,
  NotificationType,
  PaginatedResult,
  User,
} from '../index.js';
import type {
  CreateJobInput,
  LegacyContactMessageErrors,
  LegacyMatchErrors,
  LoginInput,
  RegisterInput,
} from '../validations.js';
import { JobStatus as JobStatusValues, JobUrgency as JobUrgencyValues } from '../index.js';
import {
  amountSchema,
  emailField,
  emailSchema,
  validateEmailLegacy,
  validateMatchLegacy,
} from '../validations.js';

describe('compile-time contracts: domain types', () => {
  it('Job exposes the expected field types', () => {
    expectTypeOf<Job>().toMatchTypeOf<{
      id: string;
      title: string;
      description: string;
      skills: string[];
      createdAt: string;
      updatedAt: string;
    }>();
    expectTypeOf<Job['skills']>().toEqualTypeOf<string[]>();
    expectTypeOf<Job['budget']>().toEqualTypeOf<number | null | undefined>();
    expectTypeOf<Job['status']>().toEqualTypeOf<JobStatus>();
    expectTypeOf<Job['urgency']>().toEqualTypeOf<JobUrgency>();
    expectTypeOf<Job['category']['name']>().toEqualTypeOf<string>();
  });

  it('User and AuthUser are interchangeable', () => {
    expectTypeOf<User['id']>().toEqualTypeOf<string>();
    expectTypeOf<User['role']>().toEqualTypeOf<'user' | 'curator' | 'admin'>();
    expectTypeOf<User['verified']>().toEqualTypeOf<boolean>();
    expectTypeOf<User['avatar']>().toEqualTypeOf<string | null | undefined>();
    expectTypeOf<AuthUser>().toEqualTypeOf<User>();
  });

  it('status unions match the shared constants', () => {
    expectTypeOf<JobStatus>().toEqualTypeOf<'open' | 'closed' | 'filled' | 'expired'>();
    expectTypeOf<JobUrgency>().toEqualTypeOf<'low' | 'normal' | 'urgent'>();
    expectTypeOf(JobStatusValues.Open).toEqualTypeOf<'open'>();
    expectTypeOf(JobUrgencyValues.Urgent).toEqualTypeOf<'urgent'>();
  });

  it('notification and workflow status unions are preserved', () => {
    expectTypeOf<NotificationType>().toEqualTypeOf<
      'tip' | 'review' | 'contact' | 'system' | 'message'
    >();
    expectTypeOf<JobApplication['status']>().toMatchTypeOf<
      'pending' | 'accepted' | 'rejected' | 'withdrawn'
    >();
    expectTypeOf<Booking['status']>().toMatchTypeOf<
      'pending' | 'confirmed' | 'cancelled' | 'completed'
    >();
  });

  it('API envelopes carry generic payloads and metadata', () => {
    expectTypeOf<ApiResponse<string>['status']>().toEqualTypeOf<'success' | 'error'>();
    expectTypeOf<ApiResponse<string>['code']>().toEqualTypeOf<number>();
    expectTypeOf<ApiResponse<string>['data']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Meta>().toEqualTypeOf<{
      total: number;
      page: number;
      limit: number;
      pages: number;
    }>();
    expectTypeOf<PaginatedResult<User>['data']>().toEqualTypeOf<User[]>();
    expectTypeOf<PaginatedResult<User>['meta']>().toEqualTypeOf<Meta>();
  });
});

describe('compile-time contracts: validation schemas', () => {
  it('inferred zod input types reflect the wire format', () => {
    expectTypeOf<z.input<typeof emailField>>().toEqualTypeOf<string>();
    expectTypeOf<z.output<typeof emailField>>().toEqualTypeOf<string>();
    expectTypeOf<z.output<typeof emailSchema>>().toEqualTypeOf<string>();
    expectTypeOf<z.input<typeof amountSchema>>().toEqualTypeOf<unknown>();
    expectTypeOf<z.output<typeof amountSchema>>().toEqualTypeOf<number>();
  });

  it('inferred form types are structurally compatible with the DTOs', () => {
    expectTypeOf<LoginInput>().toEqualTypeOf<{ email: string; password: string }>();
    expectTypeOf<RegisterInput>().toMatchTypeOf<{
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    }>();
    expectTypeOf<CreateJobInput['title']>().toEqualTypeOf<string>();
    expectTypeOf<CreateJobInput['urgency']>().toEqualTypeOf<JobUrgency | undefined>();
  });

  it('legacy adapters return null-on-success and field error maps', () => {
    expectTypeOf(validateEmailLegacy('')).toEqualTypeOf<string | null>();
    expectTypeOf(validateMatchLegacy({})).toEqualTypeOf<LegacyMatchErrors>();
    expectTypeOf<LegacyMatchErrors['title']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<LegacyContactMessageErrors['message']>().toEqualTypeOf<string | undefined>();
    expectTypeOf(validateMatchLegacy({})).toMatchTypeOf<{
      title?: string;
      description?: string;
      amount?: string;
      stellarAddress?: string;
    }>();
  });
});
