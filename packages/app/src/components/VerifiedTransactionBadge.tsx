import { BadgeCheck } from 'lucide-react';

interface Props {
  className?: string;
}

export default function VerifiedTransactionBadge({ className }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400 ${className ?? ''}`}
    >
      <BadgeCheck size={12} />
      Verified Transaction
    </span>
  );
}
