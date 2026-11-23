import { describe, it, expect } from 'vitest';
import {
  emailSchema,
  passwordSchema,
  stellarAddressSchema,
  amountSchema,
  matchSchema,
  contactMessageSchema,
  validateEmail,
  validatePassword,
  validateStellarAddress,
  validateAmount,
  validateMatch,
  validateContactMessage,
} from './validations';

describe('emailSchema', () => {
  it('accepts a valid email', () => {
    const result = emailSchema.safeParse('user@example.com');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('user@example.com');
    }
  });

  it('trims surrounding whitespace', () => {
    const result = emailSchema.safeParse('  user@example.com  ');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('user@example.com');
    }
  });

  it('rejects a bad email', () => {
    const result = emailSchema.safeParse('not-an-email');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Invalid email address');
    }
  });

  it('rejects an empty email', () => {
    const result = emailSchema.safeParse('');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Email is required');
    }
  });

  it('rejects a missing email', () => {
    const result = emailSchema.safeParse(undefined);
    expect(result.success).toBe(false);
  });
});

describe('passwordSchema', () => {
  it('accepts a valid password', () => {
    const result = passwordSchema.safeParse('Password123');
    expect(result.success).toBe(true);
  });

  it('rejects a short password', () => {
    const result = passwordSchema.safeParse('Ab1');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Password must be at least 8 characters');
    }
  });

  it('rejects a password without an uppercase letter', () => {
    const result = passwordSchema.safeParse('password123');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Password must contain an uppercase letter');
    }
  });

  it('rejects a password without a lowercase letter', () => {
    const result = passwordSchema.safeParse('PASSWORD123');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Password must contain a lowercase letter');
    }
  });

  it('rejects a password without a number', () => {
    const result = passwordSchema.safeParse('PasswordABC');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Password must contain a number');
    }
  });

  it('rejects a missing password', () => {
    const result = passwordSchema.safeParse(undefined);
    expect(result.success).toBe(false);
  });
});

describe('stellarAddressSchema', () => {
  const validAddress = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';

  it('accepts a valid Stellar address', () => {
    const result = stellarAddressSchema.safeParse(validAddress);
    expect(result.success).toBe(true);
  });

  it('rejects a malformed Stellar address', () => {
    const result = stellarAddressSchema.safeParse('GINVALID');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Invalid Stellar address');
    }
  });

  it('rejects an address with invalid characters', () => {
    const result = stellarAddressSchema.safeParse(
      'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2!',
    );
    expect(result.success).toBe(false);
  });

  it('rejects an empty address', () => {
    const result = stellarAddressSchema.safeParse('');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Stellar address is required');
    }
  });

  it('rejects a missing address', () => {
    const result = stellarAddressSchema.safeParse(undefined);
    expect(result.success).toBe(false);
  });
});

describe('amountSchema', () => {
  it('accepts a valid amount', () => {
    const result = amountSchema.safeParse(100);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(100);
    }
  });

  it('accepts a numeric string amount', () => {
    const result = amountSchema.safeParse('250.5');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(250.5);
    }
  });

  it('rejects a zero amount', () => {
    const result = amountSchema.safeParse(0);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Amount must be greater than 0');
    }
  });

  it('rejects a negative amount', () => {
    const result = amountSchema.safeParse(-10);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Amount must be greater than 0');
    }
  });

  it('rejects an amount above the maximum', () => {
    const result = amountSchema.safeParse(1_000_000_000);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Amount exceeds maximum allowed value');
    }
  });

  it('rejects a non-numeric amount', () => {
    const result = amountSchema.safeParse('abc');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Amount must be a valid number');
    }
  });

  it('rejects a missing amount', () => {
    const result = amountSchema.safeParse(undefined);
    expect(result.success).toBe(false);
  });
});

