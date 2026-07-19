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
