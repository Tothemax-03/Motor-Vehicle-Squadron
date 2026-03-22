import type { UserRole } from "./fleetData";

export function isAdminRole(role: UserRole | null | undefined) {
  return role === "Admin";
}

export function isStaffRole(role: UserRole | null | undefined) {
  return role === "Staff";
}

export function canAccessOperations(role: UserRole | null | undefined) {
  return isAdminRole(role) || isStaffRole(role);
}

export function canAccessSettings(role: UserRole | null | undefined) {
  return canAccessOperations(role);
}

export function getDefaultAuthorizedRoute(role: UserRole | null | undefined) {
  return canAccessOperations(role) ? "/" : "/login";
}

export function getVisibleNavigation(role: UserRole | null | undefined) {
  return {
    showOperations: canAccessOperations(role),
    showUsers: isAdminRole(role),
    showActivityLogs: isAdminRole(role),
    showSettings: canAccessSettings(role),
    showSearch: canAccessOperations(role),
    showNotifications: canAccessOperations(role),
  };
}
