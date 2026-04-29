import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "../auth/AuthProvider";
import {
  createApplication,
  listApplications,
  updateApplication,
} from "../api/client";
import type { Application, ListApplicationsResponse } from "../types/api";
import { ApplicationsPage } from "./ApplicationsPage";

const mockNavigate = vi.fn();
const mockLogout = vi.fn();

vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("../auth/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

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
  listApplications: vi.fn(),
  updateApplication: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedCreateApplication = vi.mocked(createApplication);
const mockedListApplications = vi.mocked(listApplications);
const mockedUpdateApplication = vi.mocked(updateApplication);

function createTestApplication(
  overrides: Partial<Application> = {},
): Application {
  return {
    id: 1,
    company: "Data Stack One",
    job_title: "Software Engineer",
    status: "saved",
    job_url: null,
    location: null,
    notes: null,
    applied_at: "2026-04-12T12:00:00.000Z",
    created_at: "2026-04-10T12:00:00.000Z",
    updated_at: "2026-04-10T12:00:00.000Z",
    ...overrides,
  };
}

function createListResponse(
  applications: Application[],
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

async function renderPage(application: Application) {
  mockedListApplications.mockResolvedValue(createListResponse([application]));

  render(<ApplicationsPage />);

  const heading = await screen.findByRole("heading", {
    name: application.company,
    level: 2,
  });
  const applicationCard = heading.closest("li");

  if (!applicationCard) {
    throw new Error("Application card not found");
  }

  return within(applicationCard);
}

describe("ApplicationsPage update flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedUseAuth.mockReturnValue({
      token: "token-123",
      user: {
        id: "user-123",
        email: "user@example.com",
        role: "user",
      },
      isHydrating: false,
      login: vi.fn(),
      logout: mockLogout,
    });

    mockedCreateApplication.mockResolvedValue({
      application: createTestApplication({ id: 99 }),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("closes edit mode without sending a patch when nothing changed", async () => {
    const card = await renderPage(createTestApplication());

    fireEvent.click(card.getByRole("button", { name: "Edit" }));
    fireEvent.click(card.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    });

    expect(mockedUpdateApplication).not.toHaveBeenCalled();
    expect(mockedListApplications).toHaveBeenCalledTimes(1);
  });

  it("sends only changed fields in the update body", async () => {
    const application = createTestApplication();
    const updatedApplication = createTestApplication({
      company: "Acme Labs",
      applied_at: "2026-04-02T12:00:00.000Z",
    });
    const card = await renderPage(application);

    mockedUpdateApplication.mockResolvedValue({
      application: updatedApplication,
    });

    fireEvent.click(card.getByRole("button", { name: "Edit" }));
    fireEvent.change(card.getByLabelText("Company"), {
      target: { value: updatedApplication.company },
    });
    fireEvent.change(card.getByLabelText("Applied at"), {
      target: { value: "2026-04-02" },
    });
    fireEvent.click(card.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockedUpdateApplication).toHaveBeenCalledWith("token-123", 1, {
        company: "Acme Labs",
        applied_at: "2026-04-02T12:00:00.000Z",
      });
    });
  });

  it("reloads the applications list after a successful update", async () => {
    const application = createTestApplication();
    const refreshedApplication = createTestApplication({
      company: "Acme Labs",
      status: "interviewing",
    });

    mockedListApplications
      .mockResolvedValueOnce(createListResponse([application]))
      .mockResolvedValueOnce(createListResponse([refreshedApplication]));
    mockedUpdateApplication.mockResolvedValue({
      application: createTestApplication({
        company: "Patch Response Only",
        status: "offer",
      }),
    });

    render(<ApplicationsPage />);

    const heading = await screen.findByRole("heading", {
      name: application.company,
      level: 2,
    });
    const applicationCard = heading.closest("li");

    if (!applicationCard) {
      throw new Error("Application card not found");
    }

    const card = within(applicationCard);

    fireEvent.click(card.getByRole("button", { name: "Edit" }));
    fireEvent.change(card.getByLabelText("Company"), {
      target: { value: refreshedApplication.company },
    });
    fireEvent.change(card.getByLabelText("Status"), {
      target: { value: refreshedApplication.status },
    });
    fireEvent.click(card.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockedUpdateApplication).toHaveBeenCalledWith("token-123", 1, {
        company: "Acme Labs",
        status: "interviewing",
      });
      expect(mockedListApplications).toHaveBeenCalledTimes(2);
    });

    const refreshedHeading = await screen.findByRole("heading", {
      name: refreshedApplication.company,
      level: 2,
    });
    const refreshedCard = refreshedHeading.closest("li");

    if (!refreshedCard) {
      throw new Error("Refreshed application card not found");
    }

    expect(
      within(refreshedCard).getByText(refreshedApplication.status),
    ).toBeTruthy();
  });

  it("disables the edit form while a save is in flight", async () => {
    const application = createTestApplication();
    const updatedApplication = createTestApplication({
      company: "Acme Labs",
    });

    const card = await renderPage(application);

    let resolveUpdate:
      | ((value: { application: Application }) => void)
      | undefined;

    mockedUpdateApplication.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        }),
    );

    fireEvent.click(card.getByRole("button", { name: "Edit" }));
    fireEvent.change(card.getByLabelText("Company"), {
      target: { value: updatedApplication.company },
    });
    fireEvent.click(card.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockedUpdateApplication).toHaveBeenCalledTimes(1);
      expect(
        (card.getByLabelText("Company") as HTMLInputElement).disabled,
      ).toBe(true);
      expect(
        (card.getByLabelText("Job Title") as HTMLInputElement).disabled,
      ).toBe(true);
      expect(
        (card.getByLabelText("Status") as HTMLSelectElement).disabled,
      ).toBe(true);
      expect(
        (card.getByLabelText("Applied at") as HTMLInputElement).disabled,
      ).toBe(true);
      expect(
        (card.getByRole("button", { name: "Saving..." }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
      expect(
        (card.getByRole("button", { name: "Cancel" }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
    });

    if (!resolveUpdate) {
      throw new Error("Expected update request to be pending");
    }

    resolveUpdate({ application: updatedApplication });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    });
  });
});
