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
  setUnauthorizedHandler,
} from "../api/client";
import { LoginRequestBody, MeResponse, User } from "../types/api";

const AUTH_TOKEN_STORAGE_KEY = "job-tracker-token";

type AuthContextValue = {
  user: User | null;
  token: string | null;
  isHydrating: boolean;
  login: (credentials: LoginRequestBody) => Promise<void>;
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

  const clearAuth = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    setUser(null);
    setToken(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clearAuth);

    return () => {
      setUnauthorizedHandler(null);
    };
  }, [clearAuth]);

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

  const login = useCallback(
    async (credentials: LoginRequestBody) => {
      const response = await loginRequest(credentials);

      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, response.token);
      setToken(response.token);
      setUser(toUser(response.user));
    },
    [clearAuth],
  );

  const logout = useCallback(() => {
    clearAuth();
  }, [clearAuth]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isHydrating,
      login,
      logout,
    }),
    [isHydrating, login, logout, token, user],
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
