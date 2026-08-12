"use client";

import React from "react";
import { useAuthStore } from "../../hooks/use-auth-store";

interface CompanyPermissionGuardProps {
  permission: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function CompanyPermissionGuard({
  permission,
  fallback = null,
  children,
}: CompanyPermissionGuardProps) {
  const { user } = useAuthStore();

  if (!user) return fallback as React.JSX.Element | null;

  // Admins bypass all guards
  const isAdmin = user.roles?.includes("Admin") || user.roles?.includes("Super Admin");
  const hasPermission = user.permissions?.includes(permission);

  if (isAdmin || hasPermission) {
    return <>{children}</>;
  }

  return fallback as React.JSX.Element | null;
}
