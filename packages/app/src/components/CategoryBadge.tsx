"use client";

import {
  Droplets,
  Zap,
  Hammer,
  PaintBucket,
  Flame,
  Building2,
  Wind,
  Leaf,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { memo } from "react";
import { getCategoryConfig } from "@/config/categoryConfig";

const ICON_MAP: Record<string, LucideIcon> = {
  Droplets,
  Zap,
  Hammer,
  PaintBucket,
  Flame,
  Building2,
  Wind,
  Leaf,
  Sparkles,
  Wrench,
};

type BadgeSize = "sm" | "md" | "lg";

interface CategoryBadgeProps {
  slug: string;
  size?: BadgeSize;
  showLabel?: boolean;
}

const SIZE_CLASSES: Record<BadgeSize, { badge: string; icon: number }> = {
  sm: { badge: "px-2 py-0.5 text-xs gap-1", icon: 12 },
  md: { badge: "px-2.5 py-1 text-sm gap-1.5", icon: 14 },
  lg: { badge: "px-3 py-1.5 text-base gap-2", icon: 18 },
};

export const CategoryBadge = memo(function CategoryBadge({
  slug,
  size = "md",
  showLabel = true,
}: CategoryBadgeProps) {
  const { t } = useTranslation("categories");
  const config = getCategoryConfig(slug);
  const Icon = ICON_MAP[config.iconName] ?? Wrench;
  const { badge, icon: iconSize } = SIZE_CLASSES[size];
  const label = t(config.labelKey);
  const ariaLabel = t(config.ariaLabelKey);

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium
        ${config.bg} ${config.text} ${config.border} ${badge}`}
    >
      <Icon size={iconSize} className={config.icon} aria-hidden="true" />
      {showLabel ? (
        <span aria-label={ariaLabel}>{label}</span>
      ) : (
        <span className="sr-only">{ariaLabel}</span>
      )}
    </span>
  );
});

interface CategoryIconProps {
  slug: string;
  size?: number;
  className?: string;
}

export const CategoryIcon = memo(function CategoryIcon({
  slug,
  size = 24,
  className = "",
}: CategoryIconProps) {
  const config = getCategoryConfig(slug);
  const Icon = ICON_MAP[config.iconName] ?? Wrench;
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full p-2 ${config.bg} ${className}`}
      aria-hidden="true"
    >
      <Icon size={size} className={config.icon} aria-label={t(config.ariaLabelKey)} />
    </span>
  );
});
