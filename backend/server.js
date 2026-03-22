const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
require('dotenv').config();
const { ensureDatabaseSchema } = require('./database/ensureSchema');
const db = require('./config/db');
const { logDatabaseError } = require('./config/databaseConfig');
const { requireAuth } = require('./middlewares/auth');
const { requireAdmin, requireAdminOrStaff } = require('./middlewares/roleMiddleware');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const driverRoutes = require('./routes/driverRoutes');
const movementRoutes = require('./routes/movementRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const workOrderRoutes = require('./routes/workOrderRoutes');
const activityLogRoutes = require('./routes/activityLogRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const reportRoutes = require('./routes/reportRoutes');

function normalizeOrigin(origin) {
  if (!origin) return null;

  try {
    const parsed = new URL(origin.trim());
    return `${parsed.protocol}//${parsed.host}`.toLowerCase();
  } catch {
    return null;
  }
}

function buildAllowedOrigins(configuredOrigins) {
  const expandedOrigins = new Set();

  for (const origin of configuredOrigins) {
    const normalized = normalizeOrigin(origin);
    if (!normalized) continue;

    expandedOrigins.add(normalized);

    try {
      const parsed = new URL(normalized);

      if (parsed.hostname.startsWith('www.')) {
        parsed.hostname = parsed.hostname.slice(4);
        expandedOrigins.add(`${parsed.protocol}//${parsed.host}`.toLowerCase());
      } else {
        parsed.hostname = `www.${parsed.hostname}`;
        expandedOrigins.add(`${parsed.protocol}//${parsed.host}`.toLowerCase());
      }
    } catch {
      // Skip invalid variants.
    }
  }

  return Array.from(expandedOrigins);
}

const app = express();
const configuredFrontendOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedFrontendOrigins = buildAllowedOrigins(configuredFrontendOrigins);
const isProduction = process.env.NODE_ENV === 'production';
const sessionCookieSameSite = process.env.SESSION_COOKIE_SAME_SITE || (isProduction ? 'none' : 'lax');
const sessionCookieSecure =
  process.env.SESSION_COOKIE_SECURE !== undefined
    ? process.env.SESSION_COOKIE_SECURE === 'true'
    : isProduction;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);
app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;
  const normalizedRequestOrigin = normalizeOrigin(requestOrigin);
  const matchedOrigin =
    normalizedRequestOrigin && allowedFrontendOrigins.includes(normalizedRequestOrigin)
      ? requestOrigin
      : configuredFrontendOrigins[0];

  if (matchedOrigin) {
    res.header('Access-Control-Allow-Origin', matchedOrigin);
  }
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  return next();
});
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change_this_secret_key',
    resave: false,
    saveUninitialized: false,
    proxy: isProduction,
    cookie: {
      httpOnly: true,
      sameSite: sessionCookieSameSite,
      secure: sessionCookieSecure,
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

app.use('/api/auth', authRoutes);
app.use('/api/users', requireAuth, requireAdmin, userRoutes);
app.use('/api/dashboard', requireAuth, requireAdmin, dashboardRoutes);
app.use('/api/vehicles', requireAuth, requireAdmin, vehicleRoutes);
app.use('/api/drivers', requireAuth, requireAdmin, driverRoutes);
app.use('/api/movements', requireAuth, requireAdmin, movementRoutes);
app.use('/api/maintenance', requireAuth, requireAdmin, maintenanceRoutes);
app.use('/api/work-orders', requireAuth, requireAdmin, workOrderRoutes);
app.use('/api/activity-logs', requireAuth, requireAdmin, activityLogRoutes);
app.use('/api/logs', requireAuth, requireAdmin, activityLogRoutes);
app.use('/api/settings', requireAuth, requireAdminOrStaff, settingsRoutes);
app.use('/api/reports', requireAuth, requireAdmin, reportRoutes);

app.get('/api/health', (_, res) => {
  res.json({ status: 'ok' });
});

app.get('/health', (_, res) => {
  res.json({ status: 'ok' });
});

app.get('/', (_, res) => {
  res.json({
    name: 'Motor Vehicle Squadron Management System API',
    status: 'ok',
    frontend: configuredFrontendOrigins.join(', ') || null,
    health: '/api/health',
  });
});

app.use((err, req, res, next) => {
  const statusCode = err && Number.isInteger(err.status) ? err.status : 500;

  if (statusCode >= 500) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    console.error(err && err.stack ? err.stack : err);
  }

  if (err && err.code) {
    return res.status(statusCode).json({
      message: err.message || 'Internal server error.',
      code: err.code,
      detail: !isProduction ? err.sqlMessage || err.message : undefined
    });
  }

  return res.status(statusCode).json({
    message: err && err.message ? err.message : 'Internal server error.',
    detail: !isProduction && err ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  const result = await ensureDatabaseSchema();
  await db.verifyConnection();
  if (result.addedColumns.length > 0) {
    console.log(`Schema compatibility update applied: ${result.addedColumns.join(', ')}`);
  }

  app.listen(PORT, () => {
    console.log(`MVSMS backend listening on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start MVSMS backend.');
  logDatabaseError('Backend startup failed.', error);
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
