# Cleaning Duties

Production-ready SaaS foundation for managing multi-site cleaning operations.

## Workspace

- `apps/web`: React + Vite frontend
- `apps/api`: Express API
- `packages/shared`: shared domain types and validation

## Environment

Create `apps/web/.env.local` with:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BASE_URL`

Run `apps/api` with:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CORS_ORIGIN` optional, for example `http://localhost:5173`

## Deployment

The Vercel deployment serves the Vite frontend only. API routes such as `/invite`
are handled by the Express API and must be deployed separately, for example on
Render using `render.yaml`.

Set these production environment variables:

- Vercel web: `VITE_API_BASE_URL` must be the deployed API origin, for example `https://cleaning-duties-api.onrender.com`
- Render API: `CORS_ORIGIN` must be the deployed Vercel web origin
- Render API: `SUPABASE_URL`
- Render API: `SUPABASE_SERVICE_ROLE_KEY`
