import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import {
  ApiError,
  createApplication,
  deleteApplication,
  getMe,
  listApplications,
  login,
  setUnauthorizedHandler,
  updateApplication,
} from "../api/client";
import type {
  Application,
  ListApplicationsResponse,
  LoginResponse,
  MeResponse,
} from "../types/api";

vi.mock("../api/client", () => ({
  ApiError: class ApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  },
  createApplication: vi.fn(),
  deleteApplication: vi.fn(),
  getMe: vi.fn(),
  listApplications: vi.fn(),
  login: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
  updateApplication: vi.fn(),
}));

const AUTH_TOKEN_STORAGE_KEY = "job-tracker-token";

const mockedCreateApplication = vi.mocked(createApplication);
const mockedDeleteApplication = vi.mocked(deleteApplication);
const mockedGetMe = vi.mocked(getMe);
const mockedListApplications = vi.mocked(listApplications);
const mockedLogin = vi.mocked(login);
const mockedSetUnauthorizedHandler = vi.mocked(setUnauthorizedHandler);
const mockedUpdateApplication = vi.mocked(updateApplication);

let unauthorizedHandler: (() => void) | null = null;

function createTestApplication(
  overrides: Partial<Application> = {},
): Application {
  return {
    id: 1,
    company: "Code Nine",
    job_title: "Software Engineer",
    status: "saved",
    job_url: null,
    location: null,
    notes: null,
    applied_at: "2026-05-12T12:00:00.000Z",
    created_at: "2026-05-10T12:00:00.000Z",
    updated_at: "2026-05-10T12:00:00.000Z",
    ...overrides,
  };
}

function createListResponse(
  applications: Application[] = [],
): ListApplicationsResponse {
  return {
    applications,
    pagination: {
      page: 1,
      limit: 20,
      total: applications.length,
      totalPages: 1,
    },
  };
}

function createMeResponse(): MeResponse {
  return {
    user: {
      id: "user-123",
      email: "user@example.com",
      role: "user",
      created_at: "2026-05-10T12:00:00.000Z",
    },
  };
}

function createLoginResponse(): LoginResponse {
  return {
    user: {
      id: "user-123",
      email: "user@example.com",
      role: "user",
    },
    token: "login-token-123",
  };
}

function renderApp(initialPath: string) {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>,
  );
}

