# Cleaning Duties Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Powerball app with a production-ready Cleaning Duties SaaS foundation using a React frontend, Supabase integration, and a clean multi-tenant architecture.

**Architecture:** Build a workspace-ready foundation with a Vite React app for the product UI, a small TypeScript Node/Express API surface for server-side concerns that must not live in the browser, and a shared package for types, validation, and domain constants. Establish the design system, routing, auth boundaries, layout shell, and data-access seams first so the later feature phases can be added without refactoring the entire stack.

**Tech Stack:** React 19, TypeScript, Vite, React Router, TanStack Query, Zustand, TailwindCSS, shadcn/ui, React Hook Form, Zod, Lucide Icons, Node.js, Express, Supabase Postgres, Supabase Auth, Supabase Storage, Supabase Realtime, Render

---

### Task 1: Create the workspace skeleton and remove the Powerball app shape

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `apps/web/package.json`
- Create: `apps/api/package.json`
- Create: `packages/shared/package.json`
- Create: `tsconfig.base.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/api/tsconfig.json`
- Create: `packages/shared/tsconfig.json`
- Create: `.gitignore`
- Create: `README.md`
- Remove: `templates/index.html`
- Remove: `app.py`
- Remove: `powerball_model.py`
- Remove: `powerball_scraper.py`
- Remove: `powerball_service.py`
- Remove: `script.py`
- Remove: `url_years.py`
- Remove: `data/powerball_history.csv`

- [ ] **Step 1: Write the failing verification**

Run:
```bash
test ! -f app.py && test ! -f powerball_service.py && test -f package.json
```
Expected: pass after the scaffold is created and the Powerball files are removed.

- [ ] **Step 2: Create the minimal workspace files**

Create the root workspace metadata and empty package manifests so the repo has a real monorepo boundary before app code lands.

- [ ] **Step 3: Verify the new structure**

Run:
```bash
find . -maxdepth 2 -type f | sort
```
Expected: files are organized under `apps/`, `packages/`, and root config only.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "chore: scaffold cleaning duties workspace"
```

### Task 2: Bootstrap the shared domain package

**Files:**
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/constants/priorities.ts`
- Create: `packages/shared/src/constants/statuses.ts`
- Create: `packages/shared/src/constants/incident-types.ts`
- Create: `packages/shared/src/constants/equipment.ts`
- Create: `packages/shared/src/schemas/duty.ts`
- Create: `packages/shared/src/schemas/auth.ts`
- Create: `packages/shared/src/types.ts`

- [ ] **Step 1: Write the failing verification**

Run:
```bash
pnpm --filter @cleaning-duties/shared exec tsc --noEmit
```
Expected: fail until the package exports and schema files exist.

- [ ] **Step 2: Implement the shared domain vocabulary**

Define the canonical enums, Zod schemas, and exported types that both the web app and API will reuse for duties, auth, priorities, and incident types.

- [ ] **Step 3: Verify type safety**

Run:
```bash
pnpm --filter @cleaning-duties/shared exec tsc --noEmit
```
Expected: pass with no `any` usage.

- [ ] **Step 4: Commit**

```bash
git add packages/shared
git commit -m "feat: add shared domain schemas"
```

### Task 3: Bootstrap the web application shell

**Files:**
- Create: `apps/web/index.html`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/postcss.config.js`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/app/App.tsx`
- Create: `apps/web/src/app/router.tsx`
- Create: `apps/web/src/styles/index.css`
- Create: `apps/web/src/layouts/AuthLayout.tsx`
- Create: `apps/web/src/layouts/AppLayout.tsx`
- Create: `apps/web/src/components/ui/*`
- Create: `apps/web/src/components/common/*`

- [ ] **Step 1: Write the failing verification**

Run:
```bash
pnpm --filter @cleaning-duties/web exec vite build
```
Expected: fail until the app entry, router, and style pipeline exist.

- [ ] **Step 2: Implement the app bootstrap**

Create the Vite entry, route tree, global styles, and shell layouts so the app can render a login surface and an authenticated app surface.

- [ ] **Step 3: Verify the build**

Run:
```bash
pnpm --filter @cleaning-duties/web exec vite build
```
Expected: pass with a production build.

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "feat: bootstrap cleaning duties web app"
```

### Task 4: Establish the backend API seam

**Files:**
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/routes/health.ts`
- Create: `apps/api/src/middleware/error-handler.ts`
- Create: `apps/api/src/lib/env.ts`
- Create: `apps/api/src/lib/logger.ts`
- Create: `apps/api/src/lib/supabase-admin.ts`

- [ ] **Step 1: Write the failing verification**

Run:
```bash
pnpm --filter @cleaning-duties/api exec tsc --noEmit
```
Expected: fail until the API files and env loader exist.

- [ ] **Step 2: Implement the API skeleton**

Add a typed Express app with health checks, structured error handling, and a Supabase admin client seam for future server-side operations.

- [ ] **Step 3: Verify runtime startup**

