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
          { label: "Reservation", href: "/admin/reservations", icon: RoleIcons.reservations },
          { label: "Manage Cottage", href: "/admin/cottages", icon: RoleIcons.cottage },
          { label: "Availability Calendar", href: "/admin/calendar", icon: RoleIcons.calendar },
          { label: "User Management", href: "/admin/users", icon: RoleIcons.users },
          { label: "Payments", href: "/admin/payments", icon: RoleIcons.payments },
          { label: "Invoices/Receipt", href: "/admin/invoices-receipts", icon: RoleIcons.documents },
          { label: "Reports", href: "/admin/reports", icon: RoleIcons.reports },
          { label: "Message", href: "/admin/messages", icon: RoleIcons.messages },
          { label: "Reviews", href: "/admin/reviews", icon: RoleIcons.reviews },
          { label: "Settings", href: "/admin/settings", icon: RoleIcons.settings },
        ]}
      >
        {children}
      </RoleShell>
    </ProtectedRoute>
  );
}
