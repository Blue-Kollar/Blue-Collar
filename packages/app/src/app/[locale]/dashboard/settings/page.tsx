"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, User, Lock, Bell, Trash2, AlertTriangle, X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";

// ── Schemas ───────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().optional(),
  bio: z.string().max(500, "Bio must be 500 characters or less").optional(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ icon: Icon, title, children }: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-white dark:bg-gray-900 dark:border-gray-800 p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-2.5">
        <Icon size={18} className="text-blue-600" />
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({ label, error, children }: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

const inputCls =
  "w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100";

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, isLoading: authLoading, login, logout } = useAuth();
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Notification prefs stored locally (no backend field yet)
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth/login");
  }, [user, authLoading, router]);

  // ── Profile form ────────────────────────────────────────────────────────────
  const {
    register: regProfile,
    handleSubmit: handleProfile,
    reset: resetProfile,
    formState: { errors: profileErrors, isSubmitting: profileSubmitting },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { firstName: "", lastName: "", phone: "", bio: "" },
  });

  useEffect(() => {
    if (user) {
      resetProfile({
        firstName: user.firstName,
        lastName: user.lastName,
        phone: (user as any).phone ?? "",
        bio: (user as any).bio ?? "",
      });
    }
  }, [user, resetProfile]);

  const onProfileSubmit = async (data: ProfileForm) => {
    try {
      const res = await api.updateProfile(data);
      // Refresh auth user with updated data
      const updated = (res as any).data;
      if (updated) {
        const token = localStorage.getItem("bc_token") ?? "";
        login({ ...user!, ...updated }, token);
      }
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    }
  };

  // ── Password form ───────────────────────────────────────────────────────────
  const {
    register: regPwd,
    handleSubmit: handlePwd,
    reset: resetPwd,
    formState: { errors: pwdErrors, isSubmitting: pwdSubmitting },
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  const onPasswordSubmit = async (data: PasswordForm) => {
    try {
      await api.changePassword(data.currentPassword, data.newPassword);
      toast.success("Password changed");
      resetPwd();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password");
    }
  };

  // ── Delete account ──────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteAccount();
      logout();
      router.replace("/");
      toast.success("Account deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete account");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

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
        {/* Profile info */}
        <Section icon={User} title="Profile Information">
          <form onSubmit={handleProfile(onProfileSubmit)} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="First name" error={profileErrors.firstName?.message}>
                <input {...regProfile("firstName")} className={inputCls} />
              </Field>
              <Field label="Last name" error={profileErrors.lastName?.message}>
                <input {...regProfile("lastName")} className={inputCls} />
              </Field>
            </div>
            <Field label="Phone" error={profileErrors.phone?.message}>
              <input {...regProfile("phone")} type="tel" placeholder="+1 555 000 0000" className={inputCls} />
            </Field>
            <Field label="Bio" error={profileErrors.bio?.message}>
              <textarea {...regProfile("bio")} rows={3} placeholder="Tell us a bit about yourself…" className={inputCls} />
            </Field>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={profileSubmitting}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {profileSubmitting && <Loader2 size={14} className="animate-spin" />}
                Save changes
              </button>
            </div>
          </form>
        </Section>

        {/* Password */}
        <Section icon={Lock} title="Change Password">
          <form onSubmit={handlePwd(onPasswordSubmit)} className="flex flex-col gap-4">
            <Field label="Current password" error={pwdErrors.currentPassword?.message}>
              <input {...regPwd("currentPassword")} type="password" autoComplete="current-password" className={inputCls} />
            </Field>
            <Field label="New password" error={pwdErrors.newPassword?.message}>
              <input {...regPwd("newPassword")} type="password" autoComplete="new-password" className={inputCls} />
            </Field>
            <Field label="Confirm new password" error={pwdErrors.confirmPassword?.message}>
              <input {...regPwd("confirmPassword")} type="password" autoComplete="new-password" className={inputCls} />
            </Field>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={pwdSubmitting}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {pwdSubmitting && <Loader2 size={14} className="animate-spin" />}
                Update password
              </button>
            </div>
          </form>
        </Section>

        {/* Notifications */}
        <Section icon={Bell} title="Notification Preferences">
          <div className="flex flex-col gap-4">
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Email notifications</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Receive updates and alerts via email</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={emailNotifs}
                onClick={() => setEmailNotifs((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${emailNotifs ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${emailNotifs ? "translate-x-5" : "translate-x-0"}`}
                />
              </button>
            </label>

            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Push notifications</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Receive push notifications in your browser</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={pushNotifs}
                onClick={() => setPushNotifs((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${pushNotifs ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${pushNotifs ? "translate-x-5" : "translate-x-0"}`}
                />
              </button>
            </label>
          </div>
        </Section>

        {/* Danger zone */}
        <Section icon={Trash2} title="Danger Zone">
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            Permanently delete your account and all associated data. This cannot be undone.
          </p>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950 transition-colors"
          >
            Delete my account
          </button>
        </Section>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 dark:bg-red-950">
                  <AlertTriangle size={18} className="text-red-500" />
                </div>
                <div>
                  <Dialog.Title className="font-semibold text-gray-900 dark:text-gray-100">
                    Delete account?
                  </Dialog.Title>
                  <Dialog.Description className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                    All your data will be permanently removed. This action cannot be undone.
                  </Dialog.Description>
                </div>
              </div>
              <Dialog.Close className="rounded-md p-1 text-gray-400 hover:text-gray-600">
                <X size={16} />
              </Dialog.Close>
            </div>
            <div className="mt-5 flex gap-3">
              <Dialog.Close className="flex-1 rounded-lg border py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors">
                Cancel
              </Dialog.Close>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                {deleting && <Loader2 size={14} className="animate-spin" />}
                Delete account
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
