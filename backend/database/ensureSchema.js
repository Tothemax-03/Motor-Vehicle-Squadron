const { createDatabaseConnection, getDatabaseName } = require('../config/databaseConfig');

const databaseName = getDatabaseName();

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.query(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [databaseName, tableName, columnName]
  );
  return rows.length > 0;
}

async function ensureColumn(connection, tableName, columnName, definition) {
  const exists = await columnExists(connection, tableName, columnName);
  if (exists) return false;
  await connection.query(`ALTER TABLE \`${tableName}\` ADD COLUMN ${definition}`);
  return true;
}

async function ensureTableDefinitions(connection) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(120) NOT NULL,
      username VARCHAR(80) NULL UNIQUE,
      email VARCHAR(120) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role ENUM('Admin', 'Staff') NOT NULL DEFAULT 'Staff',
      status ENUM('Pending', 'Active', 'Disabled', 'Rejected') NOT NULL DEFAULT 'Pending',
      section VARCHAR(120) NULL,
      last_login DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS vehicles (
      id VARCHAR(24) PRIMARY KEY,
      plate_number VARCHAR(30) NOT NULL UNIQUE,
      designation VARCHAR(120) NOT NULL,
      type VARCHAR(120) NOT NULL,
      category ENUM('bus', 'truck', 'van', 'mpv', 'other') NOT NULL DEFAULT 'other',
      make VARCHAR(120) NOT NULL,
      year INT NOT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'operational',
      driver VARCHAR(120) NOT NULL DEFAULT 'Unassigned',
      mileage INT NOT NULL DEFAULT 0,
      last_maintenance DATE NOT NULL,
      next_maintenance DATE NOT NULL,
      fuel_level INT NOT NULL DEFAULT 100,
      section VARCHAR(120) NOT NULL,
      location VARCHAR(180) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS drivers (
      id VARCHAR(24) PRIMARY KEY,
      full_name VARCHAR(120) NOT NULL,
      rank VARCHAR(30) NOT NULL,
      license_number VARCHAR(60) NOT NULL UNIQUE,
      license_type VARCHAR(80) NULL,
      license_expiry DATE NOT NULL,
      section VARCHAR(120) NOT NULL,
      assigned_vehicle VARCHAR(30) NOT NULL DEFAULT 'Unassigned',
      status VARCHAR(40) NOT NULL DEFAULT 'Available',
      contact_number VARCHAR(30) NOT NULL,
      missions_this_month INT NOT NULL DEFAULT 0,
      last_dispatch VARCHAR(40) NOT NULL DEFAULT 'No dispatch record',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS vehicle_movements (
      id VARCHAR(24) PRIMARY KEY,
      mission_order VARCHAR(40) NOT NULL UNIQUE,
      vehicle_id VARCHAR(24) NOT NULL,
      plate_number VARCHAR(30) NOT NULL,
      vehicle_type VARCHAR(120) NOT NULL,
      driver VARCHAR(120) NOT NULL,
      requesting_unit VARCHAR(120) NOT NULL,
      origin VARCHAR(180) NOT NULL,
      destination VARCHAR(180) NOT NULL,
      departure_time DATETIME NOT NULL,
      eta DATETIME NOT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'pending',
      cargo VARCHAR(180) NOT NULL,
      passengers INT NOT NULL DEFAULT 0,
      miles_driven INT NULL,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS maintenance_records (
      id VARCHAR(24) PRIMARY KEY,
      vehicle_id VARCHAR(24) NOT NULL,
      plate_number VARCHAR(30) NOT NULL,
      vehicle_type VARCHAR(120) NOT NULL,
      title VARCHAR(180) NULL,
      type VARCHAR(40) NOT NULL DEFAULT 'inspection',
      description TEXT NOT NULL,
      date_created DATE NOT NULL,
      scheduled_date DATE NOT NULL,
      completed_date DATE NULL,
      technician VARCHAR(120) NOT NULL,
      priority VARCHAR(40) NOT NULL DEFAULT 'medium',
      status VARCHAR(40) NOT NULL DEFAULT 'pending',
      estimated_hours INT NOT NULL DEFAULT 1,
      parts_json JSON NULL,
      cost DECIMAL(12, 2) NULL,
      assigned_personnel VARCHAR(120) NULL,
      work_order_type VARCHAR(120) NULL,
      progress_percent INT NOT NULL DEFAULT 0,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS activity_logs (
      id VARCHAR(24) PRIMARY KEY,
      logged_at DATETIME NOT NULL,
      actor VARCHAR(120) NOT NULL,
      action VARCHAR(255) NOT NULL,
      module_name VARCHAR(120) NOT NULL,
      severity VARCHAR(20) NOT NULL DEFAULT 'Info',
      details TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );
}

async function applyCompatibilityUpdates(connection) {
  const updates = [
    `UPDATE vehicles SET status = 'operational' WHERE status IN ('Available', 'available')`,
    `UPDATE vehicles SET status = 'on-mission' WHERE status IN ('In Use', 'in use', 'In Operation', 'in operation', 'Assigned')`,
    `UPDATE vehicles SET status = 'maintenance' WHERE status IN ('Maintenance', 'maintenance', 'Under Maintenance', 'under maintenance')`,
    `UPDATE vehicles SET status = 'non-operational' WHERE status IN ('Non Operational', 'Non-Operational', 'non operational', 'non-operational')`,
    `UPDATE vehicles SET status = 'standby' WHERE status IN ('Standby', 'stand by', 'Stand By')`,
    `UPDATE vehicle_movements SET status = LOWER(status) WHERE status IN ('Active', 'Completed', 'Pending', 'Cancelled')`,
    `UPDATE maintenance_records SET status = 'pending' WHERE status IN ('Pending', 'pending')`,
    `UPDATE maintenance_records SET status = 'in-progress' WHERE status IN ('Ongoing', 'In Progress', 'in progress')`,
    `UPDATE maintenance_records SET status = 'completed' WHERE status IN ('Completed', 'completed')`,
    `UPDATE maintenance_records SET status = 'overdue' WHERE status IN ('Overdue', 'overdue')`
  ];

  for (const statement of updates) {
    try {
      await connection.query(statement);
    } catch {
      // Skip compatibility updates when legacy values are not present.
    }
  }
}

async function ensureDatabaseSchema() {
  const connection = await createDatabaseConnection({
    includeDatabase: true,
    multipleStatements: true,
    allowCreateDatabase: true,
  });
  const addedColumns = [];

  try {
    await ensureTableDefinitions(connection);

    const columns = [
      ['users', 'username', 'username VARCHAR(80) NULL AFTER full_name'],
      ['users', 'section', 'section VARCHAR(120) NULL AFTER status'],
      ['users', 'last_login', 'last_login DATETIME NULL AFTER section'],
      ['users', 'created_at', 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
      ['users', 'updated_at', 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'],
      ['vehicles', 'category', "category VARCHAR(40) NOT NULL DEFAULT 'other' AFTER type"],
      ['vehicles', 'fuel_level', 'fuel_level INT NOT NULL DEFAULT 100 AFTER next_maintenance'],
      ['vehicles', 'created_at', 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
      ['vehicles', 'updated_at', 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'],
      ['drivers', 'license_type', 'license_type VARCHAR(80) NULL AFTER license_number'],
      ['drivers', 'missions_this_month', 'missions_this_month INT NOT NULL DEFAULT 0 AFTER contact_number'],
      ['drivers', 'last_dispatch', "last_dispatch VARCHAR(40) NOT NULL DEFAULT 'No dispatch record' AFTER missions_this_month"],
      ['drivers', 'created_at', 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
      ['drivers', 'updated_at', 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'],
      ['vehicle_movements', 'origin', "origin VARCHAR(180) NOT NULL DEFAULT 'N/A' AFTER requesting_unit"],
      ['vehicle_movements', 'cargo', "cargo VARCHAR(180) NOT NULL DEFAULT 'N/A' AFTER status"],
      ['vehicle_movements', 'created_by', 'created_by INT NULL AFTER miles_driven'],
      ['vehicle_movements', 'created_at', 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
      ['vehicle_movements', 'updated_at', 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'],
      ['maintenance_records', 'title', 'title VARCHAR(180) NULL AFTER vehicle_type'],
      ['maintenance_records', 'date_created', 'date_created DATE NOT NULL AFTER description'],
      ['maintenance_records', 'parts_json', 'parts_json JSON NULL AFTER estimated_hours'],
      ['maintenance_records', 'assigned_personnel', 'assigned_personnel VARCHAR(120) NULL AFTER cost'],
      ['maintenance_records', 'work_order_type', 'work_order_type VARCHAR(120) NULL AFTER assigned_personnel'],
      ['maintenance_records', 'progress_percent', 'progress_percent INT NOT NULL DEFAULT 0 AFTER work_order_type'],
      ['maintenance_records', 'created_by', 'created_by INT NULL AFTER progress_percent'],
      ['maintenance_records', 'created_at', 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
      ['maintenance_records', 'updated_at', 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'],
      ['activity_logs', 'logged_at', 'logged_at DATETIME NOT NULL AFTER id'],
      ['activity_logs', 'module_name', "module_name VARCHAR(120) NOT NULL DEFAULT 'Settings' AFTER action"],
      ['activity_logs', 'created_at', 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP']
    ];

    for (const [tableName, columnName, definition] of columns) {
      const added = await ensureColumn(connection, tableName, columnName, definition);
      if (added) {
        addedColumns.push(`${tableName}.${columnName}`);
      }
    }

    await applyCompatibilityUpdates(connection);
    return { addedColumns };
  } finally {
    await connection.end();
  }
}

module.exports = {
  ensureDatabaseSchema
};
