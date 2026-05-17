"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import FontanaLogoDashboard from "@/components/assets/fontana_logo_dashboard.png";
import {
  LayoutDashboard,
  Users,
  Building2,
  FileText,
  Settings,
  ClipboardList,
  ShieldCheck,
  Megaphone,
  BedDouble,
  UserCircle,
  CalendarClock,
  WalletCards,
  FileBadge,
  Bell,
  Menu,
  MoreVertical,
  Calendar,
  Star,
  MessageSquare
} from "lucide-react";
import { cn } from "@/components/ui/utils";
import { logout } from "@/lib/auth";
import { fetchCurrentUserWithRole } from "@/lib/auth";
import { getNotificationsForUser, type AppNotificationItem, type AppNotificationType } from "@/lib/fontana-notifications";

export type SidebarItem = {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
};

export type RoleShellProps = {
  roleLabel: string;
  sidebarItems: SidebarItem[];
  children: ReactNode;
  /** Client: show only avatar + menu controls in the header (no name/email block). */
  compactProfileHeader?: boolean;
};

type NotificationType = AppNotificationType;

type NotificationItem = AppNotificationItem;

export function RoleShell({
  roleLabel,
  sidebarItems,
  children,
  compactProfileHeader = false
}: RoleShellProps) {
  const router = useRouter();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [profileName, setProfileName] = useState("User");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState("");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const pathname = usePathname();

  const unreadCount = notifications.filter((n) => n.isNew).length;

  const activeItem =
    sidebarItems.find((item) => {
      const segments = item.href.split("/").filter(Boolean);
      const isRootItem = segments.length === 1;
      return isRootItem
        ? pathname === item.href
        : pathname === item.href || pathname.startsWith(item.href + "/");
    }) ?? sidebarItems[0];

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const current = await fetchCurrentUserWithRole();
        if (!current) return;
        const displayName = current.dbUser.full_name?.trim() || current.authUser.email || "User";
        const avatar =
          (typeof current.authUser.user_metadata?.avatar_url === "string" &&
            current.authUser.user_metadata.avatar_url) ||
          (typeof current.authUser.user_metadata?.picture === "string" &&
            current.authUser.user_metadata.picture) ||
          "";

        setProfileName(displayName);
        setProfileEmail(current.dbUser.email);
        setProfileAvatarUrl(avatar);
        const freshNotifications = await getNotificationsForUser(current.dbUser.role, current.dbUser.id);
        setNotifications(freshNotifications);
      } catch {
        // keep shell usable even if profile load fails
      }
    };

    loadProfile();
  }, []);

  const profileInitials = useMemo(() => {
    const source = profileName.trim() || profileEmail.trim();
    if (!source) return "U";
    const words = source.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return words
        .slice(0, 3)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("");
    }
    return source.slice(0, 3).toUpperCase();
  }, [profileName, profileEmail]);

  const shellRole = roleLabel.toLowerCase();
  const profileRoute =
    shellRole === "admin"
      ? "/admin/profile"
      : shellRole === "cashier"
        ? "/cashier/settings"
        : "/client/settings";
  const settingsRoute =
    shellRole === "admin"
      ? "/admin/settings"
      : shellRole === "cashier"
        ? "/cashier/settings"
        : "/client/settings";

  return (
    <div className="min-h-screen bg-muted">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden md:flex md:w-60 lg:w-68 flex-col border-r border-border bg-white">
          <div className="relative flex h-14 w-full items-center justify-center border-b border-border bg-white p-2">
            <Image
              src={FontanaLogoDashboard}
              alt="Fontana Blue Resort"
              className="h-full w-full object-contain object-center"
              fill
              sizes="(max-width: 768px) 0, 288px"
            />
          </div>

          <nav className="flex-1 space-y-3 px-4 py-2 text-sm">
            <p className="px-0 text-[0.65rem] font-sm uppercase tracking-wide text-muted-foreground">
              Main
            </p>
            <div className="space-y-1">
              {sidebarItems.map((item) => {
                const Icon = item.icon ?? LayoutDashboard;
                const segments = item.href.split("/").filter(Boolean);
                const isRootItem = segments.length === 1;
                const isActive = isRootItem
                  ? pathname === item.href
                  : pathname === item.href ||
                    pathname.startsWith(item.href + "/");

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3.5 py-2 text-[0.9rem] font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="border-t border-border px-4 py-3 text-[0.7rem] text-muted-foreground">
            <p>Fontana Blue Cold Spring</p>
          </div>
        </aside>

        {/* Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Global header */}
          <header className="hidden md:flex h-14 items-center justify-between border-b border-primary/20 bg-primary px-6 text-primary-foreground relative">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center"
              >
                <Menu className="h-6 w-6" />
              </button>
              <p className="text-sm font-semibold tracking-tight">
                {activeItem?.label ?? roleLabel}
              </p>
            </div>

            <div className="relative flex items-center gap-3">
              <button
                type="button"
                className="relative inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-primary-foreground/10"
                aria-label="Notifications"
                onClick={() => {
                  setShowNotifications((open) => !open);
                  setIsProfileOpen(false);
                }}
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[0.6rem] font-semibold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
              <div
                className={
                  compactProfileHeader
                    ? "flex items-center gap-1"
                    : "contents"
                }
              >
                <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-foreground/20 text-[0.65rem] font-semibold text-primary-foreground">
                  {profileAvatarUrl ? (
                    <img src={profileAvatarUrl} alt={profileName} className="h-full w-full object-cover" />
                  ) : (
                    profileInitials
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsProfileOpen((open) => !open)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-primary-foreground/10"
                  aria-label="Account menu"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>

              {isProfileOpen && (
                <div className="absolute right-0 top-10 z-50 w-40 rounded-md border border-border bg-card text-foreground text-xs shadow-lg">
                   <button
                    type="button"
                    className="block w-full px-3 py-2 text-left hover:bg-muted"
                    onClick={() => {
                      setIsProfileOpen(false);
                      router.push(profileRoute);
                    }}
                  >
                    Profile
                  </button>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left hover:bg-muted"
                    onClick={() => {
                      setIsProfileOpen(false);
                      router.push(settingsRoute);
                    }}
                  >
                    Settings
                  </button>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-destructive hover:bg-muted"
                  onClick={async () => {
                    setIsProfileOpen(false);
                    try {
                      await logout();
                    } finally {
                      router.push("/login");
                    }
                  }}
                  >
                    Sign out
                  </button>
                </div>
              )}

              {showNotifications && (
                <div className="absolute right-0 top-12 z-40 w-80 max-w-[calc(100vw-2rem)] rounded-md border border-border bg-card text-foreground text-xs shadow-lg">
                  <div className="flex items-center justify-between border-b px-3 py-2">
                    <p className="text-[0.75rem] font-semibold">
                      Notifications
                    </p>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] text-primary">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <div className="max-h-64 space-y-1 overflow-y-auto px-2 py-2">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className="rounded-md px-2 py-2 hover:bg-muted/80 cursor-pointer"
                      >
                        <p className="text-[0.7rem] font-semibold">
                          {n.title}
                        </p>
                        <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
                          {n.description}
                        </p>
                        <p className="mt-0.5 text-[0.65rem] text-muted-foreground/80">
                          {n.time}
                        </p>
                      </div>
                    ))}
                    {notifications.length === 0 && (
                      <p className="px-2 py-4 text-center text-[0.7rem] text-muted-foreground">
                        You have no notifications yet.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </header>

          {/* Mobile header */}
          <header className="relative flex md:hidden h-14 items-center justify-between gap-3 border-b border-primary/20 bg-primary px-4 text-primary-foreground">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center"
              >
                <Menu className="h-6 w-6" />
              </button>
              <p className="truncate text-sm font-semibold tracking-tight">
                {activeItem?.label ?? roleLabel}
              </p>
            </div>

            <div className="relative flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/20 text-primary-foreground"
                aria-label="Notifications"
                onClick={() => {
                  setShowNotifications((open) => !open);
                  setIsProfileOpen(false);
                }}
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[0.6rem] font-semibold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              <div className="flex items-center gap-0.5">
                <div className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary-foreground/20 text-[0.6rem] font-semibold text-primary-foreground">
                  {profileAvatarUrl ? (
                    <img src={profileAvatarUrl} alt={profileName} className="h-full w-full object-cover" />
                  ) : (
                    profileInitials
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsProfileOpen((open) => !open)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-primary-foreground/10"
                  aria-label="Account menu"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>

              {isProfileOpen && (
                <div className="absolute right-0 top-11 z-50 w-40 rounded-md border border-border bg-card text-foreground text-xs shadow-lg">
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left hover:bg-muted"
                    onClick={() => {
                      setIsProfileOpen(false);
                      router.push(profileRoute);
                    }}
                  >
                    Profile
                  </button>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left hover:bg-muted"
                    onClick={() => {
                      setIsProfileOpen(false);
                      router.push(settingsRoute);
                    }}
                  >
                    Settings
                  </button>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-destructive hover:bg-muted"
                    onClick={async () => {
                      setIsProfileOpen(false);
                      try {
                        await logout();
                      } finally {
                        router.push("/login");
                      }
                    }}
                  >
                    Sign out
                  </button>
                </div>
              )}

              {showNotifications && (
                <div className="absolute right-0 top-12 z-40 w-80 max-w-[calc(100vw-2rem)] rounded-md border border-border bg-card text-foreground text-xs shadow-lg">
                  <div className="flex items-center justify-between border-b px-3 py-2">
                    <p className="text-[0.75rem] font-semibold">Notifications</p>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] text-primary">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <div className="max-h-64 space-y-1 overflow-y-auto px-2 py-2">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className="cursor-pointer rounded-md px-2 py-2 hover:bg-muted/80"
                      >
                        <p className="text-[0.7rem] font-semibold">{n.title}</p>
                        <p className="mt-0.5 text-[0.7rem] text-muted-foreground">{n.description}</p>
                        <p className="mt-0.5 text-[0.65rem] text-muted-foreground/80">{n.time}</p>
                      </div>
                    ))}
                    {notifications.length === 0 && (
                      <p className="px-2 py-4 text-center text-[0.7rem] text-muted-foreground">
                        You have no notifications yet.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </header>

          <main className="flex-1 bg-muted px-4 py-4 sm:px-6 sm:py-6 md:px-6 lg:px-8">
            <div className="max-w-6xl space-y-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

// Export some icons to reuse when building menus
export const RoleIcons = {
  dashboard: LayoutDashboard,
  users: Users,
  dorms: BedDouble,
  reports: FileText,
  settings: Settings,
  accreditation: ClipboardList,
  safety: ShieldCheck,
  monitoring: Building2,
  announcements: Megaphone,
  rooms: BedDouble,
  tenants: UserCircle,
  reservations: CalendarClock,
  payments: WalletCards,
  documents: FileBadge,
  bell: Bell,
  messages: MessageSquare,
  feedback: FileText,
  cottage: Building2,
  calendar: Calendar,
  reviews: Star
};

