import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AlertCircle, CheckCircle2, Shield, UserPlus } from "lucide-react";
import { getCurrentUser } from "../../data/runtimeStore";
import { apiClient, type ApiError } from "../../data/apiClient";
import {
  buildUsernameFromEmail,
  createUserAccountFormValues,
  UserAccountForm,
  type UserAccountFormErrors,
  type UserAccountFormValues,
  validateUserAccountForm,
} from "../shared/UserAccountForm";

const SECTIONS = [
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

interface SignUpForm extends UserAccountFormValues {
  section: string;
  contactNumber: string;
}

type SignUpErrors = UserAccountFormErrors & Partial<Record<"section", string>>;

function createSignUpForm(): SignUpForm {
  return {
    ...createUserAccountFormValues({
      role: "Staff",
      status: "Pending",
    }),
    section: "",
    contactNumber: "",
  };
}

export function SignUp() {
  const navigate = useNavigate();
  const [form, setForm] = useState<SignUpForm>(createSignUpForm);
  const [errors, setErrors] = useState<SignUpErrors>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const updateField = (field: keyof SignUpForm, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    setError("");
  };

  const validate = () => {
    const accountErrors = validateUserAccountForm(form, {
      requirePassword: true,
      minPasswordLength: 8,
    });
    const nextErrors: SignUpErrors = { ...accountErrors };

    if (!form.section) {
      nextErrors.section = "Section assignment is required.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!validate()) {
      setError("Please correct the highlighted fields before submitting your request.");
      return;
    }

    setLoading(true);
    (async () => {
      try {
        await apiClient.auth.signup({
          fullName: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          username: buildUsernameFromEmail(form.email),
          password: form.password,
          section: form.section,
        });
        setSuccess(true);
      } catch (requestError) {
        const apiError = requestError as ApiError;
        setError(apiError.message || "Failed to submit access request.");
      } finally {
        setLoading(false);
      }
    })();
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f5f8] p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-[0_14px_34px_-24px_rgba(15,23,42,0.55)]">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h2 className="mb-2 text-xl text-[#0d1b2a]">Access Request Submitted</h2>
          <p className="mb-6 text-sm leading-relaxed text-slate-500">
            Your account request is now in the approval queue. You can sign in only after an
            administrator changes your account status to Active.
          </p>
          <Link
            to="/login"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0d1b2a] px-4 py-3 text-sm text-white transition-all hover:bg-[#1a2e45]"
          >
            Return to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <div className="relative hidden overflow-hidden bg-[#0d1b2a] p-10 lg:flex lg:w-[390px] xl:w-[450px] lg:flex-col lg:justify-between">
        <div className="absolute right-0 top-0 h-64 w-64 translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1e6b3c]/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-48 w-48 -translate-x-1/4 translate-y-1/4 rounded-full bg-[#1e3a5f]/40 blur-3xl" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1e6b3c] shadow-lg">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-widest text-[#7ecb9c]">MVS Command</p>
            <p className="text-sm text-white">Motor Vehicle Squadron</p>
          </div>
        </div>

        <div className="relative z-10 space-y-5">
          <div>
            <h2 className="mb-3 text-3xl leading-snug text-white">
              Request
              <br />
              <span className="text-[#7ecb9c]">System Access</span>
            </h2>
            <p className="text-sm leading-relaxed text-white/65">
              Submit your profile for controlled access to the Motor Vehicle Squadron Management
              System.
            </p>
          </div>
          <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-widest text-[#7ecb9c]">Approval Workflow</p>
            {[
              "New accounts are created with Pending status",
              "Admin review is required before first login",
              "Approved accounts are activated by role",
              "Rejected or disabled accounts cannot sign in",
            ].map((step) => (
              <div key={step} className="flex items-center gap-2.5">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#7ecb9c]" />
                <span className="text-sm text-white/75">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-white/30">FOR OFFICIAL USE ONLY - AFP RESTRICTED</p>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#f3f5f8]">
        <div className="flex min-h-full items-center justify-center p-6 lg:p-10">
          <div className="w-full max-w-[620px] rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_14px_34px_-24px_rgba(15,23,42,0.55)] sm:p-8">
            <div className="mb-6">
              <h2 className="text-2xl text-[#0d1b2a]">Create Access Request</h2>
              <p className="mt-1 text-sm text-slate-500">
                Already have an account?{" "}
                <Link to="/login" className="text-[#1e6b3c] hover:text-[#155c30]">
                  Sign in here
                </Link>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error ? (
                <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              ) : null}

              <UserAccountForm
                values={form}
                errors={errors}
                onChange={(field, value) => updateField(field as keyof SignUpForm, value)}
                showRole={false}
                showStatus={false}
                disabled={loading}
              />

              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/45 p-4">
                <p className="text-xs uppercase tracking-widest text-slate-500">Operational Profile</p>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm text-slate-700">Section / Unit *</label>
                    <select
                      value={form.section}
                      onChange={(event) => updateField("section", event.target.value)}
                      disabled={loading}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d1b2a]/20 disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                      <option value="">Select section</option>
                      {SECTIONS.map((section) => (
                        <option key={section} value={section}>
                          {section}
                        </option>
                      ))}
                    </select>
                    {errors.section ? <p className="mt-1 text-xs text-red-600">{errors.section}</p> : null}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm text-slate-700">Contact Number</label>
                    <input
                      type="tel"
                      value={form.contactNumber}
                      onChange={(event) => updateField("contactNumber", event.target.value)}
                      placeholder="09XX-XXX-XXXX"
                      disabled={loading}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0d1b2a]/20 disabled:cursor-not-allowed disabled:bg-slate-100"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  New sign-up requests are submitted with <strong>Pending</strong> status and require
                  admin approval before login.
                </div>
              </div>

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
                    Submitting Request...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Submit Access Request
                  </>
                )}
              </button>

              <p className="text-center text-xs text-slate-400">
                By submitting this request, you confirm compliance with AFP data privacy policy and
                system usage regulations.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
