"use client";

import { useState } from "react";
import { Bell, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import type { NotificationType } from "@/context/NotificationContext";

const PREFS_KEY = "bc_notification_prefs";

const NOTIFICATION_TYPES: { type: NotificationType; label: string; description: string }[] = [
  { type: "tip", label: "Tips", description: "When someone sends you a Stellar tip" },
  { type: "review", label: "Reviews", description: "When a new review is posted on your profile" },
  { type: "contact", label: "Contact requests", description: "When someone sends you a contact request" },
  { type: "system", label: "System", description: "Platform updates and announcements" },
];

function loadPrefs(): Record<NotificationType, boolean> {
  if (typeof window === "undefined")
    return { tip: true, review: true, contact: true, system: true };
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null") ?? {
      tip: true, review: true, contact: true, system: true,
    };
  } catch {
    return { tip: true, review: true, contact: true, system: true };
  }
}

export default function NotificationPreferencesPage() {
  const locale = useLocale();
  const [prefs, setPrefs] = useState<Record<NotificationType, boolean>>(loadPrefs);
  const [saved, setSaved] = useState(false);

  const toggle = (type: NotificationType) => {
    setPrefs((p) => ({ ...p, [type]: !p[type] }));
    setSaved(false);
  };

  const save = () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Link
        href={`/${locale}/workers`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors"
      >
        <ArrowLeft size={15} />
        Back
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
          <Bell size={20} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Notification Preferences</h1>
          <p className="text-sm text-gray-500">Choose which notifications you receive</p>
        </div>
      </div>

      <div className="rounded-xl border bg-white shadow-sm divide-y">
        {NOTIFICATION_TYPES.map(({ type, label, description }) => (
          <div key={type} className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm font-medium text-gray-800">{label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{description}</p>
            </div>
            <button
              role="switch"
              aria-checked={prefs[type]}
              onClick={() => toggle(type)}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                prefs[type] ? "bg-blue-600" : "bg-gray-200"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                  prefs[type] ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={save}
        className="mt-6 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
      >
        {saved ? "Saved!" : "Save preferences"}
      </button>
    </div>
  );
}
