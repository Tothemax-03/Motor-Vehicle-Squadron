const db = require('../config/db');

function toAudit(row) {
  return {
    id: row.id,
    timestamp: row.logged_at ? String(row.logged_at).slice(0, 16).replace('T', ' ') : '',
    actor: row.actor,
    action: row.action,
    module: row.module_name,
    severity: row.severity,
    details: row.details
  };
}

function normalizeDateTime(value) {
  if (!value) return new Date().toISOString().slice(0, 19).replace('T', ' ');
  return String(value).replace('T', ' ').slice(0, 19);
}

async function listActivityLogs(req, res, next) {
  try {
    const [rows] = await db.query('SELECT * FROM activity_logs ORDER BY logged_at DESC');
    res.json(rows.map(toAudit));
  } catch (error) {
    next(error);
  }
}

async function createActivityLog(req, res, next) {
  try {
    const { id, timestamp, actor, action, module, severity, details } = req.body;
    if (!id || !actor || !action || !module || !severity || !details) {
      return res.status(400).json({ message: 'id, actor, action, module, severity, and details are required.' });
    }

    await db.query(
      `INSERT INTO activity_logs (id, logged_at, actor, action, module_name, severity, details)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, normalizeDateTime(timestamp), actor, action, module, severity, details]
    );

    res.status(201).json({ message: 'Activity log created successfully.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Activity log ID already exists.' });
    }
    next(error);
  }
}

async function bulkUpsertActivityLogs(req, res, next) {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!rows) {
    return res.status(400).json({ message: 'rows array is required.' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM activity_logs');

    for (const row of rows) {
      await connection.query(
        `INSERT INTO activity_logs (id, logged_at, actor, action, module_name, severity, details)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          normalizeDateTime(row.timestamp),
          row.actor || req.session.user?.fullName || 'System User',
          row.action || 'Updated record',
          row.module || 'Settings',
          row.severity || 'Info',
          row.details || 'No details provided.'
        ]
      );
    }

    await connection.commit();
    res.json({ message: 'Activity logs synchronized.', count: rows.length });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

module.exports = {
  listActivityLogs,
  createActivityLog,
  bulkUpsertActivityLogs
};
