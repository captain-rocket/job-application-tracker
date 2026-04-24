export type UserRole = "user" | "admin";

export type User = {
  id: string;
  email: string;
  role: UserRole;
};

export type UserWithCreatedAt = User & {
  created_at: string;
};

export type LoginRequestBody = {
  email: string;
  password: string;
};

export type LoginResponse = {
  user: User;
  token: string;
};

export type MeResponse = {
  user: UserWithCreatedAt;
};

export type ApiErrorResponse = {
  error: string;
};

export type ApplicationStatus =
  | "saved"
  | "applied"
  | "interviewing"
  | "offer"
  | "rejected"
  | "withdrawn";

export type Application = {
  id: number;
  company: string;
  job_title: string;
  status: ApplicationStatus;
  job_url: string | null;
  location: string | null;
  notes: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateApplicationRequestBody = {
  company: string;
  job_title: string;
  status?: ApplicationStatus;
  applied_at: string | null;
};

export type CreateApplicationResponse = {
  application: Application;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ListApplicationsResponse = {
  applications: Application[];
  pagination: Pagination;
};
