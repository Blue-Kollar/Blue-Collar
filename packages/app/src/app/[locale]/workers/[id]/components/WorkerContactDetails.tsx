import { Mail, MapPin, Phone } from "lucide-react";

import type { Worker } from "@/types";

export function WorkerContactDetails({ worker }: { worker: Worker }) {
  if (!worker.location && !worker.email && !worker.phone) return null;
  return (
    <div className="mt-6 flex flex-col gap-2.5">
      {worker.location && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <MapPin size={15} className="shrink-0" />
          {worker.location}
        </div>
      )}
      {worker.email && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Mail size={15} className="shrink-0" />
          <a href={`mailto:${worker.email}`} className="hover:text-blue-600 transition-colors">
            {worker.email}
          </a>
        </div>
      )}
      {worker.phone && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Phone size={15} className="shrink-0" />
          <a href={`tel:${worker.phone}`} className="hover:text-blue-600 transition-colors">
            {worker.phone}
          </a>
        </div>
      )}
    </div>
  );
}
