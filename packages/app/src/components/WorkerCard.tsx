import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import type { Worker } from "@/types";
import { cn } from "@/lib/utils";

export default function WorkerCard({ worker }: { worker: Worker }) {
  return (
    <Link
      href={`/workers/${worker.id}`}
      className="flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-center gap-3">
        {worker.avatar ? (
          <img
            src={worker.avatar}
            alt={worker.name}
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold text-lg">
            {worker.name[0]}
          </div>
        )}
        <div>
          <div className="flex items-center gap-1 font-semibold text-gray-800">
            {worker.name}
            {worker.isVerified && (
              <BadgeCheck size={15} className="text-blue-500" />
            )}
          </div>
          <span className="text-xs text-gray-500">{worker.category.name}</span>
        </div>
      </div>
      {worker.bio && (
        <p className="text-sm text-gray-600 line-clamp-2">{worker.bio}</p>
      )}
    </Link>
  );
}
