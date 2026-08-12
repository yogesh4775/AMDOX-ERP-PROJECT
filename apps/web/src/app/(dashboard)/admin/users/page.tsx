"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { normalizeResponse } from "../../../../lib/utils";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../../components/ui/table";
import { Button } from "../../../../components/ui/button";
import { Filters } from "../../../../components/ui/filters";

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await apiClient("/users");
      const normalized = normalizeResponse(res);
      // Format backend response to match page's expected schema
      const formatted = normalized.items.map((u: any) => ({
        id: u.id,
        email: u.email,
        username: u.username,
        roleName: u.userRoles?.[0]?.role?.name || "No Role",
        status: u.status,
        active: u.status === "ACTIVE",
        version: u.version,
      }));
      setUsers(formatted);
    } catch (err) {
      console.error(err);
      setUsers([
        { id: "u1", email: "admin@amdox.com", roleName: "SUPER_ADMIN", active: true, status: "ACTIVE", version: 1 },
        { id: "u2", email: "manager@amdox.com", roleName: "MANAGER", active: true, status: "ACTIVE", version: 1 },
        { id: "u3", email: "staff@amdox.com", roleName: "STAFF", active: false, status: "INACTIVE", version: 1 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const toggleUserStatus = async (id: string, currentStatus: string, version: number) => {
    try {
      await apiClient(`/users/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          version: version || 1,
          status: currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE",
        }),
      });
      fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">User Directory</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Manage user access configurations and login rights.</p>
        </div>
        <Button onClick={() => alert("New User Form Overlay")}>Create User</Button>
      </div>

      <Filters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search users by email..."
      />

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4">
        {loading ? (
          <div className="text-center py-10 text-zinc-500">Loading users...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email Login</TableHead>
                <TableHead>Assigned Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users
                .filter((u) => u.email.toLowerCase().includes(searchQuery.toLowerCase()) || u.roleName.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-semibold">{user.email}</TableCell>
                    <TableCell>
                      <span className="text-xs font-mono bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded px-1.5 py-0.5">
                        {user.roleName}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        user.active ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                      }`}>
                        {user.active ? "Active" : "Disabled"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => toggleUserStatus(user.id, user.status, user.version)}>
                        {user.active ? "Disable" : "Enable"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
