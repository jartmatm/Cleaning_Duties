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
- `VITE_DEMO_REQUEST_ENDPOINT` optional, for a server-side demo request form handler

The OneSignal App ID used by the web and mobile clients is public. Never expose
the OneSignal REST API key in Vite or Expo environment variables.

The authenticated `notification-events` Supabase Edge Function sends transactional
push and email messages. Configure its server-side secrets with:

```bash
npx supabase secrets set \
  ONESIGNAL_APP_ID=3d22eb0b-ce92-4065-b9dc-bf43c4e5d10d \
  ONESIGNAL_REST_API_KEY=your-private-app-api-key \
  APP_URL=https://cleaningduties.app \
  --project-ref rbkrhaylmxnddwupetck

npx supabase functions deploy notification-events \
  --project-ref rbkrhaylmxnddwupetck
```

The OneSignal app must have Email and Web Push configured, and its Web Site URL
must exactly match the production origin. iOS Push must use the same bundle ID
as Expo: `com.cleaningduties.app`.

Run `apps/api` with:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ONESIGNAL_APP_ID`
- `ONESIGNAL_REST_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID`
- `APP_URL` optional, for notification deep links
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
- Supabase Edge Function: `ONESIGNAL_APP_ID`
- Supabase Edge Function: `ONESIGNAL_REST_API_KEY`
- Render API: `STRIPE_SECRET_KEY`
- Render API: `STRIPE_WEBHOOK_SECRET`
- Render API: `STRIPE_PRICE_ID`
- Supabase Edge Function: `APP_URL`, for example `https://cleaningduties.app`
