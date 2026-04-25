"use client";

interface Props {
  password: string;
}

interface StrengthLevel {
  label: string;
  color: string;
  width: string;
  score: number;
}

function getStrength(password: string): StrengthLevel {
  if (!password) return { label: "", color: "bg-gray-200", width: "w-0", score: 0 };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { label: "Weak", color: "bg-red-500", width: "w-1/4", score };
  if (score <= 2) return { label: "Fair", color: "bg-orange-400", width: "w-2/4", score };
  if (score <= 3) return { label: "Good", color: "bg-yellow-400", width: "w-3/4", score };
  return { label: "Strong", color: "bg-green-500", width: "w-full", score };
}

export default function PasswordStrength({ password }: Props) {
  const strength = getStrength(password);
  if (!password) return null;

  return (
    <div className="mt-1.5 flex flex-col gap-1">
      <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${strength.color} ${strength.width}`}
        />
      </div>
      <p className={`text-xs font-medium ${
        strength.score <= 1 ? "text-red-500"
        : strength.score <= 2 ? "text-orange-400"
        : strength.score <= 3 ? "text-yellow-500"
        : "text-green-500"
      }`}>
        {strength.label}
        {strength.score <= 2 && (
          <span className="ml-1 font-normal text-gray-400">
            — try adding uppercase, numbers or symbols
          </span>
        )}
      </p>
    </div>
  );
}
