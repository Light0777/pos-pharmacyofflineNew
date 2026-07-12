import { createContext, useContext, useEffect, useState } from "react";
import { apiGet, setOnUnauthorized } from "../renderer/services/api";

const VALID_ROLES = ["admin", "manager", "cashier"] as const;

type UserRole = typeof VALID_ROLES[number];

type User = {
  user_uuid?: string;
  name: string;
  role: UserRole;
  email?: string;
};

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function isValidRole(role: string): role is UserRole {
  if (role === 'owner') return true;
  return VALID_ROLES.includes(role as UserRole);
}

function isUserValid(user: any): user is User {
  return user && typeof user === "object" && user.name && isValidRole(user.role);
}

function normalizeUser(user: any): User {
  if (user.role === 'owner') {
    return { ...user, role: 'admin' };
  }
  return user;
}

  // 🔥 INIT AUTH (runs once on app load)
  useEffect(() => {
    setOnUnauthorized(logout);

    const init = async (retries = 2): Promise<void> => {
      const storedToken = localStorage.getItem("token");
      const storedUser = localStorage.getItem("user");

      if (!storedToken || !storedUser) {
        setUser(null);
        setToken(null);
        setLoading(false);
        return;
      }

      setToken(storedToken);
      try {
        const res = await apiGet("/auth/me");

        const userData = res?.data?.user || res?.user;

        const normalizedUserData = userData ? normalizeUser(userData) : null;
        if (normalizedUserData && isUserValid(normalizedUserData)) {
          setUser(normalizedUserData);
          localStorage.setItem("user", JSON.stringify(normalizedUserData));
        } else if (userData && !isUserValid(userData)) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setToken(null);
          setUser(null);
        } else if (res?.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setToken(null);
          setUser(null);
        } else {
          // Empty or unexpected response — fall back to stored user (offline/server-not-ready mode)
          try {
            const parsedUser = normalizeUser(JSON.parse(storedUser));
            if (isUserValid(parsedUser)) {
              setUser(parsedUser);
            } else {
              localStorage.removeItem("token");
              localStorage.removeItem("user");
              setToken(null);
              setUser(null);
            }
          } catch {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            setToken(null);
            setUser(null);
          }
        }
      } catch (e) {
        // Network error — retry if server might not be ready yet
        if (retries > 0) {
          await new Promise(r => setTimeout(r, 1000));
          return init(retries - 1);
        }
        // Use cached user for offline mode
        let parsedUser: any;
        try {
          parsedUser = normalizeUser(JSON.parse(storedUser));
        } catch (error) {
          console.error("Failed to parse stored user data", error);
        }
        if (parsedUser && isUserValid(parsedUser)) {
          setUser(parsedUser);
        } else {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setToken(null);
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // ✅ LOGIN - Store both token and user
  const login = (newToken: string, newUser: User) => {
    const normalized = normalizeUser(newUser);
    if (!isUserValid(normalized)) {
      console.error("Invalid user data");
      return;
    }
    setToken(newToken);
    setUser(normalized);

    // Store in localStorage for persistence
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(normalized));
  };

  // ✅ LOGOUT - Clear everything
  const logout = () => {
    setToken(null);
    setUser(null);

    // Clear localStorage
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    // Navigate to login
    window.location.reload();
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};