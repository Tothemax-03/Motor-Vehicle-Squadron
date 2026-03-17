const mysql = require('mysql2/promise');
const {
  getDatabaseConfig,
  logDatabaseConfig,
  logDatabaseError,
} = require('./databaseConfig');

const poolConfig = {
  ...getDatabaseConfig({ includeDatabase: true }),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
};

const pool = mysql.createPool(poolConfig);

async function verifyPoolConnection() {
  logDatabaseConfig('Verifying MySQL pool connection', poolConfig);
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.query('SELECT 1');
    console.log('[db] MySQL pool verification passed');
  } catch (error) {
    logDatabaseError('MySQL pool verification failed.', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

pool.verifyConnection = verifyPoolConnection;

module.exports = pool;
