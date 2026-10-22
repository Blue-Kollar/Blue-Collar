"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import Image from "next/image";
import { X, BadgeCheck, MapPin, Star } from "lucide-react";
import { useCompare } from "@/context/CompareContext";
import type { Worker } from "@bluecollar/types";
import { useTranslations } from "next-intl";

function Cell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-sm text-gray-700 border-b ${className}`}>{children}</td>;
}

function Rating({ value }: { value?: number | null }) {
  if (value == null) return <span className="text-gray-400">&mdash;</span>;
  return (
    <span className="flex items-center gap-1">
      <Star size={13} className="fill-yellow-400 text-yellow-400" aria-hidden="true" />
      {value.toFixed(1)}
    </span>
  );
}

export default function CompareDrawer() {
  const t = useTranslations("componentText");
  const workerCardT = useTranslations("workerCard");
  const { selected, remove, clear } = useCompare();
  const [open, setOpen] = useState(false);

  if (selected.length === 0) return null;

  const rows: { label: string; render: (w: Worker) => React.ReactNode }[] = [
    { label: t("category"), render: (w) => w.category.name },
    { label: t("rating"), render: (w) => <Rating value={w.averageRating} /> },
    { label: t("reviews"), render: (w) => w.reviewCount ?? "—" },
    { label: t("location"), render: (w) => w.location ? <span className="flex items-center gap-1"><MapPin size={12} aria-hidden="true" />{w.location}</span> : "—" },
    { label: t("verified"), render: (w) => w.isVerified ? <BadgeCheck size={16} className="text-blue-500" aria-label={t("verified")} /> : "—" },
    { label: t("contact"), render: (w) => w.email ?? w.phone ?? "—" },
  ];

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t shadow-lg px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          {selected.map((w) => (
            <span key={w.id} className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
              {w.name}
              <button onClick={() => remove(w.id)} aria-label={t("removeFromComparison", { name: w.name })} className="rounded-full p-0.5 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                <X size={13} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
        <button onClick={clear} className="text-xs text-gray-500 hover:text-gray-700 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-2 py-1">
          {t("clearAll")}
        </button>
        <Dialog.Trigger asChild>
          <button className="shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
            {t("compareWorkers", { count: selected.length })}
          </button>
        </Dialog.Trigger>
      </div>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-4xl max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-2xl bg-white shadow-xl outline-none">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              {t("compareWorkersTitle")}
            </Dialog.Title>
            <Dialog.Close aria-label={t("closeComparison")} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <X size={20} aria-hidden="true" />
            </Dialog.Close>
          </div>

          <div className="overflow-x-auto p-4">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-28 border-b" scope="col" />
                  {selected.map((w) => (
                    <th key={w.id} className="px-4 py-3 border-b" scope="col">
                      <div className="flex flex-col items-center gap-1">
                        {w.avatar ? (
                          <Image src={w.avatar} alt="" width={48} height={48} sizes="48px" className="h-12 w-12 rounded-full object-cover ring-2 ring-blue-100" aria-hidden="true" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold" aria-hidden="true">
                            {w.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm font-semibold text-gray-800">{w.name}</span>
                        <button onClick={() => { remove(w.id); }} aria-label={t("removeFromComparison", { name: w.name })} className="text-xs text-gray-400 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1">
                          {t("remove")}
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ label, render }) => (
                  <tr key={label}>
                    <td className="px-4 py-3 text-xs font-medium text-gray-500 uppercase border-b">{label}</td>
                    {selected.map((w) => <Cell key={w.id}>{render(w)}</Cell>)}
                  </tr>
                ))}
                <tr>
                  <td className="px-4 py-3 border-b" />
                  {selected.map((w) => (
                    <td key={w.id} className="px-4 py-3 border-b">
                      <a
                        href={`/workers/${w.id}`}
                        className="block rounded-md bg-blue-600 py-1.5 text-center text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                      >
                        {workerCardT("viewProfile")}
                      </a>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
