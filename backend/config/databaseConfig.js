const mysql = require('mysql2/promise');
require('dotenv').config();

function parseBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === 'true';
}

function getFirstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '');
}

function getDatabaseName() {
  return (
    getFirstDefined(
      process.env.DB_NAME,
      process.env.MYSQLDATABASE,
      process.env.MYSQL_DATABASE
    ) ||
    'motor_vehicle_squadron'
  );
}

function getRawDatabaseUrl() {
  return getFirstDefined(
    process.env.DATABASE_URL,
    process.env.MYSQL_PUBLIC_URL,
    process.env.MYSQL_URL
  ) || '';
}

function getDatabaseHost() {
  return getFirstDefined(process.env.DB_HOST, process.env.MYSQLHOST);
}

function getDatabasePort() {
  return getFirstDefined(process.env.DB_PORT, process.env.MYSQLPORT);
}

function getDatabaseUser() {
  return getFirstDefined(process.env.DB_USER, process.env.MYSQLUSER);
}

function getDatabasePassword() {
  return getFirstDefined(process.env.DB_PASSWORD, process.env.MYSQLPASSWORD);
}

function isRailwayPublicHost(hostname) {
  return typeof hostname === 'string' && hostname.includes('.proxy.rlwy.net');
}

function getConfigSource() {
  if (process.env.DATABASE_URL) return 'DATABASE_URL';
  if (process.env.MYSQL_PUBLIC_URL) return 'MYSQL_PUBLIC_URL';
  if (process.env.MYSQL_URL) return 'MYSQL_URL';
  if (process.env.DB_HOST || process.env.DB_PORT || process.env.DB_USER || process.env.DB_PASSWORD) {
    return 'DB_*';
  }
  if (process.env.MYSQLHOST || process.env.MYSQLPORT || process.env.MYSQLUSER || process.env.MYSQLPASSWORD) {
    return 'MYSQL_*';
  }
  return 'unknown';
}

function validateDatabaseConfig(config, { includeDatabase = true } = {}) {
  const missingKeys = [];

  if (!config.host) missingKeys.push('DB_HOST or MYSQLHOST');
  if (!config.port || Number.isNaN(Number(config.port))) missingKeys.push('DB_PORT or MYSQLPORT');
  if (!config.user) missingKeys.push('DB_USER or MYSQLUSER');
  if (getDatabasePassword() === undefined) missingKeys.push('DB_PASSWORD or MYSQLPASSWORD');
  if (includeDatabase && !config.database) missingKeys.push('DB_NAME or MYSQLDATABASE');

  if (missingKeys.length > 0) {
    const error = new Error(
      `Incomplete MySQL configuration. Missing: ${missingKeys.join(', ')}. ` +
        `Expected Railway public credentials via DB_* or MYSQL_* environment variables.`
    );
    error.code = 'DB_CONFIG_MISSING';
    throw error;
  }
}

function getSafeDatabaseConfigForLogging(config) {
  return {
    source: getConfigSource(),
    host: config.host,
    port: Number(config.port),
    user: config.user,
    database: config.database || getDatabaseName(),
    sslEnabled: Boolean(config.ssl),
  };
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
      host: getDatabaseHost(),
      port: Number(getDatabasePort() || 3306),
      user: getDatabaseUser(),
      password: getDatabasePassword() ?? '',
      database: databaseName,
    };
  }

  const connectTimeout = Number(
    process.env.DB_CONNECT_TIMEOUT || process.env.MYSQL_CONNECT_TIMEOUT || 10000
  );
  if (!Number.isNaN(connectTimeout) && connectTimeout > 0) {
    config.connectTimeout = connectTimeout;
  }

  const shouldEnableSsl =
    parseBoolean(process.env.DB_SSL) ||
    parseBoolean(process.env.MYSQL_SSL) ||
    isRailwayPublicHost(config.host);

  if (shouldEnableSsl) {
    config.ssl = {
      rejectUnauthorized: parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, false),
    };
  }

  return config;
}

function getDatabaseConfig({ includeDatabase = true, multipleStatements = false } = {}) {
  const config = buildBaseDatabaseConfig();
  validateDatabaseConfig(config, { includeDatabase });

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

async function verifyDatabaseConnection({ includeDatabase = true } = {}) {
  const connection = await createDatabaseConnection({ includeDatabase });
  const safeConfig = getSafeDatabaseConfigForLogging(
    getDatabaseConfig({ includeDatabase })
  );

  try {
    await connection.query('SELECT 1');
    console.log(
      `[db] MySQL connection established (${safeConfig.source}) ` +
        `host=${safeConfig.host} port=${safeConfig.port} user=${safeConfig.user} ` +
        `database=${safeConfig.database} ssl=${safeConfig.sslEnabled ? 'enabled' : 'disabled'}`
    );
  } catch (error) {
    console.error(
      `[db] MySQL connection check failed ` +
        `host=${safeConfig.host} port=${safeConfig.port} user=${safeConfig.user} ` +
        `database=${safeConfig.database} ssl=${safeConfig.sslEnabled ? 'enabled' : 'disabled'}`
    );
    throw error;
  } finally {
    await connection.end();
  }
}

module.exports = {
  createDatabaseConnection,
  getDatabaseConfig,
  getDatabaseName,
  getRawDatabaseUrl,
  getSafeDatabaseConfigForLogging,
  verifyDatabaseConnection,
};
