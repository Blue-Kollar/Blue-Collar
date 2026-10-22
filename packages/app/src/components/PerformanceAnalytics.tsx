"use client";

import { useMemo } from "react";
import {
  Star,
  Eye,
  MessageSquare,
  TrendingUp,
  Bookmark,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface StatCard {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: number;
  color: string;
}

interface Props {
  averageRating: number | null;
  reviewCount: number;
  profileViews?: number;
  contactRequests?: number;
  bookmarkCount?: number;
  className?: string;
}

export default function PerformanceAnalytics({
  averageRating,
  reviewCount,
  profileViews = 0,
  contactRequests = 0,
  bookmarkCount = 0,
  className,
}: Props) {
  const t = useTranslations("componentText");
  const stats: StatCard[] = useMemo(
    () => [
      {
        label: t("averageRating"),
        value: averageRating !== null ? averageRating.toFixed(1) : "—",
        icon: Star,
        color: "text-amber-500 bg-amber-50",
      },
      {
        label: t("reviews"),
        value: reviewCount,
        icon: MessageSquare,
        color: "text-blue-500 bg-blue-50",
      },
      {
        label: t("profileViews"),
        value: profileViews,
        icon: Eye,
        color: "text-purple-500 bg-purple-50",
      },
      {
        label: t("contactRequests"),
        value: contactRequests,
        icon: TrendingUp,
        color: "text-green-500 bg-green-50",
      },
      {
        label: t("bookmarks"),
        value: bookmarkCount,
        icon: Bookmark,
        color: "text-rose-500 bg-rose-50",
      },
    ],
    [averageRating, reviewCount, profileViews, contactRequests, bookmarkCount, t]
  );

  // Rating bar breakdown
  const ratingBar = useMemo(() => {
    if (averageRating === null) return null;
    const pct = (averageRating / 5) * 100;
    return pct;
  }, [averageRating]);

  return (
    <div className={cn("rounded-xl border bg-white p-4 shadow-sm", className)}>
      <h3 className="mb-4 text-sm font-semibold text-gray-800">{t("performance")}</h3>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => {
          const [iconColor, bgColor] = stat.color.split(" ");
          return (
            <div
              key={stat.label}
              className="rounded-lg border bg-white p-3 text-center"
            >
              <div
                className={cn(
                  "mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full",
                  bgColor
                )}
              >
                <stat.icon size={16} className={iconColor} />
              </div>
              <p className="text-lg font-bold text-gray-900">{stat.value}</p>
              <p className="text-[11px] text-gray-500">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Rating bar */}
      {ratingBar !== null && (
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
            <span>{t("ratingScore")}</span>
            <span>{averageRating!.toFixed(1)} / 5.0</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-amber-400 transition-all duration-500"
              style={{ width: `${ratingBar}%` }}
            />
          </div>
        </div>
      )}

      {reviewCount === 0 && (
        <p className="mt-3 text-center text-xs text-gray-400 italic">
          {t("metricsPopulate")}
        </p>
      )}
    </div>
  );
}
