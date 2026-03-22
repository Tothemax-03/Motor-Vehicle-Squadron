import type { UserRole } from "./fleetData";

export function isAdminRole(role: UserRole | null | undefined) {
  return role === "Admin";
}

export function isStaffRole(role: UserRole | null | undefined) {
  return role === "Staff";
}

export function canAccessSettings(role: UserRole | null | undefined) {
  return isAdminRole(role) || isStaffRole(role);
}

export function getDefaultAuthorizedRoute(role: UserRole | null | undefined) {
  return isStaffRole(role) ? "/settings" : "/";
}

export function getVisibleNavigation(role: UserRole | null | undefined) {
  return {
    showOperations: isAdminRole(role),
    showUsers: isAdminRole(role),
    showActivityLogs: isAdminRole(role),
    showSettings: canAccessSettings(role),
    showSearch: isAdminRole(role),
    showNotifications: isAdminRole(role),
  };
}
