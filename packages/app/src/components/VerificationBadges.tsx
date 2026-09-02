"use client";

import {
  BadgeCheck,
  Camera,
  type LucideIcon,
  Mail,
  Phone,
  ShieldCheck,
  Wallet,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface Badge {
  key: string;
  label: string;
  icon: LucideIcon;
  earned: boolean;
}

interface Props {
  isVerified: boolean;
  hasPhone: boolean;
  hasEmail: boolean;
  hasWallet: boolean;
  hasAvatar: boolean;
  className?: string;
  compact?: boolean;
}

export default function VerificationBadges({
  isVerified,
  hasPhone,
  hasEmail,
  hasWallet,
  hasAvatar,
  className,
  compact = false,
}: Props) {
  const badges: Badge[] = [
    { key: "identity", label: "Identity Verified", icon: ShieldCheck, earned: isVerified },
    { key: "phone", label: "Phone Verified", icon: Phone, earned: hasPhone },
    { key: "email", label: "Email Verified", icon: Mail, earned: hasEmail },
    { key: "wallet", label: "Wallet Connected", icon: Wallet, earned: hasWallet },
    { key: "photo", label: "Photo Added", icon: Camera, earned: hasAvatar },
  ];

  const earnedCount = badges.filter((b) => b.earned).length;

  if (compact) {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        {badges
          .filter((b) => b.earned)
          .map((b) => (
            <span
              key={b.key}
              title={b.label}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-green-50 text-green-600"
            >
              <b.icon size={13} />
            </span>
          ))}
        {earnedCount < badges.length && (
          <span className="text-xs text-gray-400">
            +{badges.length - earnedCount} to earn
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border bg-white p-4 shadow-sm", className)}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Verification</h3>
        <span className="text-xs text-gray-400">
          {earnedCount}/{badges.length} earned
        </span>
      </div>
      <div className="space-y-2">
        {badges.map((badge) => (
          <div
            key={badge.key}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors",
              badge.earned ? "bg-green-50" : "bg-gray-50"
            )}
          >
            <badge.icon
              size={16}
              className={badge.earned ? "text-green-600" : "text-gray-300"}
            />
            <span
              className={cn(
                "text-sm",
                badge.earned ? "font-medium text-green-800" : "text-gray-400"
              )}
            >
              {badge.label}
            </span>
            {badge.earned && (
              <BadgeCheck size={14} className="ml-auto text-green-500" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
