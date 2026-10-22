const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";

export interface ApiRequestOptions {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  data?: unknown;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  statusText: string;
  data: T | null;
  error?: string;
}

class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.defaultHeaders = { "Content-Type": "application/json", Accept: "application/json" };
  }

  private buildUrl(endpoint: string, params?: Record<string, string | number | boolean>): string {
    const queryParts: string[] = [];
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
      });
    }
    const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
    return `${this.baseUrl.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}${queryString}`;
  }

  private async getAuthToken(): Promise<string | null> {
    return null;
  }

  async request<T = unknown>(options: ApiRequestOptions): Promise<ApiResponse<T>> {
    const { url, method = "GET", data, headers = {}, params } = options;
    const fullUrl = this.buildUrl(url, params);
    const authToken = await this.getAuthToken();
    const requestHeaders: Record<string, string> = { ...this.defaultHeaders, ...headers };
    if (authToken) requestHeaders.Authorization = `Bearer ${authToken}`;

    try {
      const response = await fetch(fullUrl, {
        method,
        headers: requestHeaders,
        body: method !== "GET" && data ? JSON.stringify(data) : undefined,
      });
      const contentType = response.headers.get("content-type");
      const isJson = contentType?.includes("application/json");
      const responseData = isJson ? await response.json() : await response.text();
      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        data: responseData as T,
        error: response.ok ? undefined : (responseData as any)?.message || response.statusText,
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        statusText: "Network Error",
        data: null as T,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async get<T = unknown>(url: string, params?: Record<string, string | number | boolean>) {
    return this.request<T>({ url, method: "GET", params });
  }
  async post<T = unknown>(url: string, data?: unknown) {
    return this.request<T>({ url, method: "POST", data });
  }
  async put<T = unknown>(url: string, data?: unknown) {
    return this.request<T>({ url, method: "PUT", data });
  }
  async patch<T = unknown>(url: string, data?: unknown) {
    return this.request<T>({ url, method: "PATCH", data });
  }
  async delete<T = unknown>(url: string) {
    return this.request<T>({ url, method: "DELETE" });
  }
}

export const api = new ApiClient();

export const workersApi = {
  getAll: (params?: { category?: string; location?: string; page?: number; limit?: number }) => api.get("/workers", params),
  getById: (id: string) => api.get(`/workers/${id}`),
  search: (query: string) => api.get("/workers/search", { q: query }),
};

export const categoriesApi = { getAll: () => api.get("/categories") };
export const userApi = { getProfile: () => api.get("/users/me"), updateProfile: (data: unknown) => api.put("/users/me", data) };
export const contactRequestsApi = {
  create: (data: { workerId: string; message: string; preferredDate?: string }) => api.post("/contact-requests", data),
  getMyRequests: () => api.get("/contact-requests"),
  getReceivedRequests: () => api.get("/contact-requests/received"),
};
export const bookmarksApi = { getAll: () => api.get("/bookmarks"), toggle: (workerId: string) => api.post("/bookmarks", { workerId }), remove: (workerId: string) => api.delete(`/bookmarks/${workerId}`) };
export const reviewsApi = { getByWorker: (workerId: string, params?: { page?: number; limit?: number }) => api.get(`/workers/${workerId}/reviews`, params), create: (workerId: string, data: { rating: number; comment: string }) => api.post(`/workers/${workerId}/reviews`, data) };
export const tipsApi = { send: (data: { workerId: string; amount: string; asset: string; memo?: string }) => api.post("/tips", data) };
export const escrowApi = { create: (data: { workerId: string; amount: string; asset: string; description: string; expiryHours: number }) => api.post("/escrow", data), getMyEscrows: () => api.get("/escrow") };

export default api;