import { useEffect, useMemo, useState } from "react";
import {
  Ban,
  CheckCircle2,
  PencilLine,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
  X,
  XCircle,
} from "lucide-react";
import type { UserAccount, UserRole, UserStatus } from "../../data/fleetData";
import {
  appendRuntimeAudit,
  fetchUsersFromServer,
  getCurrentUser,
  nowTimestamp,
  syncRuntimeFromServer,
} from "../../data/runtimeStore";
import { apiClient, type ApiError } from "../../data/apiClient";
import { PageHeader } from "../shared/PageHeader";
import { Panel } from "../shared/Panel";
import { KpiCard } from "../shared/KpiCard";
import { StatusBadge } from "../shared/StatusBadge";
import { EmptyState } from "../shared/EmptyState";
import { TablePagination } from "../shared/TablePagination";
import {
  buildUsernameFromEmail,
  createUserAccountFormValues,
  UserAccountForm,
  type UserAccountFormErrors,
  type UserAccountFormValues,
  validateUserAccountForm,
} from "../shared/UserAccountForm";

type RoleFilter = "All" | UserRole;
type StatusFilter = "All" | UserStatus;

interface EditUserDraft {
  fullName: string;
  email: string;
  role: UserRole;
  status: "Active" | "Disabled";
  password: string;
}

interface AddUserDraft extends UserAccountFormValues {
  section: string;
}

type AddUserErrors = UserAccountFormErrors & Partial<Record<"section", string>>;

const PAGE_SIZE = 6;

const SECTION_OPTIONS = [
  "Operations Section",
  "HHC Section",
  "Alpha Section",
  "Bravo Section",
  "Charlie Section",
  "Medical Platoon",
  "Supply Section",
  "Maintenance Section",
  "CO Section",
  "S-4 Section",
  "G4 Logistics",
  "G3 Operations",
];

function roleTone(role: UserRole): "success" | "info" {
  return role === "Admin" ? "info" : "success";
}

function statusTone(status: UserStatus): "success" | "warning" | "danger" | "neutral" {
  if (status === "Active") return "success";
  if (status === "Pending") return "warning";
  if (status === "Rejected") return "danger";
  return "neutral";
}

