import type { ReactNode } from "react";
import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Overview } from "./components/dashboard/Overview";
import { MovementMonitoring } from "./components/dashboard/MovementMonitoring";
import { MaintenanceMonitoring } from "./components/dashboard/MaintenanceMonitoring";
import { FleetRegistry } from "./components/dashboard/FleetRegistry";
import { Reports } from "./components/dashboard/Reports";
import { DriverManagement } from "./components/dashboard/DriverManagement";
import { UserManagement } from "./components/dashboard/UserManagement";
import { SettingsPage } from "./components/dashboard/SettingsPage";
import { ActivityLogs } from "./components/dashboard/ActivityLogs";
import { Login } from "./components/auth/Login";
import { SignUp } from "./components/auth/SignUp";
import { ProtectedRoute } from "./components/shared/ProtectedRoute";

const AdminOnly = ({ children }: { children: ReactNode }) => (
  <ProtectedRoute allow={["Admin"]} redirectTo="/settings">
    {children}
  </ProtectedRoute>
);

const SettingsAccess = ({ children }: { children: ReactNode }) => (
  <ProtectedRoute allow={["Admin", "Staff"]}>
    {children}
  </ProtectedRoute>
);

export const router = createBrowserRouter([
  { path: "/login", Component: Login },
  { path: "/signup", Component: SignUp },
  {
    path: "/",
    Component: Layout,
    children: [
      {
        index: true,
        element: (
          <AdminOnly>
            <Overview />
          </AdminOnly>
        ),
      },
      {
        path: "movement",
        element: (
          <AdminOnly>
            <MovementMonitoring />
          </AdminOnly>
        ),
      },
      {
        path: "maintenance",
        element: (
          <AdminOnly>
            <MaintenanceMonitoring />
          </AdminOnly>
        ),
      },
      {
        path: "fleet",
        element: (
          <AdminOnly>
            <FleetRegistry />
          </AdminOnly>
        ),
      },
      {
        path: "drivers",
        element: (
          <AdminOnly>
            <DriverManagement />
          </AdminOnly>
        ),
      },
      {
        path: "reports",
        element: (
          <AdminOnly>
            <Reports />
          </AdminOnly>
        ),
      },
      {
        path: "users",
        element: (
          <AdminOnly>
            <UserManagement />
          </AdminOnly>
        ),
      },
      {
        path: "settings",
        element: (
          <SettingsAccess>
            <SettingsPage />
          </SettingsAccess>
        ),
      },
      {
        path: "activity-logs",
        element: (
          <AdminOnly>
            <ActivityLogs />
          </AdminOnly>
        ),
      },
      {
        path: "logs",
        element: (
          <AdminOnly>
            <ActivityLogs />
          </AdminOnly>
        ),
      },
    ],
  },
]);
