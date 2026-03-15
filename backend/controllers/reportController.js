const { stringify } = require('csv-stringify/sync');
const db = require('../config/db');
const { streamSimpleReportPdf } = require('../utils/pdf');

async function vehicleUsageData(req) {
  const { from = '1970-01-01', to = '2999-12-31' } = req.query;

  const [rows] = await db.query(
    `SELECT v.id AS vehicleId,
            v.plate_number AS plateNumber,
            v.designation,
            COUNT(vm.id) AS totalTrips,
            COALESCE(SUM(vm.miles_driven), 0) AS totalDistance
     FROM vehicles v
     LEFT JOIN vehicle_movements vm
       ON vm.vehicle_id = v.id
      AND DATE(vm.departure_time) BETWEEN ? AND ?
     GROUP BY v.id
     ORDER BY totalTrips DESC, v.id ASC`,
    [from, to]
  );

  return rows.map((row) => ({
    vehicleId: row.vehicleId,
    plateNumber: row.plateNumber,
    designation: row.designation,
    totalTrips: Number(row.totalTrips || 0),
    totalDistance: Number(row.totalDistance || 0)
  }));
}

async function maintenanceData(req) {
  const { from = '1970-01-01', to = '2999-12-31', status = '' } = req.query;
  const params = [from, to];
  const statusFilter = status ? 'AND m.status = ?' : '';
  if (status) params.push(status);

  const [rows] = await db.query(
    `SELECT m.id,
            m.title,
            m.plate_number AS plateNumber,
            m.vehicle_type AS vehicleType,
            m.scheduled_date AS scheduledDate,
            m.status,
            m.priority,
            m.cost
     FROM maintenance_records m
     WHERE m.scheduled_date BETWEEN ? AND ?
     ${statusFilter}
     ORDER BY m.scheduled_date DESC`,
    params
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    plateNumber: row.plateNumber,
    vehicleType: row.vehicleType,
    scheduledDate: row.scheduledDate ? String(row.scheduledDate).slice(0, 10) : '',
    status: row.status,
    priority: row.priority,
    cost: row.cost === null ? 0 : Number(row.cost)
  }));
}

async function getVehicleUsageReport(req, res, next) {
  try {
    const rows = await vehicleUsageData(req);
    res.json(rows);
  } catch (error) {
    next(error);
  }
}

async function getMaintenanceReport(req, res, next) {
  try {
    const rows = await maintenanceData(req);
    res.json(rows);
  } catch (error) {
    next(error);
  }
}

async function exportVehicleUsageCsv(req, res, next) {
  try {
    const rows = await vehicleUsageData(req);
    const csv = stringify(rows, { header: true });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="vehicle_usage_report.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
}

async function exportMaintenanceCsv(req, res, next) {
  try {
    const rows = await maintenanceData(req);
    const csv = stringify(rows, { header: true });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="maintenance_report.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
}

async function exportVehicleUsagePdf(req, res, next) {
  try {
    const rows = await vehicleUsageData(req);
    streamSimpleReportPdf(
      res,
      'Vehicle Usage Report',
      ['vehicleId', 'plateNumber', 'designation', 'totalTrips', 'totalDistance'],
      rows
    );
  } catch (error) {
    next(error);
  }
}

async function exportMaintenancePdf(req, res, next) {
  try {
    const rows = await maintenanceData(req);
    streamSimpleReportPdf(
      res,
      'Maintenance Report',
      ['id', 'title', 'plateNumber', 'vehicleType', 'scheduledDate', 'status', 'priority', 'cost'],
      rows
    );
  } catch (error) {
    next(error);
  }
}

async function exportAnalyticsPack(req, res, next) {
  try {
    const [vehicleUsage, maintenance, [vehicles], [movements], [users]] = await Promise.all([
      vehicleUsageData(req),
      maintenanceData(req),
      db.query('SELECT id, plate_number AS plateNumber, designation, status, fuel_level AS fuelLevel FROM vehicles ORDER BY id ASC'),
      db.query(
        `SELECT id, mission_order AS missionOrder, plate_number AS plateNumber, driver, destination, status, departure_time AS departureTime
         FROM vehicle_movements
         ORDER BY departure_time DESC
         LIMIT 200`
      ),
      db.query('SELECT id, full_name AS fullName, email, role, status, created_at AS createdAt FROM users ORDER BY id ASC')
    ]);

    const payload = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalVehicles: vehicles.length,
        totalMovements: movements.length,
        totalMaintenanceRecords: maintenance.length,
        totalUsers: users.length
      },
      reports: {
        vehicleUsage,
        maintenance
      },
      fleet: vehicles.map((row) => ({
        ...row,
        fuelLevel: Number(row.fuelLevel || 0)
      })),
      movements: movements.map((row) => ({
        ...row,
        departureTime: row.departureTime ? String(row.departureTime).slice(0, 16).replace('T', ' ') : ''
      })),
      users
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="mvsm_analytics_pack.json"');
    res.send(JSON.stringify(payload, null, 2));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getVehicleUsageReport,
  getMaintenanceReport,
  exportVehicleUsageCsv,
  exportMaintenanceCsv,
  exportVehicleUsagePdf,
  exportMaintenancePdf,
  exportAnalyticsPack
};
