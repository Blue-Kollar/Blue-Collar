"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ProfileSection } from "@/components/dashboard/settings/ProfileSection";
import { PasswordSection } from "@/components/dashboard/settings/PasswordSection";
import { NotificationSection } from "@/components/dashboard/settings/NotificationSection";
import { DangerZoneSection } from "@/components/dashboard/settings/DangerZoneSection";

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth/login");
  }, [user, authLoading, router]);

  if (authLoading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-8 text-2xl font-bold text-gray-900 dark:text-gray-100">Account Settings</h1>

      <div className="flex flex-col gap-6">
        <ProfileSection />
        <PasswordSection />
        <NotificationSection />
        <DangerZoneSection open={deleteOpen} onOpenChange={setDeleteOpen} />
      </div>
    </div>
  );
}
