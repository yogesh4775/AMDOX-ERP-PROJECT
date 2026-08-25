"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { useAuthStore } from "../hooks/use-auth-store";
import { apiClient } from "../lib/api-client";

interface AuthContextProps {
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    accessToken,
    refreshToken,
    user,
    hasHydrated,
    setAuth,
    clearAuth,
  } = useAuthStore();

  const [loading, setLoading] = useState(true);

  /**
   * Restore an existing session after Zustand hydration.
   *
   * Rules:
   * 1. If access token + user already exist, keep the session.
   * 2. If there is no refresh token, remain logged out.
   * 3. If a refresh token exists, rotate the session.
   * 4. Fetch /auth/me to restore the current user.
   */
  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    let cancelled = false;

    const restoreSession = async () => {
      // If access token + user already exist, verify its validity.
      if (accessToken && user) {
        try {
          const meResponse = await apiClient("/auth/me", {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            skipAuth: true,
          });

          const currentUser =
            (meResponse as { data?: any })?.data ?? meResponse;

          if (!currentUser || !currentUser.id) {
            throw new Error("Invalid session user data");
          }

          if (!cancelled) {
            setLoading(false);
          }
          return;
        } catch (err) {
          console.warn(
            "[AuthProvider] Cached access token invalid, attempting refresh...",
            err instanceof Error ? err.message : err
          );
          // Token is invalid/expired. Fall through to try refreshing the session.
        }
      }

      // No refresh token means there is no session to restore.
      if (!refreshToken) {
        if (!cancelled) {
          clearAuth();
          setLoading(false);
        }
        return;
      }

      try {
        const refreshResponse = await apiClient("/auth/refresh", {
          method: "POST",
          body: JSON.stringify({
            refreshToken,
          }),
          skipAuth: true,
        });

        const refreshData =
          (refreshResponse as { data?: any })?.data ?? refreshResponse;

        const newAccessToken = refreshData?.accessToken;
        const newRefreshToken =
          refreshData?.refreshToken ?? refreshToken;

        if (!newAccessToken) {
          throw new Error("Invalid refresh response");
        }

        if (cancelled) {
          return;
        }

        // Restore the authenticated user by passing the new token directly.
        const meResponse = await apiClient("/auth/me", {
          headers: {
            Authorization: `Bearer ${newAccessToken}`,
          },
          skipAuth: true,
        });

        const currentUser =
          (meResponse as { data?: any })?.data ?? meResponse;

        if (!currentUser) {
          throw new Error("Unable to restore authenticated user");
        }

        if (cancelled) {
          return;
        }

        setAuth(
          newAccessToken,
          newRefreshToken,
          currentUser
        );
      } catch (error) {
        console.warn(
          "[AuthProvider] Session restore failed:",
          error instanceof Error ? error.message : error
        );

        if (!cancelled) {
          clearAuth();
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, [
    hasHydrated,
    accessToken,
    refreshToken,
    user,
    setAuth,
    clearAuth,
  ]);

  /**
   * Background refresh.
   *
   * The backend uses rotating refresh tokens, so whenever a refresh
   * succeeds we save BOTH the new access token and the new refresh token.
   */
  useEffect(() => {
    if (
      !hasHydrated ||
      !accessToken ||
      !refreshToken ||
      !user
    ) {
      return;
    }

    let cancelled = false;

    const refreshSession = async () => {
      try {
        const currentRefreshToken =
          useAuthStore.getState().refreshToken;

        if (!currentRefreshToken) {
          return;
        }

        const refreshResponse = await apiClient(
          "/auth/refresh",
          {
            method: "POST",
            body: JSON.stringify({
              refreshToken: currentRefreshToken,
            }),
            skipAuth: true,
          }
        );

        const refreshData =
          (refreshResponse as { data?: any })?.data ?? refreshResponse;

        const newAccessToken =
          refreshData?.accessToken;

        const newRefreshToken =
          refreshData?.refreshToken ??
          currentRefreshToken;

        if (!newAccessToken) {
          throw new Error(
            "Invalid token refresh response"
          );
        }

        if (cancelled) {
          return;
        }

        const currentUser =
          useAuthStore.getState().user;

        if (!currentUser) {
          clearAuth();
          return;
        }

        setAuth(
          newAccessToken,
          newRefreshToken,
          currentUser
        );
      } catch (error) {
        console.error(
          "[AuthProvider] Background token refresh failed:",
          error
        );

        if (!cancelled) {
          clearAuth();
        }
      }
    };

    // Refresh before the normal access-token expiry window.
    const interval = window.setInterval(
      () => {
        void refreshSession();
      },
      14 * 60 * 1000
    );

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    hasHydrated,
    accessToken,
    refreshToken,
    user,
    setAuth,
    clearAuth,
  ]);

  const isAuthenticated =
    Boolean(accessToken) && Boolean(user);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used within an AuthProvider"
    );
  }

  return context;
}