import { useState, useMemo, useCallback } from "react";
import type { Slot } from "@/components/AvailabilityCalendar";

export function useAvailabilityCalendar(availability: Slot[]) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);

  const [showSlotEditor, setShowSlotEditor] = useState(false);
  const [bulkDays, setBulkDays] = useState<number[]>([]);
  const [bulkStart, setBulkStart] = useState("09:00");
  const [bulkEnd, setBulkEnd] = useState("17:00");

  const availableDays = useMemo(() => new Set(availability.map((s) => s.dayOfWeek)), [availability]);
  const slotMap = useMemo(
    () => Object.fromEntries(availability.map((s) => [s.dayOfWeek, s])),
    [availability]
  );

  const toggleBulkDay = useCallback((day: number) => {
    setBulkDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }, []);

  const handleBulkApply = useCallback((onBulkSet?: (slots: Slot[]) => void) => {
    if (bulkDays.length === 0 || !onBulkSet) return;
    const slots = bulkDays.map((dayOfWeek) => ({
      dayOfWeek,
      startTime: bulkStart,
      endTime: bulkEnd,
    }));
    onBulkSet(slots);
    setBulkDays([]);
    setShowSlotEditor(false);
  }, [bulkDays, bulkStart, bulkEnd]);

  const handleSelectWeekdays = useCallback(() => {
    setBulkDays([1, 2, 3, 4, 5]);
  }, []);

  const handleSelectAll = useCallback(() => {
    setBulkDays([0, 1, 2, 3, 4, 5, 6]);
  }, []);

  const prevMonth = useCallback(() => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }, [month]);

  const nextMonth = useCallback(() => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }, [month]);

  const handleDayClick = useCallback((date: Date) => {
    if (!availableDays.has(date.getDay())) return;
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(date);
      setRangeEnd(null);
    } else {
      if (date < rangeStart) {
        setRangeStart(date);
        setRangeEnd(null);
      } else {
        setRangeEnd(date);
      }
    }
  }, [rangeStart, rangeEnd, availableDays]);

  return {
    year,
    month,
    rangeStart,
    rangeEnd,
    showSlotEditor,
    bulkDays,
    bulkStart,
    bulkEnd,
    availableDays,
    slotMap,
    setShowSlotEditor,
    setBulkStart,
    setBulkEnd,
    toggleBulkDay,
    handleBulkApply,
    handleSelectWeekdays,
    handleSelectAll,
    prevMonth,
    nextMonth,
    handleDayClick,
    setRangeStart,
    setRangeEnd,
  };
}