function formatDate(value: string) {
  if (!value) return "N/A";
  const parsed = new Date(value.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function emptyEditDraft(): EditUserDraft {
  return {
    fullName: "",
    email: "",
    role: "Staff",
    status: "Active",
    password: "",
  };
}

function emptyAddDraft(): AddUserDraft {
  return {
    ...createUserAccountFormValues({ role: "Staff", status: "Pending" }),
    section: "Operations Section",
  };
}

export function UserManagement() {
  const [userData, setUserData] = useState<UserAccount[]>([]);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => getCurrentUser());
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("All");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [page, setPage] = useState(1);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<AddUserDraft>(emptyAddDraft);
  const [createErrors, setCreateErrors] = useState<AddUserErrors>({});
  const [createFormError, setCreateFormError] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditUserDraft>(emptyEditDraft);
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const isAdmin = currentUser?.role === "Admin";

  useEffect(() => {
    let mounted = true;
    const loadUsers = async () => {
      try {
        await syncRuntimeFromServer();
        const rows = await fetchUsersFromServer();
        if (mounted) {
          setUserData(rows);
          setCurrentUser(getCurrentUser());
        }
      } catch (error) {
        const apiError = error as ApiError;
        if (mounted) {
          setMessage({ tone: "error", text: apiError.message || "Failed to load users from server." });
        }
      } finally {
        if (mounted) {
          setLoadingUsers(false);
        }
      }
    };

    loadUsers();
    const intervalId = window.setInterval(loadUsers, 20000);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!message) return undefined;
    const timeout = window.setTimeout(() => setMessage(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const pendingUsers = useMemo(
    () => userData.filter((user) => user.status === "Pending"),
    [userData]
  );

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    return userData.filter((user) => {
      const matchesRole = roleFilter === "All" || user.role === roleFilter;
      const matchesStatus = statusFilter === "All" || user.status === statusFilter;
      const matchesSearch =
        !term ||
        `${user.fullName} ${user.email} ${user.role} ${user.status} ${user.id} ${user.username}`
          .toLowerCase()
          .includes(term);
      return matchesRole && matchesStatus && matchesSearch;
    });
  }, [query, roleFilter, statusFilter, userData]);

  useEffect(() => {
    setPage(1);
  }, [query, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const activeCount = userData.filter((user) => user.status === "Active").length;
  const pendingCount = pendingUsers.length;
  const disabledCount = userData.filter((user) => user.status === "Disabled").length;

  const canEditUser = (user: UserAccount) => {
    if (!currentUser) return false;
    if (isAdmin) return true;
    return user.id === currentUser.id;
  };

  const refreshUsers = async () => {
    await syncRuntimeFromServer();
    const rows = await fetchUsersFromServer();
    setUserData(rows);
    setCurrentUser(getCurrentUser());
  };

  const openEditor = (user: UserAccount) => {
    if (!canEditUser(user)) return;
    setEditingUserId(user.id);
    setDraft({
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      status: user.status === "Disabled" ? "Disabled" : "Active",
      password: "",
    });
    setFormError("");
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingUserId(null);
    setFormError("");
  };

  const openCreator = () => {
    if (!isAdmin) return;
    setCreateDraft(emptyAddDraft());
    setCreateErrors({});
    setCreateFormError("");
    setCreatorOpen(true);
  };

  const closeCreator = () => {
    setCreatorOpen(false);
    setCreateErrors({});
    setCreateFormError("");
    setCreatingUser(false);
  };

  const updateCreateDraft = (field: keyof AddUserDraft, value: string) => {
    setCreateDraft((previous) => ({ ...previous, [field]: value }));
    setCreateErrors((previous) => ({ ...previous, [field]: undefined }));
    setCreateFormError("");
  };

  const validateCreateDraft = () => {
    const nextErrors: AddUserErrors = {
      ...validateUserAccountForm(createDraft, {
        requireRole: true,
        requireStatus: true,
        requirePassword: true,
        minPasswordLength: 8,
      }),
    };

    if (!createDraft.section.trim()) {
      nextErrors.section = "Section assignment is required.";
    }

    const duplicateEmail = userData.some(
      (user) => user.email.toLowerCase() === createDraft.email.trim().toLowerCase()
    );
    if (duplicateEmail) {
      nextErrors.email = "Email address already exists in another user account.";
    }

    setCreateErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setCreateFormError("Please correct the highlighted fields before creating this user.");
      return false;
    }
    return true;
  };

  const saveCreatedUser = () => {
    if (!isAdmin || creatingUser) return;

    if (!validateCreateDraft()) {
      return;
    }

    setCreatingUser(true);
    (async () => {
      try {
        const normalizedEmail = createDraft.email.trim().toLowerCase();
        await apiClient.users.create({
          fullName: createDraft.fullName.trim(),
          email: normalizedEmail,
          username: buildUsernameFromEmail(normalizedEmail),
          password: createDraft.password,
          role: createDraft.role,
          status: createDraft.status,
          section: createDraft.section.trim() || "Operations Section",
        });

        await refreshUsers();
        appendRuntimeAudit({
          id: `AUD-${String(Date.now()).slice(-6)}`,
          timestamp: nowTimestamp(),
          actor: currentUser?.fullName || "System",
          action: "Created user account",
          module: "User Management",
          severity: "Info",
          details: `${createDraft.fullName.trim()} created with ${createDraft.role} role and ${createDraft.status} status.`,
        });
        setMessage({ tone: "success", text: "User account created successfully." });
        closeCreator();
      } catch (error) {
        const apiError = error as ApiError;
        setCreateFormError(apiError.message || "Failed to create user account.");
      } finally {
        setCreatingUser(false);
      }
    })();
  };

  const updateUserStatus = (user: UserAccount, status: UserStatus, actionLabel: string) => {
    if (!isAdmin) return;
    if (user.id === currentUser?.id && status !== "Active") {
      setMessage({ tone: "error", text: "You cannot change your own account to an inactive state." });
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to ${actionLabel.toLowerCase()} this user?`);
    if (!confirmed) return;

    (async () => {
      try {
        const dbId = Number.parseInt(user.id.replace(/\D+/g, ""), 10);
        await apiClient.users.update(dbId, { status });
        await refreshUsers();
        appendRuntimeAudit({
          id: `AUD-${String(Date.now()).slice(-6)}`,
          timestamp: nowTimestamp(),
          actor: currentUser?.fullName || "System",
          action: `${actionLabel} user account`,
          module: "User Management",
          severity: "Info",
          details: `${user.fullName} (${user.id}) status changed to ${status}.`,
        });
        setMessage({ tone: "success", text: `User status updated to ${status}.` });
      } catch (error) {
        const apiError = error as ApiError;
        setMessage({ tone: "error", text: apiError.message || "Failed to update user status." });
      }
    })();
  };

  const deleteUser = (user: UserAccount) => {
    if (!isAdmin) return;
    if (user.id === currentUser?.id) {
      setMessage({ tone: "error", text: "You cannot delete the account you are currently using." });
      return;
    }

    const confirmed = window.confirm("Are you sure you want to delete this user?");
    if (!confirmed) return;

    (async () => {
      try {
        const dbId = Number.parseInt(user.id.replace(/\D+/g, ""), 10);
        await apiClient.users.delete(dbId);
        await refreshUsers();
        appendRuntimeAudit({
          id: `AUD-${String(Date.now()).slice(-6)}`,
          timestamp: nowTimestamp(),
          actor: currentUser?.fullName || "System",
          action: "Deleted user account",
          module: "User Management",
          severity: "Warning",
          details: `User ${user.fullName} (${user.id}) was removed.`,
        });
        setMessage({ tone: "success", text: "User account deleted successfully." });
      } catch (error) {
        const apiError = error as ApiError;
        setMessage({ tone: "error", text: apiError.message || "Failed to delete user account." });
      }
    })();
  };

  const saveProfile = () => {
    if (!editingUserId) return;
    const targetUser = userData.find((user) => user.id === editingUserId);
    if (!targetUser) return;
    if (!canEditUser(targetUser)) return;

    if (!draft.fullName.trim() || !draft.email.trim()) {
      setFormError("Full name and email are required.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
      setFormError("Please provide a valid email address.");
      return;
    }

    const duplicateEmail = userData.some(
      (user) => user.id !== editingUserId && user.email.toLowerCase() === draft.email.trim().toLowerCase()
    );
    if (duplicateEmail) {
      setFormError("Email address already exists in another user account.");
      return;
    }

    if (targetUser.id === currentUser?.id && draft.status !== "Active") {
      setFormError("You cannot disable the account you are currently using.");
      return;
    }

    (async () => {
      try {
        const dbId = Number.parseInt(editingUserId.replace(/\D+/g, ""), 10);
        await apiClient.users.update(dbId, {
          fullName: draft.fullName.trim(),
          email: draft.email.trim().toLowerCase(),
          role: isAdmin ? draft.role : undefined,
          status: isAdmin ? draft.status : undefined,
          password: draft.password.trim() || undefined,
        });
        await refreshUsers();
        appendRuntimeAudit({
          id: `AUD-${String(Date.now()).slice(-6)}`,
          timestamp: nowTimestamp(),
          actor: currentUser?.fullName || "System",
          action: "Updated user profile",
          module: "User Management",
          severity: "Info",
          details: `Profile updated for ${draft.fullName.trim()} (${editingUserId}).`,
        });

        setMessage({ tone: "success", text: "User profile updated successfully." });
        closeEditor();
      } catch (error) {
        const apiError = error as ApiError;
        setFormError(apiError.message || "Failed to update user profile.");
      }
    })();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Manage account approval, role assignment, and access lifecycle controls for MVSMS users."
        rightSlot={
          isAdmin ? (
            <button
              type="button"
              onClick={openCreator}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0d1b2a] px-3.5 py-2 text-sm text-white hover:bg-[#16283d] transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add User
            </button>
          ) : null
        }
      />

      {loadingUsers ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Loading user directory from MySQL...
        </div>
      ) : null}

      {message ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            message.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard title="Total Users" value={userData.length} helper="Registered system accounts" icon={Users} tone="neutral" />
        <KpiCard title="Active Users" value={activeCount} helper="Accounts with active access" icon={ShieldCheck} tone="success" />
        <KpiCard title="Pending Requests" value={pendingCount} helper="Awaiting admin approval" icon={UserCog} tone="warning" trendLabel={`${disabledCount} disabled`} />
      </div>

      <Panel title="Pending User Requests" subtitle="Newly created accounts that require admin approval before login access.">
        {pendingUsers.length === 0 ? (
          <EmptyState
            title="No pending user requests"
            description="All user requests have already been reviewed."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2.5">Name</th>
                  <th className="px-3 py-2.5">Email</th>
                  <th className="px-3 py-2.5">Role</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingUsers.map((user) => (
                  <tr key={user.id} className="border-b border-slate-100 text-slate-700 hover:bg-slate-50/70">
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-800">{user.fullName}</p>
                      <p className="text-xs text-slate-500">{user.id}</p>
                    </td>
                    <td className="px-3 py-3">{user.email}</td>
                    <td className="px-3 py-3">
                      <StatusBadge label={user.role} tone={roleTone(user.role)} />
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge label={user.status} tone={statusTone(user.status)} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {isAdmin ? (
                          <>
                            <button
                              type="button"
                              onClick={() => updateUserStatus(user, "Active", "Approve")}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => updateUserStatus(user, "Rejected", "Reject")}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Reject
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-slate-500">Admin action required</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="User Directory" subtitle="Search, filter, and update user profiles, roles, and account status.">
        <div className="mb-4 flex flex-col gap-3 md:flex-row">
          <div className="relative max-w-xl flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="user-search"
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, email, username, role, status, or account ID"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option value="All">All Roles</option>
              <option value="Admin">Admin</option>
              <option value="Staff">Staff</option>
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option value="All">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Active">Active</option>
              <option value="Rejected">Rejected</option>
              <option value="Disabled">Disabled</option>
            </select>
          </div>
        </div>

        {filteredUsers.length === 0 ? (
          <EmptyState
            title="No user records found"
            description="Try adjusting your search keyword or filters to display matching accounts."
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[920px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2.5">Name</th>
                    <th className="px-3 py-2.5">Email</th>
                    <th className="px-3 py-2.5">Role</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Date Created</th>
                    <th className="px-3 py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map((user) => (
                    <tr key={user.id} className="border-b border-slate-100 text-slate-700 hover:bg-slate-50/70">
                      <td className="px-3 py-3">
                        <p className="font-medium text-slate-800">{user.fullName}</p>
                        <p className="text-xs text-slate-500">{user.id}</p>
                      </td>
                      <td className="px-3 py-3">
                        <p>{user.email}</p>
                        <p className="text-xs text-slate-500">@{user.username}</p>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge label={user.role} tone={roleTone(user.role)} />
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge label={user.status} tone={statusTone(user.status)} />
                      </td>
                      <td className="px-3 py-3 text-slate-600">{formatDate(user.createdAt)}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {canEditUser(user) ? (
                            <button
                              type="button"
                              onClick={() => openEditor(user)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                            >
                              <PencilLine className="h-3.5 w-3.5" />
                              Edit Profile
                            </button>
                          ) : (
                            <span className="inline-flex items-center rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500">
                              Restricted
                            </span>
                          )}

                          {isAdmin ? (
                            <>
                              {user.status !== "Active" ? (
                                <button
                                  type="button"
                                  onClick={() => updateUserStatus(user, "Active", "Approve")}
                                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Approve
                                </button>
                              ) : null}

                              {user.status !== "Rejected" ? (
                                <button
                                  type="button"
                                  onClick={() => updateUserStatus(user, "Rejected", "Reject")}
                                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                  Reject
                                </button>
                              ) : null}

                              {user.status === "Active" ? (
                                <button
                                  type="button"
                                  onClick={() => updateUserStatus(user, "Disabled", "Disable")}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200"
                                >
                                  <Ban className="h-3.5 w-3.5" />
                                  Disable
                                </button>
                              ) : null}

                              <button
                                type="button"
                                onClick={() => deleteUser(user)}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <TablePagination
              page={currentPage}
              totalPages={totalPages}
              totalItems={filteredUsers.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              itemLabel="user account"
            />
          </>
        )}
      </Panel>

      {creatorOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Add User</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Create a new account with the same structure as the registration form.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCreator}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              {createFormError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {createFormError}
                </div>
              ) : null}

              <UserAccountForm
                values={createDraft}
                errors={createErrors}
                onChange={(field, value) => updateCreateDraft(field as keyof AddUserDraft, value)}
                showRole
                showStatus
                disabled={creatingUser}
              />

              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/45 p-4">
                <p className="text-xs uppercase tracking-widest text-slate-500">Operational Profile</p>
                <div>
                  <label className="mb-1.5 block text-sm text-slate-700">Section / Unit *</label>
                  <select
                    value={createDraft.section}
                    onChange={(event) => updateCreateDraft("section", event.target.value)}
                    disabled={creatingUser}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d1b2a]/20 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    {SECTION_OPTIONS.map((section) => (
                      <option key={section} value={section}>
                        {section}
                      </option>
                    ))}
                  </select>
                  {createErrors.section ? <p className="mt-1 text-xs text-red-600">{createErrors.section}</p> : null}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={closeCreator}
                disabled={creatingUser}
                className="rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveCreatedUser}
                disabled={creatingUser}
                className="rounded-xl bg-[#0d1b2a] px-3.5 py-2 text-sm text-white hover:bg-[#16283d] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creatingUser ? "Creating..." : "Create User"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editorOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">Edit Profile</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Update user account details, role assignment, and access status.
              </p>
            </div>

            <div className="space-y-4 px-5 py-4">
              {formError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {formError}
                </div>
              ) : null}

              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-[0.08em] text-slate-500">Full Name *</label>
                <input
                  value={draft.fullName}
                  onChange={(event) => {
                    setDraft((previous) => ({ ...previous, fullName: event.target.value }));
                    setFormError("");
                  }}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-[0.08em] text-slate-500">Email *</label>
                <input
                  type="email"
                  value={draft.email}
                  onChange={(event) => {
                    setDraft((previous) => ({ ...previous, email: event.target.value }));
                    setFormError("");
                  }}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs uppercase tracking-[0.08em] text-slate-500">Role</label>
                  <select
                    value={draft.role}
                    onChange={(event) =>
                      setDraft((previous) => ({
                        ...previous,
                        role: event.target.value as UserRole,
                      }))
                    }
                    disabled={!isAdmin}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Staff">Staff</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs uppercase tracking-[0.08em] text-slate-500">Status</label>
                  <select
                    value={draft.status}
                    onChange={(event) =>
                      setDraft((previous) => ({
                        ...previous,
                        status: event.target.value as "Active" | "Disabled",
                      }))
                    }
                    disabled={!isAdmin}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    <option value="Active">Active</option>
                    <option value="Disabled">Disabled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-[0.08em] text-slate-500">Reset Password (Optional)</label>
                <input
                  type="password"
                  value={draft.password}
                  onChange={(event) =>
                    setDraft((previous) => ({
                      ...previous,
                      password: event.target.value,
                    }))
                  }
                  placeholder="Leave blank to keep current password"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveProfile}
                className="rounded-xl bg-[#0d1b2a] px-3.5 py-2 text-sm text-white hover:bg-[#16283d]"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
