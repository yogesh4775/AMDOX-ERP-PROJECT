"use client";

import React, { useState, useEffect } from "react";
import { useAuthStore, UserInfo } from "../../../hooks/use-auth-store";
import { apiClient } from "../../../lib/api-client";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface UserRolePayload {
  role: {
    name: string;
    rolePermissions: Array<{ permission: { name: string } }>;
  };
}

interface UserPayload {
  id: string;
  email: string;
  username: string;
  tenantId: string;
  userRoles: UserRolePayload[];
}

export default function MfaPage() {
  const { setAuth } = useAuthStore();
  const [code, setCode] = useState("");
  const [mfaRequiredToken, setMfaRequiredToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Read the token from URL query parameters
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      setMfaRequiredToken(token);
    } else {
      setError("MFA session token is missing. Please return to the login page.");
    }
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaRequiredToken) {
      setError("MFA session token is missing. Please return to the login page.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const response = await apiClient<AuthTokens>("/auth/mfa/verify", {
        method: "POST",
        body: JSON.stringify({ code, mfaRequiredToken }),
        skipAuth: true,
      });

      const token = response.data.accessToken;
      const payloadBase64 = token.split(".")[1];
      const payloadDecoded = JSON.parse(atob(payloadBase64));
      const userId = payloadDecoded.sub;

      // Fetch user profile details
      const userResponse = await apiClient<UserPayload>(`/users/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        skipAuth: true,
      });

      const userPayload: UserInfo = {
        id: userResponse.data.id,
        email: userResponse.data.email,
        username: userResponse.data.username,
        tenantId: userResponse.data.tenantId,
        roles: userResponse.data.userRoles.map((userRole) => userRole.role.name),
        permissions: userResponse.data.userRoles.flatMap((userRole) =>
          userRole.role.rolePermissions.map((rolePermission) => rolePermission.permission.name),
        ),
      };

      setAuth(response.data.accessToken, response.data.refreshToken, userPayload);
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-zinc-100 font-sans relative">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px] pointer-events-none" />

      <Card className="w-full max-w-md border-zinc-800 bg-zinc-900/50 backdrop-blur-xl shadow-2xl transition-all duration-300 hover:border-emerald-500/30">
        <CardHeader>
          <span className="text-xs font-semibold tracking-widest text-emerald-400 uppercase">
            Security Check
          </span>
          <CardTitle className="text-2xl font-bold tracking-tight text-white mt-1">
            Two-Factor Verification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerify} className="flex flex-col gap-4">
            <Input
              label="6-Digit Verification Code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. 123456"
              className="bg-zinc-900 border-zinc-800 text-zinc-200"
              required
              maxLength={6}
            />

            {error && (
              <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-500 font-medium">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading || !mfaRequiredToken} className="w-full">
              {loading ? "Verifying..." : "Verify & Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
