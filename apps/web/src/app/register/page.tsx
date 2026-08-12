"use client";

import React, { useState } from "react";
import { useAuthStore } from "../../hooks/use-auth-store";
import { apiClient } from "../../lib/api-client";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Loader2 } from "lucide-react";

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const { setAuth } = useAuthStore();

  const getPasswordStrength = () => {
    if (!password) return { label: "", color: "bg-zinc-800" };
    if (password.length < 6) return { label: "Weak", color: "bg-rose-500" };
    const hasLetters = /[a-zA-Z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    if (hasLetters && hasNumbers && hasSpecial) return { label: "Strong", color: "bg-emerald-500" };
    return { label: "Medium", color: "bg-amber-500" };
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      // 1. Create account
      await apiClient("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, username, password }),
        skipAuth: true,
      });

      // 2. Automatical login
      const authResponse = await apiClient<AuthTokens>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: email, password }),
        skipAuth: true,
      });
      const authData = authResponse.data;

      // 3. Resolve user details by passing the newly obtained token directly
      const meResponse = await apiClient<import("../../hooks/use-auth-store").UserInfo>("/auth/me", {
        headers: {
          Authorization: `Bearer ${authData.accessToken}`,
        },
        skipAuth: true,
      });
      const userData = meResponse.data;

      setAuth(authData.accessToken, authData.refreshToken, userData);
      window.location.href = "/dashboard";
    } catch (err: any) {
      setErrorMsg(err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  const strength = getPasswordStrength();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-6 text-zinc-100 font-sans">
      <Card className="w-full max-w-md border-zinc-800 bg-zinc-900/50 backdrop-blur-xl shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold tracking-tight text-white">Create Account</CardTitle>
          <p className="text-xs text-zinc-500 uppercase tracking-widest">Sign Up for Amdox ERP</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMsg && (
            <div className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-500 border border-rose-500/20 text-center font-medium">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <Input
              type="email"
              label="Email Address"
              placeholder="user@amdox.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              type="text"
              label="Username"
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />

            <div>
              <Input
                type="password"
                label="Password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {password && (
                <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
                  <span>Strength: {strength.label}</span>
                  <div className="flex gap-1">
                    <span className={`h-1.5 w-6 rounded ${strength.color}`} />
                  </div>
                </div>
              )}
            </div>

            <Input
              type="password"
              label="Confirm Password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin inline" /> : "Sign Up"}
            </Button>
          </form>

          <div className="text-center pt-2">
            <a href="/login" className="text-xs text-zinc-400 hover:underline">
              Already have an account? Sign In
            </a>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
