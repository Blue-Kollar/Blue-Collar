import { describe, it, expect, beforeEach } from "vitest";

interface FormState<T> {
  values: T;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
}

interface FormActions<T> {
  setFieldValue: (field: string, value: unknown) => void;
  setFieldError: (field: string, error: string) => void;
  setFieldTouched: (field: string, touched: boolean) => void;
  resetForm: () => void;
  setIsSubmitting: (isSubmitting: boolean) => void;
}

function createFormState<T>(initialValues: T): FormState<T> & FormActions<T> {
  let state: FormState<T> = {
    values: JSON.parse(JSON.stringify(initialValues)),
    errors: {},
    touched: {},
    isSubmitting: false,
  };

  const getState = () => state;
  const setState = (newState: Partial<FormState<T>>) => {
    state = { ...state, ...newState };
  };

  return {
    ...state,
    setFieldValue: (field: string, value: unknown) => {
      const parts = field.split(".");
      let obj = state.values as any;
      for (let i = 0; i < parts.length - 1; i++) {
        obj = obj[parts[i]];
      }
      obj[parts[parts.length - 1]] = value;
      setState({ values: state.values });
    },
    setFieldError: (field: string, error: string) => {
      setState({
        errors: { ...state.errors, [field]: error },
      });
    },
    setFieldTouched: (field: string, touched: boolean) => {
      setState({
        touched: { ...state.touched, [field]: touched },
      });
    },
    resetForm: () => {
      setState({
        values: JSON.parse(JSON.stringify(initialValues)),
        errors: {},
        touched: {},
        isSubmitting: false,
      });
    },
    setIsSubmitting: (isSubmitting: boolean) => {
      setState({ isSubmitting });
    },
  };
}

