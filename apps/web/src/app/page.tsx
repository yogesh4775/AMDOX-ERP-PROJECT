"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../hooks/use-auth-store";
import { useAuth } from "../providers/auth-provider";

export default function Home() {
  const router = useRouter();
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!hasHydrated || loading) {
      return;
    }

    router.replace(isAuthenticated ? "/dashboard" : "/login");
  }, [hasHydrated, loading, isAuthenticated, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
      Redirecting...
    </div>
  );
}