const db = require('../config/db');

function toVehicle(row) {
  return {
    id: row.id,
    plateNumber: row.plate_number,
    designation: row.designation,
    type: row.type,
    category: row.category,
    make: row.make,
    year: Number(row.year),
    status: row.status,
    driver: row.driver,
    mileage: Number(row.mileage || 0),
    lastMaintenance: row.last_maintenance ? String(row.last_maintenance).slice(0, 10) : '',
    nextMaintenance: row.next_maintenance ? String(row.next_maintenance).slice(0, 10) : '',
    fuelLevel: Number(row.fuel_level || 0),
    section: row.section,
    location: row.location
  };
}

function validateVehiclePayload(payload) {
  const required = ['id', 'plateNumber', 'designation', 'type', 'category', 'make', 'year', 'status', 'driver', 'lastMaintenance', 'nextMaintenance', 'section', 'location'];
  const missing = required.filter((key) => payload[key] === undefined || payload[key] === null || payload[key] === '');
  if (missing.length > 0) {
    return `Missing required fields: ${missing.join(', ')}`;
  }
  return null;
}

async function listVehicles(req, res, next) {
  try {
    const [rows] = await db.query('SELECT * FROM vehicles ORDER BY id ASC');
    res.json(rows.map(toVehicle));
  } catch (error) {
    next(error);
  }
}

async function createVehicle(req, res, next) {
  try {
    const errorMessage = validateVehiclePayload(req.body || {});
    if (errorMessage) {
      return res.status(400).json({ message: errorMessage });
    }

    const {
      id,
      plateNumber,
      designation,
      type,
      category,
      make,
      year,
      status,
      driver,
      mileage,
      lastMaintenance,
      nextMaintenance,
      fuelLevel,
      section,
      location
    } = req.body;

    await db.query(
      `INSERT INTO vehicles (
         id, plate_number, designation, type, category, make, year, status, driver,
         mileage, last_maintenance, next_maintenance, fuel_level, section, location
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        plateNumber,
        designation,
        type,
        category,
        make,
        Number(year),
        status,
        driver,
        Number(mileage || 0),
        lastMaintenance,
        nextMaintenance,
        Number(fuelLevel || 0),
        section,
        location
      ]
    );

    res.status(201).json({ message: 'Vehicle added successfully.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Vehicle ID or plate number already exists.' });
    }
    next(error);
  }
}

async function updateVehicle(req, res, next) {
  try {
    const { id } = req.params;
    const {
      plateNumber,
      designation,
      type,
      category,
      make,
      year,
      status,
      driver,
      mileage,
      lastMaintenance,
      nextMaintenance,
      fuelLevel,
      section,
      location
    } = req.body;

    const [result] = await db.query(
      `UPDATE vehicles
       SET plate_number = ?, designation = ?, type = ?, category = ?, make = ?, year = ?, status = ?, driver = ?,
           mileage = ?, last_maintenance = ?, next_maintenance = ?, fuel_level = ?, section = ?, location = ?
       WHERE id = ?`,
      [
        plateNumber,
        designation,
        type,
        category,
        make,
        Number(year),
        status,
        driver,
        Number(mileage || 0),
        lastMaintenance,
        nextMaintenance,
        Number(fuelLevel || 0),
        section,
        location,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Vehicle not found.' });
    }
    res.json({ message: 'Vehicle updated successfully.' });
  } catch (error) {
    next(error);
  }
}

async function deleteVehicle(req, res, next) {
  try {
    const { id } = req.params;
    const [result] = await db.query('DELETE FROM vehicles WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Vehicle not found.' });
    }
    res.json({ message: 'Vehicle deleted successfully.' });
  } catch (error) {
    next(error);
  }
}

async function bulkUpsertVehicles(req, res, next) {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!rows) {
    return res.status(400).json({ message: 'rows array is required.' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM vehicles');

    for (const row of rows) {
      await connection.query(
        `INSERT INTO vehicles (
           id, plate_number, designation, type, category, make, year, status, driver,
           mileage, last_maintenance, next_maintenance, fuel_level, section, location
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.plateNumber,
          row.designation,
          row.type,
          row.category,
          row.make,
          Number(row.year || 0),
          row.status,
          row.driver || 'Unassigned',
          Number(row.mileage || 0),
          row.lastMaintenance || new Date().toISOString().slice(0, 10),
          row.nextMaintenance || new Date().toISOString().slice(0, 10),
          Number(row.fuelLevel || 0),
          row.section || 'Unassigned',
          row.location || 'N/A'
        ]
      );
    }

    await connection.commit();
    res.json({ message: 'Vehicles synchronized.', count: rows.length });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

module.exports = {
  listVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  bulkUpsertVehicles
};
