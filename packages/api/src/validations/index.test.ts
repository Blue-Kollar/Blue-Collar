import { describe, it, expect } from 'vitest'
import {
  registerRules,
  loginRules,
  forgotPasswordRules,
  resetPasswordRules,
  verifyAccountRules,
  resendVerificationRules,
} from './auth.js'
import { createWorkerRules, updateWorkerRules, createReviewRules, advancedSearchRules } from './worker.js'
import { updateProfileRules, changePasswordRules, pushSubscriptionRules } from './user.js'
import { bulkDeleteRules, bulkToggleRules } from './admin.js'
import { tipRules, createEscrowRules, updateFeeRules } from './payment.js'
import { revokeOtherDevicesRules } from './device.js'

// ── Auth validators ───────────────────────────────────────────────────────────

describe('registerRules', () => {
  const valid = { email: 'test@example.com', password: 'password123', firstName: 'Jane', lastName: 'Doe' }

  it('accepts valid registration', () => {
    expect(registerRules.safeParse(valid).success).toBe(true)
  })

  it('rejects invalid email', () => {
    expect(registerRules.safeParse({ ...valid, email: 'not-email' }).success).toBe(false)
  })

  it('rejects short password', () => {
    expect(registerRules.safeParse({ ...valid, password: 'short' }).success).toBe(false)
  })

  it('rejects empty firstName', () => {
    expect(registerRules.safeParse({ ...valid, firstName: '' }).success).toBe(false)
  })
})

describe('loginRules', () => {
  it('accepts valid login', () => {
    expect(loginRules.safeParse({ email: 'test@example.com', password: 'anypass' }).success).toBe(true)
  })

  it('rejects invalid email', () => {
    expect(loginRules.safeParse({ email: 'bad', password: 'pass' }).success).toBe(false)
  })

  it('rejects empty password', () => {
    expect(loginRules.safeParse({ email: 'test@example.com', password: '' }).success).toBe(false)
  })
})

describe('forgotPasswordRules', () => {
  it('accepts valid email', () => {
    expect(forgotPasswordRules.safeParse({ email: 'test@example.com' }).success).toBe(true)
  })

  it('rejects invalid email', () => {
    expect(forgotPasswordRules.safeParse({ email: 'bad' }).success).toBe(false)
  })
})

describe('resetPasswordRules', () => {
  it('accepts valid token and password', () => {
    expect(resetPasswordRules.safeParse({ token: 'abc123', password: 'newpass123' }).success).toBe(true)
  })

  it('rejects missing token', () => {
    expect(resetPasswordRules.safeParse({ password: 'newpass123' }).success).toBe(false)
  })

  it('rejects short password', () => {
    expect(resetPasswordRules.safeParse({ token: 'abc', password: 'short' }).success).toBe(false)
  })
})

describe('verifyAccountRules', () => {
  it('accepts valid token', () => {
    expect(verifyAccountRules.safeParse({ token: 'valid-token' }).success).toBe(true)
  })

  it('rejects empty token', () => {
    expect(verifyAccountRules.safeParse({ token: '' }).success).toBe(false)
  })
})

describe('resendVerificationRules', () => {
  it('accepts valid email', () => {
    expect(resendVerificationRules.safeParse({ email: 'test@example.com' }).success).toBe(true)
  })

  it('rejects invalid email', () => {
    expect(resendVerificationRules.safeParse({ email: 'bad' }).success).toBe(false)
  })
})

// ── Worker validators ─────────────────────────────────────────────────────────

describe('createWorkerRules', () => {
  const valid = { name: 'John Smith', categoryId: 'cat-1', phone: '+1234567890' }

  it('accepts valid worker with phone', () => {
    expect(createWorkerRules.safeParse(valid).success).toBe(true)
  })

  it('accepts valid worker with email instead of phone', () => {
    expect(createWorkerRules.safeParse({ name: 'Jane', categoryId: 'cat-1', email: 'jane@example.com' }).success).toBe(true)
  })

  it('rejects empty name', () => {
    expect(createWorkerRules.safeParse({ ...valid, name: '' }).success).toBe(false)
  })

  it('rejects missing categoryId', () => {
    expect(createWorkerRules.safeParse({ name: 'John', phone: '+1234' }).success).toBe(false)
  })
})

describe('updateWorkerRules', () => {
  it('accepts partial update', () => {
    expect(updateWorkerRules.safeParse({ name: 'Updated' }).success).toBe(true)
  })

  it('accepts empty object (all optional)', () => {
    expect(updateWorkerRules.safeParse({}).success).toBe(true)
  })
})

describe('createReviewRules', () => {
  it('accepts valid review', () => {
    expect(createReviewRules.safeParse({ rating: 4, comment: 'Great work' }).success).toBe(true)
  })

  it('rejects rating below 1', () => {
    expect(createReviewRules.safeParse({ rating: 0 }).success).toBe(false)
  })

  it('rejects rating above 5', () => {
    expect(createReviewRules.safeParse({ rating: 6 }).success).toBe(false)
  })

  it('rejects non-integer rating', () => {
    expect(createReviewRules.safeParse({ rating: 3.5 }).success).toBe(false)
  })
})

describe('advancedSearchRules', () => {
  it('accepts valid search params', () => {
    expect(advancedSearchRules.safeParse({ lat: 40.7128, lng: -74.006, radius: 10 }).success).toBe(true)
  })

  it('accepts empty object (all optional)', () => {
    expect(advancedSearchRules.safeParse({}).success).toBe(true)
  })

  it('rejects invalid sortBy value', () => {
    expect(advancedSearchRules.safeParse({ sortBy: 'invalid' }).success).toBe(false)
  })

  it('rejects radius below 0.1', () => {
    expect(advancedSearchRules.safeParse({ radius: 0 }).success).toBe(false)
  })
})

