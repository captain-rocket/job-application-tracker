import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ApiError, listApplications } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import type { Application } from "../types/api";
import styles from "./ApplicationsPage.module.css";

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

export function ApplicationsPage() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [applications, setApplications] = useState<Application[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    let ignore = false;

    async function loadApplications(authToken: string) {
      setIsLoading(true);
      setError(null);

      try {
        const response = await listApplications(authToken);

        if (ignore) return;

        setApplications(response.applications);
      } catch (error) {
        if (ignore) return;

        if (error instanceof ApiError && error.status === 401) return;

        setError(
          error instanceof Error
            ? error.message
            : "Unable to load applications",
        );
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    void loadApplications(token);

    return () => {
      ignore = true;
    };
  }, [token]);

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

      {isLoading ? (
        <p className="statusMessage">Loading applications</p>
      ) : error ? (
        <p role="alert" className="errorMessage">
          {error}
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
