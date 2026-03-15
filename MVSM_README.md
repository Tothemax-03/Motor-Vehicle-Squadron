# Motor Vehicle Squadron Management System

A complete full-stack web application for monitoring transport unit vehicle movement and maintenance.

## Stack
- Frontend: HTML, CSS, JavaScript, Bootstrap 5
- Backend: Node.js + Express
- Database: MySQL

## Project Structure
- `frontend/` - Login, signup, dashboard UI and client-side logic
- `backend/server.js` - Express server entry
- `backend/config/db.js` - MySQL connection pool
- `backend/routes/` - API route modules
- `backend/controllers/` - Business logic per feature
- `backend/middlewares/` - Session and role protection middleware
- `backend/database/schema.sql` - Database schema + sample data
- `backend/public/` - Public backend-served assets

## Features Included
- Session-based login/signup with Admin/Staff roles
- Dashboard metrics + recent movement + maintenance alerts
- Vehicle management (add/edit/delete)
- Driver management (add/edit/delete + vehicle assignment)
- Vehicle movement monitoring (dispatch logs, history, filter/search)
- Vehicle maintenance monitoring (schedule, status updates, alerts)
- Reports (vehicle usage + maintenance) with CSV/PDF export

## Local Setup
1. Open MySQL and run [`backend/database/schema.sql`](/d:/Modern%20Dashboard%20UI%20Design/backend/database/schema.sql).
2. Go to backend folder:
   ```bash
   cd backend
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Copy `.env.example` to `.env` and update DB credentials.
5. Start the server:
   ```bash
   npm run dev
   ```
6. Open `http://localhost:5000`.

## Notes
- Create your first account from the Sign Up tab and choose role `Admin` for full access.
- Only Admin can delete vehicles and drivers.
- Reports export endpoints:
  - `/api/reports/vehicle-usage/csv`
  - `/api/reports/vehicle-usage/pdf`
  - `/api/reports/maintenance/csv`
  - `/api/reports/maintenance/pdf`
