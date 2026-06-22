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
  deleteApplication,
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
  deleteApplication: vi.fn(),
  listApplications: vi.fn(),
  updateApplication: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedCreateApplication = vi.mocked(createApplication);
const mockedDeleteApplication = vi.mocked(deleteApplication);
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
    is_demo_seed: false,
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
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    mockedUseAuth.mockReturnValue({
      token: "token-123",
      user: {
        id: "user-123",
        email: "user@example.com",
        role: "user",
      },
      authMessage: null,
      isHydrating: false,
      login: vi.fn(),
      loginDemo: vi.fn(),
      logout: mockLogout,
    });

    mockedCreateApplication.mockResolvedValue({
      application: createTestApplication({ id: 99 }),
    });
    mockedDeleteApplication.mockResolvedValue({
      message: "Application deleted",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("shows a create error and keeps the form usable when create fails", async () => {
    await renderPage(createTestApplication());

    mockedCreateApplication.mockRejectedValue(new Error("Create failed"));

    const companyInput = screen.getByLabelText("Company") as HTMLInputElement;
    const jobTitleInput = screen.getByLabelText(
      "Job Title",
    ) as HTMLInputElement;
    const statusSelect = screen.getByLabelText("Status") as HTMLSelectElement;
    const appliedAtInput = screen.getByLabelText(
      "Applied at",
    ) as HTMLInputElement;

    fireEvent.change(companyInput, {
      target: { value: "Acme Labs" },
    });
    fireEvent.change(jobTitleInput, {
      target: { value: "Frontend Engineer" },
    });
    fireEvent.change(statusSelect, {
      target: { value: "interviewing" },
    });
    fireEvent.change(appliedAtInput, {
      target: { value: "2026-05-21" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create application" }));

    const alert = await screen.findByRole("alert");

    expect(alert.textContent).toBe("Create failed");
    expect(mockedCreateApplication).toHaveBeenCalledWith("token-123", {
      company: "Acme Labs",
      job_title: "Frontend Engineer",
      status: "interviewing",
      applied_at: "2026-05-21T12:00:00.000Z",
    });
    expect(mockedListApplications).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("heading", {
        name: "Acme Labs",
        level: 2,
      }),
    ).toBeNull();
    expect(
      (
        screen.getByRole("button", {
          name: "Create application",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(companyInput.value).toBe("Acme Labs");

    fireEvent.change(companyInput, {
      target: { value: "Acme Labs Updated" },
    });

    expect(companyInput.value).toBe("Acme Labs Updated");
  });

  it("shows protected sample context and disabled actions for demo seed records", async () => {
    const card = await renderPage(
      createTestApplication({ is_demo_seed: true }),
    );

    const editButton = card.getByRole("button", { name: "Edit" });
    const deleteButton = card.getByRole("button", { name: "Delete" });
    const protectedSampleHelp =
      "Protected sample records cannot be edited or deleted. Create a new application to test editing and deletion.";
    const visibleProtectedSampleHelp =
      "Protected sample records are read-only. Create a new application to test editing and deletion.";

    expect(card.getByText("Protected sample")).toBeTruthy();
    expect(card.getByText(visibleProtectedSampleHelp)).toBeTruthy();
    expect((editButton as HTMLButtonElement).disabled).toBe(true);
    expect((deleteButton as HTMLButtonElement).disabled).toBe(true);
    expect(card.getAllByTitle(protectedSampleHelp).length).toBeGreaterThan(0);
  });

  it("disables the create form while create is in flight", async () => {
    await renderPage(createTestApplication());

    let resolveCreate:
      | ((value: { application: Application }) => void)
      | undefined;

    mockedCreateApplication.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );

    fireEvent.change(screen.getByLabelText("Company"), {
      target: { value: "Acme Labs" },
    });

    fireEvent.change(screen.getByLabelText("Job Title"), {
      target: { value: "Frontend Engineer" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create application" }));

    await waitFor(() => {
      expect(mockedCreateApplication).toHaveBeenCalledTimes(1);
      expect(
        (screen.getByLabelText("Company") as HTMLInputElement).disabled,
      ).toBe(true);
      expect(
        (screen.getByLabelText("Job Title") as HTMLInputElement).disabled,
      ).toBe(true);
      expect(
        (screen.getByLabelText("Status") as HTMLSelectElement).disabled,
      ).toBe(true);
      expect(
        (screen.getByLabelText("Applied at") as HTMLInputElement).disabled,
      ).toBe(true);
      expect(
        (
          screen.getByRole("button", {
            name: "Submitting...",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
    });

    if (!resolveCreate)
      throw new Error("Expected create request to be pending");

    resolveCreate({ application: createTestApplication({ id: 99 }) });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Create application" }),
      ).toBeTruthy();
    });
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

  it("shows an update error and keeps edit mode open when update fails", async () => {
    const application = createTestApplication();
    const card = await renderPage(application);

    mockedUpdateApplication.mockRejectedValue(new Error("Update failed"));

    fireEvent.click(card.getByRole("button", { name: "Edit" }));
    fireEvent.change(card.getByLabelText("Company"), {
      target: { value: "Acme Labs" },
    });
    fireEvent.click(card.getByRole("button", { name: "Save" }));

    const alert = await card.findByRole("alert");

    expect(alert.textContent).toBe("Update failed");
    expect(mockedUpdateApplication).toHaveBeenCalledWith("token-123", 1, {
      company: "Acme Labs",
    });
    expect(mockedListApplications).toHaveBeenCalledTimes(1);
    expect(card.getByRole("button", { name: "Save" })).toBeTruthy();
    expect((card.getByLabelText("Company") as HTMLInputElement).value).toBe(
      "Acme Labs",
    );

    fireEvent.click(card.getByRole("button", { name: "Cancel" }));

    const unchangedHeading = screen.getByRole("heading", {
      name: application.company,
      level: 2,
    });
    const unchangedCard = unchangedHeading.closest("li");

    if (!unchangedCard) throw new Error("Application card not found");

    expect(
      screen.queryByRole("heading", {
        name: "Acme Labs",
        level: 2,
      }),
    ).toBeNull();
    expect(within(unchangedCard).getByText(application.job_title)).toBeTruthy();
    expect(within(unchangedCard).getByText(application.status)).toBeTruthy();
  });

  it("does not delete when confirmation is canceled", async () => {
    const card = await renderPage(createTestApplication());

    vi.mocked(window.confirm).mockReturnValue(false);

    fireEvent.click(card.getByRole("button", { name: "Delete" }));

    expect(window.confirm).toHaveBeenCalledWith(
      "Delete application for Data Stack One?",
    );
    expect(mockedDeleteApplication).not.toHaveBeenCalled();
    expect(mockedListApplications).toHaveBeenCalledTimes(1);
  });

  it("reloads the applications list after a successful delete", async () => {
    const application = createTestApplication();

    mockedListApplications
      .mockResolvedValueOnce(createListResponse([application]))
      .mockResolvedValueOnce(createListResponse([]));

    render(<ApplicationsPage />);

    const heading = await screen.findByRole("heading", {
      name: application.company,
      level: 2,
    });
    const applicationCard = heading.closest("li");

    if (!applicationCard) throw new Error("Application card not found");

    const card = within(applicationCard);

    fireEvent.click(card.getByRole("button", { name: "Delete" }));

    await waitFor(async () => {
      expect(mockedDeleteApplication).toHaveBeenLastCalledWith("token-123", 1);
      expect(mockedListApplications).toHaveBeenCalledTimes(2);
    });

    expect(await screen.findByText("No applications found.")).toBeTruthy();
  });

  it("shows a delete error and restores the delete button when delete fails", async () => {
    const application = createTestApplication();
    const card = await renderPage(application);

    mockedDeleteApplication.mockRejectedValue(new Error("Delete failed"));

    fireEvent.click(card.getByRole("button", { name: "Delete" }));

    const alert = await screen.findByRole("alert");
    const deleteButton = card.getByRole("button", {
      name: "Delete",
    }) as HTMLButtonElement;

    expect(alert.textContent).toBe("Delete failed");
    expect(
      screen.getByRole("heading", {
        name: application.company,
        level: 2,
      }),
    ).toBeTruthy();
    expect(mockedListApplications).toHaveBeenCalledTimes(1);
    expect(deleteButton.disabled).toBe(false);
    expect(screen.queryByRole("button", { name: "Deleting..." })).toBeNull();
  });

  it("clears a stale delete error after a successful list refresh", async () => {
    const application = createTestApplication();
    const card = await renderPage(application);

    mockedDeleteApplication.mockRejectedValue(new Error("Delete failed"));

    fireEvent.click(card.getByRole("button", { name: "Delete" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Delete failed",
    );

    fireEvent.change(screen.getByLabelText("Company"), {
      target: { value: "Acme Labs" },
    });
    fireEvent.change(screen.getByLabelText("Job Title"), {
      target: { value: "Frontend Engineer" },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Create application",
      }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  it("disables delete and edit actions while delete is in flight", async () => {
    const application = createTestApplication();
    const card = await renderPage(application);

    let resolveDelete: ((value: { message: string }) => void) | undefined;

    mockedDeleteApplication.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDelete = resolve;
        }),
    );

    fireEvent.click(card.getByRole("button", { name: "Delete" }));

    await waitFor(async () => {
      expect(mockedDeleteApplication).toHaveBeenCalledTimes(1);
      expect(
        (card.getByRole("button", { name: "Edit" }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
      expect(
        (
          card.getByRole("button", {
            name: "Deleting...",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
    });

    if (!resolveDelete)
      throw new Error("Expected delete request to be pending");

    resolveDelete({ message: "Application deleted" });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Deleting..." })).toBeNull();
    });
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
