"use client";

import { useAvailabilityCalendar } from "@/hooks/useAvailabilityCalendar";
import CalendarHeader from "@/components/AvailabilityCalendar/CalendarHeader";
import CalendarGrid from "@/components/AvailabilityCalendar/CalendarGrid";
import CalendarLegend from "@/components/AvailabilityCalendar/CalendarLegend";
import SlotEditor from "@/components/AvailabilityCalendar/SlotEditor";
import SelectionSummary from "@/components/AvailabilityCalendar/SelectionSummary";

export interface Slot {
  dayOfWeek: number; // 0 = Sun … 6 = Sat
  startTime: string;
  endTime: string;
}

interface Props {
  availability: Slot[];
  editable?: boolean;
  onAdd?: (slot: Slot) => void;
  onRemove?: (dayOfWeek: number) => void;
  onBulkSet?: (slots: Slot[]) => void;
}

export default function AvailabilityCalendar({
  availability,
  editable = false,
  onAdd,
  onRemove,
  onBulkSet,
}: Props) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const {
    year,
    month,
    rangeStart,
    rangeEnd,
    showSlotEditor,
    bulkDays,
    bulkStart,
    bulkEnd,
    slotMap,
    setShowSlotEditor,
    setBulkStart,
    setBulkEnd,
    toggleBulkDay,
    handleBulkApply: handleApply,
    handleSelectWeekdays,
    handleSelectAll,
    prevMonth,
    nextMonth,
    handleDayClick,
    setRangeStart,
    setRangeEnd,
  } = useAvailabilityCalendar(availability);

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <CalendarHeader
        year={year}
        month={month}
        timezone={tz}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
      />

      <CalendarGrid
        year={year}
        month={month}
        availability={availability}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        onDayClick={handleDayClick}
      />

      <CalendarLegend />

      {editable && (
        <SlotEditor
          availability={availability}
          showSlotEditor={showSlotEditor}
          bulkDays={bulkDays}
          bulkStart={bulkStart}
          bulkEnd={bulkEnd}
          onToggleEditor={() => setShowSlotEditor((prev) => !prev)}
          onToggleBulkDay={toggleBulkDay}
          onBulkApply={() => handleApply(onBulkSet)}
          onStartTimeChange={setBulkStart}
          onEndTimeChange={setBulkEnd}
          onSelectWeekdays={handleSelectWeekdays}
          onSelectAll={handleSelectAll}
          onRemove={onRemove}
        />
      )}

      {!editable && (
        <>
          <SelectionSummary
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            selectedSlot={rangeStart ? slotMap[rangeStart.getDay()] : null}
            onClearSelection={() => { setRangeStart(null); setRangeEnd(null); }}
            slotMap={slotMap}
          />

          {availability.length === 0 && (
            <p className="mt-4 text-center text-xs text-gray-400 italic">
              No availability set for this worker.
            </p>
          )}
        </>
      )}
    </div>
  );
}
