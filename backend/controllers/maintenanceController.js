const db = require('../config/db');
const { refreshVehicleStatus } = require('../utils/vehicleStatus');

function toMaintenance(row) {
  const parsedParts = (() => {
    if (!row.parts_json) return [];
    try {
      const parsed = typeof row.parts_json === 'string' ? JSON.parse(row.parts_json) : row.parts_json;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    plateNumber: row.plate_number,
    vehicleType: row.vehicle_type,
    title: row.title || undefined,
    type: row.type,
    description: row.description,
    dateCreated: row.date_created ? String(row.date_created).slice(0, 10) : '',
    scheduledDate: row.scheduled_date ? String(row.scheduled_date).slice(0, 10) : '',
    completedDate: row.completed_date ? String(row.completed_date).slice(0, 10) : undefined,
    technician: row.technician,
    priority: row.priority,
    status: row.status,
    estimatedHours: Number(row.estimated_hours || 0),
    parts: parsedParts,
    cost: row.cost === null ? undefined : Number(row.cost),
    assignedPersonnel: row.assigned_personnel || undefined,
    workOrderType: row.work_order_type || undefined,
    progressPercent: Number(row.progress_percent || 0)
  };
}

async function listMaintenance(req, res, next) {
  try {
    const [rows] = await db.query('SELECT * FROM maintenance_records ORDER BY scheduled_date DESC');
    res.json(rows.map(toMaintenance));
  } catch (error) {
    next(error);
  }
}

async function createMaintenance(req, res, next) {
  try {
    const {
      id,
      vehicleId,
      plateNumber,
      vehicleType,
      title,
      type,
      description,
      dateCreated,
      scheduledDate,
      completedDate,
      technician,
      priority,
      status,
      estimatedHours,
      parts,
      cost,
      assignedPersonnel,
      workOrderType,
      progressPercent
    } = req.body;

    if (!id || !vehicleId || !plateNumber || !vehicleType || !description || !scheduledDate || !technician) {
      return res.status(400).json({ message: 'Work order ID, vehicle details, description, schedule date, and technician are required.' });
    }

    await db.query(
      `INSERT INTO maintenance_records (
         id, vehicle_id, plate_number, vehicle_type, title, type, description, date_created, scheduled_date,
         completed_date, technician, priority, status, estimated_hours, parts_json, cost,
         assigned_personnel, work_order_type, progress_percent, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        vehicleId,
        plateNumber,
        vehicleType,
        title || null,
        type || 'inspection',
        description,
        dateCreated || new Date().toISOString().slice(0, 10),
        scheduledDate,
        completedDate || null,
        technician,
        priority || 'medium',
        status || 'pending',
        Number(estimatedHours || 1),
        JSON.stringify(Array.isArray(parts) ? parts : []),
        cost === undefined || cost === '' ? null : Number(cost),
        assignedPersonnel || null,
        workOrderType || null,
        Number(progressPercent || 0),
        req.session.user?.id || null
      ]
    );

    await refreshVehicleStatus(vehicleId);
    res.status(201).json({ message: 'Work order created successfully.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Work order ID already exists.' });
    }
    next(error);
  }
}

async function updateMaintenance(req, res, next) {
  try {
    const { id } = req.params;
    const {
      vehicleId,
      plateNumber,
      vehicleType,
      title,
      type,
      description,
      dateCreated,
      scheduledDate,
      completedDate,
      technician,
      priority,
      status,
      estimatedHours,
      parts,
      cost,
      assignedPersonnel,
      workOrderType,
      progressPercent
    } = req.body;

    const [existingRows] = await db.query('SELECT vehicle_id FROM maintenance_records WHERE id = ?', [id]);
    if (existingRows.length === 0) {
      return res.status(404).json({ message: 'Work order not found.' });
    }

    const previousVehicleId = existingRows[0].vehicle_id;
    await db.query(
      `UPDATE maintenance_records
       SET vehicle_id = ?, plate_number = ?, vehicle_type = ?, title = ?, type = ?, description = ?, date_created = ?,
           scheduled_date = ?, completed_date = ?, technician = ?, priority = ?, status = ?, estimated_hours = ?,
           parts_json = ?, cost = ?, assigned_personnel = ?, work_order_type = ?, progress_percent = ?
       WHERE id = ?`,
      [
        vehicleId,
        plateNumber,
        vehicleType,
        title || null,
        type || 'inspection',
        description,
        dateCreated || new Date().toISOString().slice(0, 10),
        scheduledDate,
        completedDate || null,
        technician,
        priority || 'medium',
        status || 'pending',
        Number(estimatedHours || 1),
        JSON.stringify(Array.isArray(parts) ? parts : []),
        cost === undefined || cost === '' ? null : Number(cost),
        assignedPersonnel || null,
        workOrderType || null,
        Number(progressPercent || 0),
        id
      ]
    );

    const refreshTargets = new Set([vehicleId, previousVehicleId]);
    for (const target of refreshTargets) {
      await refreshVehicleStatus(target);
    }

    res.json({ message: 'Work order updated successfully.' });
  } catch (error) {
    next(error);
  }
}

async function deleteMaintenance(req, res, next) {
  try {
    const { id } = req.params;
    const [existingRows] = await db.query('SELECT vehicle_id FROM maintenance_records WHERE id = ?', [id]);
    if (existingRows.length === 0) {
      return res.status(404).json({ message: 'Work order not found.' });
    }

    const vehicleId = existingRows[0].vehicle_id;
    await db.query('DELETE FROM maintenance_records WHERE id = ?', [id]);
    await refreshVehicleStatus(vehicleId);
    res.json({ message: 'Work order deleted successfully.' });
  } catch (error) {
    next(error);
  }
}

async function getMaintenanceAlerts(req, res, next) {
  try {
    const [rows] = await db.query(
      `SELECT id, plate_number, title, scheduled_date, status, priority
       FROM maintenance_records
       WHERE status IN ('pending', 'overdue', 'in-progress')
       ORDER BY FIELD(status, 'overdue', 'in-progress', 'pending'), scheduled_date ASC
       LIMIT 25`
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
}

async function bulkUpsertMaintenance(req, res, next) {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!rows) {
    return res.status(400).json({ message: 'rows array is required.' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM maintenance_records');

    for (const row of rows) {
      await connection.query(
        `INSERT INTO maintenance_records (
           id, vehicle_id, plate_number, vehicle_type, title, type, description, date_created, scheduled_date,
           completed_date, technician, priority, status, estimated_hours, parts_json, cost,
           assigned_personnel, work_order_type, progress_percent, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.vehicleId,
          row.plateNumber,
          row.vehicleType,
          row.title || null,
          row.type || 'inspection',
          row.description || '',
          row.dateCreated || new Date().toISOString().slice(0, 10),
          row.scheduledDate || new Date().toISOString().slice(0, 10),
          row.completedDate || null,
          row.technician || 'Unassigned',
          row.priority || 'medium',
          row.status || 'pending',
          Number(row.estimatedHours || 1),
          JSON.stringify(Array.isArray(row.parts) ? row.parts : []),
          row.cost === undefined || row.cost === '' ? null : Number(row.cost),
          row.assignedPersonnel || null,
          row.workOrderType || null,
          Number(row.progressPercent || 0),
          req.session.user?.id || null
        ]
      );
    }

    await connection.commit();

    const [vehicleRows] = await db.query('SELECT id FROM vehicles');
    for (const vehicle of vehicleRows) {
      await refreshVehicleStatus(vehicle.id);
    }

    res.json({ message: 'Maintenance records synchronized.', count: rows.length });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

module.exports = {
  listMaintenance,
  createMaintenance,
  updateMaintenance,
  deleteMaintenance,
  getMaintenanceAlerts,
  bulkUpsertMaintenance
};
