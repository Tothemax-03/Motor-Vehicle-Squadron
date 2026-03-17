
# Motor Vehicle Squadron Management System

Production deployment target:

- Frontend: Vercel
- Backend: Render Web Service
- Database: Render MySQL

Important repository note:

- The deployable Vite/React frontend lives at the repository root.
- The `frontend/` folder is an older static prototype and is not the production app.
- The production backend lives in `backend/`.

## Frontend configuration

The frontend reads its API URL from `VITE_API_URL`.

Example `.env`:

```env
VITE_API_URL=https://your-render-backend.onrender.com
```

If `VITE_API_BASE_URL` is not set, the app defaults to `/api`, which only works when the backend is served from the same domain.
## Render deployment
The app normalizes this automatically, so it can be:

- `https://your-render-backend.onrender.com`
- `https://your-render-backend.onrender.com/api`

## Backend configuration

The backend uses environment variables for:

- `PORT`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `FRONTEND_ORIGIN`

Optional:

- `DATABASE_URL`
- `DB_SSL`
- `DB_SSL_REJECT_UNAUTHORIZED`
- `SESSION_SECRET`
- `SESSION_COOKIE_SAME_SITE`
- `SESSION_COOKIE_SECURE`

Health checks:

- `GET /api/health`
- `GET /health`

## Vercel deployment steps

1. Import the GitHub repository into Vercel.
2. Set the Root Directory to the repo root.
3. Framework Preset: `Vite`
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Add environment variable:

```env
VITE_API_URL=https://your-render-backend.onrender.com
```

7. Deploy.

This repo already includes `vercel.json` for SPA rewrites.

## Render backend deployment steps

1. Create a new Render Web Service from the same GitHub repo.
2. Set:
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
3. Add environment variables:

```env
PORT=5000
DB_HOST=your-render-mysql-host
DB_PORT=3306
DB_USER=your-render-mysql-user
DB_PASSWORD=your-render-mysql-password
DB_NAME=motor_vehicle_squadron
FRONTEND_ORIGIN=https://your-vercel-project.vercel.app
SESSION_SECRET=change_this_secret_key
SESSION_COOKIE_SAME_SITE=none
SESSION_COOKIE_SECURE=true
```

4. Deploy the service.
5. Verify:

```text
https://your-render-backend.onrender.com/api/health
```

Expected response:

```json
{
  "status": "ok"
}
```

## Render MySQL setup

1. Create a new Render MySQL database.
2. Copy the connection values from the Render dashboard:
   - Host
   - Port
   - Database
   - Username
   - Password
3. Add those values to the Render backend environment variables.

## Importing `motor_vehicle_squadron.sql` into Render MySQL

Use the MySQL CLI from your local machine with the external connection details shown in the Render MySQL dashboard.

Example:

```bash
mysql -h YOUR_RENDER_MYSQL_HOST -P 3306 -u YOUR_RENDER_MYSQL_USER -p motor_vehicle_squadron < motor_vehicle_squadron.sql
```

If the database has not been created yet:

```bash
mysql -h YOUR_RENDER_MYSQL_HOST -P 3306 -u YOUR_RENDER_MYSQL_USER -p < motor_vehicle_squadron.sql
```

The checked-in `motor_vehicle_squadron.sql` file matches the current application schema and demo data.

## Local development

Frontend:

```bash
npm install
npm run dev
```

Backend:

```bash
cd backend
npm install
npm start
```
