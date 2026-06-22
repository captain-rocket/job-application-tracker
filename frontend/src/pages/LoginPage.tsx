import { useState, type SubmitEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import styles from "./LoginPage.module.css";

export function LoginPage() {
  const { user, login, loginDemo, isHydrating, authMessage } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDemoSubmitting, setIsDemoSubmitting] = useState(false);
  const isBusy = isSubmitting || isDemoSubmitting;

  if (isHydrating) {
    return (
      <div className="pageShell">
        <p role="status" className="statusMessage">
          Loading session...
        </p>
      </div>
    );
  }

  if (user) return <Navigate to="/applications" replace />;

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login({ email, password });
      navigate("/applications", { replace: true });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDemoLogin() {
    setError(null);
    setIsDemoSubmitting(true);

    try {
      await loginDemo();
      navigate("/applications", { replace: true });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Demo login failed");
    } finally {
      setIsDemoSubmitting(false);
    }
  }

  return (
    <div className={`pageShell ${styles.authLayout}`}>
      <div className={`surfacePanel ${styles.authPanel}`}>
        <h1>Sign In</h1>
        <p className={styles.formHint}>
          Use your existing account to view applications.
        </p>
        {error ? (
          <p role="alert" className="errorMessage">
            {error}
          </p>
        ) : authMessage ? (
          <p role="status" className="statusMessage">
            {authMessage}
          </p>
        ) : null}
        <form onSubmit={handleSubmit}>
          <div className={styles.formRow}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isBusy}
              required
            />
          </div>

          <div className={styles.formRow}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isBusy}
              required
            />
          </div>

          <button
            type="submit"
            className="primaryButton"
            disabled={isBusy}
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <button
          type="button"
          className={`secondaryButton ${styles.demoButton}`}
          onClick={() => void handleDemoLogin()}
          disabled={isBusy}
        >
          {isDemoSubmitting ? "Using demo..." : "Use Demo Account"}
        </button>
      </div>
    </div>
  );
}
