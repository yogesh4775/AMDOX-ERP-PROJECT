import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={twMerge(
        clsx(
          "inline-flex items-center justify-center font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
          {
            "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/10 focus:ring-offset-zinc-900":
              variant === "primary",
            "bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 focus:ring-offset-zinc-900":
              variant === "secondary",
            "bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/10 focus:ring-offset-zinc-900":
              variant === "danger",
            "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800": variant === "ghost",
            "text-xs px-3 py-1.5": size === "sm",
            "text-sm px-4 py-2": size === "md",
            "text-base px-5 py-2.5": size === "lg",
          },
          className,
        ),
      )}
      {...props}
    />
  );
}