describe("App auth and routing", () => {
  beforeEach(() => {
    unauthorizedHandler = null;
    localStorage.clear();
    vi.clearAllMocks();

    mockedSetUnauthorizedHandler.mockImplementation((handler) => {
      unauthorizedHandler = handler;
    });
    mockedListApplications.mockResolvedValue(createListResponse());
    mockedCreateApplication.mockResolvedValue({
      application: createTestApplication(),
    });
    mockedDeleteApplication.mockResolvedValue({
      message: "Application deleted",
    });
    mockedUpdateApplication.mockResolvedValue({
      application: createTestApplication(),
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("hydrates a valid stored token and renders a protected route", async () => {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "stored-token-123");
    mockedGetMe.mockResolvedValue(createMeResponse());

    renderApp("/applications");

    expect(await screen.findByText("Loading session...")).toBeTruthy();

    expect(
      await screen.findByRole("heading", {
        name: "Applications",
        level: 1,
      }),
    ).toBeTruthy();

    expect(mockedGetMe).toHaveBeenCalledWith("stored-token-123");
    expect(mockedListApplications).toHaveBeenCalledWith("stored-token-123");
    expect(screen.getByText("user@example.com")).toBeTruthy();
    expect(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe(
      "stored-token-123",
    );
  });

  it("clears auth and redirects to login when stored token hydration fails unauthorized", async () => {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "expired-token-123");
    mockedGetMe.mockImplementation(() => {
      unauthorizedHandler?.();
      return Promise.reject(new Error("Unauthorized"));
    });

    renderApp("/applications");

    expect(
      await screen.findByRole("heading", {
        name: "Sign In",
        level: 1,
      }),
    ).toBeTruthy();

    expect(mockedGetMe).toHaveBeenCalledWith("expired-token-123");
    expect(mockedListApplications).not.toHaveBeenCalled();
    expect(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBeNull();
    expect(
      screen.getByText("Your session expired. Please sign in again."),
    ).toBeTruthy();
  });

  it("blocks unauthenticated users from protected routes", async () => {
    renderApp("/applications");

    expect(
      await screen.findByRole("heading", {
        name: "Sign In",
        level: 1,
      }),
    ).toBeTruthy();

    expect(mockedGetMe).not.toHaveBeenCalled();
    expect(mockedListApplications).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated root route visits to login", async () => {
    renderApp("/");

    expect(
      await screen.findByRole("heading", {
        name: "Sign In",
        level: 1,
      }),
    ).toBeTruthy();

    expect(mockedGetMe).not.toHaveBeenCalled();
    expect(mockedListApplications).not.toHaveBeenCalled();
  });

  it("redirects authenticated root route visits to the applications", async () => {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "stored-token-123");
    mockedGetMe.mockResolvedValue(createMeResponse());

    renderApp("/");

    expect(
      await screen.findByRole("heading", {
        name: "Applications",
        level: 1,
      }),
    ).toBeTruthy();

    expect(mockedGetMe).toHaveBeenCalledWith("stored-token-123");
    expect(mockedListApplications).toHaveBeenCalledWith("stored-token-123");
  });

  it("clears the stored token and redirects to login when an authenticated user logs out", async () => {
    const application = createTestApplication();

    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "stored-token-123");
    mockedGetMe.mockResolvedValue(createMeResponse());
    mockedListApplications.mockResolvedValue(createListResponse([application]));

    renderApp("/applications");

    expect(
      await screen.findByRole("heading", {
        name: "Applications",
        level: 1,
      }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => {
      expect(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBeNull();
    });

    expect(
      await screen.findByRole("heading", {
        name: "Sign In",
        level: 1,
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("heading", {
        name: "Applications",
        level: 1,
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("heading", {
        name: application.company,
        level: 2,
      }),
    ).toBeNull();
  });

  it("clears auth and leaves the protected page when a protected API call becomes unauthorized", async () => {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "stored-token-123");
    mockedGetMe.mockResolvedValue(createMeResponse());
    mockedListApplications.mockImplementation(async () => {
      unauthorizedHandler?.();

      const error = new Error("Unauthorized");
      Object.assign(error, { status: 401 });
      throw error;
    });

    renderApp("/applications");

    await waitFor(() => {
      expect(mockedListApplications).toHaveBeenCalledWith("stored-token-123");
    });

    expect(
      await screen.findByRole("heading", {
        name: "Sign In",
        level: 1,
      }),
    ).toBeTruthy();
    expect(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBeNull();
    expect(
      screen.queryByRole("heading", {
        name: "Applications",
        level: 1,
      }),
    ).toBeNull();
    expect(
      screen.getByText("Your session expired. Please sign in again."),
    ).toBeTruthy();
  });

  it("clears auth and redirects to login when a create request becomes unauthorized", async () => {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "stored-token-123");
    mockedGetMe.mockResolvedValue(createMeResponse());
    mockedCreateApplication.mockImplementation(async () => {
      unauthorizedHandler?.();

      throw new ApiError("Unauthorized", 401);
    });

    renderApp("/applications");

    expect(
      await screen.findByRole("heading", {
        name: "Applications",
        level: 1,
      }),
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Company"), {
      target: { value: "Expired Session Co" },
    });
    fireEvent.change(screen.getByLabelText("Job Title"), {
      target: { value: "Frontend Engineer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create application" }));

    await waitFor(() => {
      expect(mockedCreateApplication).toHaveBeenCalledWith("stored-token-123", {
        company: "Expired Session Co",
        job_title: "Frontend Engineer",
        status: "saved",
        applied_at: null,
      });
      expect(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBeNull();
    });

    expect(
      await screen.findByRole("heading", {
        name: "Sign In",
        level: 1,
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("heading", {
        name: "Applications",
        level: 1,
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("heading", {
        name: "Expired Session Co",
        level: 2,
      }),
    ).toBeNull();
    expect(
      screen.getByText("Your session expired. Please sign in again."),
    ).toBeTruthy();
  });

  it("shows an error and does not store a token when login fails", async () => {
    mockedLogin.mockRejectedValue(new Error("Invalid email or password"));

    renderApp("/login");

    fireEvent.change(await screen.findByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(await screen.findByLabelText("Password"), {
      target: { value: "wrong-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const alert = await screen.findByRole("alert");

    expect(alert.textContent).toBe("Invalid email or password");
    expect(mockedLogin).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "wrong-password",
    });
    expect(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBeNull();
    expect(
      screen.getByRole("heading", {
        name: "Sign In",
        level: 1,
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("heading", {
        name: "Applications",
        level: 1,
      }),
    ).toBeNull();
    expect(mockedListApplications).not.toHaveBeenCalled();
  });

  it("stores the token and redirects to applications after successful login", async () => {
    mockedLogin.mockResolvedValue(createLoginResponse());

    renderApp("/login");

    fireEvent.change(await screen.findByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(await screen.findByLabelText("Password"), {
      target: { value: "correct-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe(
        "login-token-123",
      );
    });

    expect(
      await screen.findByRole("heading", {
        name: "Applications",
        level: 1,
      }),
    ).toBeTruthy();
  });
});
