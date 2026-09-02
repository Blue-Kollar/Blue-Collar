import { Bookmark, Search, Star, Users, Wallet } from "lucide-react";
import Link from "next/link";

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
    icon: <Users size={48} className="text-blue-200" />,
    title: "No workers listed yet",
    description: "Be the first to add a skilled worker to the community.",
    cta: "Add a Worker",
    defaultHref: "/dashboard/workers/new",
  },
  "no-bookmarks": {
    icon: <Bookmark size={48} className="text-blue-200" />,
    title: "No saved workers yet",
    description: "Bookmark workers you like to find them quickly later.",
    cta: "Browse Workers",
    defaultHref: "/workers",
  },
  "no-reviews": {
    icon: <Star size={48} className="text-blue-200" />,
    title: "No reviews yet",
    description: "Be the first to share your experience with this worker.",
    cta: "Write a Review",
    defaultHref: "#review-form",
  },
  "no-search-results": {
    icon: <Search size={48} className="text-blue-200" />,
    title: "No results found",
    description: "Try different keywords, a broader location, or remove some filters.",
    cta: "Clear Filters",
    defaultHref: "/workers",
  },
  "no-transactions": {
    icon: <Wallet size={48} className="text-blue-200" />,
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
    <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-gradient-to-b from-gray-50 to-white py-16 px-6 text-center shadow-sm">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-50">
        {icon}
      </div>
      <p className="text-xl font-semibold text-gray-900">{title}</p>
      <p className="mt-2 max-w-sm text-sm text-gray-600">{description}</p>
      <Link
        href={href}
        className="mt-6 rounded-md bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
      >
        {buttonText}
      </Link>
    </div>
  );
}
