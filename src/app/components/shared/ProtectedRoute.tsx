import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import type { UserRole } from "../../data/fleetData";
import { getCurrentUser } from "../../data/runtimeStore";
import { AccessDenied } from "./AccessDenied";

interface ProtectedRouteProps {
  allow: UserRole[];
  redirectTo?: string;
  children?: ReactNode;
}

export function ProtectedRoute({ allow, redirectTo, children }: ProtectedRouteProps) {
  const location = useLocation();
  const currentUser = getCurrentUser();

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!allow.includes(currentUser.role)) {
    if (redirectTo && redirectTo !== location.pathname) {
      return <Navigate to={redirectTo} replace state={{ from: location.pathname, denied: true }} />;
    }

    return <AccessDenied />;
  }

  return children ? <>{children}</> : <Outlet />;
}
