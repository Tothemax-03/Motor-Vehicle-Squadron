const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ADMIN_HASH = '$2a$10$52DzAkIeLsU3vAqHXNt2O.zXIVZiBXniUcxqMuKTcVNxiyr7ABe1O';
const STAFF_HASH = '$2a$10$4ee7g0o.uB4/P75L8MIf4ezv82wg.bgTZlG1nG1Bl6KVb7/OPxsX.';

async function resetFreshData() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });

  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await connection.query(schemaSql);

    await connection.query(
      `USE motor_vehicle_squadron_db;
       SET FOREIGN_KEY_CHECKS = 0;
       TRUNCATE TABLE activity_logs;
       TRUNCATE TABLE maintenance_records;
       TRUNCATE TABLE vehicle_movements;
       TRUNCATE TABLE drivers;
       TRUNCATE TABLE vehicles;
       TRUNCATE TABLE users;
       SET FOREIGN_KEY_CHECKS = 1;`
    );

    await connection.query(
      `INSERT INTO users (full_name, username, email, password, role, status, section)
       VALUES
         ('System Administrator', 'admin', 'admin@mvsm.com', ?, 'Admin', 'Active', 'System Administration'),
         ('Operations Staff', 'staff', 'staff@mvsm.com', ?, 'Staff', 'Active', 'Operations Section')`,
      [ADMIN_HASH, STAFF_HASH]
    );

    process.stdout.write('Fresh reset completed. Core admin/staff users are ready for a clean demo.\n');
  } finally {
    await connection.end();
  }
}

resetFreshData().catch((error) => {
  process.stderr.write(`Fresh reset failed: ${error.message}\n`);
  process.exit(1);
});
