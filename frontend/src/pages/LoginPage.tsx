import { useState, type SubmitEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import styles from "./LoginPage.module.css";

export function LoginPage() {
  const { user, login, isHydrating } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isHydrating) {
    return (
      <div className="pageShell">
        <p className="statusMessage">Loading session...</p>
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
              required
            />
          </div>

          <button
            type="submit"
            className="primaryButton"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
