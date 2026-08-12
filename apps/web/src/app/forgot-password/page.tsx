"use client";

import React, { useState } from "react";
import { apiClient } from "../../lib/api-client";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Loader2 } from "lucide-react";

interface ForgotPasswordResult {
  resetPasswordToken?: string;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const response = await apiClient<ForgotPasswordResult>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
        skipAuth: true,
      });
      const data = response.data;

      // Show reset token helper dynamically in dev for verification simplicity
      setSuccessMsg(
        `If the email matches an active account, a reset code was generated: ${data.resetPasswordToken || ""}`
      );
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-6 text-zinc-100 font-sans">
      <Card className="w-full max-w-md border-zinc-800 bg-zinc-900/50 backdrop-blur-xl shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold tracking-tight text-white">Reset Password</CardTitle>
          <p className="text-xs text-zinc-500 uppercase tracking-widest">Amdox ERP Credentials Recovery</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMsg && (
            <div className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-500 border border-rose-500/20 text-center font-medium">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-500 border border-emerald-500/20 text-center font-medium">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              label="Account Email"
              placeholder="admin@amdox.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin inline" /> : "Send Reset Code"}
            </Button>
          </form>

          <div className="text-center pt-2">
            <a href="/login" className="text-xs text-zinc-400 hover:underline">
              Back to Login
            </a>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
