"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, X, Plus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getCategories } from "@/lib/api";
import { createJob } from "@/lib/api/jobs";
import type { Category } from "@/types";

export default function NewJobPage() {
  const { user } = useAuth();
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
    getCategories().then((r) => setCategories(r.data)).catch(() => {});
  }, [user, router]);

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !skills.includes(s) && skills.length < 20) {
      setSkills((prev) => [...prev, s]);
      setSkillInput("");
    }
  };

  const removeSkill = (s: string) => setSkills((prev) => prev.filter((x) => x !== s));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!title.trim() || !description.trim() || !categoryId) {
      setError("Title, description, and category are required.");
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
          {/* Title */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Job title <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Experienced Plumber Needed"
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={120}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Description <span className="text-red-500">*</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the work, requirements, location, timeline…"
              rows={6}
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              maxLength={5000}
              required
            />
            <p className="mt-1 text-xs text-gray-400 text-right">{description.length}/5000</p>
          </div>

          {/* Category + Urgency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Category <span className="text-red-500">*</span></label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Urgency</label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as typeof urgency)}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">⚪ Low</option>
                <option value="normal">🔵 Normal</option>
                <option value="urgent">🔴 Urgent</option>
              </select>
            </div>
          </div>

          {/* Budget + Escrow */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Budget (USD)</label>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="e.g. 200"
                min={0}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Escrow amount (XLM)</label>
              <input
                type="number"
                value={escrowAmount}
                onChange={(e) => setEscrowAmount(e.target.value)}
                placeholder="Optional"
                min={0}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Expires at */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Expires on</label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              min={minDateStr}
              className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">Leave blank for no expiry</p>
          </div>

          {/* Skills */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Required skills</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                placeholder="e.g. plumbing, welding…"
                className="flex-1 rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={60}
              />
              <button
                type="button"
                onClick={addSkill}
                className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                <Plus size={14} /> Add
              </button>
            </div>
            {skills.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {skills.map((s) => (
                  <span key={s} className="flex items-center gap-1 rounded-full bg-gray-100 pl-2.5 pr-1.5 py-0.5 text-xs text-gray-700">
                    {s}
                    <button type="button" onClick={() => removeSkill(s)} className="text-gray-400 hover:text-gray-600">
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {submitting && <Loader2 size={15} className="animate-spin" />}
            Post Job
          </button>
        </form>
      </div>
    </div>
  );
}
