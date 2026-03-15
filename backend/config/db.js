const mysql = require('mysql2/promise');
const { getDatabaseConfig } = require('./databaseConfig');

const pool = mysql.createPool({
  ...getDatabaseConfig({ includeDatabase: true }),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

module.exports = pool;
