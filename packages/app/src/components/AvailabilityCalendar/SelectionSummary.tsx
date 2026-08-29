import { Clock } from "lucide-react";
import type { Slot } from "@/components/AvailabilityCalendar";

interface SelectionSummaryProps {
  rangeStart: Date | null;
  rangeEnd: Date | null;
  selectedSlot: Slot | null;
  onClearSelection: () => void;
  slotMap: Record<number, Slot>;
}

export default function SelectionSummary({
  rangeStart,
  rangeEnd,
  selectedSlot,
  onClearSelection,
  slotMap,
}: SelectionSummaryProps) {
  if (!rangeStart) return null;

  const displaySlot = rangeStart ? slotMap[rangeStart.getDay()] : null;

  return (
    <div className="mt-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">
      {rangeEnd ? (
        <p>
          <span className="font-medium">
            {rangeStart.toLocaleDateString()} – {rangeEnd.toLocaleDateString()}
          </span>
          {" "}selected
          {" "}
          <button
            onClick={onClearSelection}
            className="ml-2 text-xs text-blue-500 underline hover:no-underline"
          >
            Clear
          </button>
        </p>
      ) : (
        <p>
          <span className="font-medium">{rangeStart.toLocaleDateString()}</span>
          {" "}— select an end date
        </p>
      )}
      {displaySlot && (
        <p className="mt-1 flex items-center gap-1 text-xs text-blue-600">
          <Clock size={12} />
          {displaySlot.startTime} – {displaySlot.endTime}
        </p>
      )}
    </div>
  );
}
