import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

interface TransactionListPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/** Presentational pager. Renders nothing when there is only one page. */
export default function TransactionListPagination({
  page,
  totalPages,
  onPageChange,
}: TransactionListPaginationProps) {
  const t = useTranslations("componentText");
  if (totalPages <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
      <span>
        {t("pageOf", { page, totalPages })}
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label={t("previous")}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label={t("next")}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
