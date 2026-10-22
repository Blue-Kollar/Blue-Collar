"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { useEmailNotificationPrefs, useUpdateEmailNotificationPrefs } from "@/hooks/queries";
import type { EmailNotificationPrefs as NotificationPrefs } from "@/lib/api";

const DEFAULT_PREFS: NotificationPrefs = {
  newWorkerInArea: true,
  workerStatusChange: true,
  reviewReplies: true,
  platformAnnouncements: true,
};

const LABELS: Record<keyof NotificationPrefs, string> = {
  newWorkerInArea: "New worker in my area",
  workerStatusChange: "Worker status change",
  reviewReplies: "Review replies",
  platformAnnouncements: "Platform announcements",
};

export default function NotificationPreferencesPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const prefsQuery = useEmailNotificationPrefs();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [toast, setToast] = useState("");

  const updatePrefs = useUpdateEmailNotificationPrefs();
  const saving = updatePrefs.isPending;

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 3500);
  };

  useEffect(() => {
    if (!isLoading && !user) router.replace("/auth/login");
  }, [isLoading, router, user]);

  useEffect(() => {
    if (!prefsQuery.data) return;
    const data = "data" in prefsQuery.data ? prefsQuery.data.data : prefsQuery.data;
    if (data) setPrefs({ ...DEFAULT_PREFS, ...data });
  }, [prefsQuery.data]);

  const toggle = (key: keyof NotificationPrefs) => {
    setPrefs((current) => ({ ...current, [key]: !current[key] }));
  };

  const unsubscribeAll = () => {
    setPrefs({
      newWorkerInArea: false,
      workerStatusChange: false,
      reviewReplies: false,
      platformAnnouncements: false,
    });
  };

  const handleSave = () => {
    updatePrefs.mutate(prefs, {
      onSuccess: () => showToast("Preferences saved!"),
      onError: () => showToast("Failed to save preferences."),
    });
  };

  const allOff = Object.values(prefs).every((value) => !value);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-8 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notification Preferences</h1>
        <p className="mt-1 text-sm text-gray-500">
          Choose which email notifications you would like to receive.
        </p>
      </div>

      <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
        {(Object.keys(prefs) as (keyof NotificationPrefs)[]).map((key) => (
          <div key={key} className="flex items-center justify-between gap-4 px-5 py-4">
            <span className="text-sm font-medium text-gray-800">{LABELS[key]}</span>
            <button
              type="button"
              role="switch"
              aria-checked={prefs[key]}
              aria-label={`Toggle ${LABELS[key]}`}
              onClick={() => toggle(key)}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500",
                prefs[key] ? "bg-blue-600" : "bg-gray-300"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
                  prefs[key] ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save preferences"}
        </button>
        <button
          type="button"
          onClick={unsubscribeAll}
          disabled={allOff}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          Unsubscribe from all
        </button>
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg -translate-x-1/2"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
