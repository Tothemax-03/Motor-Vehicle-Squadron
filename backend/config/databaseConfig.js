const mysql = require('mysql2/promise');
require('dotenv').config();

function parseBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === 'true';
}

function getDatabaseName() {
  return (
    process.env.DB_NAME ||
    process.env.MYSQLDATABASE ||
    process.env.MYSQL_DATABASE ||
    'motor_vehicle_squadron_db'
  );
}

function getRawDatabaseUrl() {
  return process.env.DATABASE_URL || process.env.MYSQL_PUBLIC_URL || process.env.MYSQL_URL || '';
}

function buildBaseDatabaseConfig() {
  const databaseName = getDatabaseName();
  const rawUrl = getRawDatabaseUrl();

  let config;
  if (rawUrl) {
    const parsedUrl = new URL(rawUrl);
    config = {
      host: parsedUrl.hostname,
      port: Number(parsedUrl.port || 3306),
      user: decodeURIComponent(parsedUrl.username || 'root'),
      password: decodeURIComponent(parsedUrl.password || ''),
      database: decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, '')) || databaseName,
    };
  } else {
    config = {
      host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
      port: Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
      user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
      password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
      database: databaseName,
    };
  }

  const connectTimeout = Number(
    process.env.DB_CONNECT_TIMEOUT || process.env.MYSQL_CONNECT_TIMEOUT || 10000
  );
  if (!Number.isNaN(connectTimeout) && connectTimeout > 0) {
    config.connectTimeout = connectTimeout;
  }

  if (parseBoolean(process.env.DB_SSL) || parseBoolean(process.env.MYSQL_SSL)) {
    config.ssl = {
      rejectUnauthorized: parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, false),
    };
  }

  return config;
}

function getDatabaseConfig({ includeDatabase = true, multipleStatements = false } = {}) {
  const config = buildBaseDatabaseConfig();

  if (!includeDatabase) {
    delete config.database;
  }

  if (multipleStatements) {
    config.multipleStatements = true;
  }

  return config;
}

function isMissingDatabaseError(error) {
  return (
    error &&
    (error.code === 'ER_BAD_DB_ERROR' ||
      /unknown database/i.test(error.message || '') ||
      /unknown schema/i.test(error.message || ''))
  );
}

async function createDatabaseConnection({
  includeDatabase = true,
  multipleStatements = false,
  allowCreateDatabase = false,
} = {}) {
  const databaseConfig = getDatabaseConfig({ includeDatabase, multipleStatements });

  try {
    return await mysql.createConnection(databaseConfig);
  } catch (error) {
    if (!includeDatabase || !allowCreateDatabase || !isMissingDatabaseError(error)) {
      throw error;
    }

    const adminConnection = await mysql.createConnection(
      getDatabaseConfig({ includeDatabase: false, multipleStatements: true })
    );

    try {
      await adminConnection.query(`CREATE DATABASE IF NOT EXISTS \`${getDatabaseName()}\``);
    } finally {
      await adminConnection.end();
    }

    return mysql.createConnection(databaseConfig);
  }
}

module.exports = {
  createDatabaseConnection,
  getDatabaseConfig,
  getDatabaseName,
  getRawDatabaseUrl,
};
