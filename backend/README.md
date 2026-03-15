# Motor Vehicle Squadron Management System (Backend)

This folder contains the Express + MySQL API server.

## Quick Start
1. Copy `.env.example` to `.env` and update database credentials.
2. Run SQL script: `backend/database/schema.sql`.
3. Install dependencies: `npm install` (inside `backend`).
4. Start server: `npm run dev`.

The app is served at `http://localhost:5000`.

## Client Demo Reset
- Run `npm run demo:reset` inside `backend` to clear old data and reload the clean demo dataset.
- The reset script executes `backend/database/schema.sql`, including table creation and seeded demo records.
- Run `npm run fresh:reset` inside `backend` for a clean start (vehicles/logs/operations cleared and IDs reset to 1).

Demo accounts:
- `admin@mvsm.com` / `admin123`
- `staff@mvsm.com` / `staff123`
