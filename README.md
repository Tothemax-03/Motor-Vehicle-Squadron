
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
