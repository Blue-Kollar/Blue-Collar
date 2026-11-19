"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useEmailNotificationPrefs, useUpdateEmailNotificationPrefs } from "@/hooks/queries";
import type { EmailNotificationPrefs as NotificationPrefs } from "@/lib/api";
import {
  DEFAULT_PREFS,
  NotificationPrefsList,
  NotificationPrefsActions,
  NotificationToast,
} from "@/components/settings/notifications";

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

      <NotificationPrefsList prefs={prefs} onToggle={toggle} />

      <NotificationPrefsActions
        saving={saving}
        allOff={allOff}
        onSave={handleSave}
        onUnsubscribeAll={unsubscribeAll}
      />

      <NotificationToast message={toast} />
    </div>
  );
}
