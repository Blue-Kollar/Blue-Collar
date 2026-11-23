'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useWallet } from '@/hooks/useWallet';
import { validateUserProfile, validatePassword, validateRequired } from '@/utils/validation';
import { useUpdateAccount, useChangePassword, useDeleteAccount } from '@/hooks/queries';
import {
  PersonalInfoSection,
  type UserProfile,
} from '@/components/settings/profile/PersonalInfoSection';
import { ChangePasswordSection } from '@/components/settings/profile/ChangePasswordSection';
import { DangerZoneSection } from '@/components/settings/profile/DangerZoneSection';
import { DeleteAccountModal } from '@/components/settings/profile/DeleteAccountModal';
import { Toast } from '@/components/settings/profile/Toast';

export default function ProfileSettingsPage() {
  const router = useRouter();
  const { user, token, isLoading, login, logout } = useAuth();
  const { address: walletAddress } = useWallet();

  const [profile, setProfile] = useState<UserProfile>({
    firstName: '',
    lastName: '',
    email: '',
  });
  const [profileErrors, setProfileErrors] = useState<Partial<UserProfile>>({});
  const [toastMessage, setToastMessage] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const updateAccount = useUpdateAccount();
  const changePassword = useChangePassword();
  const deleteAccount = useDeleteAccount();

  const profileSaving = updateAccount.isPending;
  const passwordSaving = changePassword.isPending;
  const deleting = deleteAccount.isPending;

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), 3500);
  };

  useEffect(() => {
    if (!isLoading && !user) router.replace('/auth/login');
  }, [isLoading, router, user]);

  useEffect(() => {
    if (!user) return;
    setProfile({
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      email: user.email ?? '',
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
        showToast('Profile saved!');
      },
      onError: (err) => showToast(err instanceof Error ? err.message : 'Failed to save profile.'),
    });
  };

  const handlePasswordChange = async () => {
    const currErr = validateRequired(currentPassword, 'Current password');
    if (currErr) {
      setPasswordError(currErr);
      return;
    }
    const newPwdErr = validatePassword(newPassword, 8, true);
    if (newPwdErr) {
      setPasswordError(newPwdErr);
      return;
    }

    setPasswordError('');
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrentPassword('');
          setNewPassword('');
          showToast('Password updated!');
        },
        onError: (err) => {
          const message = err instanceof Error ? err.message : 'Failed to update password.';
          if (message === 'Current password is incorrect') {
            setPasswordError(message);
          } else {
            showToast(message);
          }
        },
      },
    );
  };

  const handleDeleteAccount = () => {
    if (deleteConfirm !== 'DELETE') return;

    deleteAccount.mutate(undefined, {
      onSuccess: () => {
        logout();
        router.replace('/');
      },
      onError: (err) => showToast(err instanceof Error ? err.message : 'Failed to delete account.'),
      onSettled: () => {
        setShowDeleteModal(false);
        setDeleteConfirm('');
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

      {walletAddress && (
        <p className="text-sm text-gray-600">
          Connected wallet: <span className="font-mono">{walletAddress}</span>
        </p>
      )}

      <PersonalInfoSection
        profile={profile}
        errors={profileErrors}
        saving={profileSaving}
        onChange={(field, value) => setProfile((current) => ({ ...current, [field]: value }))}
        onSave={handleProfileSave}
      />

      <ChangePasswordSection
        currentPassword={currentPassword}
        newPassword={newPassword}
        error={passwordError}
        saving={passwordSaving}
        onCurrentPasswordChange={setCurrentPassword}
        onNewPasswordChange={setNewPassword}
        onSubmit={handlePasswordChange}
      />

      <DangerZoneSection onDeleteClick={() => setShowDeleteModal(true)} />

      <DeleteAccountModal
        open={showDeleteModal}
        confirmValue={deleteConfirm}
        deleting={deleting}
        onConfirmValueChange={setDeleteConfirm}
        onConfirm={handleDeleteAccount}
        onCancel={() => {
          setShowDeleteModal(false);
          setDeleteConfirm('');
        }}
      />

      <Toast message={toastMessage} />
    </div>
  );
}
