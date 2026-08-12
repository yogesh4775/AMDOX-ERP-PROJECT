"use client";

import React, { useEffect, useState } from "react";
import { useAuthStore } from "../../hooks/use-auth-store";
import { useUiStore } from "../../hooks/use-ui-store";
import { ThemeProvider } from "../../providers/theme-provider";
import { CompanyProvider } from "../../providers/company-provider";
import { Sidebar } from "../../components/navigation/sidebar";
import { TopNav } from "../../components/navigation/topnav";
import { useAuth } from "../../providers/auth-provider";
import { useRouter } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const { sidebarOpen } = useUiStore();
  const { loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && hasHydrated && !loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [mounted, hasHydrated, loading, isAuthenticated, router]);

  if (!mounted || !hasHydrated || loading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        Authenticating session...
      </div>
    );
  }

  return (
    <ThemeProvider>
      <CompanyProvider>
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 transition-colors">
          {/* Collapsible Sidebar */}
          <Sidebar />

          {/* Main Layout Content Container */}
          <div
            className={`flex flex-col min-h-screen transition-all duration-300 ${
              sidebarOpen ? "pl-64" : "pl-16"
            }`}
          >
            {/* Top Navigation */}
            <TopNav />

            {/* Main Content Area */}
            <main className="flex-1 p-6 md:p-8 overflow-y-auto">{children}</main>
          </div>
        </div>
      </CompanyProvider>
    </ThemeProvider>
  );
}
