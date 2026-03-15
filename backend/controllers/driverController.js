const db = require('../config/db');

function toDriver(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    rank: row.rank,
    licenseNumber: row.license_number,
    licenseType: row.license_type || undefined,
    licenseExpiry: row.license_expiry ? String(row.license_expiry).slice(0, 10) : '',
    section: row.section,
    assignedVehicle: row.assigned_vehicle,
    status: row.status,
    contactNumber: row.contact_number,
    missionsThisMonth: Number(row.missions_this_month || 0),
    lastDispatch: row.last_dispatch
  };
}

async function listDrivers(req, res, next) {
  try {
    const [rows] = await db.query('SELECT * FROM drivers ORDER BY id ASC');
    res.json(rows.map(toDriver));
  } catch (error) {
    next(error);
  }
}

async function createDriver(req, res, next) {
  try {
    const {
      id,
      fullName,
      rank,
      licenseNumber,
      licenseType,
      licenseExpiry,
      section,
      assignedVehicle,
      status,
      contactNumber,
      missionsThisMonth,
      lastDispatch
    } = req.body;

    if (!id || !fullName || !licenseNumber || !licenseExpiry || !section) {
      return res.status(400).json({ message: 'Driver ID, full name, license number, expiry, and section are required.' });
    }

    await db.query(
      `INSERT INTO drivers (
         id, full_name, rank, license_number, license_type, license_expiry, section,
         assigned_vehicle, status, contact_number, missions_this_month, last_dispatch
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        fullName,
        rank || 'Driver',
        licenseNumber,
        licenseType || null,
        licenseExpiry,
        section,
        assignedVehicle || 'Unassigned',
        status || 'Available',
        contactNumber || 'N/A',
        Number(missionsThisMonth || 0),
        lastDispatch || 'No dispatch record'
      ]
    );

    res.status(201).json({ message: 'Driver added successfully.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Driver ID or license number already exists.' });
    }
    next(error);
  }
}

async function updateDriver(req, res, next) {
  try {
    const { id } = req.params;
    const {
      fullName,
      rank,
      licenseNumber,
      licenseType,
      licenseExpiry,
      section,
      assignedVehicle,
      status,
      contactNumber,
      missionsThisMonth,
      lastDispatch
    } = req.body;

    const [result] = await db.query(
      `UPDATE drivers
       SET full_name = ?, rank = ?, license_number = ?, license_type = ?, license_expiry = ?, section = ?,
           assigned_vehicle = ?, status = ?, contact_number = ?, missions_this_month = ?, last_dispatch = ?
       WHERE id = ?`,
      [
        fullName,
        rank || 'Driver',
        licenseNumber,
        licenseType || null,
        licenseExpiry,
        section,
        assignedVehicle || 'Unassigned',
        status || 'Available',
        contactNumber || 'N/A',
        Number(missionsThisMonth || 0),
        lastDispatch || 'No dispatch record',
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Driver not found.' });
    }

    res.json({ message: 'Driver updated successfully.' });
  } catch (error) {
    next(error);
  }
}

async function deleteDriver(req, res, next) {
  try {
    const { id } = req.params;
    const [result] = await db.query('DELETE FROM drivers WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Driver not found.' });
    }
    res.json({ message: 'Driver deleted successfully.' });
  } catch (error) {
    next(error);
  }
}

async function bulkUpsertDrivers(req, res, next) {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!rows) {
    return res.status(400).json({ message: 'rows array is required.' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM drivers');

    for (const row of rows) {
      await connection.query(
        `INSERT INTO drivers (
           id, full_name, rank, license_number, license_type, license_expiry, section,
           assigned_vehicle, status, contact_number, missions_this_month, last_dispatch
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.fullName,
          row.rank || 'Driver',
          row.licenseNumber,
          row.licenseType || null,
          row.licenseExpiry || new Date().toISOString().slice(0, 10),
          row.section || 'Unassigned',
          row.assignedVehicle || 'Unassigned',
          row.status || 'Available',
          row.contactNumber || 'N/A',
          Number(row.missionsThisMonth || 0),
          row.lastDispatch || 'No dispatch record'
        ]
      );
    }

    await connection.commit();
    res.json({ message: 'Drivers synchronized.', count: rows.length });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

module.exports = {
  listDrivers,
  createDriver,
  updateDriver,
  deleteDriver,
  bulkUpsertDrivers
};
