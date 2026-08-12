"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../../lib/api-client";
import { Card, CardHeader, CardTitle, CardContent } from "../../../../../components/ui/card";
import { Button } from "../../../../../components/ui/button";
import { ArrowLeft, User, Mail, Calendar, MapPin, DollarSign } from "lucide-react";

export default function EmployeeProfilePage({ params }: { params: { id: string } }) {
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const data = await apiClient(`/hrm/employees/${params.id}`);
      setEmployee(data);
    } catch {
      setEmployee({
        id: params.id,
        employeeId: "EMP-001",
        name: "Alice Smith",
        department: "Engineering",
        designation: "Software Architect",
        email: "alice@amdox.com",
        phone: "+123456789",
        joiningDate: "2024-01-15",
        location: "New York, USA",
        salary: 12500,
        status: "ACTIVE",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [params.id]);

  if (loading) {
    return <div className="text-zinc-500 text-center py-10">Loading employee profile...</div>;
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Employee: {employee.name}
        </h1>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Employment Profile Details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm text-zinc-600 dark:text-zinc-400">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-zinc-400" />
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">{employee.employeeId}</p>
                  <p className="text-xs">Employee ID</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-zinc-400" />
                <div>
                  <p>{employee.email}</p>
                  <p className="text-xs">Work Email</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-zinc-400" />
                <div>
                  <p>{employee.joiningDate}</p>
                  <p className="text-xs">Date of Joining</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-zinc-400" />
                <div>
                  <p>{employee.location}</p>
                  <p className="text-xs">Office Location</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Contract Monthly Salary</p>
                <p className="text-2xl font-bold text-emerald-500 mt-1">${employee.salary.toLocaleString()}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                employee.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
              }`}>
                {employee.status}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Corporate Actions Card */}
        <Card>
          <CardHeader>
            <CardTitle>Management Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button variant="secondary" onClick={() => alert("Upload contract documents")}>
              Upload Document
            </Button>
            <Button variant="secondary" onClick={() => alert("Configure employee payroll adjustments")}>
              Adjust Payroll
            </Button>
            <Button variant="danger" onClick={() => alert("Terminate employment contract warning")}>
              Terminate Contract
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
