
# Motor Vehicle Squadron Management System

This project contains the Vite/React frontend for the Motor Vehicle Squadron Management System.

## Local development

Run `npm install` to install the dependencies.

Run `npm run dev` to start the development server.

## Vercel deployment

This frontend can be deployed to Vercel as a static Vite app.

Required notes:

- The frontend build output is `dist`
- SPA routes are handled by `vercel.json`
- If your backend is hosted separately, add a Vercel environment variable:
  - `VITE_API_BASE_URL=https://your-backend-domain/api`

If `VITE_API_BASE_URL` is not set, the app defaults to `/api`, which only works when the backend is served from the same domain.
## Render deployment

This repo also includes a [render.yaml](d:\Modern Dashboard UI Design\render.yaml) blueprint for deploying:

- a Render static site for the frontend
- a Render web service for the backend

The blueprint wires the frontend to the backend automatically by using the backend service's public Render URL.

Before deploying, you still need to provide MySQL credentials for the backend service:

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

If you deploy frontend and backend on separate Render URLs, the backend now supports production session cookies through:

- `SESSION_COOKIE_SAME_SITE=none`
- `SESSION_COOKIE_SECURE=true`
