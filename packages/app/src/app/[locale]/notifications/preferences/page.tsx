"use client";

import { useEffect, useState } from "react";
import { Bell, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useLocale } from "next-intl";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/api";
import {
  DEFAULT_PREFS,
  NotificationPreferencesList,
} from "@/components/notifications/preferences/NotificationPreferencesList";
import { SavePreferencesButton } from "@/components/notifications/preferences/SavePreferencesButton";

export default function NotificationPreferencesPage() {
  const locale = useLocale();
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getNotificationPreferences()
      .then((res) => setPrefs({ ...DEFAULT_PREFS, ...res.data }))
      .catch(() => {});
  }, []);

  const toggle = (type: keyof NotificationPreferences) => {
    setPrefs((p) => ({ ...p, [type]: !p[type] }));
    setSaved(false);
  };

  const save = async () => {
    await updateNotificationPreferences(prefs);
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

      <NotificationPreferencesList prefs={prefs} onToggle={toggle} />

      <SavePreferencesButton saved={saved} onSave={save} />
    </div>
  );
}