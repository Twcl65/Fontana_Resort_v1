"use client";

import { ReactNode } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { RoleShell, RoleIcons } from "@/components/layouts/role-shell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute requiredRole="admin">
      <RoleShell
        roleLabel="Admin"
        sidebarItems={[
          { label: "Dashboard", href: "/admin", icon: RoleIcons.dashboard },
          { label: "Reservations", href: "/admin/reservations", icon: RoleIcons.reservations },
          { label: "Manage Cottages", href: "/admin/cottages", icon: RoleIcons.cottage },
          { label: "Payments", href: "/admin/payments", icon: RoleIcons.payments },
          { label: "Invoices/Receipts", href: "/admin/invoices-receipts", icon: RoleIcons.documents },
          {
            label: "Availability Calendar",
            href: "/admin/calendar",
            icon: RoleIcons.calendar
          },
          { label: "Reports", href: "/admin/reports", icon: RoleIcons.reports },
          { label: "User Management", href: "/admin/users", icon: RoleIcons.users },
          { label: "Messages", href: "/admin/messages", icon: RoleIcons.messages },
          { label: "Reviews", href: "/admin/reviews", icon: RoleIcons.reviews },
          { label: "Settings", href: "/admin/settings", icon: RoleIcons.settings }
        ]}
      >
        {children}
      </RoleShell>
    </ProtectedRoute>
  );
}
