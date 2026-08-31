"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { validateUserProfile, validatePassword, validateRequired } from "@/utils/validation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
}

export default function ProfileSettingsPage() {
  const router = useRouter();
  const { user, token, isLoading, login, logout } = useAuth();

  const [profile, setProfile] = useState<UserProfile>({
    firstName: "",
    lastName: "",
    email: "",
  });
  const [profileErrors, setProfileErrors] = useState<Partial<UserProfile>>({});
  const [toastMessage, setToastMessage] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const updateAccount = useUpdateAccount();
  const changePassword = useChangePassword();
  const deleteAccount = useDeleteAccount();

  const profileSaving = updateAccount.isPending;
  const passwordSaving = changePassword.isPending;
  const deleting = deleteAccount.isPending;

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(""), 3500);
  };

  useEffect(() => {
    if (!isLoading && !user) router.replace("/auth/login");
  }, [isLoading, router, user]);

  useEffect(() => {
    if (!user) return;
    setProfile({
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      email: user.email ?? "",
    });
  }, [user]);

  const validateProfile = () => {
    const errors = validateUserProfile(profile);
    setProfileErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleProfileSave = () => {
    if (!validateProfile()) return;

    updateAccount.mutate(profile, {
      onSuccess: () => {
        if (user && token) login({ ...user, ...profile }, token);
        showToast("Profile saved!");
      },
      onError: (err) => showToast(err instanceof Error ? err.message : "Failed to save profile."),
    });
  };

  const handlePasswordChange = async () => {
    const currErr = validateRequired(currentPassword, "Current password");
    if (currErr) {
      setPasswordError(currErr);
      return;
    }
    const newPwdErr = validatePassword(newPassword, 8, true);
    if (newPwdErr) {
      setPasswordError(newPwdErr);
      return;
    }

    setPasswordError("");
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrentPassword("");
          setNewPassword("");
          showToast("Password updated!");
        },
        onError: (err) => {
          const message = err instanceof Error ? err.message : "Failed to update password.";
          if (message === "Current password is incorrect") {
            setPasswordError(message);
          } else {
            showToast(message);
          }
        },
      }
    );
  };

  const handleDeleteAccount = () => {
    if (deleteConfirm !== "DELETE") return;

    deleteAccount.mutate(undefined, {
      onSuccess: () => {
        logout();
        router.replace("/");
      },
      onError: (err) => showToast(err instanceof Error ? err.message : "Failed to delete account."),
      onSettled: () => {
        setShowDeleteModal(false);
        setDeleteConfirm("");
      },
    });
  };

  if (isLoading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-10 px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Personal Information</h2>
        {(["firstName", "lastName", "email"] as (keyof UserProfile)[]).map((field) => (
          <div key={field}>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {field === "firstName" ? "First name" : field === "lastName" ? "Last name" : "Email"}
            </label>
            <input
              type={field === "email" ? "email" : "text"}
              value={profile[field]}
              onChange={(event) =>
                setProfile((current) => ({ ...current, [field]: event.target.value }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {profileErrors[field] && (
              <p className="mt-1 text-xs text-red-600">{profileErrors[field]}</p>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={handleProfileSave}
          disabled={profileSaving}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {profileSaving ? "Saving..." : "Save changes"}
        </button>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Change Password</h2>
        <input
          type="password"
          placeholder="Current password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          type="password"
          placeholder="New password (min 8 chars)"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        {passwordError && <p className="text-xs text-red-600">{passwordError}</p>}
        <button
          type="button"
          onClick={handlePasswordChange}
          disabled={passwordSaving}
          className="rounded-lg bg-gray-800 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-900 disabled:opacity-50"
        >
          {passwordSaving ? "Updating..." : "Update password"}
        </button>
      </section>

      <section className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-5">
        <h2 className="text-lg font-semibold text-red-700">Danger Zone</h2>
        <p className="text-sm text-red-600">Permanently delete your account and all data.</p>
        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="rounded-lg border border-red-500 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
        >
          Delete account
        </button>
      </section>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Delete your account?</h3>
            <p className="text-sm text-gray-600">
              Type <strong>DELETE</strong> to confirm. This cannot be undone.
            </p>
            <input
              value={deleteConfirm}
              onChange={(event) => setDeleteConfirm(event.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="DELETE"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== "DELETE" || deleting}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
              >
                {deleting ? "Deleting..." : "Confirm delete"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirm("");
                }}
                className="flex-1 rounded-lg border py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg -translate-x-1/2"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
