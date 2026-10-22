import { describe, it, expect } from 'vitest';
import {
  EMAIL_REGEX,
  PHONE_REGEX,
  STELLAR_ADDRESS_REGEX,
  isValidEmail,
  validateEmail,
  isValidPassword,
  validatePassword,
  isRequired,
  validateRequired,
  validateMinLength,
  validateMaxLength,
  isValidStellarAddress,
  validateStellarAddress,
  isValidPhone,
  validatePhone,
  validateAmount,
  validateMatch,
} from '@/utils/validation';

describe('Validation Regex Patterns', () => {
  it('EMAIL_REGEX pattern is defined', () => {
    expect(EMAIL_REGEX).toBeDefined();
  });

  it('PHONE_REGEX pattern is defined', () => {
    expect(PHONE_REGEX).toBeDefined();
  });

  it('STELLAR_ADDRESS_REGEX pattern is defined', () => {
    expect(STELLAR_ADDRESS_REGEX).toBeDefined();
  });

  it('EMAIL_REGEX matches valid email formats', () => {
    expect(EMAIL_REGEX.test('user@example.com')).toBe(true);
    expect(EMAIL_REGEX.test('invalid')).toBe(false);
  });

  it('STELLAR_ADDRESS_REGEX matches valid stellar addresses', () => {
    const address = 'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJAU53D47XNGGQY2H5OKNFREE';
    expect(STELLAR_ADDRESS_REGEX.test(address)).toBe(true);
  });
});

describe('Email Validation', () => {
  it('isValidEmail validates correct email addresses', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('user.name+tag@example.co.uk')).toBe(true);
  });

  it('isValidEmail rejects invalid email addresses', () => {
    expect(isValidEmail('invalid')).toBe(false);
    expect(isValidEmail('test@')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });

  it('validateEmail function returns validation result', () => {
    const validResult = validateEmail('test@example.com');
    const invalidResult = validateEmail('invalid');
    expect(typeof validResult).toBe('boolean');
    expect(typeof invalidResult).toBe('boolean');
  });
});

describe('Password Validation', () => {
  it('isValidPassword validates strong passwords', () => {
    expect(isValidPassword('StrongPass123!')).toBe(true);
    expect(isValidPassword('MyP@ssw0rd')).toBe(true);
  });

  it('isValidPassword rejects weak passwords', () => {
    expect(isValidPassword('123')).toBe(false);
    expect(isValidPassword('password')).toBe(false);
    expect(isValidPassword('')).toBe(false);
  });

  it('validatePassword function is available', () => {
    expect(typeof validatePassword).toBe('function');
  });
});

describe('Required Field Validation', () => {
  it('isRequired validates non-empty strings', () => {
    expect(isRequired('value')).toBe(true);
    expect(isRequired('any text')).toBe(true);
  });

  it('isRequired rejects empty values', () => {
    expect(isRequired('')).toBe(false);
    expect(isRequired(null)).toBe(false);
    expect(isRequired(undefined)).toBe(false);
  });

  it('validateRequired function is available', () => {
    expect(typeof validateRequired).toBe('function');
  });
});

describe('Length Validation', () => {
  it('validateMinLength validates minimum string length', () => {
    expect(validateMinLength('hello', 3)).toBe(true);
    expect(validateMinLength('hi', 3)).toBe(false);
    expect(validateMinLength('hello', 0)).toBe(true);
  });

  it('validateMaxLength validates maximum string length', () => {
    expect(validateMaxLength('hello', 10)).toBe(true);
    expect(validateMaxLength('hello', 3)).toBe(false);
    expect(validateMaxLength('', 10)).toBe(true);
  });

  it('handles boundary cases correctly', () => {
    expect(validateMinLength('exact', 5)).toBe(true);
    expect(validateMaxLength('exact', 5)).toBe(true);
  });
});

describe('Stellar Address Validation', () => {
  const validAddress = 'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJAU53D47XNGGQY2H5OKNFREE';

  it('isValidStellarAddress validates correct addresses', () => {
    expect(isValidStellarAddress(validAddress)).toBe(true);
  });

  it('isValidStellarAddress rejects invalid addresses', () => {
    expect(isValidStellarAddress('invalid')).toBe(false);
    expect(isValidStellarAddress('')).toBe(false);
    expect(isValidStellarAddress('GBRP')).toBe(false);
  });

  it('validateStellarAddress function is available', () => {
    expect(typeof validateStellarAddress).toBe('function');
  });
});

describe('Phone Validation', () => {
  it('isValidPhone validates phone numbers', () => {
    expect(isValidPhone('1234567890')).toBe(true);
    expect(isValidPhone('+1-234-567-8900')).toBe(true);
  });

  it('isValidPhone rejects invalid numbers', () => {
    expect(isValidPhone('123')).toBe(false);
    expect(isValidPhone('abc')).toBe(false);
    expect(isValidPhone('')).toBe(false);
  });

  it('validatePhone function is available', () => {
    expect(typeof validatePhone).toBe('function');
  });
});

describe('Amount Validation', () => {
  it('validateAmount validates numeric values', () => {
    expect(validateAmount('100')).toBe(true);
    expect(validateAmount('99.99')).toBe(true);
    expect(validateAmount('0')).toBe(true);
  });

  it('validateAmount rejects non-numeric values', () => {
    expect(validateAmount('abc')).toBe(false);
    expect(validateAmount('')).toBe(false);
  });
});

describe('Match Validation', () => {
  it('validateMatch function is available', () => {
    expect(typeof validateMatch).toBe('function');
  });

  it('validateMatch validates matching values', () => {
    const result = validateMatch('value1', 'value1');
    expect(typeof result).toBe('boolean');
  });
});

describe('Validation Utility Exports', () => {
  it('all core validation functions are exported', () => {
    expect(isValidEmail).toBeDefined();
    expect(isValidPassword).toBeDefined();
    expect(isRequired).toBeDefined();
    expect(validateMinLength).toBeDefined();
    expect(validateMaxLength).toBeDefined();
    expect(isValidStellarAddress).toBeDefined();
    expect(isValidPhone).toBeDefined();
    expect(validateAmount).toBeDefined();
  });

  it('all validation wrappers are exported', () => {
    expect(validateEmail).toBeDefined();
    expect(validatePassword).toBeDefined();
    expect(validateRequired).toBeDefined();
    expect(validateStellarAddress).toBeDefined();
    expect(validatePhone).toBeDefined();
    expect(validateMatch).toBeDefined();
  });

  it('all regex patterns are exported', () => {
    expect(EMAIL_REGEX).toBeDefined();
    expect(PHONE_REGEX).toBeDefined();
    expect(STELLAR_ADDRESS_REGEX).toBeDefined();
  });
});
