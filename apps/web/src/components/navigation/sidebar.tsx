"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "../../hooks/use-auth-store";
import { useUiStore } from "../../hooks/use-ui-store";
import { navigationConfig } from "../../config/navigation";
import { ChevronDown, ChevronRight, FolderTree } from "lucide-react";

export function Sidebar() {
  const { user } = useAuthStore();
  const { sidebarOpen, setSidebarOpen } = useUiStore();
  const pathname = usePathname();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Pre-expand active group
    const activeGroup = navigationConfig.find((group) =>
      group.subItems?.some((sub) => sub.path === pathname)
    );
    if (activeGroup) {
      setExpandedGroups((prev) => ({
        ...prev,
        [activeGroup.name]: true,
      }));
    }
  }, [pathname]);

  if (!user) return null;

  // Filter items by user permissions
  const filteredGroups = navigationConfig
    .map((group) => {
      if (group.subItems) {
        const filteredSubs = group.subItems.filter((sub) => {
          if (!sub.permission) return true;
          const isUserAdmin = user.roles?.some((r: string) => {
            const role = r.toLowerCase().replace(/_/g, " ");
            return role === "admin" || role === "super admin";
          });
          if (isUserAdmin) return true;
          return user.permissions?.includes(sub.permission);
        });
        return { ...group, subItems: filteredSubs };
      }
      return group;
    })
    .filter((group) => {
      if (group.subItems) {
        return group.subItems.length > 0;
      }
      if (!group.permission) return true;
      const isUserAdmin = user.roles?.some((r: string) => {
        const role = r.toLowerCase().replace(/_/g, " ");
        return role === "admin" || role === "super admin";
      });
      if (isUserAdmin) return true;
      return user.permissions?.includes(group.permission);
    });

  const toggleGroup = (name: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  return (
    <aside
      className={`fixed top-0 left-0 z-30 h-full border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 transition-all duration-300 ${
        sidebarOpen ? "w-64" : "w-16"
      }`}
    >
      <div className="flex h-16 items-center gap-2 px-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 font-bold text-white">
          A
        </div>
        {sidebarOpen && (
          <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            Amdox ERP
          </span>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-2 py-4 h-[calc(100%-4rem)] overflow-y-auto">
        {filteredGroups.map((group) => {
          const Icon = group.icon;
          const isExpanded = !!expandedGroups[group.name];
          const hasSubItems = !!group.subItems && group.subItems.length > 0;

          if (!hasSubItems && group.path) {
            const isActive = pathname === group.path;
            return (
              <Link
                key={group.name}
                href={group.path}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-50"
                }`}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 ${
                    isActive ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 dark:text-zinc-500"
                  }`}
                />
                {sidebarOpen && <span>{group.name}</span>}
              </Link>
            );
          }

          return (
            <div key={group.name} className="space-y-1">
              <button
                onClick={() => {
                  if (!sidebarOpen) {
                    setSidebarOpen(true);
                  }
                  toggleGroup(group.name);
                }}
                className="w-full group flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 shrink-0 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300" />
                  {sidebarOpen && <span>{group.name}</span>}
                </div>
                {sidebarOpen && (
                  isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-zinc-400 shrink-0" />
                  )
                )}
              </button>

              {sidebarOpen && isExpanded && group.subItems && (
                <div className="mt-1 ml-4 pl-3 border-l border-zinc-200 dark:border-zinc-800 space-y-1">
                  {group.subItems.map((sub) => {
                    const SubIcon = sub.icon || FolderTree;
                    const isActive = pathname === sub.path;
                    return (
                      <Link
                        key={sub.name}
                        href={sub.path}
                        className={`group flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                          isActive
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-50"
                        }`}
                      >
                        <SubIcon
                          className={`h-4 w-4 shrink-0 ${
                            isActive ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 dark:text-zinc-500"
                          }`}
                        />
                        <span>{sub.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
