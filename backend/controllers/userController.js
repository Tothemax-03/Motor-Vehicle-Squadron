const bcrypt = require('bcryptjs');
const db = require('../config/db');

function toUser(row) {
  return {
    id: `USR-${String(row.id).padStart(3, '0')}`,
    dbId: row.id,
    fullName: row.full_name,
    username: row.username,
    email: row.email,
    role: row.role,
    section: row.section || 'Operations Section',
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLogin: row.last_login ? String(row.last_login).slice(0, 16).replace('T', ' ') : 'Never'
  };
}

function canManageTarget(requestUser, targetUserId) {
  if (!requestUser) return false;
  if (requestUser.role === 'Admin') return true;
  return Number(requestUser.id) === Number(targetUserId);
}

async function listUsers(req, res, next) {
  try {
    if (req.session.user.role !== 'Admin') {
      const [rows] = await db.query(
        `SELECT id, full_name, username, email, role, status, section, created_at, updated_at, last_login
         FROM users
         WHERE id = ?`,
        [req.session.user.id]
      );
      return res.json(rows.map(toUser));
    }

    const [rows] = await db.query(
      `SELECT id, full_name, username, email, role, status, section, created_at, updated_at, last_login
       FROM users
       ORDER BY created_at DESC`
    );
    res.json(rows.map(toUser));
  } catch (error) {
    next(error);
  }
}

async function getMyProfile(req, res, next) {
  try {
    const [rows] = await db.query(
      `SELECT id, full_name, username, email, role, status, section, created_at, updated_at, last_login
       FROM users
       WHERE id = ?`,
      [req.session.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.json(toUser(rows[0]));
  } catch (error) {
    next(error);
  }
}

async function createUser(req, res, next) {
  try {
    const { fullName, email, username, password, role, status, section } = req.body;
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: 'Full name, email, and password are required.' });
    }

    const safeRole = role === 'Admin' ? 'Admin' : 'Staff';
    const safeStatus = ['Pending', 'Active', 'Disabled', 'Rejected'].includes(status) ? status : 'Pending';
    const [exists] = await db.query(
      'SELECT id FROM users WHERE email = ? OR (username IS NOT NULL AND username = ?)',
      [email.trim().toLowerCase(), username ? username.trim().toLowerCase() : null]
    );
    if (exists.length > 0) {
      return res.status(409).json({ message: 'Email or username already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      `INSERT INTO users (full_name, username, email, password, role, status, section)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        fullName.trim(),
        username ? username.trim().toLowerCase() : null,
        email.trim().toLowerCase(),
        passwordHash,
        safeRole,
        safeStatus,
        section || 'Operations Section'
      ]
    );

    res.status(201).json({ message: 'User account created successfully.', id: result.insertId });
  } catch (error) {
    next(error);
  }
}

async function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    if (!canManageTarget(req.session.user, id)) {
      return res.status(403).json({ message: 'Forbidden: insufficient role.' });
    }

    const [existingRows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    if (existingRows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const existing = existingRows[0];
    const {
      fullName,
      email,
      username,
      role,
      status,
      section,
      password
    } = req.body;

    const nextRole = req.session.user.role === 'Admin' ? (role === 'Admin' ? 'Admin' : 'Staff') : existing.role;
    const nextStatus =
      req.session.user.role === 'Admin' && ['Pending', 'Active', 'Disabled', 'Rejected'].includes(status)
        ? status
        : existing.status;

    const nextUsername = username === undefined ? existing.username : username ? username.trim().toLowerCase() : null;
    const nextEmail = email === undefined ? existing.email : email.trim().toLowerCase();
    const nextFullName = fullName === undefined ? existing.full_name : fullName.trim();
    const nextSection = section === undefined ? existing.section : section || 'Operations Section';

    if (nextEmail !== existing.email || nextUsername !== existing.username) {
      const [duplicateRows] = await db.query(
        `SELECT id FROM users
         WHERE id <> ?
           AND (email = ? OR (username IS NOT NULL AND username = ?))`,
        [id, nextEmail, nextUsername]
      );
      if (duplicateRows.length > 0) {
        return res.status(409).json({ message: 'Email or username is already in use.' });
      }
    }

    let nextPasswordHash = existing.password;
    if (password && String(password).trim()) {
      nextPasswordHash = await bcrypt.hash(String(password), 10);
    }

    await db.query(
      `UPDATE users
       SET full_name = ?, username = ?, email = ?, password = ?, role = ?, status = ?, section = ?
       WHERE id = ?`,
      [nextFullName, nextUsername, nextEmail, nextPasswordHash, nextRole, nextStatus, nextSection, id]
    );

    if (Number(id) === Number(req.session.user.id)) {
      req.session.user = {
        ...req.session.user,
        fullName: nextFullName,
        username: nextUsername,
        email: nextEmail,
        role: nextRole,
        status: nextStatus,
        section: nextSection
      };
    }

    res.json({ message: 'User profile updated successfully.' });
  } catch (error) {
    next(error);
  }
}

async function deleteUser(req, res, next) {
  try {
    const { id } = req.params;
    if (Number(id) === Number(req.session.user.id)) {
      return res.status(400).json({ message: 'You cannot delete your currently logged-in account.' });
    }

    const [result] = await db.query('DELETE FROM users WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({ message: 'User deleted successfully.' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listUsers,
  getMyProfile,
  createUser,
  updateUser,
  deleteUser
};
