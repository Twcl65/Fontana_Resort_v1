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
          { label: "Dashboard", href: "/cashier/dashboard", icon: RoleIcons.dashboard },
          { label: "Reservation", href: "/cashier/reservations", icon: RoleIcons.reservations },
          { label: "Availability Calendar", href: "/cashier/calendar", icon: RoleIcons.calendar },
          { label: "Payment", href: "/cashier/payments", icon: RoleIcons.payments },
          { label: "Invoices/Receipt", href: "/cashier/invoices-receipts", icon: RoleIcons.documents },
          { label: "Daily Transactions", href: "/cashier/daily-transaction", icon: RoleIcons.documents },
          { label: "Reports", href: "/cashier/reports", icon: RoleIcons.reports },
          { label: "Message", href: "/cashier/messages", icon: RoleIcons.messages },
          { label: "Reviews", href: "/cashier/reviews", icon: RoleIcons.reviews },
          { label: "Settings", href: "/cashier/settings", icon: RoleIcons.settings },
        ]}
      >
        {children}
      </RoleShell>
    </ProtectedRoute>
  );
}
