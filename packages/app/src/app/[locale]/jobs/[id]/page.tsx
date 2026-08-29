"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Briefcase, Clock, DollarSign, Loader2,
  Send, CheckCircle, XCircle, AlertTriangle, MessageSquare, RefreshCw,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import LoadingState from "@/components/LoadingState";
import {
  getJob, applyToJob, withdrawJobApplication, getJobApplications,
  updateJobApplicationStatus, getJobMessages, sendJobMessage, renewJob,
  getMyApplications,
} from "@/lib/api/jobs";
import type { Job, JobApplication, JobMessage } from "@/types";

const STATUS_STYLE: Record<string, string> = {
  open:    "bg-green-50 text-green-600",
  filled:  "bg-blue-50 text-blue-600",
  closed:  "bg-gray-100 text-gray-500",
  expired: "bg-yellow-50 text-yellow-600",
};

const APP_STATUS_STYLE: Record<string, string> = {
  pending:   "bg-yellow-50 text-yellow-600",
  accepted:  "bg-green-50 text-green-600",
  rejected:  "bg-red-50 text-red-600",
  withdrawn: "bg-gray-100 text-gray-400",
};

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, token } = useAuth();
  const router = useRouter();

  const [job, setJob] = useState<Job | null>(null);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [messages, setMessages] = useState<JobMessage[]>([]);
  const [myApp, setMyApp] = useState<JobApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"details" | "applications" | "messages">("details");

  // Apply form
  const [coverLetter, setCoverLetter] = useState("");
  const [proposedRate, setProposedRate] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState("");

  // Message form
  const [msgBody, setMsgBody] = useState("");
  const [msgRecipient, setMsgRecipient] = useState("");
  const [sending, setSending] = useState(false);

  // Renew
  const [renewing, setRenewing] = useState(false);

  const isOwner = user && job && job.postedBy.id === user.id;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getJob(id);
      setJob(res.data);

      if (token) {
        // Poster loads applications; workers check their own application
        if (res.data.postedBy.id === user?.id) {
          const apps = await getJobApplications(id);
          setApplications(apps.data);
        } else if (user) {
          // Try to find existing application by this worker
          // We'd need a workerId — skip for now; handled via apply success state
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

  // Set default message recipient when poster views and there are applicants
  useEffect(() => {
    if (isOwner && applications.length > 0 && !msgRecipient) {
      setMsgRecipient(applications[0]?.worker?.id ?? "");
    }
  }, [isOwner, applications, msgRecipient]);

  const handleApply = async () => {
    if (!coverLetter.trim()) { setApplyError("Cover letter is required"); return; }
    setApplying(true);
    setApplyError("");
    try {
      // Workers need their worker profile id — for now use user id as placeholder
      // In a real flow the user selects which worker profile to apply with
      const workerRes = await applyToJob(id, { workerId: user!.id, coverLetter, proposedRate: proposedRate ? Number(proposedRate) : undefined });
      setMyApp(workerRes.data);
      setCoverLetter("");
      setProposedRate("");
    } catch (e: unknown) {
      setApplyError(e instanceof Error ? e.message : "Failed to apply");
    } finally {
      setApplying(false);
    }
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

  const handleSendMessage = async () => {
    if (!msgBody.trim() || !msgRecipient) return;
    setSending(true);
    try {
      const res = await sendJobMessage(id, { recipientId: msgRecipient, body: msgBody });
      setMessages((prev) => [...prev, res.data]);
      setMsgBody("");
    } catch {/* ignore */}
    finally { setSending(false); }
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

  const daysLeft = job.expiresAt
    ? Math.max(0, Math.ceil((new Date(job.expiresAt).getTime() - Date.now()) / 86_400_000))
    : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/jobs" className="mb-6 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={15} /> Back to jobs
      </Link>

      {/* Header */}
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
            <span className="flex items-center gap-1.5"><DollarSign size={14} /> Budget: <strong className="text-gray-700">${job.budget.toLocaleString()}</strong></span>
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

        {/* Owner actions */}
        {isOwner && (
          <div className="mt-4 flex gap-2">
            <Link href={`/jobs/${job.id}/edit`} className="rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
              Edit
            </Link>
            {(job.status === "open" || job.status === "expired") && (
              <button onClick={handleRenew} disabled={renewing} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                {renewing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                Renew 30 days
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 rounded-lg bg-gray-100 p-1">
        {(["details", ...(isOwner ? ["applications"] : []), "messages"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as typeof tab)}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium capitalize transition-colors",
              tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700",
            )}
          >
            {t === "applications" ? `Applications (${applications.length})` : t === "messages" ? `Messages (${messages.length})` : t}
          </button>
        ))}
      </div>

      {/* Details tab */}
      {tab === "details" && (
        <div className="mt-6 space-y-6">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-3 font-semibold text-gray-900">Description</h2>
            <p className="whitespace-pre-wrap text-sm text-gray-700">{job.description}</p>
          </div>

          {/* Apply box — non-owners on open jobs */}
          {!isOwner && user && job.status === "open" && (
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              {myApp ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800">Your application</p>
                    <span className={cn("mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", APP_STATUS_STYLE[myApp.status])}>
                      {myApp.status}
                    </span>
                  </div>
                  {myApp.status === "pending" && (
                    <button onClick={handleWithdraw} className="rounded-lg border px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                      Withdraw
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <h2 className="mb-4 font-semibold text-gray-900">Apply for this job</h2>
                  {applyError && <p className="mb-3 text-sm text-red-600">{applyError}</p>}
                  <textarea
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    placeholder="Tell the poster why you're the right fit…"
                    rows={4}
                    className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <div className="mt-3 flex gap-3">
                    <input
                      type="number"
                      value={proposedRate}
                      onChange={(e) => setProposedRate(e.target.value)}
                      placeholder="Proposed rate (optional)"
                      className="w-48 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={handleApply}
                      disabled={applying}
                      className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
                    >
                      {applying && <Loader2 size={14} className="animate-spin" />}
                      Apply
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {!user && job.status === "open" && (
            <div className="rounded-xl border bg-blue-50 p-5 text-center text-sm text-blue-700">
              <Link href="/auth/login" className="font-medium underline">Sign in</Link> to apply for this job.
            </div>
          )}
        </div>
      )}

      {/* Applications tab — owner only */}
      {tab === "applications" && isOwner && (
        <div className="mt-6 space-y-3">
          {applications.length === 0 ? (
            <div className="rounded-xl border bg-white py-16 text-center text-sm text-gray-400">No applications yet</div>
          ) : (
            applications.map((app) => (
              <div key={app.id} className="rounded-xl border bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-800">{app.worker?.name ?? "Worker"}</p>
                    {app.worker?.category && <p className="text-xs text-gray-400">{app.worker.category.name}</p>}
                    {app.proposedRate != null && <p className="mt-1 text-xs text-gray-500">Proposed rate: <strong>${app.proposedRate.toLocaleString()}</strong></p>}
                  </div>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", APP_STATUS_STYLE[app.status])}>
                    {app.status}
                  </span>
                </div>
                {app.coverLetter && (
                  <p className="mt-3 text-sm text-gray-600 line-clamp-3">{app.coverLetter}</p>
                )}
                {app.status === "pending" && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => handleStatusUpdate(app.id, "accepted")} className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700">
                      <CheckCircle size={13} /> Accept
                    </button>
                    <button onClick={() => handleStatusUpdate(app.id, "rejected")} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                      <XCircle size={13} /> Reject
                    </button>
                    <button onClick={() => { setTab("messages"); setMsgRecipient(app.worker?.id ?? ""); }} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                      <MessageSquare size={13} /> Message
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Messages tab */}
      {tab === "messages" && (
        <div className="mt-6">
          <div className="rounded-xl border bg-white shadow-sm">
            <div className="divide-y max-h-96 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">No messages yet</p>
              ) : (
                messages.map((m) => {
                  const mine = m.sender.id === user?.id;
                  return (
                    <div key={m.id} className={cn("flex gap-3", mine ? "flex-row-reverse" : "flex-row")}>
                      <div className={cn("max-w-xs rounded-2xl px-4 py-2.5 text-sm", mine ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800")}>
                        {!mine && <p className="mb-1 text-xs font-medium text-gray-500">{m.sender.firstName}</p>}
                        <p>{m.body}</p>
                        <p className={cn("mt-1 text-[10px]", mine ? "text-blue-200" : "text-gray-400")}>
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {user && (
              <div className="border-t p-4">
                {isOwner && applications.length > 0 && (
                  <select
                    value={msgRecipient}
                    onChange={(e) => setMsgRecipient(e.target.value)}
                    className="mb-3 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select recipient…</option>
                    {applications.map((a) => (
                      <option key={a.worker?.id} value={a.worker?.id ?? ""}>{a.worker?.name ?? "Worker"}</option>
                    ))}
                  </select>
                )}
                {!isOwner && job && (
                  <input type="hidden" value={job.postedBy.id} onChange={() => setMsgRecipient(job.postedBy.id)} />
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={msgBody}
                    onChange={(e) => setMsgBody(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                    placeholder="Type a message…"
                    className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={sending || !msgBody.trim() || (!msgRecipient && isOwner)}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
