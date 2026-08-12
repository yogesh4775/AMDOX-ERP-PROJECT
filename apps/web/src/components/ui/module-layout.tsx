"use client";

import React from "react";
import Link from "next/link";
import { Card } from "./card";

export interface StatItem {
  label: string;
  value: string | number;
  description?: string;
}

interface ModuleLayoutProps {
  title: string;
  description: string;
  breadcrumbs?: { label: string; href?: string }[];
  stats?: StatItem[];
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function ModuleLayout({
  title,
  description,
  breadcrumbs,
  stats,
  actions,
  children,
}: ModuleLayoutProps) {
  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto px-4 py-6">
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex text-xs font-semibold text-zinc-400 dark:text-zinc-500 gap-1.5 items-center">
          <Link href="/dashboard" className="hover:text-zinc-700 dark:hover:text-zinc-300">
            Dashboard
          </Link>
          {breadcrumbs.map((b, idx) => (
            <React.Fragment key={idx}>
              <span>/</span>
              {b.href ? (
                <Link href={b.href} className="hover:text-zinc-700 dark:hover:text-zinc-300">
                  {b.label}
                </Link>
              ) : (
                <span className="text-zinc-600 dark:text-zinc-400 font-bold">{b.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-zinc-50">
            {title}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl">{description}</p>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>

      {/* Stats Cards */}
      {stats && stats.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, idx) => (
            <Card key={idx} className="p-4 bg-zinc-50/50 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800">
              <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                {stat.label}
              </span>
              <div className="text-2xl font-black text-zinc-900 dark:text-zinc-50 mt-1">
                {stat.value}
              </div>
              {stat.description && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{stat.description}</p>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Main Content */}
      <div className="w-full mt-2">{children}</div>
    </div>
  );
}
