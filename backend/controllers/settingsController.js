const DEFAULT_SETTINGS = {
  timezone: "Asia/Manila",
  backupTime: "02:00",
  passwordRotationDays: "90",
  sessionTimeout: "30",
  emailFrom: "mvsm-notify@afp.mil.ph",
  mfaRequired: true,
  anomalyAlerts: true,
  escalationReminders: true,
};

let currentSettings = { ...DEFAULT_SETTINGS };

function sanitizePayload(body = {}) {
  return {
    timezone: String(body.timezone || DEFAULT_SETTINGS.timezone),
    backupTime: String(body.backupTime || DEFAULT_SETTINGS.backupTime),
    passwordRotationDays: String(body.passwordRotationDays || DEFAULT_SETTINGS.passwordRotationDays),
    sessionTimeout: String(body.sessionTimeout || DEFAULT_SETTINGS.sessionTimeout),
    emailFrom: String(body.emailFrom || DEFAULT_SETTINGS.emailFrom),
    mfaRequired: Boolean(body.mfaRequired),
    anomalyAlerts: Boolean(body.anomalyAlerts),
    escalationReminders: Boolean(body.escalationReminders),
  };
}

function getSettings(req, res) {
  return res.json({
    ...currentSettings,
    accessRole: req.session.user.role,
  });
}

function updateSettings(req, res) {
  currentSettings = sanitizePayload(req.body);
  return res.json({
    message: "Settings updated successfully.",
    settings: currentSettings,
  });
}

module.exports = {
  getSettings,
  updateSettings,
};
