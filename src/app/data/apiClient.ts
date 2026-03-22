type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  allowUnauthorized?: boolean;
};

const rawApiBase =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "/api";
const normalizedApiBase = rawApiBase.trim().replace(/\/+$/, "");
const API_BASE =
  normalizedApiBase === "" || normalizedApiBase === "/api"
    ? "/api"
    : normalizedApiBase.endsWith("/api")
      ? normalizedApiBase
      : `${normalizedApiBase}/api`;

export interface ApiError extends Error {
  status?: number;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {}, allowUnauthorized = false } = options;
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    if (response.status === 401 && allowUnauthorized) {
      return null as T;
    }

    let message = "Request failed.";
    try {
      const payload = await response.json();
      message =
        payload.message === "Internal server error." && payload.detail
          ? payload.detail
          : payload.message || payload.detail || message;
    } catch {
      message = response.statusText || message;
    }

    const error = new Error(message) as ApiError;
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  auth: {
    login: (email: string, password: string) =>
      request<{ message: string; user: any }>("/auth/login", {
        method: "POST",
        body: { email, password },
      }),
    signup: (payload: {
      fullName: string;
      email: string;
      username?: string;
      password: string;
      section?: string;
    }) =>
      request<{ message: string; user: any }>("/auth/signup", {
        method: "POST",
        body: payload,
      }),
    me: () =>
      request<{ user: any | null }>("/auth/me", {
        method: "GET",
        allowUnauthorized: true,
      }),
    logout: () => request<{ message: string }>("/auth/logout", { method: "POST" }),
  },
  users: {
    list: () => request<any[]>("/users"),
    me: () => request<any>("/users/me"),
    create: (payload: any) => request<{ message: string }>("/users", { method: "POST", body: payload }),
    update: (id: number | string, payload: any) =>
      request<{ message: string }>(`/users/${id}`, { method: "PUT", body: payload }),
    delete: (id: number | string) => request<{ message: string }>(`/users/${id}`, { method: "DELETE" }),
  },
  vehicles: {
    list: () => request<any[]>("/vehicles"),
    bulk: (rows: any[]) => request<{ message: string }>("/vehicles/bulk", { method: "PUT", body: { rows } }),
  },
  drivers: {
    list: () => request<any[]>("/drivers"),
    bulk: (rows: any[]) => request<{ message: string }>("/drivers/bulk", { method: "PUT", body: { rows } }),
  },
  movements: {
    list: () => request<any[]>("/movements"),
    bulk: (rows: any[]) => request<{ message: string }>("/movements/bulk", { method: "PUT", body: { rows } }),
  },
  maintenance: {
    list: () => request<any[]>("/maintenance"),
    alerts: () => request<any[]>("/maintenance/alerts"),
    bulk: (rows: any[]) => request<{ message: string }>("/maintenance/bulk", { method: "PUT", body: { rows } }),
  },
  workOrders: {
    list: () => request<any[]>("/work-orders"),
  },
  activityLogs: {
    list: () => request<any[]>("/activity-logs"),
    bulk: (rows: any[]) => request<{ message: string }>("/activity-logs/bulk", { method: "PUT", body: { rows } }),
    create: (payload: any) => request<{ message: string }>("/activity-logs", { method: "POST", body: payload }),
  },
  settings: {
    get: () => request<any>("/settings"),
    update: (payload: any) => request<{ message: string; settings: any }>("/settings", { method: "PUT", body: payload }),
  },
  dashboard: {
    summary: () => request<any>("/dashboard/summary"),
  },
  reports: {
    vehicleUsage: () => request<any[]>("/reports/vehicle-usage"),
    maintenance: () => request<any[]>("/reports/maintenance"),
  },
};
