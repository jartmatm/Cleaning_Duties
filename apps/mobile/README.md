# Cleaning Duties Mobile

React Native client for Cleaning Duties, built with Expo Router and connected to the same Supabase project used by the web application.

## Architecture

- Expo SDK 57, React Native, TypeScript, and Expo Router.
- Supabase Auth sessions persisted in AsyncStorage.
- TanStack Query owns server state and targeted cache invalidation.
- A small React context owns only the authenticated profile, company, accessible sites, and validated active site.
- Company palettes, duty statuses, priorities, incident types, and validation schemas come from `@cleaning-duties/shared`.
- Supabase Realtime invalidates duty, assignment, notification, and unplanned-request queries when the project publication supports those tables.
- `expo-network` disables mutations while offline. Read cache remains available in memory.

The mobile client does not contain demo users, sites, duties, photos, counters, or fallback business records.

## Requirements

- Node.js 24.19.0
- Corepack
- pnpm 9.15.4
- Xcode with an available iPhone simulator

Use the repository package manager version:

```bash
fnm exec --using=24.19.0 corepack enable
fnm exec --using=24.19.0 corepack prepare pnpm@9.15.4 --activate
fnm exec --using=24.19.0 pnpm install
```

## Environment

Create `apps/mobile/.env` from `.env.example` and provide public client values only:

```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
EXPO_PUBLIC_API_BASE_URL=
EXPO_PUBLIC_ONESIGNAL_APP_ID=3d22eb0b-ce92-4065-b9dc-bf43c4e5d10d
```

Either the anon key or publishable key is required. Never add a service-role key, Stripe secret, OneSignal REST API key, or webhook secret to Expo.

When Supabase configuration is absent, the app displays a configuration-required screen and does not substitute fake data.

## Commands

From the repository root:

```bash
pnpm dev:mobile
pnpm ios
pnpm --filter @cleaning-duties/mobile typecheck
pnpm --filter @cleaning-duties/mobile lint
```

From `apps/mobile`:

```bash
pnpm start
pnpm ios
pnpm android
```

## Authentication Flow

1. Supabase restores the persisted session from AsyncStorage.
2. The client loads the matching `profiles` row.
3. It loads company branding from `companies`.
4. It reads `site_members` and fetches only sites visible through current RLS policies.
5. A previously selected site is restored only when it remains accessible.
6. Missing profiles or site access produce explicit recoverable states.
7. The restored profile UUID is registered with OneSignal as the stable `external_id`.
8. Sign out removes Realtime channels, query cache, persisted active-site state, the OneSignal identity, and the Supabase session.

Email and phone sign-in use the shared `authLoginSchema`. Password reset deep-links through the `cleaningduties` app scheme.

## Data Access Strategy

The app follows the same boundary as the web client:

- Direct Supabase access with the authenticated user session for profiles, sites, duties, assignments, comments, evidence, incidents, notifications, service reports, and unplanned-duty requests.
- Existing PostgreSQL functions for duty schedule advancement, archived-duty cleanup, and unplanned-duty review.
- The Express API remains the boundary for invitations, billing, Stripe, and other service-role operations.
- The authenticated Supabase `notification-events` Edge Function sends OneSignal push and email messages without exposing the REST API key to either client.

RLS remains the security boundary. UI visibility is only an additional usability control.

## Photo Upload Flow

1. The user selects the native camera or photo library.
2. Expo Image Manipulator resizes large images to a maximum dimension of 1600 pixels and encodes JPEG at 72% quality.
3. Expo File System reads the optimized file as an ArrayBuffer.
4. Supabase Storage uploads to the site's existing public bucket.
5. Duty evidence uses the existing `<site-id>/before` and `<site-id>/after` folders.
6. Unplanned evidence uses `<site-id>/unplanned/<cleaner-id>/<request-id>/<type>`.
7. Public URLs are saved to the same `before_photos` and `after_photos` arrays used by the web application.

No additional bucket or duplicate photo table is created.

## iOS Simulator

List and boot an available simulator, then start Expo:

```bash
xcrun simctl list devices available
pnpm ios
```

The initial simulator run can validate routing and missing configuration without credentials. Real authentication and data mutation require the public Supabase variables in `apps/mobile/.env`.

## Push Notifications

- Native OneSignal registration is enabled for iOS and Android development builds.
- Expo Go cannot load the native OneSignal SDK; use a development build, TestFlight, or an App Store build on a real device.
- On sign-in and session restore, the profile UUID is registered as OneSignal `external_id`, with company and role tags.
- Assignment, recurring assignment, completion, incident, unplanned-duty, and sign-in events are delivered through Supabase.
- Notification clicks open the matching duty when one is present; operational review alerts open the appropriate app section.
- The current Expo plugin mode and `aps-environment` are `development`. Change both to `production` for TestFlight and App Store builds.
- Configure Apple Push credentials and bundle ID `com.cleaningduties.app` in the OneSignal dashboard before building for a physical iPhone.

## Known Limitations
- Managers and supervisors can review operational records and unplanned work, but duty creation/editing remains in the web application for this first mobile slice.
- Service report generation and PDF download remain in the web application; mobile lists saved reports visible through RLS.
- Offline mode preserves in-memory reads and blocks mutations. It does not optimistically complete duties.
- There is no SQLite mutation queue. A future queue must use idempotency keys, retain original server versions, serialize photo uploads before dependent mutations, and surface conflicts for manual resolution.
- Production sign-in, photo upload, and cross-client mutation verification require local public environment values.

## Next Steps

1. Add the public mobile environment values and run authenticated simulator verification.
2. Add Apple Push credentials to the OneSignal app and validate delivery on a physical iPhone development build.
3. Add manager and supervisor duty authoring after the cleaner execution workflow has completed field testing.
4. Add durable encrypted read persistence and a transactional offline queue only after conflict semantics are agreed.

See [`docs/mobile-data-mapping.md`](../../docs/mobile-data-mapping.md) for the screen-to-database mapping.
