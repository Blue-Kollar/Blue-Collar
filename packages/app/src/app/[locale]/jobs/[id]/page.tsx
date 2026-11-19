"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/hooks/useWallet";
import LoadingState from "@/components/LoadingState";
import {
  getJob, applyToJob, withdrawJobApplication, getJobApplications,
  updateJobApplicationStatus, getJobMessages, sendJobMessage, renewJob,
} from "@/lib/api/jobs";
import type { Job, JobApplication, JobMessage } from "@/types";
import JobHeader from "@/components/jobs/detail/JobHeader";
import JobTabs, { type JobTab } from "@/components/jobs/detail/JobTabs";
import JobDetailsTab from "@/components/jobs/detail/JobDetailsTab";
import JobApplicationsTab from "@/components/jobs/detail/JobApplicationsTab";
import JobMessagesTab from "@/components/jobs/detail/JobMessagesTab";

// packages/app/src/components/jobs/detail/JobHeader.tsx
"use client";

import Link from "next/link";
import { Briefcase, Clock, DollarSign, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import type { Job } from "@/types";

const STATUS_STYLE: Record<string, string> = {
  open:    "bg-green-50 text-green-600",
  filled:  "bg-blue-50 text-blue-600",
  closed:  "bg-gray-100 text-gray-500",
  expired: "bg-yellow-50 text-yellow-600",
};

export interface JobHeaderProps {
  job: Job;
  isOwner: boolean;
  renewing: boolean;
  onRenew: () => void;
}

export default function JobHeader({ job, isOwner, renewing, onRenew }: JobHeaderProps) {
  const daysLeft = job.expiresAt
    ? Math.max(0, Math.ceil((new Date(job.expiresAt).getTime() - Date.now()) / 86_400_000))
    : null;

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{job.title}</h1>
          <p className="mt-0.5 text-sm text-gray-400">
            Posted by {job.postedBy.firstName} {job.postedBy.lastName} · {job.category.name}
          </p>
        </div>
        <span className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-semibold capitalize", STATUS_STYLE[job.status] ?? "bg-gray-100 text-gray-500")}>
          {job.status}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-500">
        {job.budget != null && (
          <span className="flex items-center gap-1.5"><DollarSign size={14} /> Budget: <strong className="text-gray-700">{formatCurrency(job.budget)}</strong></span>
        )}
        {daysLeft !== null && (
          <span className="flex items-center gap-1.5"><Clock size={14} /> {daysLeft === 0 ? "Expires today" : `${daysLeft} days left`}</span>
        )}
        <span className="flex items-center gap-1.5"><Briefcase size={14} /> {job._count?.applications ?? 0} applicant{(job._count?.applications ?? 0) !== 1 ? "s" : ""}</span>
      </div>

      {job.skills.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {job.skills.map((s) => (
            <span key={s} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">{s}</span>
          ))}
        </div>
      )}

      {isOwner && (
        <div className="mt-4 flex gap-2">
          <Link href={`/jobs/${job.id}/edit`} className="rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
            Edit
          </Link>
          {(job.status === "open" || job.status === "expired") && (
            <button onClick={onRenew} disabled={renewing} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
              {renewing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Renew 30 days
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, token } = useAuth();
  const { isConnected } = useWallet();

  const [job, setJob] = useState<Job | null>(null);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [messages, setMessages] = useState<JobMessage[]>([]);
  const [myApp, setMyApp] = useState<JobApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<JobTab>("details");
  const [msgRecipient, setMsgRecipient] = useState("");
  const [renewing, setRenewing] = useState(false);

  const isOwner = user && job && job.postedBy.id === user.id;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getJob(id);
      setJob(res.data);

      if (token) {
        if (res.data.postedBy.id === user?.id) {
          const apps = await getJobApplications(id);
          setApplications(apps.data);
        }
        const msgs = await getJobMessages(id).catch(() => ({ data: [] }));
        setMessages(msgs.data);
      }
    } catch {
      // ignore — show empty state
    } finally {
      setLoading(false);
    }
  }, [id, token, user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (isOwner && applications.length > 0 && !msgRecipient) {
      setMsgRecipient(applications[0]?.worker?.id ?? "");
    }
  }, [isOwner, applications, msgRecipient]);

  const handleApply = async (coverLetter: string, proposedRate: string) => {
    if (!coverLetter.trim()) throw new Error("Cover letter is required");
    const res = await applyToJob(id, {
      workerId: user!.id,
      coverLetter,
      proposedRate: proposedRate ? Number(proposedRate) : undefined,
    });
    setMyApp(res.data);
  };

  const handleWithdraw = async () => {
    if (!myApp) return;
    try {
      const res = await withdrawJobApplication(id, myApp.workerId);
      setMyApp(res.data);
    } catch {/* ignore */}
  };

  const handleStatusUpdate = async (applicationId: string, status: "accepted" | "rejected") => {
    try {
      const res = await updateJobApplicationStatus(id, applicationId, status);
      setApplications((prev) => prev.map((a) => a.id === applicationId ? res.data : a));
      if (status === "accepted") setJob((j) => j ? { ...j, status: "filled" } : j);
    } catch {/* ignore */}
  };

  const handleSendMessage = async (body: string) => {
    if (!body.trim() || !msgRecipient) return;
    const res = await sendJobMessage(id, { recipientId: msgRecipient, body });
    setMessages((prev) => [...prev, res.data]);
  };

  const handleRenew = async () => {
    setRenewing(true);
    try {
      const res = await renewJob(id, 30);
      setJob(res.data);
    } catch {/* ignore */}
    finally { setRenewing(false); }
  };

  if (loading) {
    return <LoadingState className="py-32" />;
  }

  if (!job) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <AlertTriangle size={36} className="mx-auto mb-4 text-gray-300" />
        <p className="text-gray-500">Job not found.</p>
        <Link href="/jobs" className="mt-4 inline-block text-sm text-blue-600 hover:underline">← Back to jobs</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/jobs" className="mb-6 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={15} /> Back to jobs
      </Link>

      <JobHeader
        job={job}
        isOwner={!!isOwner}
        renewing={renewing}
        onRenew={handleRenew}
      />

      <JobTabs
        tab={tab}
        onChange={setTab}
        isOwner={!!isOwner}
        applicationCount={applications.length}
        messageCount={messages.length}
      />

      {tab === "details" && (
        <JobDetailsTab
          job={job}
          isOwner={!!isOwner}
          user={user}
          walletConnected={isConnected}
          myApp={myApp}
          onApply={handleApply}
          onWithdraw={handleWithdraw}
        />
      )}

      {tab === "applications" && isOwner && (
        <JobApplicationsTab
          applications={applications}
          onStatusUpdate={handleStatusUpdate}
          onMessage={(workerId) => { setTab("messages"); setMsgRecipient(workerId); }}
        />
      )}

      {tab === "messages" && (
        <JobMessagesTab
          messages={messages}
          user={user}
          isOwner={!!isOwner}
          applications={applications}
          recipient={msgRecipient}
          onRecipientChange={setMsgRecipient}
          onSend={handleSendMessage}
        />
      )}
    </div>
  );
}
