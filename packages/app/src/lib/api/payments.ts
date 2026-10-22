import type { ApiResponse, Invoice } from "@/types";
import { request } from "./client";

export const getInvoice = (invoiceId: string) =>
  request<ApiResponse<Invoice>>(`/v1/invoices/${invoiceId}`);