Run:
```bash
pnpm --filter @cleaning-duties/api dev
```
Expected: server starts and `/health` returns JSON.

- [ ] **Step 4: Commit**

```bash
git add apps/api
git commit -m "feat: add api foundation"
```

### Task 5: Add auth, routing, and app state boundaries

**Files:**
- Create: `apps/web/src/features/auth/*`
- Create: `apps/web/src/features/session/*`
- Create: `apps/web/src/store/session-store.ts`
- Create: `apps/web/src/hooks/use-session.ts`
- Create: `apps/web/src/services/supabase-client.ts`
- Create: `apps/web/src/services/auth-service.ts`
- Create: `apps/web/src/routes/protected-route.tsx`
- Create: `apps/web/src/routes/public-route.tsx`

- [ ] **Step 1: Write the failing verification**

Run:
```bash
pnpm --filter @cleaning-duties/web exec tsc --noEmit
```
Expected: fail until auth state and route guards are wired.

- [ ] **Step 2: Implement Supabase auth boundaries**

Set up session hydration, login/logout flows, protected routing, and user role loading with Zustand and TanStack Query.

- [ ] **Step 3: Verify type and build health**

Run:
```bash
pnpm --filter @cleaning-duties/web exec tsc --noEmit && pnpm --filter @cleaning-duties/web exec vite build
```
Expected: both commands pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "feat: add auth and route boundaries"
```

### Task 6: Add database contract and migration scaffolding

**Files:**
- Create: `supabase/migrations/0001_initial_schema.sql`
- Create: `supabase/migrations/0002_rls_policies.sql`
- Create: `supabase/seed.sql`
- Create: `supabase/config.toml`
- Create: `apps/api/src/db/schema-contract.ts`

- [ ] **Step 1: Write the failing verification**

Run:
```bash
test -f supabase/migrations/0001_initial_schema.sql
```
Expected: fail before migrations exist.

- [ ] **Step 2: Implement the initial schema**

Add the core tables, UUID keys, foreign keys, indexes, and row-level security policies for companies, sites, profiles, memberships, duties, assignments, comments, photos, incidents, notifications, and logs.

- [ ] **Step 3: Verify the SQL files are in place**

Run:
```bash
find supabase -maxdepth 2 -type f | sort
```
Expected: migration and config files exist and are named consistently.

- [ ] **Step 4: Commit**

```bash
git add supabase apps/api/src/db
git commit -m "feat: add supabase schema foundation"
```

### Task 7: Add the product shell and premium visual system

**Files:**
- Create: `apps/web/src/components/navigation/*`
- Create: `apps/web/src/components/feedback/*`
- Create: `apps/web/src/components/empty-states/*`
- Create: `apps/web/src/components/skeletons/*`
- Create: `apps/web/src/theme/*`
- Create: `apps/web/src/constants/navigation.ts`

- [ ] **Step 1: Write the failing verification**

Run:
```bash
pnpm --filter @cleaning-duties/web exec vite build
```
Expected: fail until the shell components and theme tokens exist.

- [ ] **Step 2: Implement the visual language**

Create the design tokens, sidebar/topbar shell, cards, skeletons, dialogs, and toast surfaces that will carry the app through dashboard, sites, duties, and users views.

- [ ] **Step 3: Verify responsive output**

Run:
```bash
pnpm --filter @cleaning-duties/web exec vite build
```
Expected: pass and preserve responsiveness across the shell.

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "feat: add product shell and design system"
```

### Task 8: Prepare the first feature slice for Sites

**Files:**
- Create: `apps/web/src/features/sites/*`
- Create: `apps/web/src/pages/sites/*`
- Create: `apps/api/src/routes/sites.ts`

- [ ] **Step 1: Write the failing verification**

Run:
```bash
pnpm --filter @cleaning-duties/web exec tsc --noEmit
```
Expected: fail until the sites feature slice exists.

- [ ] **Step 2: Add the feature boundary**

Create the site list, site card, and site create/edit entry points with typed data access hooks and a server route contract that will later connect to Supabase.

- [ ] **Step 3: Verify the slice is wired**

Run:
```bash
pnpm --filter @cleaning-duties/web exec vite build
```
Expected: pass with the feature slice routed but not yet fully product-complete.

- [ ] **Step 4: Commit**

```bash
git add apps/web apps/api
git commit -m "feat: scaffold sites feature slice"
```

### Task 9: Verify the foundation before moving to Phase 2

**Files:**
- Modify: any files needed from Tasks 1-8

- [ ] **Step 1: Run the cross-package checks**

Run:
```bash
pnpm -r exec tsc --noEmit
pnpm -r exec vite build
```
Expected: the workspace type-checks and the web app builds.

- [ ] **Step 2: Run a repository sanity check**

Run:
```bash
find . -maxdepth 3 -type f | sort
```
Expected: only the new SaaS workspace files remain relevant to the project.

- [ ] **Step 3: Commit the foundation**

```bash
git add .
git commit -m "chore: complete cleaning duties foundation"
```
