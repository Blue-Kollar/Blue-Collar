"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Tags } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/useToast";
import { getCategories } from "@/lib/api";
import type { Category } from "@/types";

export default function AdminCategoriesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCategories();
      setCategories(res.data);
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
        <div className="rounded-xl border bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b px-4 py-3 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Categories ({categories.length})</h2>
          </div>
          <div className="divide-y dark:divide-gray-800">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-3 px-4 py-3">
                {cat.icon && <span className="text-xl">{cat.icon}</span>}
                <span className="font-medium text-gray-800 dark:text-gray-200">{cat.name}</span>
              </div>
            ))}
            {categories.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
                <Tags size={40} className="opacity-30" />
                <p className="text-sm">No categories found</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
