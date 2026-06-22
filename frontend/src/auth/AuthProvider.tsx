import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getMe,
  login as loginRequest,
  loginDemo as loginDemoRequest,
  setUnauthorizedHandler,
} from "../api/client";
import {
  LoginRequestBody,
  LoginResponse,
  MeResponse,
  User,
} from "../types/api";

const AUTH_TOKEN_STORAGE_KEY = "job-tracker-token";

type AuthContextValue = {
  user: User | null;
  token: string | null;
  isHydrating: boolean;
  authMessage: string | null;
  login: (credentials: LoginRequestBody) => Promise<void>;
  loginDemo: () => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function toUser(user: MeResponse["user"] | User): User {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  const clearAuth = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    setUser(null);
    setToken(null);
  }, []);

  const handleUnauthorizedSession = useCallback(() => {
    clearAuth();
    setAuthMessage("Your session expired. Please sign in again.");
  }, [clearAuth]);

  useEffect(() => {
    setUnauthorizedHandler(handleUnauthorizedSession);

    return () => {
      setUnauthorizedHandler(null);
    };
  }, [handleUnauthorizedSession]);

  useEffect(() => {
    const storedToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

    if (!storedToken) {
      setIsHydrating(false);
      return;
    }

    let ignore = false;

    async function hydrateSession(authToken: string) {
      try {
        const response = await getMe(authToken);

        if (ignore) return;

        setToken(authToken);
        setUser(toUser(response.user));
      } catch {
        if (ignore) return;
      } finally {
        if (!ignore) setIsHydrating(false);
      }
    }

    void hydrateSession(storedToken);

    return () => {
      ignore = true;
    };
  }, [clearAuth]);

  const storeLoginResponse = useCallback((response: LoginResponse) => {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, response.token);
    setToken(response.token);
    setUser(toUser(response.user));
    setAuthMessage(null);
  }, []);

  const login = useCallback(
    async (credentials: LoginRequestBody) => {
      const response = await loginRequest(credentials);
      storeLoginResponse(response);
    },
    [storeLoginResponse],
  );

  const loginDemo = useCallback(async () => {
    const response = await loginDemoRequest();
    storeLoginResponse(response);
  }, [storeLoginResponse]);

  const logout = useCallback(() => {
    clearAuth();
    setAuthMessage(null);
  }, [clearAuth]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isHydrating,
      authMessage,
      login,
      loginDemo,
      logout,
    }),
    [isHydrating, authMessage, login, loginDemo, logout, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used with AuthProvider");
  }

  return context;
}
