/** The rules a password is scored against, with the message shown when one is missing. */
export const PASSWORD_RULES = [
  { id: "length8", label: "at least 8 characters", test: (p: string) => p.length >= 8 },
  { id: "length12", label: "at least 12 characters", test: (p: string) => p.length >= 12 },
  { id: "uppercase", label: "an uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { id: "number", label: "a number", test: (p: string) => /[0-9]/.test(p) },
  { id: "symbol", label: "a symbol", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

export type PasswordStrengthLabel = "Weak" | "Fair" | "Good" | "Strong";

export interface PasswordStrengthResult {
  score: number;
  label: PasswordStrengthLabel | "";
  missingRules: string[];
}

/** Scores a password from 0 to 5 by the rules it meets. Pure, so registration and server checks can share it. */
export function getPasswordStrength(password: string): PasswordStrengthResult {
  if (!password) return { score: 0, label: "", missingRules: PASSWORD_RULES.map((r) => r.label) };

  const passed = PASSWORD_RULES.filter((r) => r.test(password));
  const score = passed.length;
  const label: PasswordStrengthLabel =
    score <= 1 ? "Weak" : score <= 2 ? "Fair" : score <= 3 ? "Good" : "Strong";
  const missingRules = PASSWORD_RULES.filter((r) => !r.test(password)).map((r) => r.label);

  return { score, label, missingRules };
}
