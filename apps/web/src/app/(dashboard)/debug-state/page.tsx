"use client";

import React from "react";
import { useAuthStore } from "../../../hooks/use-auth-store";

export default function DebugStatePage() {
  const auth = useAuthStore();

  return (
    <div className="p-6 bg-zinc-900 text-zinc-100 rounded-lg font-mono text-sm space-y-4">
      <h1 className="text-xl font-bold">Zustand Auth Store State Debugger</h1>
      
      <div>
        <h2 className="font-semibold text-emerald-400">accessToken:</h2>
        <pre className="bg-zinc-950 p-2 rounded overflow-x-auto max-w-full">
          {auth.accessToken ? `${auth.accessToken.substring(0, 30)}...` : "null"}
        </pre>
      </div>

      <div>
        <h2 className="font-semibold text-emerald-400">refreshToken:</h2>
        <pre className="bg-zinc-950 p-2 rounded overflow-x-auto max-w-full">
          {auth.refreshToken ? `${auth.refreshToken.substring(0, 30)}...` : "null"}
        </pre>
      </div>

      <div>
        <h2 className="font-semibold text-emerald-400">activeCompanyId:</h2>
        <pre className="bg-zinc-950 p-2 rounded overflow-x-auto max-w-full">
          {auth.activeCompanyId || "null"}
        </pre>
      </div>

      <div>
        <h2 className="font-semibold text-emerald-400">user:</h2>
        <pre className="bg-zinc-950 p-2 rounded overflow-x-auto max-w-full">
          {JSON.stringify(auth.user, null, 2)}
        </pre>
      </div>
    </div>
  );
}
