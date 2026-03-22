import { Link } from "react-router";
import { LockKeyhole } from "lucide-react";
import { getCurrentUser } from "../../data/runtimeStore";
import { getDefaultAuthorizedRoute } from "../../data/accessControl";

interface AccessDeniedProps {
  title?: string;
  message?: string;
}

export function AccessDenied({
  title = "Access Denied",
  message = "Your account does not have permission to open this page.",
}: AccessDeniedProps) {
  const currentUser = getCurrentUser();
  const returnRoute = getDefaultAuthorizedRoute(currentUser?.role);

  return (
    <div className="flex min-h-[55vh] items-center justify-center">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-[0_18px_36px_-28px_rgba(15,23,42,0.45)]">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
          <LockKeyhole className="h-6 w-6" />
        </div>
        <h2 className="text-2xl text-slate-900">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{message}</p>
        <div className="mt-6">
          <Link
            to={returnRoute}
            className="inline-flex items-center justify-center rounded-xl bg-[#0d1b2a] px-4 py-2.5 text-sm text-white transition-colors hover:bg-[#16283d]"
          >
            Return to Authorized Page
          </Link>
        </div>
      </div>
    </div>
  );
}
