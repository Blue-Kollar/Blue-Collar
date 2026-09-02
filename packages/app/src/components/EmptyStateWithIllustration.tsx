import { Bookmark, Search, Star, TrendingUp,Users } from 'lucide-react'
import Link from 'next/link'

type Variant = 'no-workers' | 'no-bookmarks' | 'no-reviews' | 'no-search-results' | 'no-transactions'

interface EmptyStateProps {
  variant: Variant
  ctaHref?: string
}

const illustrations: Record<Variant, { icon: React.ReactNode; title: string; description: string; cta: string; defaultHref: string }> = {
  'no-workers': {
    icon: <UsersIllustration />,
    title: 'No workers listed yet',
    description: 'Be the first to add a skilled worker to the community.',
    cta: 'Add a Worker',
    defaultHref: '/dashboard/workers/new',
  },
  'no-bookmarks': {
    icon: <BookmarksIllustration />,
    title: 'No saved workers yet',
    description: 'Bookmark workers you like to find them quickly later.',
    cta: 'Browse Workers',
    defaultHref: '/workers',
  },
  'no-reviews': {
    icon: <ReviewsIllustration />,
    title: 'No reviews yet',
    description: 'Be the first to share your experience with this worker.',
    cta: 'Write a Review',
    defaultHref: '#review-form',
  },
  'no-search-results': {
    icon: <SearchIllustration />,
    title: 'No results found',
    description: 'Try different keywords, a broader location, or remove some filters.',
    cta: 'Clear Filters',
    defaultHref: '/workers',
  },
  'no-transactions': {
    icon: <TransactionsIllustration />,
    title: 'No transaction history',
    description: 'Your transactions will appear here once you start tipping workers.',
    cta: 'Browse Workers',
    defaultHref: '/workers',
  },
}

function UsersIllustration() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="No workers illustration">
      <circle cx="60" cy="30" r="15" fill="#DBEAFE" />
      <path d="M45 50C45 42.27 51.27 36 60 36C68.73 36 75 42.27 75 50V60H45V50Z" fill="#DBEAFE" />
      <circle cx="35" cy="70" r="12" fill="#E0E7FF" />
      <path d="M25 85C25 79.48 29.48 75 35 75C40.52 75 45 79.48 45 85V92H25V85Z" fill="#E0E7FF" />
      <circle cx="85" cy="70" r="12" fill="#E0E7FF" />
      <path d="M75 85C75 79.48 79.48 75 85 75C90.52 75 95 79.48 95 85V92H75V85Z" fill="#E0E7FF" />
      <path d="M30 100H90C92.21 100 94 101.79 94 104V110C94 112.21 92.21 114 90 114H30C27.79 114 26 112.21 26 110V104C26 101.79 27.79 100 30 100Z" fill="#3B82F6" opacity="0.1" />
    </svg>
  )
}

function BookmarksIllustration() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="No bookmarks illustration">
      <rect x="30" y="20" width="60" height="80" rx="4" fill="#DBEAFE" stroke="#3B82F6" strokeWidth="2" />
      <path d="M50 40L60 50L70 40" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="40" y1="60" x2="80" y2="60" stroke="#3B82F6" strokeWidth="1.5" opacity="0.5" />
      <line x1="40" y1="70" x2="80" y2="70" stroke="#3B82F6" strokeWidth="1.5" opacity="0.5" />
      <line x1="40" y1="80" x2="70" y2="80" stroke="#3B82F6" strokeWidth="1.5" opacity="0.5" />
    </svg>
  )
}

function ReviewsIllustration() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="No reviews illustration">
      <circle cx="60" cy="60" r="40" fill="#DBEAFE" />
      <path d="M50 50L55 60L50 70M70 50L75 60L70 70" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="60" cy="45" r="3" fill="#3B82F6" />
      <path d="M45 75Q60 85 75 75" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function SearchIllustration() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="No search results illustration">
      <circle cx="50" cy="50" r="25" fill="none" stroke="#3B82F6" strokeWidth="2" />
      <line x1="70" y1="70" x2="85" y2="85" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
      <circle cx="50" cy="50" r="15" fill="#DBEAFE" opacity="0.5" />
      <text x="50" y="55" textAnchor="middle" fontSize="20" fill="#3B82F6" fontWeight="bold">
        ?
      </text>
    </svg>
  )
}

function TransactionsIllustration() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="No transactions illustration">
      <rect x="25" y="30" width="70" height="60" rx="4" fill="#DBEAFE" stroke="#3B82F6" strokeWidth="2" />
      <line x1="30" y1="45" x2="90" y2="45" stroke="#3B82F6" strokeWidth="1.5" />
      <line x1="30" y1="60" x2="90" y2="60" stroke="#3B82F6" strokeWidth="1.5" opacity="0.5" />
      <line x1="30" y1="75" x2="90" y2="75" stroke="#3B82F6" strokeWidth="1.5" opacity="0.5" />
      <path d="M60 85L65 95L55 95Z" fill="#3B82F6" />
    </svg>
  )
}

export default function EmptyStateWithIllustration({ variant, ctaHref }: EmptyStateProps) {
  const { icon, title, description, cta, defaultHref } = illustrations[variant]
  const href = ctaHref ?? defaultHref

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border bg-white py-20 px-6 text-center shadow-sm">
      <div className="mb-6">{icon}</div>
      <p className="text-lg font-semibold text-gray-700">{title}</p>
      <p className="mt-2 max-w-xs text-sm text-gray-500">{description}</p>
      <Link
        href={href}
        className="mt-6 rounded-md bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
      >
        {cta}
      </Link>
    </div>
  )
}