describe('matchSchema', () => {
  const validMatch = {
    title: 'Senior Frontend Developer',
    description: 'Build and maintain our React applications.',
    amount: 5000,
    stellarAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
  };

  it('accepts a valid match payload', () => {
    const result = matchSchema.safeParse(validMatch);
    expect(result.success).toBe(true);
  });

  it('rejects a missing title', () => {
    const { title: _title, ...rest } = validMatch;
    const result = matchSchema.safeParse(rest);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'title');
      expect(issue?.message).toBe('Title is required');
    }
  });

  it('rejects a short title', () => {
    const result = matchSchema.safeParse({ ...validMatch, title: 'A' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'title');
      expect(issue?.message).toBe('Title must be at least 3 characters');
    }
  });

  it('rejects a missing description', () => {
    const { description: _description, ...rest } = validMatch;
    const result = matchSchema.safeParse(rest);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'description');
      expect(issue?.message).toBe('Description is required');
    }
  });

  it('rejects an out-of-range amount', () => {
    const result = matchSchema.safeParse({ ...validMatch, amount: -1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'amount');
      expect(issue?.message).toBe('Amount must be greater than 0');
    }
  });

  it('rejects a malformed stellar address', () => {
    const result = matchSchema.safeParse({
      ...validMatch,
      stellarAddress: 'bad',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'stellarAddress');
      expect(issue?.message).toBe('Invalid Stellar address');
    }
  });

  it('rejects a missing stellar address', () => {
    const { stellarAddress: _stellarAddress, ...rest } = validMatch;
    const result = matchSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

describe('contactMessageSchema', () => {
  const validMessage = {
    name: 'Jane Doe',
    email: 'jane@example.com',
    message: 'Hello, I would like to know more about your services.',
  };

  it('accepts a valid contact message', () => {
    const result = contactMessageSchema.safeParse(validMessage);
    expect(result.success).toBe(true);
  });

  it('rejects a missing name', () => {
    const { name: _name, ...rest } = validMessage;
    const result = contactMessageSchema.safeParse(rest);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'name');
      expect(issue?.message).toBe('Name is required');
    }
  });

  it('rejects a bad email', () => {
    const result = contactMessageSchema.safeParse({
      ...validMessage,
      email: 'bad-email',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'email');
      expect(issue?.message).toBe('Invalid email address');
    }
  });

  it('rejects a short message', () => {
    const result = contactMessageSchema.safeParse({
      ...validMessage,
      message: 'Hi',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'message');
      expect(issue?.message).toBe('Message must be at least 10 characters');
    }
  });

  it('rejects a missing message', () => {
    const { message: _message, ...rest } = validMessage;
    const result = contactMessageSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

describe('validateEmail', () => {
  it('returns null for a valid email', () => {
    expect(validateEmail('user@example.com')).toBeNull();
  });

  it('returns an error message for a bad email', () => {
    expect(validateEmail('bad')).toBe('Invalid email address');
  });

  it('returns an error message for an empty email', () => {
    expect(validateEmail('')).toBe('Email is required');
  });
});

describe('validatePassword', () => {
  it('returns null for a valid password', () => {
    expect(validatePassword('Password123')).toBeNull();
  });

  it('returns an error message for a short password', () => {
    expect(validatePassword('Ab1')).toBe('Password must be at least 8 characters');
  });

  it('returns an error message for a password without a number', () => {
    expect(validatePassword('PasswordABC')).toBe('Password must contain a number');
  });
});

describe('validateStellarAddress', () => {
  it('returns null for a valid address', () => {
    expect(
      validateStellarAddress('GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H'),
    ).toBeNull();
  });

  it('returns an error message for a malformed address', () => {
    expect(validateStellarAddress('GINVALID')).toBe('Invalid Stellar address');
  });

  it('returns an error message for an empty address', () => {
    expect(validateStellarAddress('')).toBe('Stellar address is required');
  });
});

describe('validateAmount', () => {
  it('returns null for a valid amount', () => {
    expect(validateAmount(100)).toBeNull();
  });

  it('returns an error message for a zero amount', () => {
    expect(validateAmount(0)).toBe('Amount must be greater than 0');
  });

  it('returns an error message for a negative amount', () => {
    expect(validateAmount(-5)).toBe('Amount must be greater than 0');
  });

  it('returns an error message for an out-of-range amount', () => {
    expect(validateAmount(1_000_000_000)).toBe('Amount exceeds maximum allowed value');
  });

  it('returns an error message for a non-numeric amount', () => {
    expect(validateAmount('abc')).toBe('Amount must be a valid number');
  });
});

describe('validateMatch', () => {
  const validMatch = {
    title: 'Senior Frontend Developer',
    description: 'Build and maintain our React applications.',
    amount: 5000,
    stellarAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
  };

  it('returns an empty object for a valid match', () => {
    expect(validateMatch(validMatch)).toEqual({});
  });

  it('returns field errors for an invalid match', () => {
    const errors = validateMatch({
      ...validMatch,
      title: 'A',
      amount: -1,
      stellarAddress: 'bad',
    });
    expect(errors.title).toBe('Title must be at least 3 characters');
    expect(errors.amount).toBe('Amount must be greater than 0');
    expect(errors.stellarAddress).toBe('Invalid Stellar address');
  });

  it('returns errors for missing required fields', () => {
    const errors = validateMatch({});
    expect(errors.title).toBe('Title is required');
    expect(errors.description).toBe('Description is required');
    expect(errors.amount).toBeDefined();
    expect(errors.stellarAddress).toBe('Stellar address is required');
  });
});

describe('validateContactMessage', () => {
  const validMessage = {
    name: 'Jane Doe',
    email: 'jane@example.com',
    message: 'Hello, I would like to know more about your services.',
  };

  it('returns an empty object for a valid message', () => {
    expect(validateContactMessage(validMessage)).toEqual({});
  });

  it('returns field errors for an invalid message', () => {
    const errors = validateContactMessage({
      name: '',
      email: 'bad',
      message: 'Hi',
    });
    expect(errors.name).toBe('Name is required');
    expect(errors.email).toBe('Invalid email address');
    expect(errors.message).toBe('Message must be at least 10 characters');
  });

  it('returns errors for missing required fields', () => {
    const errors = validateContactMessage({});
    expect(errors.name).toBe('Name is required');
    expect(errors.email).toBe('Email is required');
    expect(errors.message).toBe('Message is required');
  });
});
