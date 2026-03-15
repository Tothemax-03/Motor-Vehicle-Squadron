function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ message: 'Unauthorized access.' });
  }
  if (req.session.user.status && req.session.user.status !== 'Active') {
    return res.status(403).json({ message: 'Account is not active.' });
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ message: 'Unauthorized access.' });
    }
    if (req.session.user.status && req.session.user.status !== 'Active') {
      return res.status(403).json({ message: 'Account is not active.' });
    }

    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ message: 'Forbidden: insufficient role.' });
    }

    next();
  };
}

module.exports = {
  requireAuth,
  requireRole
};
