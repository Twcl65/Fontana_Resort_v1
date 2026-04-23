"use client";

import { ReactNode } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { RoleShell, RoleIcons } from "@/components/layouts/role-shell";

export default function CashierLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute requiredRole="cashier">
      <RoleShell
        roleLabel="Cashier"
        sidebarItems={[
          { label: "Dashboard", href: "/cashier", icon: RoleIcons.dashboard },
          { label: "Reservations", href: "/cashier/reservations", icon: RoleIcons.reservations },
          { label: "Payments", href: "/cashier/payments", icon: RoleIcons.payments },
          { label: "Invoices/Receipts", href: "/cashier/invoices-receipts", icon: RoleIcons.documents },
          { label: "Daily Transaction", href: "/cashier/daily-transaction", icon: RoleIcons.calendar },
          { label: "Reports", href: "/cashier/reports", icon: RoleIcons.reports },
          { label: "Messages", href: "/cashier/messages", icon: RoleIcons.messages },
          { label: "Reviews", href: "/cashier/reviews", icon: RoleIcons.reviews },
          { label: "Settings", href: "/cashier/settings", icon: RoleIcons.settings },
        ]}
      >
        {children}
      </RoleShell>
    </ProtectedRoute>
  );
}
