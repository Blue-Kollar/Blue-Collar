"use client";

import { getPasswordStrength, type PasswordStrengthLabel } from "@/lib/passwordStrength";

interface Props {
  password: string;
}

/** Colours and widths for each strength label. The scoring itself lives in lib/passwordStrength. */
const PRESENTATION: Record<PasswordStrengthLabel, { color: string; width: string; text: string }> = {
  Weak: { color: "bg-red-500", width: "w-1/4", text: "text-red-500" },
  Fair: { color: "bg-orange-400", width: "w-2/4", text: "text-orange-400" },
  Good: { color: "bg-yellow-400", width: "w-3/4", text: "text-yellow-500" },
  Strong: { color: "bg-green-500", width: "w-full", text: "text-green-500" },
};

export default function PasswordStrength({ password }: Props) {
  const { score, label } = getPasswordStrength(password);
  if (!password || !label) return null;

  const style = PRESENTATION[label];

  return (
    <div className="mt-1.5 flex flex-col gap-1">
      <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${style.color} ${style.width}`} />
      </div>
      <p className={`text-xs font-medium ${style.text}`}>
        {label}
        {score <= 2 && (
          <span className="ml-1 font-normal text-gray-400">
            — try adding uppercase, numbers or symbols
          </span>
        )}
      </p>
    </div>
  );
}
