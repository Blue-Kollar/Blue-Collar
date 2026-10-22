import type { Job, JobApplication, JobMessage, PaginatedResponse } from "@/types";
import { request } from "./client";

export interface ListJobsParams {
  categoryId?: string;
  status?: string;
  search?: string;
  skills?: string;
  urgency?: string;
  minBudget?: number;
  maxBudget?: number;
  page?: number;
  limit?: number;
}

export const getJobs = (params?: ListJobsParams) => {
  const qs = params ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString()}` : "";
  return request<PaginatedResponse<Job>>(`/v1/jobs${qs}`);
};

export const getJob = (id: string) =>
  request<{ data: Job; status: string }>(`/v1/jobs/${id}`);

export const createJob = (data: {
  title: string;
  description: string;
  budget?: number;
  skills?: string[];
  urgency?: string;
  categoryId: string;
  locationId?: string;
  expiresAt?: string;
  escrowAmount?: number;
}) => request<{ data: Job }>("/v1/jobs", { method: "POST", body: data });

export const updateJob = (id: string, data: Partial<Parameters<typeof createJob>[0] & { status?: string }>) =>
  request<{ data: Job }>(`/v1/jobs/${id}`, { method: "PUT", body: data });

export const deleteJob = (id: string) =>
  request<void>(`/v1/jobs/${id}`, { method: "DELETE" });

export const renewJob = (id: string, days = 30) =>
  request<{ data: Job }>(`/v1/jobs/${id}/renew`, { method: "POST", body: { days } });

export const getMyPostedJobs = (params?: { page?: number; limit?: number }) => {
  const qs = params ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString()}` : "";
  return request<PaginatedResponse<Job>>(`/v1/jobs/me/posted${qs}`);
};

export const getMyApplications = (workerId: string, params?: { page?: number; limit?: number }) => {
  const qs = new URLSearchParams({ workerId, ...(params?.page ? { page: String(params.page) } : {}), ...(params?.limit ? { limit: String(params.limit) } : {}) }).toString();
  return request<PaginatedResponse<JobApplication>>(`/v1/jobs/me/applications?${qs}`);
};

export const getRecommendedJobs = (workerId: string) =>
  request<{ data: Job[] }>(`/v1/jobs/recommendations/${workerId}`);

export const applyToJob = (jobId: string, data: { workerId: string; coverLetter?: string; proposedRate?: number }) =>
  request<{ data: JobApplication }>(`/v1/jobs/${jobId}/apply`, { method: "POST", body: data });

export const withdrawJobApplication = (jobId: string, workerId: string) =>
  request<{ data: JobApplication }>(`/v1/jobs/${jobId}/apply`, { method: "DELETE", body: { workerId } });

export const getJobApplications = (jobId: string) =>
  request<{ data: JobApplication[] }>(`/v1/jobs/${jobId}/applications`);

export const updateJobApplicationStatus = (jobId: string, applicationId: string, status: "accepted" | "rejected") =>
  request<{ data: JobApplication }>(`/v1/jobs/${jobId}/applications/${applicationId}`, { method: "PATCH", body: { status } });

export const sendJobMessage = (jobId: string, data: { recipientId: string; body: string }) =>
  request<{ data: JobMessage }>(`/v1/jobs/${jobId}/messages`, { method: "POST", body: data });

export const getJobMessages = (jobId: string) =>
  request<{ data: JobMessage[] }>(`/v1/jobs/${jobId}/messages`);
