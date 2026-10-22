import { describe, it, expect } from "vitest";
import {
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
  validateUserProfile,
  validateEscrowForm,
  validateContactMessage,
} from "@/utils/validation";

describe("Validation Utilities", () => {
  describe("Email validation", () => {
    it("identifies valid email addresses", () => {
      expect(isValidEmail("user@example.com")).toBe(true);
      expect(isValidEmail("first.last@domain.co.uk")).toBe(true);
      expect(isValidEmail("user+tag@domain.org")).toBe(true);
    });

    it("rejects invalid email addresses", () => {
      expect(isValidEmail("invalid")).toBe(false);
      expect(isValidEmail("@example.com")).toBe(false);
      expect(isValidEmail("user@")).toBe(false);
      expect(isValidEmail("user@domain")).toBe(false);
      expect(isValidEmail("")).toBe(false);
    });

    it("validateEmail returns appropriate error messages", () => {
      expect(validateEmail("")).toBe("Email is required");
      expect(validateEmail("", false)).toBeUndefined();
      expect(validateEmail("invalid-email")).toBe("Enter a valid email");
      expect(validateEmail("test@example.com")).toBeUndefined();
    });
  });

  describe("Password validation", () => {
    it("validates password length correctly", () => {
      expect(isValidPassword("12345678")).toBe(true);
      expect(isValidPassword("short")).toBe(false);
      expect(isValidPassword("short", 5)).toBe(true);
    });

    it("validatePassword returns appropriate error messages", () => {
      expect(validatePassword("")).toBe("Password is required");
      expect(validatePassword("", 8, false)).toBeUndefined();
      expect(validatePassword("short", 8)).toBe("Password must be at least 8 characters");
      expect(validatePassword("validpassword123")).toBeUndefined();
    });
  });

  describe("Required field validation", () => {
    it("checks isRequired properly", () => {
      expect(isRequired("hello")).toBe(true);
      expect(isRequired("  ")).toBe(false);
      expect(isRequired("")).toBe(false);
      expect(isRequired(null)).toBe(false);
      expect(isRequired(undefined)).toBe(false);
      expect(isRequired([])).toBe(false);
      expect(isRequired([1])).toBe(true);
      expect(isRequired(0)).toBe(true);
      expect(isRequired(false)).toBe(true);
    });

    it("validateRequired returns correct error message", () => {
      expect(validateRequired("", "Name")).toBe("Name is required");
      expect(validateRequired("Alice", "Name")).toBeUndefined();
    });
  });

  describe("String length validation", () => {
    it("validates min and max lengths", () => {
      expect(validateMinLength("ab", 3, "Code")).toBe("Code must be at least 3 characters");
      expect(validateMinLength("abc", 3, "Code")).toBeUndefined();

      expect(validateMaxLength("toolongstring", 5, "Code")).toBe("Code must be 5 characters or less");
      expect(validateMaxLength("ok", 5, "Code")).toBeUndefined();
    });
  });

  describe("Stellar address validation", () => {
    it("validates Stellar public keys", () => {
      const validKey = "GDNWUUXJRNFQ2HF3EUKP3BXOUJTZIQZ4JCFDQ2AYKMNXDJWYON7VM3BL";
      expect(isValidStellarAddress(validKey)).toBe(true);
      expect(isValidStellarAddress("SDNWUUXJRNFQ2HF3EUKP3BXOUJTZIQZ4JCFDQ2AYKMNXDJWYON7VM3BL")).toBe(false);
      expect(isValidStellarAddress("invalid")).toBe(false);
    });

    it("validateStellarAddress returns error message", () => {
      expect(validateStellarAddress("", true)).toBe("Stellar address is required");
      expect(validateStellarAddress("", false)).toBeUndefined();
      expect(validateStellarAddress("invalid")).toBe("Must be a valid Stellar public key (starts with G)");
    });
  });

  describe("Phone validation", () => {
    it("validates phone format", () => {
      expect(isValidPhone("+1234567890")).toBe(true);
      expect(isValidPhone("(555) 123-4567")).toBe(true);
      expect(isValidPhone("123")).toBe(false);
    });

    it("validatePhone returns error message", () => {
      expect(validatePhone("", true)).toBe("Phone number is required");
      expect(validatePhone("", false)).toBeUndefined();
      expect(validatePhone("abc")).toBe("Enter a valid phone number");
    });
  });

  describe("Amount validation", () => {
    it("validates amount properly", () => {
      expect(validateAmount("")).toBe("Amount is required");
      expect(validateAmount("notanumber")).toBe("Amount must be a valid number");
      expect(validateAmount("-5")).toBe("Amount must be greater than 0");
      expect(validateAmount("0")).toBe("Amount must be greater than 0");
      expect(validateAmount("10.5")).toBeUndefined();
      expect(validateAmount(25)).toBeUndefined();
    });
  });

  describe("Match validation", () => {
    it("validates two matching values", () => {
      expect(validateMatch("secret", "secret")).toBeUndefined();
      expect(validateMatch("secret", "other", "Mismatch")).toBe("Mismatch");
    });
  });

  describe("Complex form validators", () => {
    it("validates user profile", () => {
      const invalidProfile = { firstName: "", lastName: "", email: "bad" };
      const errors = validateUserProfile(invalidProfile);
      expect(errors.firstName).toBe("First name is required");
      expect(errors.lastName).toBe("Last name is required");
      expect(errors.email).toBe("Enter a valid email");

      const validProfile = { firstName: "John", lastName: "Doe", email: "john@example.com" };
      expect(validateUserProfile(validProfile)).toEqual({});
    });

    it("validates escrow form", () => {
      const invalidEscrow = { amount: "0", counterparty: "", terms: "" };
      const errors = validateEscrowForm(invalidEscrow);
      expect(errors.amount).toBe("Amount must be greater than 0");
      expect(errors.counterparty).toBe("Counterparty address is required");
      expect(errors.terms).toBe("Terms is required");

      const validEscrow = { amount: "100", counterparty: "G123", terms: "Delivery of goods" };
      expect(validateEscrowForm(validEscrow)).toEqual({});
    });

    it("validates contact message", () => {
      expect(validateContactMessage("").isValid).toBe(false);
      expect(validateContactMessage("short").isValid).toBe(false);
      expect(validateContactMessage("A valid message with sufficient length").isValid).toBe(true);
      expect(validateContactMessage("a".repeat(1001)).isValid).toBe(false);
    });
  });
});
