/**
 * Unit tests for the contact-request controller.
 *
 * The controller validates request body, calls the service, and shapes responses.
 * Business logic is tested in the service layer; these tests verify HTTP handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db.js', () => ({ db: {} }));

vi.mock('../services/contact-request.service.js', () => ({
  createContactRequest: vi.fn(),
  getContactRequests: vi.fn(),
  updateContactRequestStatus: vi.fn(),
}));

vi.mock('../mailer/index.js', () => ({
  sendContactRequestEmail: vi.fn().mockResolvedValue(undefined),
}));

import * as contactRequestService from '../services/contact-request.service.js';
import {
  createContactRequest,
  getContactRequests,
  updateContactRequestStatus,
} from './contact-request.js';
import { AppError } from '../utils/AppError.js';

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => vi.clearAllMocks());

describe('createContactRequest', () => {
  it('creates a contact request with valid message', async () => {
    const contactRequest = { id: 'cr-1', workerId: 'w-1', fromUserId: 'u-1', message: 'Hello' };
    (contactRequestService.createContactRequest as any).mockResolvedValue(contactRequest);

    const req = {
      params: { id: 'w-1' },
      user: { id: 'u-1' },
      body: { message: 'Hello' },
    } as any;
    const res = makeRes();

    await createContactRequest(req, res);

    expect(contactRequestService.createContactRequest).toHaveBeenCalledWith('w-1', 'u-1', 'Hello');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: contactRequest,
        status: 'success',
        code: 201,
      }),
    );
  });

  it('throws 400 when message is missing', async () => {
    const req = {
      params: { id: 'w-1' },
      user: { id: 'u-1' },
      body: {},
    } as any;
    const res = makeRes();

    await expect(createContactRequest(req, res)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when message is empty string', async () => {
    const req = {
      params: { id: 'w-1' },
      user: { id: 'u-1' },
      body: { message: '' },
    } as any;
    const res = makeRes();

    await expect(createContactRequest(req, res)).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('getContactRequests', () => {
  it('retrieves contact requests for a worker', async () => {
    const requests = [
      { id: 'cr-1', workerId: 'w-1', status: 'pending' },
      { id: 'cr-2', workerId: 'w-1', status: 'accepted' },
    ];
    (contactRequestService.getContactRequests as any).mockResolvedValue(requests);

    const req = { params: { id: 'w-1' } } as any;
    const res = makeRes();

    await getContactRequests(req, res);

    expect(contactRequestService.getContactRequests).toHaveBeenCalledWith('w-1');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: requests,
        status: 'success',
        code: 200,
      }),
    );
  });

  it('returns empty array when no requests exist', async () => {
    (contactRequestService.getContactRequests as any).mockResolvedValue([]);

    const req = { params: { id: 'w-1' } } as any;
    const res = makeRes();

    await getContactRequests(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [],
        status: 'success',
        code: 200,
      }),
    );
  });
});

describe('updateContactRequestStatus', () => {
  it('accepts a contact request', async () => {
    const updated = { id: 'cr-1', status: 'accepted' };
    (contactRequestService.updateContactRequestStatus as any).mockResolvedValue(updated);

    const req = {
      params: { requestId: 'cr-1' },
      body: { status: 'accepted' },
    } as any;
    const res = makeRes();

    await updateContactRequestStatus(req, res);

    expect(contactRequestService.updateContactRequestStatus).toHaveBeenCalledWith(
      'cr-1',
      'accepted',
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: updated,
        status: 'success',
        code: 200,
      }),
    );
  });

  it('declines a contact request', async () => {
    const updated = { id: 'cr-1', status: 'declined' };
    (contactRequestService.updateContactRequestStatus as any).mockResolvedValue(updated);

    const req = {
      params: { requestId: 'cr-1' },
      body: { status: 'declined' },
    } as any;
    const res = makeRes();

    await updateContactRequestStatus(req, res);

    expect(contactRequestService.updateContactRequestStatus).toHaveBeenCalledWith(
      'cr-1',
      'declined',
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: updated,
        status: 'success',
        code: 200,
      }),
    );
  });

  it('throws 400 for invalid status', async () => {
    const req = {
      params: { requestId: 'cr-1' },
      body: { status: 'invalid' },
    } as any;
    const res = makeRes();

    await expect(updateContactRequestStatus(req, res)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when status is missing', async () => {
    const req = {
      params: { requestId: 'cr-1' },
      body: {},
    } as any;
    const res = makeRes();

    await expect(updateContactRequestStatus(req, res)).rejects.toMatchObject({ statusCode: 400 });
  });
});
