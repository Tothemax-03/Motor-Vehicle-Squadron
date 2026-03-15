const bcrypt = require('bcryptjs');
const db = require('../config/db');

function buildSessionUser(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    username: row.username,
    email: row.email,
    role: row.role,
    status: row.status,
    section: row.section || 'Operations Section'
  };
}

async function signup(req, res, next) {
  try {
    const { fullName, email, username, password, section } = req.body;
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: 'Full name, email, and password are required.' });
    }

    const [exists] = await db.query(
      'SELECT id FROM users WHERE email = ? OR (username IS NOT NULL AND username = ?)',
      [email.trim().toLowerCase(), username ? username.trim().toLowerCase() : null]
    );
    if (exists.length > 0) {
      return res.status(409).json({ message: 'Email or username is already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      `INSERT INTO users (full_name, username, email, password, role, status, section)
       VALUES (?, ?, ?, ?, 'Staff', 'Pending', ?)`,
      [
        fullName.trim(),
        username ? username.trim().toLowerCase() : null,
        email.trim().toLowerCase(),
        passwordHash,
        section || 'Operations Section'
      ]
    );

    res.status(201).json({
      message: 'Access request submitted. Awaiting admin approval.',
      user: {
        id: result.insertId,
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        username: username ? username.trim().toLowerCase() : null,
        role: 'Staff',
        status: 'Pending',
        section: section || 'Operations Section'
      }
    });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const [rows] = await db.query(
      `SELECT id, full_name, username, email, password, role, status, section
       FROM users
       WHERE email = ?`,
      [email.trim().toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    if (user.status === 'Pending' || user.status === 'Rejected') {
      return res.status(403).json({ message: 'Your account is awaiting admin approval.' });
    }

    if (user.status === 'Disabled') {
      return res.status(403).json({ message: 'Your account is disabled. Please contact the administrator.' });
    }

    await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
    req.session.user = buildSessionUser(user);

    res.json({ message: 'Login successful.', user: req.session.user });
  } catch (error) {
    next(error);
  }
}

function logout(req, res, next) {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully.' });
  });
}

async function me(req, res, next) {
  try {
    if (!req.session.user) {
      return res.json({ user: null });
    }

    const [rows] = await db.query(
      `SELECT id, full_name, username, email, role, status, section
       FROM users
       WHERE id = ?`,
      [req.session.user.id]
    );

    if (rows.length === 0) {
      req.session.user = null;
      return res.json({ user: null });
    }

    const sessionUser = buildSessionUser(rows[0]);
    req.session.user = sessionUser;
    res.json({ user: sessionUser });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  signup,
  login,
  logout,
  me
};
