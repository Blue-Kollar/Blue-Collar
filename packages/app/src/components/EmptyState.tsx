import Link from "next/link";
import { Search, Bookmark, Star, Users, Wallet } from "lucide-react";
import { colors, spacing, radius, typography } from "@blue-collar/design-tokens";

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
    title: string;
    description: string;
    cta: string;
    defaultHref: string;
  }
> = {
  "no-workers": {
    icon: <Users size={48} className={colors.iconMuted} />,
    title: "No workers listed yet",
    description: "Be the first to add a skilled worker to the community.",
    cta: "Add a Worker",
    defaultHref: "/dashboard/workers/new",
  },
  "no-bookmarks": {
    icon: <Bookmark size={48} className={colors.iconMuted} />,
    title: "No saved workers yet",
    description: "Bookmark workers you like to find them quickly later.",
    cta: "Browse Workers",
    defaultHref: "/workers",
  },
  "no-reviews": {
    icon: <Star size={48} className={colors.iconMuted} />,
    title: "No reviews yet",
    description: "Be the first to share your experience with this worker.",
    cta: "Write a Review",
    defaultHref: "#review-form",
  },
  "no-search-results": {
    icon: <Search size={48} className={colors.iconMuted} />,
    title: "No results found",
    description: "Try different keywords, a broader location, or remove some filters.",
    cta: "Clear Filters",
    defaultHref: "/workers",
  },
  "no-transactions": {
    icon: <Wallet size={48} className={colors.iconMuted} />,
    title: "No transaction history",
    description: "Your tips and payments will appear here.",
    cta: "Send a Tip",
    defaultHref: "/workers",
  },
};

export default function EmptyState({
  variant,
  ctaHref,
  ctaText,
}: EmptyStateProps) {
  const { icon, title, description, cta, defaultHref } = config[variant];
  const href = ctaHref ?? defaultHref;
  const buttonText = ctaText ?? cta;

  return (
    <div
      className={`flex flex-col items-center justify-center ${radius.xl} border ${colors.border} bg-gradient-to-b ${colors.surfaceGradient} ${spacing.emptyStateY} ${spacing.emptyStateX} text-center shadow-sm`}
    >
      <div
        className={`${spacing.emptyStateIconBottom} flex h-20 w-20 items-center justify-center ${radius.full} ${colors.iconBg}`}
      >
        {icon}
      </div>
      <p className={`${typography.heading} ${colors.textPrimary}`}>{title}</p>
      <p className={`mt-2 max-w-sm ${typography.body} ${colors.textSecondary}`}>
        {description}
      </p>
      <Link
        href={href}
        className={`${spacing.emptyStateCtaTop} ${radius.md} ${colors.primaryBg} px-6 py-2.5 ${typography.body} font-medium ${colors.primaryText} ${colors.primaryHoverBg} transition-colors`}
      >
        {buttonText}
      </Link>
    </div>
  );
}
