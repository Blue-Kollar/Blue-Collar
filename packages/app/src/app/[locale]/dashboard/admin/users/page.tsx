'use client';

import LoadingState from '@/components/LoadingState';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useDebounce } from '@/hooks/useDebounce';
import {
  useAdminUsers,
  useSuspendUser,
  useUnsuspendUser,
  useBanUser,
  useChangeUserRole,
  useBulkSuspendUsers,
  useBulkUnsuspendUsers,
} from '@/hooks/queries';
import type { AdminUser } from '@/lib/api';
import AdminUsersFilters, { type Role } from '@/components/dashboard/admin/users/AdminUsersFilters';
import AdminUsersBulkBar from '@/components/dashboard/admin/users/AdminUsersBulkBar';
import AdminUsersTable from '@/components/dashboard/admin/users/AdminUsersTable';
import AdminUsersPagination from '@/components/dashboard/admin/users/AdminUsersPagination';

export default function AdminUsersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [roleFilter, setRoleFilter] = useState<'' | Role>('');
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'suspended'>('');

  const params: Record<string, string> = { page: String(page), limit: '20' };
  if (debouncedSearch) params.search = debouncedSearch;
  if (roleFilter) params.role = roleFilter;
  if (statusFilter) params.status = statusFilter;

  const usersQuery = useAdminUsers(params);
  const users = usersQuery.data?.data ?? [];
  const loading = usersQuery.isLoading;
  const meta = usersQuery.data?.meta ?? null;

  const suspendUser = useSuspendUser();
  const unsuspendUser = useUnsuspendUser();
  const banUser = useBanUser();
  const changeUserRole = useChangeUserRole();
  const bulkSuspendUsers = useBulkSuspendUsers();
  const bulkUnsuspendUsers = useBulkUnsuspendUsers();

  const actionLoading =
    (suspendUser.isPending && (suspendUser.variables as string)) ||
    (unsuspendUser.isPending && (unsuspendUser.variables as string)) ||
    (banUser.isPending && (banUser.variables as string)) ||
    (changeUserRole.isPending && (changeUserRole.variables as { userId: string })?.userId) ||
    null;
  const bulkLoading = bulkSuspendUsers.isPending || bulkUnsuspendUsers.isPending;

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/');
    }
  }, [user, router]);

  // Reset to page 1 whenever a filter changes.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, roleFilter, statusFilter]);

  // Clear selection whenever the underlying page of results changes.
  useEffect(() => {
    setSelected(new Set());
  }, [usersQuery.data]);

  useEffect(() => {
    if (usersQuery.isError) toast('Failed to load users', 'error');
  }, [usersQuery.isError, toast]);

  const handleSuspend = (userId: string) => {
    suspendUser.mutate(userId, {
      onSuccess: () => toast('User suspended', 'success'),
      onError: () => toast('Failed to suspend user', 'error'),
    });
  };

  const handleUnsuspend = (userId: string) => {
    unsuspendUser.mutate(userId, {
      onSuccess: () => toast('User unsuspended', 'success'),
      onError: () => toast('Failed to unsuspend user', 'error'),
    });
  };

  const handleBan = (userId: string) => {
    if (
      !confirm(
        'Are you sure you want to permanently ban this user? This will delete their account.',
      )
    )
      return;
    banUser.mutate(userId, {
      onSuccess: () => toast('User banned', 'success'),
      onError: () => toast('Failed to ban user', 'error'),
    });
  };

  const handleRoleChange = (userId: string, role: Role) => {
    changeUserRole.mutate(
      { userId, role },
      {
        onSuccess: () => toast('Role updated', 'success'),
        onError: () => toast('Failed to update role', 'error'),
      },
    );
  };

  const toggleSelected = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const selectableUsers = useMemo(() => users.filter((u) => u.role !== 'admin'), [users]);
  const allSelectableSelected =
    selectableUsers.length > 0 && selectableUsers.every((u) => selected.has(u.id));

  const toggleSelectAll = () => {
    setSelected((prev) => {
      if (allSelectableSelected) return new Set();
      return new Set(selectableUsers.map((u) => u.id));
    });
  };

  const handleBulkSuspend = () => {
    if (selected.size === 0) return;
    const count = selected.size;
    bulkSuspendUsers.mutate(Array.from(selected), {
      onSuccess: () => toast(`Suspended ${count} user(s)`, 'success'),
      onError: () => toast('Failed to bulk suspend users', 'error'),
    });
  };

  const handleBulkUnsuspend = () => {
    if (selected.size === 0) return;
    const count = selected.size;
    bulkUnsuspendUsers.mutate(Array.from(selected), {
      onSuccess: () => toast(`Unsuspended ${count} user(s)`, 'success'),
      onError: () => toast('Failed to bulk unsuspend users', 'error'),
    });
  };

  const isSuspended = (u: AdminUser) => u.deletedAt != null;

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/dashboard/admin"
          className="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">User Management</h1>
      </div>

      <AdminUsersFilters
        search={search}
        onSearchChange={setSearch}
        roleFilter={roleFilter}
        onRoleFilterChange={setRoleFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      <AdminUsersBulkBar
        selectedCount={selected.size}
        bulkLoading={bulkLoading}
        onBulkSuspend={handleBulkSuspend}
        onBulkUnsuspend={handleBulkUnsuspend}
      />

      {loading ? (
        <LoadingState variant="list" />
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-400">
          <p className="text-sm">No users match your filters</p>
        </div>
      ) : (
        <>
          <AdminUsersTable
            users={users}
            selected={selected}
            allSelectableSelected={allSelectableSelected}
            actionLoading={actionLoading}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelected={toggleSelected}
            onRoleChange={handleRoleChange}
            onSuspend={handleSuspend}
            onUnsuspend={handleUnsuspend}
            onBan={handleBan}
            isSuspended={isSuspended}
          />

          <AdminUsersPagination page={page} pages={meta?.pages ?? 0} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
