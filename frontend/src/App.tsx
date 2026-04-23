import { Navigate, Outlet, Route, Routes } from "react-router";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { ApplicationsPage } from "./pages/ApplicationsPage";
import { LoginPage } from "./pages/LoginPage";

function RouteLoading() {
  return (
    <div className="pageShell">
      <p className="statusMessage">Loading session...</p>
    </div>
  );
}

function RootRedirect() {
  const { user, isHydrating } = useAuth();

  if (isHydrating) return <RouteLoading />;

  return <Navigate to={user ? "applications" : "/login"} replace />;
}

function ProtectedRoute() {
  const { user, token, isHydrating } = useAuth();

  if (isHydrating) return <RouteLoading />;

  if (!user || !token) return <Navigate to="/login" replace />;

  return <Outlet />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/applications" element={<ApplicationsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
