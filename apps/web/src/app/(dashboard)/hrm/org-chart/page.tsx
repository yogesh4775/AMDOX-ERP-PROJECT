"use client";

import React from "react";
import { Card } from "../../../../components/ui/card";
import { Users, User, ArrowDown } from "lucide-react";

export default function OrgChartPage() {
  return (
    <div className="flex flex-col gap-6 w-full items-center">
      <div className="w-full text-left">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Corporate Organization Chart</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Flexbox-based hierarchical corporate structure map.</p>
      </div>

      <div className="flex flex-col items-center gap-6 mt-8 w-full">
        {/* CEO / Root Node */}
        <div className="flex flex-col items-center">
          <Card className="p-4 border-emerald-500/50 shadow-md text-center max-w-[200px]">
            <div className="rounded-full bg-emerald-500/10 p-2 text-emerald-500 mx-auto w-10 h-10 flex items-center justify-center mb-2">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-sm">CEO Office</h3>
            <p className="text-xs text-zinc-400">Executive Director</p>
          </Card>
          <ArrowDown className="h-6 w-6 text-zinc-400 mt-2" />
        </div>

        {/* Second Level: Division Managers */}
        <div className="flex flex-wrap justify-center gap-8 w-full border-t border-zinc-200 dark:border-zinc-800 pt-6">
          {/* Engineering */}
          <div className="flex flex-col items-center gap-4">
            <Card className="p-4 text-center max-w-[180px]">
              <h4 className="font-bold text-sm">Engineering Dept</h4>
              <p className="text-xs text-zinc-400">Alice Smith (Head)</p>
            </Card>
            <ArrowDown className="h-4 w-4 text-zinc-400" />
            {/* Engineering Sub-nodes */}
            <div className="flex gap-4">
              <Card className="p-3 text-center text-xs">
                <p className="font-semibold">Software Arch</p>
              </Card>
              <Card className="p-3 text-center text-xs">
                <p className="font-semibold">DevOps Eng</p>
              </Card>
            </div>
          </div>

          {/* Finance */}
          <div className="flex flex-col items-center gap-4">
            <Card className="p-4 text-center max-w-[180px]">
              <h4 className="font-bold text-sm">Finance & Ledger</h4>
              <p className="text-xs text-zinc-400">Bob Jones (Head)</p>
            </Card>
            <ArrowDown className="h-4 w-4 text-zinc-400" />
            {/* Finance Sub-nodes */}
            <div className="flex gap-4">
              <Card className="p-3 text-center text-xs">
                <p className="font-semibold">General Ledger</p>
              </Card>
            </div>
          </div>

          {/* HR */}
          <div className="flex flex-col items-center gap-4">
            <Card className="p-4 text-center max-w-[180px]">
              <h4 className="font-bold text-sm">Human Resources</h4>
              <p className="text-xs text-zinc-400">Charlie Brown (Head)</p>
            </Card>
            <ArrowDown className="h-4 w-4 text-zinc-400" />
            {/* HR Sub-nodes */}
            <div className="flex gap-4">
              <Card className="p-3 text-center text-xs">
                <p className="font-semibold">Talent Acquisition</p>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
