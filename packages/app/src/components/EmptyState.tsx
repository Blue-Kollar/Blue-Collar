import Link from "next/link";
import { useTranslations } from "next-intl";
import { Search, Bookmark, Star, Users, Wallet } from "lucide-react";
import { routes } from "@/lib/routes";

type Variant = "no-workers" | "no-bookmarks" | "no-reviews" | "no-search-results" | "no-transactions";

interface EmptyStateProps {
  variant: Variant;
  /** Override the default CTA href */
  ctaHref?: string;
  /** Custom CTA text */
  ctaText?: string;
}

const config: Record<
  Variant,
  {
    icon: React.ReactNode;
    titleKey: string;
    descriptionKey: string;
    ctaKey: string;
    defaultHref: string;
  }
> = {
  "no-workers": {
    icon: <Users size={48} className="text-blue-200" />,
    titleKey: "noWorkers.title",
    descriptionKey: "noWorkers.description",
    ctaKey: "noWorkers.cta",
    defaultHref: routes.dashboard.workers.new(),
  },
  "no-bookmarks": {
    icon: <Bookmark size={48} className="text-blue-200" />,
    titleKey: "noBookmarks.title",
    descriptionKey: "noBookmarks.description",
    ctaKey: "noBookmarks.cta",
    defaultHref: routes.workers.list(),
  },
  "no-reviews": {
    icon: <Star size={48} className="text-blue-200" />,
    titleKey: "noReviews.title",
    descriptionKey: "noReviews.description",
    ctaKey: "noReviews.cta",
    defaultHref: "#review-form",
  },
  "no-search-results": {
    icon: <Search size={48} className="text-blue-200" />,
    titleKey: "noSearchResults.title",
    descriptionKey: "noSearchResults.description",
    ctaKey: "noSearchResults.cta",
    defaultHref: routes.workers.list(),
  },
  "no-transactions": {
    icon: <Wallet size={48} className="text-blue-200" />,
    titleKey: "noTransactions.title",
    descriptionKey: "noTransactions.description",
    ctaKey: "noTransactions.cta",
    defaultHref: routes.workers.list(),
  },
};

export default function EmptyState({
  variant,
  ctaHref,
  ctaText,
}: EmptyStateProps) {
  const t = useTranslations("emptyState");
  const { icon, titleKey, descriptionKey, ctaKey, defaultHref } = config[variant];
  const href = ctaHref ?? defaultHref;
  const buttonText = ctaText ?? t(ctaKey);

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-gradient-to-b from-gray-50 to-white py-16 px-6 text-center shadow-sm">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-50">
        {icon}
      </div>
      <p className="text-xl font-semibold text-gray-900">{t(titleKey)}</p>
      <p className="mt-2 max-w-sm text-sm text-gray-600">{t(descriptionKey)}</p>
      <Link
        href={href}
        className="mt-6 rounded-md bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
      >
        {buttonText}
      </Link>
    </div>
  );
}