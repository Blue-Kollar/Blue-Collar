"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/useToast";
import { apiClient } from "@/lib/apiClient";
import type { Category } from "@/types";
import { CategoryList } from "@/components/dashboard/admin/categories/CategoryList";

export default function AdminCategoriesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.getCategories();
      setCategories(res.data ?? []);
    } catch {
      toast("Failed to load categories", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user && user.role !== "admin") {
      router.push("/");
      return;
    }
    fetchCategories();
  }, [user, router, fetchCategories]);

  if (!user || user.role !== "admin") return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/dashboard/admin"
          className="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Categories</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        <CategoryList categories={categories} />
      )}
    </div>
  );
}
