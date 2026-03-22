import { useEffect, useState } from "react";
import { Save, Shield, Bell, Database, Globe, Lock, Clock3 } from "lucide-react";
import { PageHeader } from "../shared/PageHeader";
import { Panel } from "../shared/Panel";
import { apiClient, type ApiError } from "../../data/apiClient";

interface SettingsForm {
  timezone: string;
  backupTime: string;
  passwordRotationDays: string;
  sessionTimeout: string;
  emailFrom: string;
  mfaRequired: boolean;
  anomalyAlerts: boolean;
  escalationReminders: boolean;
}

const DEFAULT_FORM: SettingsForm = {
  timezone: "Asia/Manila",
  backupTime: "02:00",
  passwordRotationDays: "90",
  sessionTimeout: "30",
  emailFrom: "mvsm-notify@afp.mil.ph",
  mfaRequired: true,
  anomalyAlerts: true,
  escalationReminders: true,
};

export function SettingsPage() {
  const [form, setForm] = useState<SettingsForm>(DEFAULT_FORM);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const settings = await apiClient.settings.get();
        if (!mounted) return;
        setForm({
          timezone: settings.timezone || DEFAULT_FORM.timezone,
          backupTime: settings.backupTime || DEFAULT_FORM.backupTime,
          passwordRotationDays: String(settings.passwordRotationDays || DEFAULT_FORM.passwordRotationDays),
          sessionTimeout: String(settings.sessionTimeout || DEFAULT_FORM.sessionTimeout),
          emailFrom: settings.emailFrom || DEFAULT_FORM.emailFrom,
          mfaRequired: Boolean(settings.mfaRequired),
          anomalyAlerts: Boolean(settings.anomalyAlerts),
          escalationReminders: Boolean(settings.escalationReminders),
        });
      } catch (requestError) {
        if (!mounted) return;
        const apiError = requestError as ApiError;
        setError(apiError.message || "Unable to load system settings.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const update = <K extends keyof SettingsForm>(field: K, value: SettingsForm[K]) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setSaved(false);
    setError("");
  };

  const saveSettings = async () => {
    setError("");
    setSaved(false);

    const rotation = Number.parseInt(form.passwordRotationDays, 10);
    const timeout = Number.parseInt(form.sessionTimeout, 10);
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.emailFrom);

    if (!form.timezone || !form.backupTime || !form.passwordRotationDays || !form.sessionTimeout || !form.emailFrom) {
      setError("Please complete all required configuration fields.");
      return;
    }

    if (Number.isNaN(rotation) || rotation < 30 || rotation > 180) {
      setError("Password rotation policy must be between 30 and 180 days.");
      return;
    }

    if (Number.isNaN(timeout) || timeout < 10 || timeout > 240) {
      setError("Session timeout must be between 10 and 240 minutes.");
      return;
    }

    if (!emailValid) {
      setError("Notification sender email must be a valid address.");
      return;
    }

    setSaving(true);
    try {
      const response = await apiClient.settings.update(form);
      setForm({
        timezone: response.settings.timezone,
        backupTime: response.settings.backupTime,
        passwordRotationDays: String(response.settings.passwordRotationDays),
        sessionTimeout: String(response.settings.sessionTimeout),
        emailFrom: response.settings.emailFrom,
        mfaRequired: Boolean(response.settings.mfaRequired),
        anomalyAlerts: Boolean(response.settings.anomalyAlerts),
        escalationReminders: Boolean(response.settings.escalationReminders),
      });
      setSaved(true);
    } catch (requestError) {
      const apiError = requestError as ApiError;
      setError(apiError.message || "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Settings"
        description="Configure security, notification, backup, and regional platform preferences."
        rightSlot={
          <button
            type="button"
            onClick={() => { void saveSettings(); }}
            disabled={loading || saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0d1b2a] px-3.5 py-2 text-sm text-white transition-colors hover:bg-[#16283d] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Configuration"}
          </button>
        }
      />

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Loading current configuration...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      {saved ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Configuration saved successfully. Updated policies are now active.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Security Controls" subtitle="Session, authentication, and password policy settings.">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Password Rotation (Days) *</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={form.passwordRotationDays}
                  onChange={(event) => update("passwordRotationDays", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">Recommended policy range: 60 to 120 days.</p>
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Session Timeout (Minutes) *</label>
              <div className="relative">
                <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={form.sessionTimeout}
                  onChange={(event) => update("sessionTimeout", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>
            </div>

            <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <span className="inline-flex items-center gap-2 text-sm text-slate-700">
                <Shield className="h-4 w-4 text-slate-500" />
                Require Multi-Factor Authentication
              </span>
              <input
                type="checkbox"
                checked={form.mfaRequired}
                onChange={(event) => update("mfaRequired", event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#0d1b2a] focus:ring-[#0d1b2a]/20"
              />
            </label>

            <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <span className="inline-flex items-center gap-2 text-sm text-slate-700">
                <Bell className="h-4 w-4 text-slate-500" />
                Login Anomaly Alerts
              </span>
              <input
                type="checkbox"
                checked={form.anomalyAlerts}
                onChange={(event) => update("anomalyAlerts", event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#0d1b2a] focus:ring-[#0d1b2a]/20"
              />
            </label>
          </div>
        </Panel>

        <Panel title="Operations Preferences" subtitle="Regional options, backups, and notification controls.">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Timezone *</label>
              <div className="relative">
                <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={form.timezone}
                  onChange={(event) => update("timezone", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                  <option value="Asia/Manila">Asia/Manila</option>
                  <option value="Asia/Singapore">Asia/Singapore</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Daily Backup Time *</label>
              <div className="relative">
                <Database className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="time"
                  value={form.backupTime}
                  onChange={(event) => update("backupTime", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-slate-500">Notification Sender Email *</label>
              <input
                value={form.emailFrom}
                onChange={(event) => update("emailFrom", event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <span className="inline-flex items-center gap-2 text-sm text-slate-700">
                <Bell className="h-4 w-4 text-slate-500" />
                Maintenance Escalation Reminders
              </span>
              <input
                type="checkbox"
                checked={form.escalationReminders}
                onChange={(event) => update("escalationReminders", event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#0d1b2a] focus:ring-[#0d1b2a]/20"
              />
            </label>
          </div>
        </Panel>
      </div>
    </div>
  );
}
