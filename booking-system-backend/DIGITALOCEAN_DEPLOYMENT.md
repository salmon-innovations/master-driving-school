# DigitalOcean Deployment Guide (Backend + Database)

This project can be hosted on DigitalOcean App Platform with DigitalOcean Managed PostgreSQL.

## 1. Prerequisites

- Code pushed to GitHub
- DigitalOcean account
- Domain ready (optional but recommended)

## 2. Create Managed PostgreSQL

1. In DigitalOcean, create a PostgreSQL cluster.
2. Copy the connection string (it includes host, port, user, password).
3. Ensure it uses SSL (`sslmode=require`).

## 3. Deploy Backend on App Platform

Option A: Using `.do/app.yaml`

1. Edit `.do/app.yaml` and replace:
- `YOUR_GITHUB_OWNER/YOUR_GITHUB_REPO`
- frontend/backend domains
- secrets marked `CHANGE_ME`
2. In App Platform, choose "Create App from App Spec".
3. Upload/select `.do/app.yaml`.
4. Deploy.

Option B: App UI (manual)

1. Create app from GitHub repo.
2. Set source dir to `booking-system-backend`.
3. Build command: `npm install`
4. Run command: `npm start`
5. HTTP port: `8080`
6. Health check path: `/api/health`

## 4. Required Environment Variables

Use `booking-system-backend/.env.digitalocean.example` as template.

Minimum required:
- `NODE_ENV=production`
- `PORT=8080`
- `FRONTEND_URL=https://...` (comma-separated if multiple)
- `BACKEND_URL=https://...`
- `DATABASE_URL=postgresql://...?...sslmode=require`
- `DB_SSL=true`
- `DB_SSL_REJECT_UNAUTHORIZED=false`
- `JWT_SECRET=...`

## 5. Database Migration / Schema

This backend currently performs a small runtime migration for `courses.branch_prices`.
For full schema, run your SQL/migration scripts once against the new DB:

- `database/database.sql` (if your canonical schema is here)
- any migration scripts under `migrations/`

Run using your preferred psql client against the DigitalOcean DB.

## 6. CORS and Frontend

Set `FRONTEND_URL` to your real frontend domains.
Example:

`FRONTEND_URL=https://app.example.com,https://www.app.example.com`

## 7. Post-Deploy Checks

- `GET /api/health` returns `{ status: "ok" }`
- Login works
- CRUD (users/branches/courses) works
- Email sending works with production credentials
- Payment callback URLs match `BACKEND_URL`

## 8. Security Notes

- Rotate all secrets currently stored in local `.env` before production.
- Store all credentials in App Platform secrets, not in git.
- Restrict database trusted sources to App Platform if possible.
