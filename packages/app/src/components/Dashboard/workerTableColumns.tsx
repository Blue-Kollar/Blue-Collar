import Link from "next/link";
import { Pencil, ToggleLeft, ToggleRight, Trash2, TrendingUp } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { ColumnDef } from "@/components/Table";
import type { DashboardWorker } from "./WorkersPanel";

export interface WorkerColumnHandlers {
  onToggle: (worker: DashboardWorker) => void;
  onDeleteRequest: (worker: DashboardWorker) => void;
  onViewTrends: (workerId: string, workerName: string) => void;
}

const ICON_BUTTON =
  "rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 transition-colors";

/** Column definitions for the curator's worker listings table. */
export function buildWorkerColumns({
  onToggle,
  onDeleteRequest,
  onViewTrends,
}: WorkerColumnHandlers): ColumnDef<DashboardWorker>[] {
  return [
    {
      key: "name",
      header: "Name",
      cell: (w) => <span className="font-medium text-gray-800">{w.name}</span>,
    },
    {
      key: "category",
      header: "Category",
      cell: (w) => (
        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600">
          {w.category.name}
        </span>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      cell: (w) => (
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium",
            w.isActive ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"
          )}
        >
          {w.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      cell: (w) => <span className="text-gray-400">{formatDate(w.createdAt)}</span>,
      hideOnMobile: true,
    },
    {
      key: "_actions",
      header: "Actions",
      className: "text-right",
      cell: (w) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => onViewTrends(w.id, w.name)}
            className={ICON_BUTTON}
            title="View Trends"
          >
            <TrendingUp size={15} />
          </button>
          <Link href={`/dashboard/workers/${w.id}/edit`} className={ICON_BUTTON} title="Edit">
            <Pencil size={15} />
          </Link>
          <button
            onClick={() => onToggle(w)}
            className={ICON_BUTTON}
            title={w.isActive ? "Deactivate" : "Activate"}
          >
            {w.isActive ? (
              <ToggleRight size={17} className="text-green-500" />
            ) : (
              <ToggleLeft size={17} />
            )}
          </button>
          <button
            onClick={() => onDeleteRequest(w)}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500 transition-colors"
            title="Delete"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];
}
