const db = require('../config/db');

async function getDashboardSummary(req, res, next) {
  try {
    const [[totalVehicles]] = await db.query('SELECT COUNT(*) AS value FROM vehicles');
    const [[availableVehicles]] = await db.query("SELECT COUNT(*) AS value FROM vehicles WHERE status = 'operational' OR status = 'standby'");
    const [[inUseVehicles]] = await db.query("SELECT COUNT(*) AS value FROM vehicles WHERE status = 'on-mission'");
    const [[maintenanceVehicles]] = await db.query("SELECT COUNT(*) AS value FROM vehicles WHERE status = 'maintenance' OR status = 'non-operational'");

    const [recentMovements] = await db.query(
      `SELECT id, mission_order, plate_number, driver, destination, departure_time, eta, status
       FROM vehicle_movements
       ORDER BY departure_time DESC
       LIMIT 12`
    );

    res.json({
      cards: {
        totalVehicles: Number(totalVehicles.value || 0),
        availableVehicles: Number(availableVehicles.value || 0),
        inUseVehicles: Number(inUseVehicles.value || 0),
        maintenanceVehicles: Number(maintenanceVehicles.value || 0)
      },
      recentMovements: recentMovements.map((row) => ({
        id: row.id,
        missionOrder: row.mission_order,
        plateNumber: row.plate_number,
        driver: row.driver,
        destination: row.destination,
        departureTime: row.departure_time ? String(row.departure_time).slice(0, 16).replace('T', ' ') : '',
        eta: row.eta ? String(row.eta).slice(0, 16).replace('T', ' ') : '',
        status: row.status
      }))
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getDashboardSummary
};
