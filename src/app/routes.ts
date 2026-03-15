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

export const router = createBrowserRouter([
  { path: "/login", Component: Login },
  { path: "/signup", Component: SignUp },
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Overview },
      { path: "movement", Component: MovementMonitoring },
      { path: "maintenance", Component: MaintenanceMonitoring },
      { path: "fleet", Component: FleetRegistry },
      { path: "drivers", Component: DriverManagement },
      { path: "reports", Component: Reports },
      { path: "users", Component: UserManagement },
      { path: "settings", Component: SettingsPage },
      { path: "activity-logs", Component: ActivityLogs },
    ],
  },
]);
