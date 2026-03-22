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
  <ProtectedRoute allow={["Admin"]} redirectTo="/">
    {children}
  </ProtectedRoute>
);

const OperationalAccess = ({ children }: { children: ReactNode }) => (
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
          <OperationalAccess>
            <Overview />
          </OperationalAccess>
        ),
      },
      {
        path: "movement",
        element: (
          <OperationalAccess>
            <MovementMonitoring />
          </OperationalAccess>
        ),
      },
      {
        path: "maintenance",
        element: (
          <OperationalAccess>
            <MaintenanceMonitoring />
          </OperationalAccess>
        ),
      },
      {
        path: "fleet",
        element: (
          <OperationalAccess>
            <FleetRegistry />
          </OperationalAccess>
        ),
      },
      {
        path: "drivers",
        element: (
          <OperationalAccess>
            <DriverManagement />
          </OperationalAccess>
        ),
      },
      {
        path: "reports",
        element: (
          <OperationalAccess>
            <Reports />
          </OperationalAccess>
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
          <OperationalAccess>
            <SettingsPage />
          </OperationalAccess>
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
