"use client";

import Link from "next/link";
import { Briefcase, Clock, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Job } from "@/types";

interface UrgencyStyle {
  label: string;
  color: string;
}

/** Fallback for urgency values the UI does not have a style for. */
const DEFAULT_URGENCY: UrgencyStyle = { label: "Normal", color: "bg-blue-50 text-blue-700" };

/**
 * Visible label and chip colours per urgency level. Text/background pairs are
 * all >= 4.5:1 so the chip meets WCAG 2.1 AA for small text.
 */
export const URGENCY_LABEL: Record<string, UrgencyStyle> = {
  low:    { label: "Low",    color: "bg-gray-100 text-gray-700" },
  normal: DEFAULT_URGENCY,
  urgent: { label: "Urgent", color: "bg-red-50 text-red-700" },
};

const MAX_VISIBLE_SKILLS = 4;

export default function JobCard({ job }: { job: Job }) {
  const urg = URGENCY_LABEL[job.urgency] ?? DEFAULT_URGENCY;
  const daysLeft = job.expiresAt
    ? Math.max(0, Math.ceil((new Date(job.expiresAt).getTime() - Date.now()) / 86_400_000))
    : null;

  const applicants = job._count?.applications ?? 0;
  const visibleSkills = job.skills.slice(0, MAX_VISIBLE_SKILLS);
  const hiddenSkillCount = job.skills.length - visibleSkills.length;

  const titleId = `job-${job.id}-title`;
  const skillsId = `job-${job.id}-skills`;

  return (
    <article aria-labelledby={titleId} className="h-full">
      <Link
        href={`/jobs/${job.id}`}
        className="block h-full rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id={titleId} className="truncate font-semibold text-gray-900">
              {job.title}
            </h3>
            <p className="mt-0.5 text-xs text-gray-600">
              <span className="sr-only">Posted by </span>
              {job.postedBy.firstName} {job.postedBy.lastName}
              <span aria-hidden="true"> · </span>
              <span className="sr-only">in </span>
              {job.category.name}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
              urg.color,
            )}
          >
            <span className="sr-only">Urgency: </span>
            {urg.label}
          </span>
        </div>

        <p className="mt-3 line-clamp-2 text-sm text-gray-600">{job.description}</p>

        {visibleSkills.length > 0 && (
          <>
            <h4 id={skillsId} className="sr-only">
              Skills required
            </h4>
            <ul aria-labelledby={skillsId} className="mt-3 flex flex-wrap gap-1.5">
              {visibleSkills.map((s) => (
                <li
                  key={s}
                  className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                >
                  {s}
                </li>
              ))}
              {hiddenSkillCount > 0 && (
                <li className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  <span aria-hidden="true">+{hiddenSkillCount}</span>
                  <span className="sr-only">and {hiddenSkillCount} more</span>
                </li>
              )}
            </ul>
          </>
        )}

        <div className="mt-4 flex items-center gap-4 text-xs text-gray-600">
          {job.budget != null && (
            <span className="flex items-center gap-1">
              <DollarSign size={12} aria-hidden="true" />
              <span className="sr-only">Budget: </span>
              {job.budget.toLocaleString()}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Briefcase size={12} aria-hidden="true" />
            {applicants} applicant{applicants !== 1 ? "s" : ""}
          </span>
          {daysLeft !== null && (
            <span className="flex items-center gap-1">
              <Clock size={12} aria-hidden="true" />
              {daysLeft === 0 ? "Expires today" : `${daysLeft}d left`}
            </span>
          )}
        </div>
      </Link>
    </article>
  );
}
