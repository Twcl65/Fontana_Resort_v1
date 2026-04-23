"use client";

import { ReactNode } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { RoleShell, RoleIcons } from "@/components/layouts/role-shell";

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute requiredRole="client">
      <RoleShell
        roleLabel="Customer"
        compactProfileHeader
        sidebarItems={[
          { label: "Dashboard", href: "/client", icon: RoleIcons.dashboard },
          { label: "My Reservations", href: "/client/reservations", icon: RoleIcons.reservations },
          { label: "Book New Cottages", href: "/client/cottage", icon: RoleIcons.dorms },
          { label: "Availability Calendar", href: "/client/calendar", icon: RoleIcons.calendar },
          { label: "Booking History", href: "/client/history", icon: RoleIcons.payments },
          { label: "Payments", href: "/client/payments", icon: RoleIcons.announcements },
          { label: "Messages", href: "/client/messages", icon: RoleIcons.messages },
          { label: "Feedback", href: "/client/feedback", icon: RoleIcons.feedback },
          { label: "Settings", href: "/client/settings", icon: RoleIcons.settings }
        ]}
      >
        {children}
      </RoleShell>
    </ProtectedRoute>
  );
}

