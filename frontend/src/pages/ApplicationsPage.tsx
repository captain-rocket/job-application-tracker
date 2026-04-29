import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { useNavigate } from "react-router";
import { toDateInputValue } from "../utils/applicationDate";
import {
  ApiError,
  createApplication,
  listApplications,
  updateApplication,
} from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import type {
  Application,
  ApplicationStatus,
  CreateApplicationRequestBody,
  UpdateApplicationRequestBody,
} from "../types/api";
import { ApplicationListItem, type EditFormState } from "./ApplicationListItem";
import styles from "./ApplicationsPage.module.css";

const APPLICATION_STATUS_OPTIONS: ApplicationStatus[] = [
  "saved",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
];

function toAppliedAtRequestValue(value: string) {
  if (!value) return null;

  return `${value}T12:00:00.000Z`;
}

function buildUpdateApplicationRequestBody(
  application: Application,
  editForm: EditFormState,
): UpdateApplicationRequestBody | null {
  const body: UpdateApplicationRequestBody = {};
  if (editForm.company !== application.company) {
    body.company = editForm.company;
  }
  if (editForm.jobTitle !== application.job_title) {
    body.job_title = editForm.jobTitle;
  }
  if (editForm.status !== application.status) {
    body.status = editForm.status;
  }
  if (editForm.appliedAt !== toDateInputValue(application.applied_at)) {
    body.applied_at = toAppliedAtRequestValue(editForm.appliedAt);
  }

  return Object.keys(body).length > 0 ? body : null;
}

export function ApplicationsPage() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const requestId = useRef(0);
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [status, setStatus] = useState<ApplicationStatus>("saved");
  const [appliedAt, setAppliedAt] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingApplicationId, setEditingApplicationId] = useState<
    number | null
  >(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const getNextLoadRequestId = (): number => {
    return ++requestId.current;
  };

  async function loadApplications(authToken: string) {
    setIsLoading(true);
    setLoadError(null);

    const currentRequestId = getNextLoadRequestId();
    try {
      const response = await listApplications(authToken);

      if (requestId.current !== currentRequestId) return;

      setApplications(response.applications);
    } catch (error) {
      if (requestId.current !== currentRequestId) return;

      if (error instanceof ApiError && error.status === 401) return;

      setLoadError(
        error instanceof Error ? error.message : "Unable to load applications",
      );
    } finally {
      if (requestId.current === currentRequestId) setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    void loadApplications(token);

    return () => {
      requestId.current += 1;
    };
  }, [token]);

  async function handleCreateApplication(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) return;

    setCreateError(null);
    setIsSubmitting(true);

    const body: CreateApplicationRequestBody = {
      company,
      job_title: jobTitle,
      status,
      applied_at: toAppliedAtRequestValue(appliedAt),
    };

    try {
      await createApplication(token, body);

      setCompany("");
      setJobTitle("");
      setStatus("saved");
      setAppliedAt("");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return;

      setCreateError(
        error instanceof Error ? error.message : "Unable to create application",
      );
      return;
    } finally {
      setIsSubmitting(false);
    }

    void loadApplications(token);
  }

  function handleStartEdit(application: Application) {
    setEditingApplicationId(application.id);

    setEditForm({
      company: application.company,
      jobTitle: application.job_title,
      status: application.status,
      appliedAt: toDateInputValue(application.applied_at),
    });
    setUpdateError(null);
  }

  function handleCancelEdit() {
    setEditingApplicationId(null);
    setEditForm(null);
    setUpdateError(null);
  }

  function handleEditFormChange(updates: Partial<EditFormState>) {
    setEditForm((current) => {
      if (!current) return current;
      return {
        ...current,
        ...updates,
      };
    });
  }

  async function handleUpdateApplication(
    event: SubmitEvent<HTMLFormElement>,
    applicationId: number,
  ) {
    event.preventDefault();

    if (!token || !editForm) return;

    const application = applications.find((item) => item.id === applicationId);

    if (!application) return;

    const body = buildUpdateApplicationRequestBody(application, editForm);

    if (!body) {
      handleCancelEdit();
      return;
    }

    setUpdateError(null);
    setIsSaving(true);

    let didUpdate = false;

    try {
      await updateApplication(token, applicationId, body);
      didUpdate = true;
      setEditingApplicationId(null);
      setEditForm(null);
      setUpdateError(null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return;

      setUpdateError(
        error instanceof Error ? error.message : "Unable to update application",
      );
      return;
    } finally {
      setIsSaving(false);
    }

    if (didUpdate) {
      void loadApplications(token);
    }
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="pageShell">
      <header className={styles.appHeader}>
        <div>
          <p className={styles.eyebrow}>Job Application Tracker</p>
          <h1>Applications</h1>
        </div>

        <div className={styles.headerActions}>
          <span>{user?.email}</span>
          <button
            type="button"
            className="secondaryButton"
            onClick={handleLogout}
          >
            Log out
          </button>
        </div>
      </header>

      <section className={`surfacePanel ${styles.controlPanel}`}>
        <h2>Create application</h2>
        <p className={styles.formHint}>
          Add a new application to your tracker.
        </p>

        {createError ? (
          <p role="alert" className="errorMessage">
            {createError}
          </p>
        ) : null}

        <form className={styles.createForm} onSubmit={handleCreateApplication}>
          <div className={styles.formGrid}>
            <div className={styles.formRow}>
              <label htmlFor="company">Company</label>
              <input
                id="company"
                className={styles.formControl}
                type="text"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                required
              />
            </div>

            <div className={styles.formRow}>
              <label htmlFor="jobTitle">Job Title</label>
              <input
                id="jobTitle"
                className={styles.formControl}
                type="text"
                value={jobTitle}
                onChange={(event) => setJobTitle(event.target.value)}
                required
              />
            </div>

            <div className={styles.formRow}>
              <label htmlFor="status">Status</label>
              <select
                id="status"
                className={styles.formControl}
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as ApplicationStatus)
                }
                required
              >
                {APPLICATION_STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formRow}>
              <label htmlFor="appliedAt">Applied at</label>
              <input
                id="appliedAt"
                className={styles.formControl}
                type="date"
                value={appliedAt}
                onChange={(event) => setAppliedAt(event.target.value)}
              />
            </div>
          </div>
          <button
            type="submit"
            className={`primaryButton ${styles.submitButton}`}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Create application"}
          </button>
        </form>
      </section>

      {isLoading ? (
        <p className="statusMessage">Loading applications</p>
      ) : loadError ? (
        <p role="alert" className="errorMessage">
          {loadError}
        </p>
      ) : applications.length === 0 ? (
        <p className="statusMessage">No applications found.</p>
      ) : (
        <ul className={styles.applicationList}>
          {applications.map((application) => (
            <ApplicationListItem
              application={application}
              key={application.id}
              isEditing={editingApplicationId === application.id}
              editForm={
                editingApplicationId === application.id ? editForm : null
              }
              isSaving={isSaving}
              updateError={
                editingApplicationId === application.id ? updateError : null
              }
              statusOptions={APPLICATION_STATUS_OPTIONS}
              onStartEdit={handleStartEdit}
              onCancelEdit={handleCancelEdit}
              onSubmit={handleUpdateApplication}
              onEditFormChange={handleEditFormChange}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
