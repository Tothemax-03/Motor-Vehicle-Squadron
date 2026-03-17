const mysql = require('mysql2/promise');
const {
  getDatabaseConfig,
  getSafeDatabaseConfigForLogging,
} = require('./databaseConfig');

const pool = mysql.createPool({
  ...getDatabaseConfig({ includeDatabase: true }),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

async function verifyPoolConnection() {
  const safeConfig = getSafeDatabaseConfigForLogging(
    getDatabaseConfig({ includeDatabase: true })
  );
  const connection = await pool.getConnection();

  try {
    await connection.query('SELECT 1');
    console.log(
      `[db] MySQL pool ready host=${safeConfig.host} port=${safeConfig.port} ` +
        `user=${safeConfig.user} database=${safeConfig.database} ` +
        `ssl=${safeConfig.sslEnabled ? 'enabled' : 'disabled'}`
    );
  } catch (error) {
    console.error(
      `[db] MySQL pool verification failed host=${safeConfig.host} port=${safeConfig.port} ` +
        `user=${safeConfig.user} database=${safeConfig.database} ` +
        `ssl=${safeConfig.sslEnabled ? 'enabled' : 'disabled'}`
    );
    throw error;
  } finally {
    connection.release();
  }
}

pool.verifyConnection = verifyPoolConnection;

module.exports = pool;
