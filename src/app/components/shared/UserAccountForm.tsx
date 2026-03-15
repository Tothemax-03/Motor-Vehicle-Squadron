import { useState } from "react";
import { BadgeCheck, Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import type { UserRole, UserStatus } from "../../data/fleetData";

export interface UserAccountFormValues {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
  status: UserStatus;
}

export type UserAccountFormErrors = Partial<Record<keyof UserAccountFormValues, string>>;

const VALID_ROLES: UserRole[] = ["Admin", "Staff"];
const VALID_STATUSES: UserStatus[] = ["Pending", "Active", "Rejected", "Disabled"];

export function createUserAccountFormValues(
  overrides: Partial<UserAccountFormValues> = {}
): UserAccountFormValues {
  return {
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "Staff",
    status: "Pending",
    ...overrides,
  };
}

export function buildUsernameFromEmail(email: string) {
  const source = (email || "user").toLowerCase().trim();
  const [local] = source.split("@");
  const sanitized = (local || "user").replace(/[^a-z0-9._-]/g, ".");
  return sanitized.replace(/\.{2,}/g, ".").replace(/^\.|\.$/g, "") || "user";
}

interface ValidateUserAccountFormOptions {
  requireRole?: boolean;
  requireStatus?: boolean;
  requirePassword?: boolean;
  minPasswordLength?: number;
}

export function validateUserAccountForm(
  values: UserAccountFormValues,
  options: ValidateUserAccountFormOptions = {}
) {
  const {
    requireRole = false,
    requireStatus = false,
    requirePassword = true,
    minPasswordLength = 8,
  } = options;
  const errors: UserAccountFormErrors = {};

  if (!values.fullName.trim()) {
    errors.fullName = "Full name is required.";
  }

  if (!values.email.trim()) {
    errors.email = "Email address is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Please enter a valid email address.";
  }

  if (requirePassword || values.password.trim() || values.confirmPassword.trim()) {
    if (!values.password) {
      errors.password = "Password is required.";
    } else if (values.password.length < minPasswordLength) {
      errors.password = `Password must be at least ${minPasswordLength} characters.`;
    }

    if (!values.confirmPassword) {
      errors.confirmPassword = "Please confirm your password.";
    } else if (values.password !== values.confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }
  }

  if (requireRole && !VALID_ROLES.includes(values.role)) {
    errors.role = "Please select a valid role.";
  }

  if (requireStatus && !VALID_STATUSES.includes(values.status)) {
    errors.status = "Please select a valid status.";
  }

  return errors;
}

interface UserAccountFormProps {
  values: UserAccountFormValues;
  errors?: UserAccountFormErrors;
  onChange: (field: keyof UserAccountFormValues, value: string) => void;
  showRole?: boolean;
  showStatus?: boolean;
  disabled?: boolean;
}

export function UserAccountForm({
  values,
  errors = {},
  onChange,
  showRole = false,
  showStatus = false,
  disabled = false,
}: UserAccountFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/45 p-4">
      <p className="text-xs uppercase tracking-widest text-slate-500">Account Credentials</p>

      <div>
        <label className="mb-1.5 block text-sm text-slate-700">Full Name *</label>
        <div className="relative">
          <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={values.fullName}
            onChange={(event) => onChange("fullName", event.target.value)}
            placeholder="e.g. Reyes, Juan A."
            disabled={disabled}
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0d1b2a]/20 disabled:cursor-not-allowed disabled:bg-slate-100"
          />
        </div>
        {errors.fullName ? <p className="mt-1 text-xs text-red-600">{errors.fullName}</p> : null}
      </div>

      <div>
        <label className="mb-1.5 block text-sm text-slate-700">Email Address *</label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="email"
            value={values.email}
            onChange={(event) => onChange("email", event.target.value)}
            placeholder="name@mvsm.com"
            disabled={disabled}
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0d1b2a]/20 disabled:cursor-not-allowed disabled:bg-slate-100"
          />
        </div>
        {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email}</p> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm text-slate-700">Password *</label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type={showPassword ? "text" : "password"}
              value={values.password}
              onChange={(event) => onChange("password", event.target.value)}
              placeholder="Minimum 8 characters"
              disabled={disabled}
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-10 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0d1b2a]/20 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
            <button
              type="button"
              onClick={() => setShowPassword((previous) => !previous)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password ? <p className="mt-1 text-xs text-red-600">{errors.password}</p> : null}
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-slate-700">Confirm Password *</label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type={showConfirmPassword ? "text" : "password"}
              value={values.confirmPassword}
              onChange={(event) => onChange("confirmPassword", event.target.value)}
              placeholder="Re-enter password"
              disabled={disabled}
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-10 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0d1b2a]/20 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((previous) => !previous)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              tabIndex={-1}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirmPassword ? <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p> : null}
        </div>
      </div>

      {showRole || showStatus ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {showRole ? (
            <div>
              <label className="mb-1.5 block text-sm text-slate-700">Role *</label>
              <div className="relative">
                <BadgeCheck className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={values.role}
                  onChange={(event) => onChange("role", event.target.value)}
                  disabled={disabled}
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d1b2a]/20 disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  <option value="Admin">Admin</option>
                  <option value="Staff">Staff</option>
                </select>
              </div>
              {errors.role ? <p className="mt-1 text-xs text-red-600">{errors.role}</p> : null}
            </div>
          ) : null}

          {showStatus ? (
            <div>
              <label className="mb-1.5 block text-sm text-slate-700">Status *</label>
              <select
                value={values.status}
                onChange={(event) => onChange("status", event.target.value)}
                disabled={disabled}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d1b2a]/20 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                <option value="Pending">Pending</option>
                <option value="Active">Active</option>
                <option value="Rejected">Rejected</option>
                <option value="Disabled">Disabled</option>
              </select>
              {errors.status ? <p className="mt-1 text-xs text-red-600">{errors.status}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