describe("Form State Management - Issue #1379", () => {
  interface PaymentFormValues {
    amount: string;
    recipient: string;
    memo?: string;
  }

  interface SearchFormValues {
    query: string;
    category?: string;
    sortBy?: string;
  }

  interface FiltersFormValues {
    minPrice?: number;
    maxPrice?: number;
    status?: string;
    tags?: string[];
  }

  describe("Payment Form State", () => {
    let form: ReturnType<typeof createFormState<PaymentFormValues>>;

    beforeEach(() => {
      form = createFormState<PaymentFormValues>({
        amount: "",
        recipient: "",
        memo: "",
      });
    });

    it("should initialize with empty values", () => {
      expect(form.values.amount).toBe("");
      expect(form.values.recipient).toBe("");
      expect(form.values.memo).toBe("");
    });

    it("should set field value for amount", () => {
      form.setFieldValue("amount", "100");
      expect(form.values.amount).toBe("100");
    });

    it("should set field value for recipient", () => {
      form.setFieldValue("recipient", "GADDR123");
      expect(form.values.recipient).toBe("GADDR123");
    });

    it("should set field error", () => {
      form.setFieldError("amount", "Amount is required");
      expect(form.errors.amount).toBe("Amount is required");
    });

    it("should mark field as touched", () => {
      form.setFieldTouched("amount", true);
      expect(form.touched.amount).toBe(true);
    });

    it("should reset form to initial state", () => {
      form.setFieldValue("amount", "100");
      form.setFieldError("amount", "Invalid");
      form.setFieldTouched("amount", true);

      form.resetForm();

      expect(form.values.amount).toBe("");
      expect(form.errors.amount).toBeUndefined();
      expect(form.touched.amount).toBeUndefined();
    });

    it("should handle validation errors", () => {
      form.setFieldValue("amount", "");
      form.setFieldError("amount", "Amount is required");
      form.setFieldError("recipient", "Recipient is required");

      expect(Object.keys(form.errors)).toHaveLength(2);
      expect(form.errors.amount).toBe("Amount is required");
      expect(form.errors.recipient).toBe("Recipient is required");
    });

    it("should track submitting state", () => {
      expect(form.isSubmitting).toBe(false);
      form.setIsSubmitting(true);
      expect(form.isSubmitting).toBe(true);
      form.setIsSubmitting(false);
      expect(form.isSubmitting).toBe(false);
    });
  });

  describe("Search Form State", () => {
    let form: ReturnType<typeof createFormState<SearchFormValues>>;

    beforeEach(() => {
      form = createFormState<SearchFormValues>({
        query: "",
        category: "",
        sortBy: "recent",
      });
    });

    it("should initialize with search defaults", () => {
      expect(form.values.query).toBe("");
      expect(form.values.sortBy).toBe("recent");
    });

    it("should update query field", () => {
      form.setFieldValue("query", "plumber");
      expect(form.values.query).toBe("plumber");
    });

    it("should update category filter", () => {
      form.setFieldValue("category", "construction");
      expect(form.values.category).toBe("construction");
    });

    it("should update sort order", () => {
      form.setFieldValue("sortBy", "rating");
      expect(form.values.sortBy).toBe("rating");
    });

    it("should reset search form", () => {
      form.setFieldValue("query", "plumber");
      form.setFieldValue("category", "construction");
      form.setFieldValue("sortBy", "rating");

      form.resetForm();

      expect(form.values.query).toBe("");
      expect(form.values.category).toBe("");
      expect(form.values.sortBy).toBe("recent");
    });

    it("should handle multiple field changes", () => {
      form.setFieldValue("query", "electrician");
      form.setFieldValue("category", "electrical");
      form.setFieldValue("sortBy", "price");

      expect(form.values.query).toBe("electrician");
      expect(form.values.category).toBe("electrical");
      expect(form.values.sortBy).toBe("price");
    });
  });

  describe("Filters Form State", () => {
    let form: ReturnType<typeof createFormState<FiltersFormValues>>;

    beforeEach(() => {
      form = createFormState<FiltersFormValues>({
        minPrice: undefined,
        maxPrice: undefined,
        status: undefined,
        tags: [],
      });
    });

    it("should initialize with no filters", () => {
      expect(form.values.minPrice).toBeUndefined();
      expect(form.values.maxPrice).toBeUndefined();
      expect(form.values.tags).toEqual([]);
    });

    it("should set minimum price filter", () => {
      form.setFieldValue("minPrice", 50);
      expect(form.values.minPrice).toBe(50);
    });

    it("should set maximum price filter", () => {
      form.setFieldValue("maxPrice", 500);
      expect(form.values.maxPrice).toBe(500);
    });

    it("should set status filter", () => {
      form.setFieldValue("status", "active");
      expect(form.values.status).toBe("active");
    });

    it("should reset all filters", () => {
      form.setFieldValue("minPrice", 50);
      form.setFieldValue("maxPrice", 500);
      form.setFieldValue("status", "active");
      form.setFieldValue("tags", ["urgent", "popular"]);

      form.resetForm();

      expect(form.values.minPrice).toBeUndefined();
      expect(form.values.maxPrice).toBeUndefined();
      expect(form.values.status).toBeUndefined();
      expect(form.values.tags).toEqual([]);
    });

    it("should validate price range", () => {
      form.setFieldValue("minPrice", 100);
      form.setFieldValue("maxPrice", 50);

      if (form.values.minPrice && form.values.maxPrice && form.values.minPrice > form.values.maxPrice) {
        form.setFieldError("maxPrice", "Maximum price must be greater than minimum price");
      }

      expect(form.errors.maxPrice).toBe("Maximum price must be greater than minimum price");
    });

    it("should handle tag filtering", () => {
      form.setFieldValue("tags", ["verified", "active"]);
      expect(form.values.tags).toEqual(["verified", "active"]);

      form.setFieldValue("tags", ["verified"]);
      expect(form.values.tags).toEqual(["verified"]);
    });
  });

  describe("Form Validation", () => {
    it("should validate required fields", () => {
      const form = createFormState({ email: "", password: "" });

      if (!form.values.email) {
        form.setFieldError("email", "Email is required");
      }
      if (!form.values.password) {
        form.setFieldError("password", "Password is required");
      }

      expect(Object.keys(form.errors)).toHaveLength(2);
    });

    it("should validate email format", () => {
      const form = createFormState({ email: "" });

      form.setFieldValue("email", "invalid-email");
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.values.email as string)) {
        form.setFieldError("email", "Invalid email format");
      }

      expect(form.errors.email).toBe("Invalid email format");
    });

    it("should clear errors on valid input", () => {
      const form = createFormState({ amount: "" });

      form.setFieldError("amount", "Amount is required");
      expect(form.errors.amount).toBe("Amount is required");

      form.setFieldValue("amount", "100");
      if (form.values.amount) {
        delete form.errors.amount;
      }

      expect(form.errors.amount).toBeUndefined();
    });
  });

  describe("Form Reset Behavior", () => {
    it("should completely reset form state", () => {
      const form = createFormState({
        name: "John",
        email: "john@example.com",
        phone: "555-1234",
      });

      form.setFieldValue("name", "Jane");
      form.setFieldValue("email", "jane@example.com");
      form.setFieldError("phone", "Invalid phone");
      form.setFieldTouched("name", true);
      form.setIsSubmitting(true);

      form.resetForm();

      expect(form.values.name).toBe("John");
      expect(form.values.email).toBe("john@example.com");
      expect(form.values.phone).toBe("555-1234");
      expect(form.errors.phone).toBeUndefined();
      expect(form.touched.name).toBeUndefined();
      expect(form.isSubmitting).toBe(false);
    });

    it("should reset to custom initial values", () => {
      const initialValues = {
        status: "active",
        priority: "high",
      };
      const form = createFormState(initialValues);

      form.setFieldValue("status", "inactive");
      form.setFieldValue("priority", "low");
      form.resetForm();

      expect(form.values.status).toBe("active");
      expect(form.values.priority).toBe("high");
    });
  });
});
