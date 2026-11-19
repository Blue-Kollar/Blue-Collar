"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/hooks/useWallet";
import { getCategories } from "@/lib/api";
import { createJob } from "@/lib/api/jobs";
import type { Category } from "@/types";
import { JobBasicsFields } from "@/components/jobs/new/JobBasicsFields";
import { JobBudgetFields } from "@/components/jobs/new/JobBudgetFields";
import { JobSkillsField } from "@/components/jobs/new/JobSkillsField";
import { JobSubmitButton } from "@/components/jobs/new/JobSubmitButton";

export default function NewJobPage() {
  const { user } = useAuth();
  const { isConnected } = useWallet();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [budget, setBudget] = useState("");
  const [urgency, setUrgency] = useState<"low" | "normal" | "urgent">("normal");
  const [expiresAt, setExpiresAt] = useState("");
  const [escrowAmount, setEscrowAmount] = useState("");
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState<string[]>([]);

  useEffect(() => {
    if (!user) { router.replace("/auth/login"); return; }
    getCategories().then((r) => setCategories(r.data ?? [])).catch(() => {});
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!title.trim() || !description.trim() || !categoryId) {
      setError("Title, description, and category are required.");
      return;
    }
    if (!isConnected) {
      setError("Connect your wallet to post a job.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await createJob({
        title: title.trim(),
        description: description.trim(),
        categoryId,
        urgency,
        skills,
        budget: budget ? Number(budget) : undefined,
        escrowAmount: escrowAmount ? Number(escrowAmount) : undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      });
      router.push(`/jobs/${res.data.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create job");
    } finally {
      setSubmitting(false);
    }
  };

  // Default expiry = 30 days from now for the date input min
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split("T")[0];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/jobs" className="mb-6 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={15} /> Back to jobs
      </Link>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="mb-6 text-xl font-bold text-gray-900">Post a Job</h1>

        {error && (
          <div className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <JobBasicsFields
            title={title}
            onTitleChange={setTitle}
            description={description}
            onDescriptionChange={setDescription}
            categoryId={categoryId}
            onCategoryIdChange={setCategoryId}
            categories={categories}
            urgency={urgency}
            onUrgencyChange={setUrgency}
          />

          <JobBudgetFields
            budget={budget}
            onBudgetChange={setBudget}
            escrowAmount={escrowAmount}
            onEscrowAmountChange={setEscrowAmount}
            expiresAt={expiresAt}
            onExpiresAtChange={setExpiresAt}
            minDateStr={minDateStr}
          />

          <JobSkillsField
            skillInput={skillInput}
            onSkillInputChange={setSkillInput}
            skills={skills}
            onSkillsChange={setSkills}
          />

          <JobSubmitButton submitting={submitting} />
        </form>
      </div>
    </div>
  );
}
