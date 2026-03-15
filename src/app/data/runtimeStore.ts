import type {
  AuditEntry,
  DriverProfile,
  MaintenanceRecord,
  Mission,
  UserAccount,
  UserRole,
  UserStatus,
  Vehicle,
} from "./fleetData";
import { apiClient, type ApiError } from "./apiClient";

const KEYS = {
  vehicles: "mvsm_runtime_vehicles",
  drivers: "mvsm_runtime_drivers",
  missions: "mvsm_runtime_missions",
  maintenance: "mvsm_runtime_maintenance",
  audit: "mvsm_runtime_audit",
  users: "mvsm_runtime_users",
  session: "mvsm_runtime_session",
} as const;

const syncTimers = new Map<string, number>();

export interface UserSession {
  dbId: number;
  userId: string;
  fullName: string;
  username?: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  section: string;
  signedInAt: string;
}

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function readRows<T>(key: string): T[] {
  if (!canUseStorage()) return [];
  const raw = window.localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function readValue<T>(key: string): T | null {
  if (!canUseStorage()) return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeRows<T>(key: string, rows: T[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(rows));
}

function writeValue<T>(key: string, value: T | null) {
  if (!canUseStorage()) return;
  if (value === null) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

function writeRowsIfChanged<T>(key: string, rows: T[]) {
  const current = readRows<T>(key);
  if (JSON.stringify(current) === JSON.stringify(rows)) {
    return false;
  }
  writeRows(key, rows);
  return true;
}

function normalizeUserRole(value: unknown): UserRole {
  return value === "Admin" ? "Admin" : "Staff";
}

function normalizeUserStatus(value: unknown): UserStatus {
  if (value === "Active") return "Active";
  if (value === "Disabled") return "Disabled";
  if (value === "Rejected") return "Rejected";
  return "Pending";
}

function mapApiUserToAccount(value: any): UserAccount {
  const numericId =
    typeof value.dbId === "number"
      ? value.dbId
      : typeof value.id === "number"
      ? value.id
      : Number.parseInt(String(value.id).replace(/\D+/g, ""), 10) || 0;
  const id =
    typeof value.id === "string" && value.id.startsWith("USR-")
      ? value.id
      : `USR-${String(numericId || 0).padStart(3, "0")}`;

  return {
    id,
    fullName: value.fullName || value.full_name || "Unknown User",
    username: value.username || (value.email ? String(value.email).split("@")[0] : `user${numericId}`),
    role: normalizeUserRole(value.role),
    email: (value.email || "").toLowerCase(),
    section: value.section || "Operations Section",
    status: normalizeUserStatus(value.status),
    password: "",
    createdAt: value.createdAt || value.created_at || nowTimestamp(),
    lastLogin: value.lastLogin || value.last_login || "Never",
  };
}

function mapSessionUser(value: any): UserSession | null {
  if (!value || !value.email) return null;
  const dbId =
    typeof value.dbId === "number"
      ? value.dbId
      : typeof value.id === "number"
      ? value.id
      : Number.parseInt(String(value.id).replace(/\D+/g, ""), 10) || 0;
  const userId =
    typeof value.userId === "string" && value.userId.startsWith("USR-")
      ? value.userId
      : `USR-${String(dbId).padStart(3, "0")}`;

  return {
    dbId,
    userId,
    fullName: value.fullName || value.full_name || "Unknown User",
    username: value.username || undefined,
    email: String(value.email).toLowerCase(),
    role: normalizeUserRole(value.role),
    status: normalizeUserStatus(value.status),
    section: value.section || "Operations Section",
    signedInAt: value.signedInAt || nowTimestamp(),
  };
}

function buildCurrentUserFromSession(session: UserSession): UserAccount {
  const rows = getRuntimeUsers();
  const matched = rows.find(
    (row) => row.id === session.userId || row.email.toLowerCase() === session.email.toLowerCase()
  );
  if (matched) {
    return {
      ...matched,
      fullName: session.fullName || matched.fullName,
      email: session.email || matched.email,
      role: session.role || matched.role,
      status: session.status || matched.status,
      section: session.section || matched.section,
    };
  }

  return {
    id: session.userId,
    fullName: session.fullName,
    username: session.username || session.email.split("@")[0],
    role: session.role,
    email: session.email,
    section: session.section,
    status: session.status,
    password: "",
    createdAt: "",
    lastLogin: "Current Session",
  };
}

function scheduleSync<T>(key: string, rows: T[], syncFn: (values: T[]) => Promise<any>) {
  const session = getCurrentSession();
  if (!session) return;

  const timerId = syncTimers.get(key);
  if (timerId) {
    window.clearTimeout(timerId);
  }

  const nextTimer = window.setTimeout(async () => {
    try {
      await syncFn(rows);
    } catch {
      // Sync errors are intentionally silent; the UI keeps local state and retries on next change.
    } finally {
      syncTimers.delete(key);
    }
  }, 250);
  syncTimers.set(key, nextTimer);
}

export function getRuntimeVehicles() {
  return readRows<Vehicle>(KEYS.vehicles);
}

export function setRuntimeVehicles(rows: Vehicle[]) {
  if (!writeRowsIfChanged(KEYS.vehicles, rows)) return;
  scheduleSync(KEYS.vehicles, rows, (values) => apiClient.vehicles.bulk(values as any[]));
}

export function getRuntimeDrivers() {
  return readRows<DriverProfile>(KEYS.drivers);
}

export function setRuntimeDrivers(rows: DriverProfile[]) {
  if (!writeRowsIfChanged(KEYS.drivers, rows)) return;
  scheduleSync(KEYS.drivers, rows, (values) => apiClient.drivers.bulk(values as any[]));
}

export function getRuntimeMissions() {
  return readRows<Mission>(KEYS.missions);
}

export function setRuntimeMissions(rows: Mission[]) {
  if (!writeRowsIfChanged(KEYS.missions, rows)) return;
  scheduleSync(KEYS.missions, rows, (values) => apiClient.movements.bulk(values as any[]));
}

export function getRuntimeMaintenance() {
  return readRows<MaintenanceRecord>(KEYS.maintenance);
}

export function setRuntimeMaintenance(rows: MaintenanceRecord[]) {
  if (!writeRowsIfChanged(KEYS.maintenance, rows)) return;
  scheduleSync(KEYS.maintenance, rows, (values) => apiClient.maintenance.bulk(values as any[]));
}

export function getRuntimeAuditTrail() {
  return readRows<AuditEntry>(KEYS.audit);
}

export function setRuntimeAuditTrail(rows: AuditEntry[]) {
  if (!writeRowsIfChanged(KEYS.audit, rows)) return;
  scheduleSync(KEYS.audit, rows, (values) => apiClient.activityLogs.bulk(values as any[]));
}

export function appendRuntimeAudit(entry: AuditEntry) {
  const existing = getRuntimeAuditTrail();
  setRuntimeAuditTrail([entry, ...existing]);
}

export function getRuntimeUsers() {
  return readRows<UserAccount>(KEYS.users);
}

export function setRuntimeUsers(rows: UserAccount[]) {
  writeRows(KEYS.users, rows);
}

export function getCurrentSession() {
  return readValue<UserSession>(KEYS.session);
}

export function setCurrentSession(session: UserSession | null) {
  writeValue(KEYS.session, session);
}

export function clearCurrentSession() {
  setCurrentSession(null);
}

export function getCurrentUser() {
  const session = getCurrentSession();
  if (!session) return null;
  if (session.status !== "Active") return null;
  return buildCurrentUserFromSession(session);
}

export async function fetchUsersFromServer() {
  try {
    const rows = await apiClient.users.list();
    const mapped = rows.map(mapApiUserToAccount);
    writeRows(KEYS.users, mapped);
    return mapped;
  } catch (error) {
    const apiError = error as ApiError;
    if (apiError.status === 403 || apiError.status === 401) {
      try {
        const me = await apiClient.users.me();
        const mapped = [mapApiUserToAccount(me)];
        writeRows(KEYS.users, mapped);
        return mapped;
      } catch {
        return getRuntimeUsers();
      }
    }
    throw error;
  }
}

export async function syncRuntimeFromServer() {
  const me = await apiClient.auth.me();
  if (!me || !me.user) {
    clearCurrentSession();
    return false;
  }

  const session = mapSessionUser(me.user);
  if (!session) {
    clearCurrentSession();
    return false;
  }

  setCurrentSession(session);

  const results = await Promise.allSettled([
    apiClient.vehicles.list(),
    apiClient.drivers.list(),
    apiClient.movements.list(),
    apiClient.maintenance.list(),
    apiClient.activityLogs.list(),
    fetchUsersFromServer(),
  ]);

  const [vehiclesResult, driversResult, missionsResult, maintenanceResult, auditResult, usersResult] = results;

  if (vehiclesResult.status === "fulfilled") {
    writeRows(KEYS.vehicles, vehiclesResult.value || []);
  } else {
    console.warn("MVSMS sync warning: vehicles sync failed.", vehiclesResult.reason);
  }

  if (driversResult.status === "fulfilled") {
    writeRows(KEYS.drivers, driversResult.value || []);
  } else {
    console.warn("MVSMS sync warning: drivers sync failed.", driversResult.reason);
  }

  if (missionsResult.status === "fulfilled") {
    writeRows(KEYS.missions, missionsResult.value || []);
  } else {
    console.warn("MVSMS sync warning: movements sync failed.", missionsResult.reason);
  }

  if (maintenanceResult.status === "fulfilled") {
    writeRows(KEYS.maintenance, maintenanceResult.value || []);
  } else {
    console.warn("MVSMS sync warning: maintenance sync failed.", maintenanceResult.reason);
  }

  if (auditResult.status === "fulfilled") {
    writeRows(KEYS.audit, auditResult.value || []);
  } else {
    console.warn("MVSMS sync warning: activity log sync failed.", auditResult.reason);
  }

  if (usersResult.status === "rejected") {
    console.warn("MVSMS sync warning: users sync failed.", usersResult.reason);
  }

  return true;
}

export async function initializeRuntimeData() {
  if (!canUseStorage()) return;
  try {
    await syncRuntimeFromServer();
  } catch {
    // Keep local cache if backend is temporarily unavailable.
  }
}

export function buildNextNumericId(values: string[]) {
  return values.reduce((max, value) => {
    const numeric = Number.parseInt((value.match(/\d+/g) || []).join(""), 10);
    if (Number.isNaN(numeric)) return max;
    return Math.max(max, numeric);
  }, 0) + 1;
}

export function nowTimestamp() {
  return new Date().toLocaleString("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
