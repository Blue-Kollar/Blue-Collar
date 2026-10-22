import { ChevronLeft, ChevronRight } from "lucide-react";

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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
  return (
    <>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Availability</h3>
        <span className="text-xs text-gray-400">{timezone}</span>
      </div>

      {/* Month nav */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={onPrevMonth}
          className="rounded p-1 hover:bg-gray-100 transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-medium text-gray-700">
          {MONTH_NAMES[month]} {year}
        </span>
        <button
          onClick={onNextMonth}
          className="rounded p-1 hover:bg-gray-100 transition-colors"
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day labels */}
      <div className="mb-1 grid grid-cols-7 text-center">
        {DAY_LABELS.map((d) => (
          <span key={d} className="text-xs font-medium text-gray-400">{d}</span>
        ))}
      </div>
    </>
  );
}