// ── User validators ───────────────────────────────────────────────────────────

describe('updateProfileRules', () => {
  it('accepts all optional fields present', () => {
    expect(updateProfileRules.safeParse({ firstName: 'Alice', lastName: 'Smith', email: 'a@b.com' }).success).toBe(true)
  })

  it('accepts empty object (all fields optional)', () => {
    expect(updateProfileRules.safeParse({}).success).toBe(true)
  })

  it('rejects invalid email', () => {
    expect(updateProfileRules.safeParse({ email: 'not-an-email' }).success).toBe(false)
  })

  it('rejects empty firstName', () => {
    expect(updateProfileRules.safeParse({ firstName: '' }).success).toBe(false)
  })
})

describe('changePasswordRules', () => {
  it('accepts valid input', () => {
    expect(changePasswordRules.safeParse({ currentPassword: 'old-pass', newPassword: 'new-pass-123' }).success).toBe(true)
  })

  it('rejects missing currentPassword', () => {
    expect(changePasswordRules.safeParse({ newPassword: 'new-pass-123' }).success).toBe(false)
  })

  it('rejects newPassword shorter than 8 chars', () => {
    expect(changePasswordRules.safeParse({ currentPassword: 'old', newPassword: 'short' }).success).toBe(false)
  })
})

describe('pushSubscriptionRules', () => {
  const validSub = {
    endpoint: 'https://push.example.com/endpoint',
    keys: { auth: 'authkey', p256dh: 'p256dhkey' },
  }

  it('accepts valid subscription', () => {
    expect(pushSubscriptionRules.safeParse(validSub).success).toBe(true)
  })

  it('rejects non-URL endpoint', () => {
    expect(pushSubscriptionRules.safeParse({ ...validSub, endpoint: 'not-a-url' }).success).toBe(false)
  })

  it('rejects missing keys', () => {
    expect(pushSubscriptionRules.safeParse({ endpoint: validSub.endpoint }).success).toBe(false)
  })
})

// ── Admin validators ──────────────────────────────────────────────────────────

describe('bulkDeleteRules', () => {
  it('accepts a non-empty array of ids', () => {
    expect(bulkDeleteRules.safeParse({ ids: ['id1', 'id2'] }).success).toBe(true)
  })

  it('rejects empty ids array', () => {
    expect(bulkDeleteRules.safeParse({ ids: [] }).success).toBe(false)
  })

  it('rejects missing ids', () => {
    expect(bulkDeleteRules.safeParse({}).success).toBe(false)
  })
})

describe('bulkToggleRules', () => {
  it('accepts valid input', () => {
    expect(bulkToggleRules.safeParse({ ids: ['id1'], active: true }).success).toBe(true)
  })

  it('rejects non-boolean active', () => {
    expect(bulkToggleRules.safeParse({ ids: ['id1'], active: 'yes' }).success).toBe(false)
  })
})

// ── Payment validators ────────────────────────────────────────────────────────

describe('tipRules', () => {
  const validTip = {
    from: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA',
    to: 'GBCJLPKHE2QTXTYZNZG6K3OBRPHJHABT2MG6JLAMM5FOARHM2GL67VCW',
    amount: '10.5000000',
  }

  it('accepts valid tip', () => {
    expect(tipRules.safeParse(validTip).success).toBe(true)
  })

  it('rejects invalid from address', () => {
    expect(tipRules.safeParse({ ...validTip, from: 'not-stellar' }).success).toBe(false)
  })

  it('rejects invalid amount format', () => {
    expect(tipRules.safeParse({ ...validTip, amount: '-5' }).success).toBe(false)
  })

  it('rejects missing fields', () => {
    expect(tipRules.safeParse({ from: validTip.from }).success).toBe(false)
  })
})

describe('createEscrowRules', () => {
  const validEscrow = {
    from: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA',
    to: 'GBCJLPKHE2QTXTYZNZG6K3OBRPHJHABT2MG6JLAMM5FOARHM2GL67VCW',
    amount: '50.0000000',
    expiryDate: '2027-01-01T00:00:00.000Z',
  }

  it('accepts valid escrow', () => {
    expect(createEscrowRules.safeParse(validEscrow).success).toBe(true)
  })

  it('rejects invalid expiryDate format', () => {
    expect(createEscrowRules.safeParse({ ...validEscrow, expiryDate: 'not-a-date' }).success).toBe(false)
  })
})

describe('updateFeeRules', () => {
  it('accepts valid fee_bps', () => {
    expect(updateFeeRules.safeParse({ fee_bps: 250 }).success).toBe(true)
  })

  it('rejects negative fee_bps', () => {
    expect(updateFeeRules.safeParse({ fee_bps: -1 }).success).toBe(false)
  })

  it('rejects fee_bps above 500', () => {
    expect(updateFeeRules.safeParse({ fee_bps: 501 }).success).toBe(false)
  })

  it('rejects non-integer fee_bps', () => {
    expect(updateFeeRules.safeParse({ fee_bps: 1.5 }).success).toBe(false)
  })
})

// ── Device validators ─────────────────────────────────────────────────────────

describe('revokeOtherDevicesRules', () => {
  it('accepts valid deviceId', () => {
    expect(revokeOtherDevicesRules.safeParse({ currentDeviceId: 'device-123' }).success).toBe(true)
  })

  it('rejects empty deviceId', () => {
    expect(revokeOtherDevicesRules.safeParse({ currentDeviceId: '' }).success).toBe(false)
  })

  it('rejects missing deviceId', () => {
    expect(revokeOtherDevicesRules.safeParse({}).success).toBe(false)
  })
})
