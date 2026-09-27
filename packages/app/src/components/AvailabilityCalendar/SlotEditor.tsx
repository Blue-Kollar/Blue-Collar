import { Clock, Plus, Trash2 } from "lucide-react";
import type { Slot } from "@/components/AvailabilityCalendar";

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return `${h.toString().padStart(2, "0")}:${m}`;
});

interface SlotEditorProps {
  availability: Slot[];
  showSlotEditor: boolean;
  bulkDays: number[];
  bulkStart: string;
  bulkEnd: string;
  onToggleEditor: () => void;
  onToggleBulkDay: (day: number) => void;
  onBulkApply: () => void;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  onSelectWeekdays: () => void;
  onSelectAll: () => void;
  onRemove?: (dayOfWeek: number) => void;
}

export default function SlotEditor({
  availability,
  showSlotEditor,
  bulkDays,
  bulkStart,
  bulkEnd,
  onToggleEditor,
  onToggleBulkDay,
  onBulkApply,
  onStartTimeChange,
  onEndTimeChange,
  onSelectWeekdays,
  onSelectAll,
  onRemove,
}: SlotEditorProps) {
  return (
    <div className="mt-4 space-y-3">
      {/* Current slots list */}
      {availability.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-gray-600">Current schedule</p>
          {availability
            .slice()
            .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
            .map((slot) => (
              <div
                key={slot.dayOfWeek}
                className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
              >
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-gray-700 w-24">
                    {DAY_FULL[slot.dayOfWeek]}
                  </span>
                  <span className="flex items-center gap-1 text-gray-500">
                    <Clock size={12} />
                    {slot.startTime} – {slot.endTime}
                  </span>
                </div>
                <button
                  onClick={() => onRemove?.(slot.dayOfWeek)}
                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                  aria-label={`Remove ${DAY_FULL[slot.dayOfWeek]}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
        </div>
      )}

      {/* Bulk set toggle */}
      {!showSlotEditor ? (
        <button
          onClick={onToggleEditor}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs font-medium text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors w-full justify-center"
        >
          <Plus size={14} />
          Set availability
        </button>
      ) : (
        <div className="rounded-lg border bg-blue-50/50 p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-700">
            Bulk set availability
          </p>

          {/* Day selector */}
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-xs text-gray-500">Select days</span>
              <button
                type="button"
                onClick={onSelectWeekdays}
                className="text-[10px] text-blue-500 hover:underline"
              >
                Weekdays
              </button>
              <button
                type="button"
                onClick={onSelectAll}
                className="text-[10px] text-blue-500 hover:underline"
              >
                All
              </button>
            </div>
            <div className="flex gap-1.5">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onToggleBulkDay(i)}
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                    bulkDays.includes(i)
                      ? "bg-blue-600 text-white"
                      : "bg-white border text-gray-600 hover:border-blue-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">Start time</label>
              <select
                value={bulkStart}
                onChange={(e) => onStartTimeChange(e.target.value)}
                className="w-full rounded-lg border bg-white px-2 py-1.5 text-sm"
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">End time</label>
              <select
                value={bulkEnd}
                onChange={(e) => onEndTimeChange(e.target.value)}
                className="w-full rounded-lg border bg-white px-2 py-1.5 text-sm"
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onBulkApply}
              disabled={bulkDays.length === 0}
              className="flex-1 rounded-lg bg-blue-600 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Apply to {bulkDays.length} day{bulkDays.length !== 1 ? "s" : ""}
            </button>
            <button
              type="button"
              onClick={onToggleEditor}
              className="rounded-lg border bg-white px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
