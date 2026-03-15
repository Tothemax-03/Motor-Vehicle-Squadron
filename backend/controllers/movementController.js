const db = require('../config/db');
const { refreshVehicleStatus } = require('../utils/vehicleStatus');

function toMission(row) {
  return {
    id: row.id,
    missionOrder: row.mission_order,
    vehicleId: row.vehicle_id,
    plateNumber: row.plate_number,
    vehicleType: row.vehicle_type,
    driver: row.driver,
    requestingUnit: row.requesting_unit,
    origin: row.origin,
    destination: row.destination,
    departureTime: row.departure_time ? String(row.departure_time).slice(0, 16).replace('T', ' ') : '',
    eta: row.eta ? String(row.eta).slice(0, 16).replace('T', ' ') : '',
    status: row.status,
    cargo: row.cargo,
    passengers: Number(row.passengers || 0),
    milesDriven: row.miles_driven === null ? undefined : Number(row.miles_driven)
  };
}

function normalizeDateTime(value) {
  if (!value) return null;
  return String(value).replace('T', ' ').slice(0, 19);
}

async function listMovements(req, res, next) {
  try {
    const { search = '', status = '', from = '', to = '' } = req.query;
    const params = [];
    const clauses = [];

    if (search) {
      clauses.push(`(
        mission_order LIKE ?
        OR plate_number LIKE ?
        OR driver LIKE ?
        OR destination LIKE ?
        OR requesting_unit LIKE ?
      )`);
      const wildcard = `%${search}%`;
      params.push(wildcard, wildcard, wildcard, wildcard, wildcard);
    }

    if (status) {
      clauses.push('status = ?');
      params.push(status);
    }

    if (from) {
      clauses.push('DATE(departure_time) >= ?');
      params.push(from);
    }

    if (to) {
      clauses.push('DATE(departure_time) <= ?');
      params.push(to);
    }

    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const [rows] = await db.query(
      `SELECT * FROM vehicle_movements
       ${whereClause}
       ORDER BY departure_time DESC`,
      params
    );

    res.json(rows.map(toMission));
  } catch (error) {
    next(error);
  }
}

async function createMovement(req, res, next) {
  try {
    const {
      id,
      missionOrder,
      vehicleId,
      plateNumber,
      vehicleType,
      driver,
      requestingUnit,
      origin,
      destination,
      departureTime,
      eta,
      status,
      cargo,
      passengers,
      milesDriven
    } = req.body;

    if (!id || !missionOrder || !vehicleId || !driver || !destination || !departureTime || !eta || !status) {
      return res.status(400).json({ message: 'Mission ID, order number, vehicle, driver, destination, times, and status are required.' });
    }

    await db.query(
      `INSERT INTO vehicle_movements (
         id, mission_order, vehicle_id, plate_number, vehicle_type, driver, requesting_unit, origin,
         destination, departure_time, eta, status, cargo, passengers, miles_driven, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        missionOrder,
        vehicleId,
        plateNumber,
        vehicleType,
        driver,
        requestingUnit || 'N/A',
        origin || 'N/A',
        destination,
        normalizeDateTime(departureTime),
        normalizeDateTime(eta),
        status,
        cargo || 'N/A',
        Number(passengers || 0),
        milesDriven === undefined || milesDriven === '' ? null : Number(milesDriven),
        req.session.user?.id || null
      ]
    );

    await refreshVehicleStatus(vehicleId);
    res.status(201).json({ message: 'Mission movement record created successfully.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Mission ID or mission order already exists.' });
    }
    next(error);
  }
}

async function updateMovement(req, res, next) {
  try {
    const { id } = req.params;
    const {
      missionOrder,
      vehicleId,
      plateNumber,
      vehicleType,
      driver,
      requestingUnit,
      origin,
      destination,
      departureTime,
      eta,
      status,
      cargo,
      passengers,
      milesDriven
    } = req.body;

    const [existingRows] = await db.query('SELECT vehicle_id FROM vehicle_movements WHERE id = ?', [id]);
    if (existingRows.length === 0) {
      return res.status(404).json({ message: 'Mission movement record not found.' });
    }

    const previousVehicleId = existingRows[0].vehicle_id;
    await db.query(
      `UPDATE vehicle_movements
       SET mission_order = ?, vehicle_id = ?, plate_number = ?, vehicle_type = ?, driver = ?, requesting_unit = ?,
           origin = ?, destination = ?, departure_time = ?, eta = ?, status = ?, cargo = ?, passengers = ?, miles_driven = ?
       WHERE id = ?`,
      [
        missionOrder,
        vehicleId,
        plateNumber,
        vehicleType,
        driver,
        requestingUnit || 'N/A',
        origin || 'N/A',
        destination,
        normalizeDateTime(departureTime),
        normalizeDateTime(eta),
        status,
        cargo || 'N/A',
        Number(passengers || 0),
        milesDriven === undefined || milesDriven === '' ? null : Number(milesDriven),
        id
      ]
    );

    const refreshTargets = new Set([vehicleId, previousVehicleId]);
    for (const target of refreshTargets) {
      await refreshVehicleStatus(target);
    }

    res.json({ message: 'Mission movement record updated successfully.' });
  } catch (error) {
    next(error);
  }
}

async function deleteMovement(req, res, next) {
  try {
    const { id } = req.params;
    const [existingRows] = await db.query('SELECT vehicle_id FROM vehicle_movements WHERE id = ?', [id]);
    if (existingRows.length === 0) {
      return res.status(404).json({ message: 'Mission movement record not found.' });
    }

    const vehicleId = existingRows[0].vehicle_id;
    await db.query('DELETE FROM vehicle_movements WHERE id = ?', [id]);
    await refreshVehicleStatus(vehicleId);
    res.json({ message: 'Mission movement record deleted successfully.' });
  } catch (error) {
    next(error);
  }
}

async function bulkUpsertMovements(req, res, next) {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!rows) {
    return res.status(400).json({ message: 'rows array is required.' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM vehicle_movements');

    for (const row of rows) {
      await connection.query(
        `INSERT INTO vehicle_movements (
           id, mission_order, vehicle_id, plate_number, vehicle_type, driver, requesting_unit, origin,
           destination, departure_time, eta, status, cargo, passengers, miles_driven, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.missionOrder,
          row.vehicleId,
          row.plateNumber,
          row.vehicleType,
          row.driver,
          row.requestingUnit || 'N/A',
          row.origin || 'N/A',
          row.destination || 'N/A',
          normalizeDateTime(row.departureTime) || new Date().toISOString().slice(0, 19).replace('T', ' '),
          normalizeDateTime(row.eta) || new Date().toISOString().slice(0, 19).replace('T', ' '),
          row.status || 'pending',
          row.cargo || 'N/A',
          Number(row.passengers || 0),
          row.milesDriven === undefined || row.milesDriven === '' ? null : Number(row.milesDriven),
          req.session.user?.id || null
        ]
      );
    }

    await connection.commit();

    const [vehicleRows] = await db.query('SELECT id FROM vehicles');
    for (const vehicle of vehicleRows) {
      await refreshVehicleStatus(vehicle.id);
    }

    res.json({ message: 'Mission records synchronized.', count: rows.length });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

module.exports = {
  listMovements,
  createMovement,
  updateMovement,
  deleteMovement,
  bulkUpsertMovements
};
