"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Shield, User, Pencil, Archive, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { PageToolbar } from "@/components/ui/page-toolbar";

type UserRole = "admin" | "cashier" | "client";
type UserStatus = "active" | "inactive";
type UserRecord = {
  id: string;
  full_name: string | null;
  email: string;
  role: UserRole;
  status: UserStatus;
  created_at?: string;
};

type UserForm = {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<UserRecord | null>(null);
  const [form, setForm] = useState<UserForm>({
    id: "",
    full_name: "",
    email: "",
    role: "client",
    status: "active"
  });
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [createForm, setCreateForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "client" as Exclude<UserRole, "admin">,
  });
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showEditNewPassword, setShowEditNewPassword] = useState(false);
  const [showEditConfirmPassword, setShowEditConfirmPassword] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error("Your session expired. Please log in again.");
      }

      const response = await fetch("/api/admin/users", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const result = (await response.json()) as { users?: UserRecord[]; error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Failed to load users.");
      }

      setUsers(result.users ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const openEditDialog = (user: UserRecord) => {
    setEditTargetId(user.id);
    setForm({
      id: user.id,
      full_name: user.full_name ?? "",
      email: user.email,
      role: user.role,
      status: user.status
    });
    setNewPassword("");
    setConfirmNewPassword("");
    setShowEditNewPassword(false);
    setShowEditConfirmPassword(false);
    setIsEditOpen(true);
  };

  const openArchiveDialog = (user: UserRecord) => {
    setArchiveTarget(user);
    setIsArchiveOpen(true);
  };

  const getAccessToken = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      throw new Error("Your session expired. Please log in again.");
    }
    return accessToken;
  };

  const handleUpdateUser = async () => {
    if (!editTargetId) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const trimmedNew = newPassword.trim();
      const trimmedConfirm = confirmNewPassword.trim();
      if (trimmedNew || trimmedConfirm) {
        if (trimmedNew.length < 6) {
          throw new Error("New password must be at least 6 characters.");
        }
        if (trimmedNew !== trimmedConfirm) {
          throw new Error("New password and confirmation do not match.");
        }
      }

      const { data: sessionBefore } = await supabase.auth.getUser();
      const currentUserId = sessionBefore.user?.id;

      const accessToken = await getAccessToken();
      const body: Record<string, unknown> = {
        user_id: editTargetId,
        full_name: form.full_name.trim(),
        role: form.role,
        status: form.status,
      };
      if (trimmedNew.length >= 6) {
        body.new_password = trimmedNew;
      }

      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });

      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Failed to update user.");
      }

      // Changing your own password revokes existing JWTs — sign in again before loadUsers() (which uses the token).
      if (trimmedNew.length >= 6 && currentUserId && editTargetId === currentUserId) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: form.email.trim(),
          password: trimmedNew,
        });
        if (signInError) {
          setMessage("Password updated. Please log in again with your new password.");
          setNewPassword("");
          setConfirmNewPassword("");
          setIsEditOpen(false);
          setEditTargetId(null);
          return;
        }
      }

      setMessage("User updated successfully.");
      setNewPassword("");
      setConfirmNewPassword("");
      setIsEditOpen(false);
      setEditTargetId(null);
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update user.");
    } finally {
      setSaving(false);
    }
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const { data: userData } = await supabase.auth.getUser();
      const currentId = userData.user?.id;
      if (currentId && archiveTarget.id === currentId) {
        throw new Error("You cannot archive your own account.");
      }

      const accessToken = await getAccessToken();
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          user_id: archiveTarget.id,
          status: "inactive",
        }),
      });

      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Failed to archive user.");
      }

      setMessage("User archived (set to inactive).");
      setIsArchiveOpen(false);
      setArchiveTarget(null);
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to archive user.");
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        (u.full_name ?? "").toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
      );
    });
  }, [users, userSearch, roleFilter]);

  const createNewUser = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error("Your session expired. Please log in again.");
      }

      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          full_name: createForm.full_name.trim(),
          email: createForm.email.trim(),
          password: createForm.password,
          role: createForm.role,
          status: "active",
        }),
      });

      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Failed to create user.");
      }

      setMessage("User account created successfully (email already confirmed).");
      setCreateForm({ full_name: "", email: "", password: "", role: "client" });
      setIsCreateOpen(false);
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create user.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-md font-semibold tracking-tight">User Management</h1>
          <p className="text-xs text-muted-foreground">
            Owner can create and manage cashier and customer accounts for the resort portal.
          </p>
        </div>
        <Button size="sm" variant="save" onClick={() => setIsCreateOpen(true)}>
          Create new user
        </Button>
      </div>
      {message && <p className="text-xs text-[#16A34A]">{message}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}

      <PageToolbar searchValue={userSearch} onSearchChange={setUserSearch} searchPlaceholder="Search name, email, or ID...">
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={roleFilter === "all" ? "reserve" : "outline"}
            className="h-8 text-xs"
            onClick={() => setRoleFilter("all")}
          >
            All roles
          </Button>
          <Button
            type="button"
            size="sm"
            variant={roleFilter === "admin" ? "reserve" : "outline"}
            className="h-8 text-xs"
            onClick={() => setRoleFilter("admin")}
          >
            Admin (Owner)
          </Button>
          <Button
            type="button"
            size="sm"
            variant={roleFilter === "cashier" ? "reserve" : "outline"}
            className="h-8 text-xs"
            onClick={() => setRoleFilter("cashier")}
          >
            Cashier
          </Button>
          <Button
            type="button"
            size="sm"
            variant={roleFilter === "client" ? "reserve" : "outline"}
            className="h-8 text-xs"
            onClick={() => setRoleFilter("client")}
          >
            Customer
          </Button>
        </div>
      </PageToolbar>

      <div className="border border-border bg-card">
        <CardHeader className="border-b bg-muted/40 pb-3">
          <CardTitle className="text-base font-semibold">Users</CardTitle>
          <p className="text-xs text-muted-foreground">Roles, status, and contact information.</p>
        </CardHeader>
        <CardContent className="pt-0">
          <Table bordered={false}>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    Loading users...
                  </TableCell>
                </TableRow>
              )}
              {!loading && users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No users yet.
                  </TableCell>
                </TableRow>
              )}
              {!loading && users.length > 0 && filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No users match your search or role filter.
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                filteredUsers.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {u.id.slice(0, 8)}...{u.id.slice(-4)}
                  </TableCell>
                  <TableCell className="font-medium">{u.full_name ?? "No name"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-sm">
                      {u.role === "admin" ? (
                        <Shield className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      {u.role === "admin" ? "Admin (Owner)" : u.role === "cashier" ? "Cashier" : "Customer"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={u.status === "active" ? "statusActive" : "statusArchived"}
                      className="rounded-full"
                    >
                      {u.status === "active" ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="edit"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => openEditDialog(u)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="archive"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => openArchiveDialog(u)}
                        disabled={u.status === "inactive"}
                      >
                        <Archive className="h-3.5 w-3.5" />
                        Archive
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md gap-2 p-4">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details and account access.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2.5">
            <div className="space-y-1">
              <Label className="text-xs">User ID</Label>
              <Input className="h-9 text-sm" value={form.id} disabled />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                className="h-9 text-sm"
                value={form.full_name}
                onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input
                className="h-9 text-sm"
                type="email"
                value={form.email}
                disabled
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Role</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.role}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, role: e.target.value as UserRole }))
                  }
                >
                  <option value="admin">Admin (Owner)</option>
                  <option value="cashier">Cashier</option>
                  <option value="client">Customer</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.status}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, status: e.target.value as UserStatus }))
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="space-y-1 border-t border-border pt-3">
              <p className="text-[0.65rem] font-medium text-muted-foreground">Reset password (optional)</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">New password</Label>
                  <div className="relative">
                    <Input
                      className="h-9 pr-9 text-sm"
                      type={showEditNewPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Leave blank to keep current"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditNewPassword((p) => !p)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showEditNewPassword ? "Hide password" : "Show password"}
                    >
                      {showEditNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Confirm new password</Label>
                  <div className="relative">
                    <Input
                      className="h-9 pr-9 text-sm"
                      type={showEditConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Confirm"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditConfirmPassword((p) => !p)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showEditConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showEditConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="cancelMuted" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="save" onClick={handleUpdateUser} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isArchiveOpen}
        onOpenChange={(open) => {
          setIsArchiveOpen(open);
          if (!open) setArchiveTarget(null);
        }}
      >
        <DialogContent className="max-w-sm gap-2 p-4">
          <DialogHeader>
            <DialogTitle>Archive user</DialogTitle>
            <DialogDescription>
              This sets the account to <span className="font-medium text-foreground">inactive</span>. The user
              will not be able to sign in until an admin sets them back to active.
            </DialogDescription>
            <p className="pt-2 text-sm text-foreground">
              Archive{" "}
              <span className="font-medium">
                {archiveTarget?.full_name?.trim() || archiveTarget?.email || "this user"}
              </span>
              ?
            </p>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="cancelMuted"
              onClick={() => {
                setIsArchiveOpen(false);
                setArchiveTarget(null);
              }}
            >
              Cancel
            </Button>
            <Button type="button" variant="archive" onClick={confirmArchive} disabled={saving}>
              {saving ? "Archiving..." : "Archive user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) {
            setCreateForm({ full_name: "", email: "", password: "", role: "client" });
            setShowCreatePassword(false);
          }
        }}
      >
        <DialogContent className="max-w-md gap-2 p-4">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>Create a cashier or customer auth account with email/password.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2.5">
            <div className="space-y-1">
              <Label className="text-xs">Full name</Label>
              <Input
                className="h-9 text-sm"
                value={createForm.full_name}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, full_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input
                className="h-9 text-sm"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Temporary password</Label>
              <div className="relative">
                <Input
                  className="h-9 pr-9 text-sm"
                  type={showCreatePassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword((p) => !p)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showCreatePassword ? "Hide password" : "Show password"}
                >
                  {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Role</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={createForm.role}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    role: e.target.value as Exclude<UserRole, "admin">,
                  }))
                }
              >
                <option value="cashier">Cashier</option>
                <option value="client">Customer</option>
              </select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="cancelMuted" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="save" onClick={createNewUser} disabled={saving}>
              {saving ? "Creating..." : "Create user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
