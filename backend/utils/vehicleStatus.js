const db = require('../config/db');

async function refreshVehicleStatus(vehicleId) {
  if (!vehicleId) return;

  const [maintenanceRows] = await db.query(
    `SELECT 1
     FROM maintenance_records
     WHERE vehicle_id = ?
       AND status IN ('pending', 'in-progress', 'overdue')
     LIMIT 1`,
    [vehicleId]
  );

  let nextStatus = 'operational';

  if (maintenanceRows.length > 0) {
    nextStatus = 'maintenance';
  } else {
    const [movementRows] = await db.query(
      `SELECT 1
       FROM vehicle_movements
       WHERE vehicle_id = ?
         AND status = 'active'
       LIMIT 1`,
      [vehicleId]
    );

    if (movementRows.length > 0) {
      nextStatus = 'on-mission';
    }
  }

  await db.query('UPDATE vehicles SET status = ? WHERE id = ?', [nextStatus, vehicleId]);
}

module.exports = {
  refreshVehicleStatus
};
