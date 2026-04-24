import {
  ApiErrorResponse,
  CreateApplicationRequestBody,
  CreateApplicationResponse,
  ListApplicationsResponse,
  LoginRequestBody,
  LoginResponse,
  MeResponse,
} from "../types/api.js";

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  token?: string;
  handleUnauthorized?: boolean;
};

let unauthorizedHandler: (() => void) | null = null;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as { error: unknown }).error === "string"
  );
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers = new Headers();

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const contentType = response.headers.get("content-type") ?? "";
  const data: unknown = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    if (response.status === 401 && options.handleUnauthorized !== false) {
      unauthorizedHandler?.();
    }

    const message = isApiErrorResponse(data)
      ? data.error
      : response.statusText || "Request failed";

    throw new ApiError(message, response.status);
  }

  return data as T;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function login(body: LoginRequestBody) {
  return request<LoginResponse>("/auth/login", {
    method: "POST",
    body,
    handleUnauthorized: false,
  });
}

export function getMe(token: string) {
  return request<MeResponse>("/auth/me", { token });
}

export function listApplications(token: string) {
  return request<ListApplicationsResponse>("/applications?page=1&limit=20", {
    token,
  });
}

export function createApplication(
  token: string,
  body: CreateApplicationRequestBody,
) {
  return request<CreateApplicationResponse>("/applications", {
    method: "POST",
    token,
    body,
  });
}
