const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createDatabaseConnection, getDatabaseName } = require('../config/databaseConfig');

async function resetDemoData() {
  const connection = await createDatabaseConnection({
    includeDatabase: true,
    multipleStatements: true,
    allowCreateDatabase: true,
  });

  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs
      .readFileSync(schemaPath, 'utf8')
      .replace(/CREATE DATABASE IF NOT EXISTS\s+[`"]?motor_vehicle_squadron_db[`"]?;/i, `CREATE DATABASE IF NOT EXISTS \`${getDatabaseName()}\`;`)
      .replace(/USE\s+[`"]?motor_vehicle_squadron_db[`"]?;/i, `USE \`${getDatabaseName()}\`;`);
    await connection.query(schemaSql);
    process.stdout.write('Demo database reset completed.\n');
  } finally {
    await connection.end();
  }
}

resetDemoData().catch((error) => {
  process.stderr.write(`Demo database reset failed: ${error.message}\n`);
  process.exit(1);
});
