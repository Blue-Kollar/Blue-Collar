import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

interface CalendarHeaderProps {
  year: number;
  month: number;
  timezone: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

export default function CalendarHeader({
  year,
  month,
  timezone,
  onPrevMonth,
  onNextMonth,
}: CalendarHeaderProps) {
  const locale = useLocale();
  const t = useTranslations("componentText");
  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month, 1))
  );
  const dayLabels = Array.from({ length: 7 }, (_, day) =>
    new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(
      new Date(Date.UTC(2023, 0, 1 + day))
    )
  );
  return (
    <>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">{t("availability")}</h3>
        <span className="text-xs text-gray-400">{timezone}</span>
      </div>

      {/* Month nav */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={onPrevMonth}
          className="rounded p-1 hover:bg-gray-100 transition-colors"
          aria-label={t("previousMonth")}
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-medium text-gray-700">
          {monthLabel} {year}
        </span>
        <button
          onClick={onNextMonth}
          className="rounded p-1 hover:bg-gray-100 transition-colors"
          aria-label={t("nextMonth")}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day labels */}
      <div className="mb-1 grid grid-cols-7 text-center">
        {dayLabels.map((d, index) => (
          <span key={index} className="text-xs font-medium text-gray-400">{d}</span>
        ))}
      </div>
    </>
  );
}
