"use client";

import React from "react";
import { useUiStore } from "../../hooks/use-ui-store";
import { useTheme } from "../../providers/theme-provider";
import { CompanySelector } from "./company-selector";
import { ProfileMenu } from "./profile-menu";
import { Menu, Sun, Moon, Bell } from "lucide-react";

export function TopNav() {
  const { toggleSidebar } = useUiStore();
  const { theme, toggleTheme } = useTheme();

  const handleNotifClick = () => {
    const el = document.getElementById("dashboard-notifications");

    if (el) {
      el.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-zinc-200 bg-white/80 px-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="cursor-pointer rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 focus:outline-none dark:text-zinc-400 dark:hover:bg-zinc-900"
        >
          <Menu className="h-5 w-5" />
        </button>

        <CompanySelector />
      </div>

      <div className="flex items-center gap-4">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="cursor-pointer rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 focus:outline-none dark:text-zinc-400 dark:hover:bg-zinc-900"
        >
          {theme === "light" ? (
            <Moon className="h-5 w-5" />
          ) : (
            <Sun className="h-5 w-5" />
          )}
        </button>

        {/* Notifications - scrolls to dashboard notification section */}
        <button
          onClick={handleNotifClick}
          className="relative cursor-pointer rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 focus:outline-none dark:text-zinc-400 dark:hover:bg-zinc-900"
          aria-label="View notifications"
        >
          <Bell className="h-5 w-5" />

          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-emerald-500" />
        </button>

        <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800" />

        <ProfileMenu />
      </div>
    </header>
  );
}