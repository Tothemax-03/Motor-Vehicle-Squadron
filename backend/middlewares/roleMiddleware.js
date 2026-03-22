function normalizeRole(role) {
  if (!role) return "";
  return String(role).trim().toLowerCase();
}

function requireRoles(...roles) {
  const allowedRoles = roles.map(normalizeRole);

  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ message: "Unauthorized access." });
    }

    if (req.session.user.status && req.session.user.status !== "Active") {
      return res.status(403).json({ message: "Account is not active." });
    }

    const currentRole = normalizeRole(req.session.user.role);
    if (!allowedRoles.includes(currentRole)) {
      return res.status(403).json({ message: "Forbidden." });
    }

    next();
  };
}

const requireAdmin = requireRoles("admin");
const requireStaff = requireRoles("staff");
const requireAdminOrStaff = requireRoles("admin", "staff");

module.exports = {
  requireRoles,
  requireAdmin,
  requireStaff,
  requireAdminOrStaff,
};
