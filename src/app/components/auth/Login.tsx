import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  Shield,
  User,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
} from "lucide-react";
import {
  syncRuntimeFromServer,
  getCurrentUser,
  setCurrentSession,
} from "../../data/runtimeStore";
import { apiClient, type ApiError } from "../../data/apiClient";

const BG_IMAGE =
  "https://images.unsplash.com/photo-1678818048682-44b5cc5375a1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtaWxpdGFyeSUyMGNvbnZveSUyMHZlaGljbGVzJTIwbmlnaHQlMjBkYXJrfGVufDF8fHx8MTc3MjcwNjcyNHww&ixlib=rb-4.1.0&q=80&w=1080";

export function Login() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const nextFieldErrors: { identifier?: string; password?: string } = {};
    if (!identifier.trim()) nextFieldErrors.identifier = "Email is required.";
    if (!password) nextFieldErrors.password = "Password is required.";
    setFieldErrors(nextFieldErrors);

    if (Object.keys(nextFieldErrors).length > 0) {
      setError("Please review the required fields before continuing.");
      return;
    }

    setLoading(true);
    (async () => {
      try {
        const response = await apiClient.auth.login(identifier.trim(), password);
        const user = response.user;
        const dbId = Number(user.id);
        const userId = `USR-${String(dbId).padStart(3, "0")}`;
        const now = new Date().toISOString();

        setCurrentSession({
          dbId,
          userId,
          fullName: user.fullName || user.full_name || "",
          username: user.username || identifier.trim().toLowerCase(),
          email: user.email,
          role: user.role,
          status: user.status || "Active",
          section: user.section || "Operations Section",
          signedInAt: now,
        });

        await syncRuntimeFromServer();
        navigate("/", { replace: true });
      } catch (requestError) {
        const apiError = requestError as ApiError;
        setError(apiError.message || "Unable to login. Please check your credentials.");
      } finally {
        setLoading(false);
      }
    })();
  };

  return (
    <div className="min-h-screen flex">
      <div
        className="relative hidden overflow-hidden p-10 lg:flex lg:w-1/2 lg:flex-col lg:justify-between"
        style={{
          backgroundImage: `url(${BG_IMAGE})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d1b2a]/95 via-[#0d1b2a]/85 to-[#1e3a5f]/70" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1e6b3c] shadow-lg">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-widest text-[#7ecb9c]">MVS Command</p>
            <p className="text-sm text-white">Motor Vehicle Squadron</p>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <div>
            <h1 className="mb-3 text-4xl leading-tight text-white">
              Motor Vehicle Squadron
              <br />
              <span className="text-[#7ecb9c]">Management System</span>
            </h1>
            <p className="max-w-sm text-sm leading-relaxed text-white/65">
              Unified operations platform for dispatch, movement monitoring, fleet readiness,
              and maintenance control.
            </p>
          </div>

          <div className="space-y-2.5">
            {[
              "Mission dispatch and movement control",
              "Maintenance planning and work order tracking",
              "Real-time fleet readiness monitoring",
              "Audit logs and command reporting",
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#7ecb9c]" />
                <p className="text-sm text-white/75">{feature}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white/80 backdrop-blur-sm">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          FOR OFFICIAL USE ONLY - AFP RESTRICTED
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-[#f3f5f8] p-6 lg:p-12">
        <div className="w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_14px_34px_-24px_rgba(15,23,42,0.55)] sm:p-8">
          <div className="mb-6">
            <h2 className="text-2xl text-[#0d1b2a]">Sign In to MVSMS</h2>
            <p className="mt-1 text-sm text-slate-500">
              Enter your assigned account credentials to access command operations.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            ) : null}

            <div>
              <label className="mb-1.5 block text-sm text-slate-700">Email Address *</label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (fieldErrors.identifier) {
                      setFieldErrors((prev) => ({ ...prev, identifier: undefined }));
                    }
                  }}
                  placeholder="e.g. admin@mvsm.com"
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#0d1b2a]/40 focus:outline-none focus:ring-2 focus:ring-[#0d1b2a]/20"
                />
              </div>
              {fieldErrors.identifier ? (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.identifier}</p>
              ) : null}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm text-slate-700">Password *</label>
                <button type="button" className="text-xs text-[#1e6b3c] hover:text-[#155c30]">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }
                  }}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-11 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#0d1b2a]/40 focus:outline-none focus:ring-2 focus:ring-[#0d1b2a]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password ? <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p> : null}
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#0d1b2a] focus:ring-[#0d1b2a]/20"
              />
              <span className="text-sm text-slate-600">Remember session on this device</span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0d1b2a] px-4 py-3 text-sm text-white transition-all duration-200 hover:bg-[#1a2e45] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Authenticating...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Access System
                </>
              )}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-400">OR</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <p className="text-center text-sm text-slate-500">
            Need account access?{" "}
            <Link to="/signup" className="text-[#1e6b3c] hover:text-[#155c30]">
              Submit access request
            </Link>
          </p>

          <p className="mt-7 text-center text-xs text-slate-400">
            Motor Vehicle Squadron Management System v2.1
            <br />
            Authorized personnel only
          </p>
        </div>
      </div>
    </div>
  );
}
