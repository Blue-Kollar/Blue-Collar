/**
 * Shared Form Validation Utilities
 *
 * Centralized validation rules and helpers for form components across packages/app.
 */

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_REGEX = /^\+?[\d\s\-().]{7,20}$/;
export const STELLAR_ADDRESS_REGEX = /^G[A-Z2-7]{55}$/;

/**
 * Checks if a string is a valid email address.
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Validates an email field and returns an error message if invalid.
 */
export function validateEmail(email?: string, required = true): string | undefined {
  const trimmed = email?.trim() ?? "";
  if (!trimmed) {
    return required ? "Email is required" : undefined;
  }
  if (!isValidEmail(trimmed)) {
    return "Enter a valid email";
  }
  return undefined;
}

/**
 * Checks if a password satisfies length requirements (default min 8).
 */
export function isValidPassword(password: string, minLength = 8): boolean {
  return typeof password === "string" && password.length >= minLength;
}

/**
 * Validates a password field and returns an error message if invalid.
 */
export function validatePassword(
  password?: string,
  minLength = 8,
  required = true
): string | undefined {
  if (!password) {
    return required ? "Password is required" : undefined;
  }
  if (password.length < minLength) {
    return `Password must be at least ${minLength} characters`;
  }
  return undefined;
}

/**
 * Checks if a value is non-empty (string, number, boolean, or array).
 */
export function isRequired(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Validates that a required field is not empty.
 */
export function validateRequired(value: unknown, fieldName = "This field"): string | undefined {
  if (!isRequired(value)) {
    return `${fieldName} is required`;
  }
  return undefined;
}

/**
 * Validates minimum string length.
 */
export function validateMinLength(
  value: string | undefined,
  min: number,
  fieldName = "Field"
): string | undefined {
  const len = (value ?? "").trim().length;
  if (len < min) {
    return `${fieldName} must be at least ${min} characters`;
  }
  return undefined;
}

/**
 * Validates maximum string length.
 */
export function validateMaxLength(
  value: string | undefined,
  max: number,
  fieldName = "Field"
): string | undefined {
  const len = (value ?? "").length;
  if (len > max) {
    return `${fieldName} must be ${max} characters or less`;
  }
  return undefined;
}

/**
 * Checks if a string is a valid Stellar public key address.
 */
export function isValidStellarAddress(address: string): boolean {
  return STELLAR_ADDRESS_REGEX.test(address.trim());
}

/**
 * Validates a Stellar public key address.
 */
export function validateStellarAddress(
  address?: string,
  required = false
): string | undefined {
  const trimmed = address?.trim() ?? "";
  if (!trimmed) {
    return required ? "Stellar address is required" : undefined;
  }
  if (!isValidStellarAddress(trimmed)) {
    return "Must be a valid Stellar public key (starts with G)";
  }
  return undefined;
}

/**
 * Checks if a phone number format is valid.
 */
export function isValidPhone(phone: string): boolean {
  return PHONE_REGEX.test(phone.trim());
}

/**
 * Validates a phone number field.
 */
export function validatePhone(phone?: string, required = false): string | undefined {
  const trimmed = phone?.trim() ?? "";
  if (!trimmed) {
    return required ? "Phone number is required" : undefined;
  }
  if (!isValidPhone(trimmed)) {
    return "Enter a valid phone number";
  }
  return undefined;
}

/**
 * Validates a positive numeric amount.
 */
export function validateAmount(
  amount: string | number | undefined,
  min = 0,
  fieldName = "Amount"
): string | undefined {
  if (amount === undefined || amount === null || amount === "") {
    return `${fieldName} is required`;
  }
  const parsed = typeof amount === "number" ? amount : parseFloat(amount);
  if (isNaN(parsed) || !isFinite(parsed)) {
    return `${fieldName} must be a valid number`;
  }
  if (parsed <= min) {
    return `${fieldName} must be greater than ${min}`;
  }
  return undefined;
}

/**
 * Validates that two fields match (e.g. password confirmation).
 */
export function validateMatch(
  value1: string,
  value2: string,
  message = "Fields do not match"
): string | undefined {
  if (value1 !== value2) {
    return message;
  }
  return undefined;
}

/**
 * Validates user profile fields.
 */
export function validateUserProfile(profile: {
  firstName?: string;
  lastName?: string;
  email?: string;
}): Partial<Record<"firstName" | "lastName" | "email", string>> {
  const errors: Partial<Record<"firstName" | "lastName" | "email", string>> = {};

  const fnError = validateRequired(profile.firstName, "First name");
  if (fnError) errors.firstName = fnError;

  const lnError = validateRequired(profile.lastName, "Last name");
  if (lnError) errors.lastName = lnError;

  const emailError = validateEmail(profile.email, true);
  if (emailError) errors.email = emailError;

  return errors;
}

/**
 * Validates escrow creation form data.
 */
export function validateEscrowForm(form: {
  amount?: string;
  counterparty?: string;
  terms?: string;
}): Partial<Record<"amount" | "counterparty" | "terms", string>> {
  const errors: Partial<Record<"amount" | "counterparty" | "terms", string>> = {};

  const amountError = validateAmount(form.amount, 0, "Amount");
  if (amountError) errors.amount = amountError;

  const counterpartyError = validateRequired(form.counterparty, "Counterparty address");
  if (counterpartyError) errors.counterparty = counterpartyError;

  const termsError = validateRequired(form.terms, "Terms");
  if (termsError) errors.terms = termsError;

  return errors;
}

/**
 * Validates contact message content.
 */
export function validateContactMessage(
  message: string,
  minLength = 10,
  maxLength = 1000
): { isValid: boolean; error?: string } {
  const trimmed = message.trim();
  if (!trimmed) {
    return { isValid: false, error: "Message cannot be empty" };
  }
  if (trimmed.length < minLength) {
    return { isValid: false, error: `Message must be at least ${minLength} characters` };
  }
  if (trimmed.length > maxLength) {
    return { isValid: false, error: `Message must be ${maxLength} characters or less` };
  }
  return { isValid: true };
}
