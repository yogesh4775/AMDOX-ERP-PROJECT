"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { useAuthStore } from "../../hooks/use-auth-store";
import { useAuth } from "../../providers/auth-provider";
import { apiClient } from "../../lib/api-client";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../../components/ui/card";

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface UserInfo {
  id: string;
  email: string;
  username: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const {
    setAuth,
    clearAuth,
    hasHydrated,
  } = useAuthStore();

  /**
   * Redirect only when the auth store has finished hydrating,
   * the auth provider has finished verifying the session,
   * and the user is authenticated.
   */
  useEffect(() => {
    if (!hasHydrated || authLoading) {
      return;
    }

    if (isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [hasHydrated, authLoading, isAuthenticated, router]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      /**
       * IMPORTANT:
       *
       * Login must NOT use the existing access token
       * and must NOT trigger automatic refresh.
       */
      const authResponse = await apiClient<AuthTokens>(
        "/auth/login",
        {
          method: "POST",
          skipAuth: true,
          body: JSON.stringify({
            username: email.trim(),
            password,
          }),
        },
      );

      const authData = authResponse.data;

      /**
       * Validate login response.
       */
      if (
        !authData ||
        typeof authData.accessToken !== "string" ||
        typeof authData.refreshToken !== "string"
      ) {
        throw new Error(
          "Login response is missing authentication tokens.",
        );
      }

      /**
       * Get authenticated user information by passing the newly obtained token directly.
       * This avoids updating the Zustand store with a partial state (tokens without user),
       * which would trigger the AuthProvider session-restore/refresh effects prematurely.
       */
      const meResponse = await apiClient<UserInfo>(
        "/auth/me",
        {
          headers: {
            Authorization: `Bearer ${authData.accessToken}`,
          },
          skipAuth: true,
        }
      );

      const userData = meResponse.data;

      if (!userData || !userData.id) {
        throw new Error(
          "Unable to load authenticated user information.",
        );
      }

      /**
       * Store complete authentication state atomically.
       */
      setAuth(
        authData.accessToken,
        authData.refreshToken,
        userData,
      );

      setSuccessMsg("Logged in successfully!");

      /**
       * Go to dashboard only after authentication
       * and /auth/me both succeed.
       */
      router.replace("/dashboard");
    } catch (err: unknown) {
      /**
       * Login failed.
       *
       * Clear any partially stored authentication state.
       */
      clearAuth();

      let message = "Unable to sign in.";

      if (err instanceof Error && err.message) {
        message = err.message;
      }

      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  if (!hasHydrated || authLoading) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center px-4 text-zinc-400">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
          <span>Verifying session...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black flex items-center justify-center px-4">
      <Card className="w-full max-w-md bg-zinc-950 border-zinc-800">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-white">
            Amdox ERP
          </CardTitle>

          <p className="text-sm text-zinc-500 uppercase tracking-wider">
            Sign In to Workspace
          </p>
        </CardHeader>

        <CardContent>
          {errorMsg && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
              {successMsg}
            </div>
          )}

          <form
            onSubmit={handleLogin}
            className="space-y-4"
          >
            <Input
              type="email"
              label="Email"
              placeholder="admin@amdox.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />

            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                label="Password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword((previous) => !previous)
                }
                disabled={loading}
                className="absolute right-3 top-[34px] text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            <div className="flex justify-end">
              <a
                href="/forgot-password"
                className="text-xs text-emerald-400 hover:underline"
              >
                Forgot password?
              </a>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing In...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="relative flex items-center justify-center my-4">
            <span className="absolute w-full border-t border-zinc-800" />

            <span className="relative bg-zinc-950 px-3 text-xs text-zinc-500">
              Don&apos;t have an account?
            </span>
          </div>

          <Button
            variant="secondary"
            className="w-full"
            disabled={loading}
            onClick={() => {
              window.location.href = "/register";
            }}
          >
            Create Account
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}