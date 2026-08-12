"use client";

import React, { useState } from "react";
import { useAuthStore } from "../../hooks/use-auth-store";
import { Button } from "../ui/button";
import { apiClient } from "../../lib/api-client";
import { useRouter } from "next/navigation";

export function ProfileMenu() {
  const { user, clearAuth } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    setLoggingOut(true);

    try {
      await apiClient("/auth/logout", {
        method: "POST",
      });
    } catch {
      // Clear the client session even if the server session is already invalid.
    } finally {
      clearAuth();
      setIsOpen(false);
      setLoggingOut(false);
      router.replace("/login");
    }
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 focus:outline-none cursor-pointer"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white shadow-md">
          {user.username.substring(0, 2).toUpperCase()}
        </div>
        <span className="hidden md:inline text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {user.username}
        </span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-56 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 shadow-xl z-20 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex flex-col space-y-1 pb-2 border-b border-zinc-200 dark:border-zinc-800">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{user.username}</span>
              <span className="text-xs text-zinc-500 truncate">{user.email}</span>
            </div>
            <div className="py-2 text-xs text-zinc-500 flex flex-col gap-1">
              <span>Roles: {user.roles?.join(", ") || "None"}</span>
            </div>
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <Button
                variant="danger"
                size="sm"
                onClick={() => void handleLogout()}
                className="w-full"
                disabled={loggingOut}
              >
                {loggingOut ? "Logging Out..." : "Log Out"}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
