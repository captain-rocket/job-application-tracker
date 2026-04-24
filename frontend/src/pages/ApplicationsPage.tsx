import { useEffect, useState, type SubmitEvent, useRef } from "react";
import { useNavigate } from "react-router";
import { ApiError, createApplication, listApplications } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import type {
  Application,
  ApplicationStatus,
  CreateApplicationRequestBody,
} from "../types/api";
import styles from "./ApplicationsPage.module.css";

const APPLICATION_STATUS_OPTIONS: ApplicationStatus[] = [
  "saved",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
];

function formatAppliedAt(appliedAt: string | null) {
  if (!appliedAt) return "Not set";

  const date = new Date(appliedAt);

  if (Number.isNaN(date.getTime())) return appliedAt;

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function toAppliedAtRequestValue(value: string) {
  if (!value) return null;

  return `${value}T12:00:00.000Z`;
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
            <li
              key={application.id}
              className={`surfacePanel ${styles.applicationItem}`}
            >
              <h2>{application.company}</h2>

              <dl className={styles.applicationDetails}>
                <div>
                  <dt>Job title</dt>
                  <dd>{application.job_title}</dd>
                </div>

                <div>
                  <dt>Status</dt>
                  <dd>{application.status}</dd>
                </div>

                <div>
                  <dt>Applied At</dt>
                  <dd>{formatAppliedAt(application.applied_at)}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
