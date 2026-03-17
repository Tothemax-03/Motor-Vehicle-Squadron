const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
require('dotenv').config();
const { ensureDatabaseSchema } = require('./database/ensureSchema');
const db = require('./config/db');
const { logDatabaseError } = require('./config/databaseConfig');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const driverRoutes = require('./routes/driverRoutes');
const movementRoutes = require('./routes/movementRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const workOrderRoutes = require('./routes/workOrderRoutes');
const activityLogRoutes = require('./routes/activityLogRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();
const allowedFrontendOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
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
  const matchedOrigin =
    requestOrigin && allowedFrontendOrigins.includes(requestOrigin)
      ? requestOrigin
      : allowedFrontendOrigins[0];

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
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/movements', movementRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/work-orders', workOrderRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/reports', reportRoutes);

const frontendPath = path.join(__dirname, '..', 'frontend');
app.use('/assets', express.static(path.join(__dirname, 'public')));
app.use(express.static(frontendPath));

app.get('/api/health', (_, res) => {
  res.json({ status: 'ok' });
});

app.get('/health', (_, res) => {
  res.json({ status: 'ok' });
});

app.get('*', (_, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
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
