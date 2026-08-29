import type { Slot } from "@/components/AvailabilityCalendar";

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface CalendarGridProps {
  year: number;
  month: number;
  availability: Slot[];
  rangeStart: Date | null;
  rangeEnd: Date | null;
  onDayClick: (date: Date) => void;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function inRange(date: Date, start: Date | null, end: Date | null) {
  if (!start || !end) return false;
  const t = date.getTime();
  return t > start.getTime() && t < end.getTime();
}

export default function CalendarGrid({
  year,
  month,
  availability,
  rangeStart,
  rangeEnd,
  onDayClick,
}: CalendarGridProps) {
  const today = new Date();
  const availableDays = new Set(availability.map((s) => s.dayOfWeek));

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];

  return (
    <div className="grid grid-cols-7 gap-y-1 text-center">
      {cells.map((date, i) => {
        if (!date) return <span key={i} />;

        const dow = date.getDay();
        const isAvailable = availableDays.has(dow);
        const isPast = date < today && !isSameDay(date, today);
        const isStart = rangeStart && isSameDay(date, rangeStart);
        const isEnd = rangeEnd && isSameDay(date, rangeEnd);
        const isInRange = inRange(date, rangeStart, rangeEnd);
        const isToday = isSameDay(date, today);

        let cls = "mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors ";
        if (isPast) {
          cls += "text-gray-300 cursor-not-allowed";
        } else if (isStart || isEnd) {
          cls += "bg-blue-600 text-white font-semibold cursor-pointer";
        } else if (isInRange && isAvailable) {
          cls += "bg-blue-100 text-blue-700 cursor-pointer";
        } else if (isAvailable) {
          cls += "bg-green-50 text-green-700 hover:bg-green-100 cursor-pointer font-medium";
        } else {
          cls += "text-gray-400 cursor-not-allowed";
        }
        if (isToday && !isStart && !isEnd) cls += " ring-1 ring-blue-400";

        return (
          <div key={i} className={isInRange ? "bg-blue-50 rounded" : ""}>
            <button
              onClick={() => !isPast && onDayClick(date)}
              disabled={isPast || !isAvailable}
              className={cls}
              aria-label={`${date.getDate()} ${MONTH_NAMES[month]}`}
            >
              {date.getDate()}
            </button>
          </div>
        );
      })}
    </div>
  );
}
