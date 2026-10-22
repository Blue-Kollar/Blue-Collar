export default function CalendarLegend() {
  return (
    <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded-full bg-green-100 border border-green-300" />
        Available
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded-full bg-gray-100 border border-gray-300" />
        Unavailable
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded-full bg-blue-600" />
        Selected
      </span>
    </div>
  );
}
