# BuckedUp Dashboard — Complete Development Workflow

> **Repo**: `Lyduke56/BuckedUp-Dashboard-Lifewood`  
> **Stack**: Next.js 16 · React 19 · TypeScript · Supabase · Tailwind CSS v4  
> **Last Updated**: July 17, 2026

---

## Table of Contents

1. [Environment Setup](#1-environment-setup)
2. [Project Architecture](#2-project-architecture)
3. [Component Structure — Atomic Design](#3-component-structure--atomic-design)
4. [Core Code Patterns](#4-core-code-patterns)
5. [Database & Schema Workflow](#5-database--schema-workflow)
6. [Authentication & Middleware](#6-authentication--middleware)
7. [API Routes](#7-api-routes)
8. [Styling System](#8-styling-system)
9. [Adding a New Feature — Step-by-Step](#9-adding-a-new-feature--step-by-step)
10. [npm Scripts Reference](#10-npm-scripts-reference)
11. [Debugging Guide](#11-debugging-guide)
12. [Critical Rules & Gotchas](#12-critical-rules--gotchas)

---

## 1. Environment Setup

### Prerequisites

| Tool | Min Version | Notes |
|------|------------|-------|
| Node.js | v18+ | Check with `node --version` |
| npm | v9+ | Comes bundled with Node |
| Git | Any | For version control |
| Supabase project | — | Cloud or local Docker |

### Clone & Install

```bash
git clone <repo-url>
cd BuckedUp-Dashboard-Lifewood/buckedup_dashboard
npm install
```

### Environment Variables

Create a `.env.local` file in `buckedup_dashboard/` (this file is gitignored — never commit it):

```env
# Required for the app to function at all
NEXT_PUBLIC_SUPABASE_URL=https://<project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>

# Required ONLY for DB schema migrations (apply-schema.ts script)
SUPABASE_DB_URL=postgresql://postgres:<password>@db.<project-id>.supabase.co:5432/postgres
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Required for user invite emails (ManageUsersView → /api/admin/create-user)
# Uses nodemailer — configure with your SMTP provider
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=<smtp-password>
SMTP_FROM=BuckedUp Dashboard <noreply@example.com>

# Required for Bucky AI assistant (BuckyWidget)
OPENROUTER_API_KEY=<openrouter-key>
```

> [!IMPORTANT]
> `NEXT_PUBLIC_*` variables are exposed to the browser bundle. Never put secrets in `NEXT_PUBLIC_*` vars. The anon key is intentionally public — Supabase's RLS policies are the security layer.

### First-Time Database Setup

```bash
# Apply the full schema to a fresh Supabase project
npm run db:apply-schema

# Optionally seed the catalog from the CSV
npm run db:seed-catalog
```

> [!WARNING]
> `db:apply-schema` is **not idempotent** — it will fail with "table already exists" if run against an existing database. For incremental changes, write a migration script in `scripts/` instead.

### Running the Dev Server

```bash
npm run dev
# → http://localhost:3000
```

### First Login

1. Navigate to `/login`
2. Create an account with email/password
3. **The first-ever signup automatically becomes Admin** — this is enforced by the `handle_new_user()` Postgres trigger
4. All subsequent signups default to `operator` — an Admin must promote them via the Admin tab

---

## 2. Project Architecture

### Directory Map

```
buckedup_dashboard/
├── app/                        # Next.js App Router — pages, layouts, API routes
│   ├── globals.css             # ⭐ Entire CSS design system (~142KB) — one file, no exceptions
│   ├── layout.tsx              # Root layout (Geist font, HTML shell)
│   ├── page.tsx                # / → renders <Dashboard />
│   ├── login/page.tsx          # /login → glassmorphism login page
│   ├── api/
│   │   ├── admin/
│   │   │   ├── create-user/route.ts   # POST — admin creates new user + sends invite email
│   │   │   └── users/[id]/route.ts    # DELETE — admin deletes user account
│   │   └── bucky/chat/route.ts        # POST — Bucky AI streaming chat endpoint
│   └── auth/confirm/route.ts          # GET — handles Supabase invite/recovery email links
│
├── components/                 # UI components — Atomic Design hierarchy
│   ├── atoms/                  # Primitive, stateless UI pieces
│   ├── molecules/              # Small compositions of atoms
│   ├── organisms/              # Complex, self-contained sections
│   ├── templates/              # Full page layouts (tab views)
│   └── auth/                   # Auth-specific components
│
├── lib/                        # Business logic, hooks, utilities
│   ├── types.ts                # ⭐ All TypeScript types — single source of truth
│   ├── data.ts                 # ⭐ Constants: CATEGORY_TREE, STATUS_ORDER, STATUS_HEX, pacing logic
│   ├── utils.ts                # Pure helper functions
│   ├── colors.ts               # Color utilities
│   ├── useAuth.ts              # Auth hook: session, role, signOut, mustChangePassword
│   ├── useVideoRequests.ts     # Products hook + Realtime
│   ├── useIssues.ts            # Issues hook + Realtime
│   ├── useNotifications.ts     # Notifications hook + Realtime
│   ├── useProductionPlan.ts    # Production plan hook + Realtime
│   ├── useProfiles.ts          # All profiles hook + Realtime
│   ├── useStageAge.ts          # Stage aging (time-in-stage) hook
│   ├── useStageDeliverables.ts # Stage deliverables hook + Realtime
│   ├── useTodayStats.ts        # Daily stats hook
│   ├── useDailyProgress.ts     # Daily progress chart data hook
│   ├── useCatalog.ts           # Catalog products hook + Realtime
│   ├── useMounted.ts           # SSR guard for portal modals
│   ├── inviteEmailHtml.ts      # Email template for invite emails
│   ├── sendInviteEmail.ts      # Nodemailer send helper
│   ├── bucky/
│   │   ├── systemPrompt.ts     # Bucky AI system prompt builder
│   │   └── tools.ts            # Bucky AI tool definitions (50KB — all DB operations)
│   └── supabase/
│       ├── client.ts           # Browser Supabase client (anon key)
│       ├── server.ts           # Server-side client (cookie-aware, for Route Handlers)
│       └── admin.ts            # Service-role client (for admin scripts only)
│
├── supabase/
│   └── schema.sql              # ⭐ Complete DB schema (661 lines) — source of truth for all DB changes
│
└── scripts/                    # One-off database scripts (tsx, run manually)
    ├── apply-schema.ts         # Apply schema.sql to a fresh DB
    ├── seed-catalog.ts         # Seed catalog_products from CSV
    ├── migrate-phase-*.ts      # Per-phase incremental migrations
    └── ...                     # Other one-off data/migration scripts
```

### Data Flow

```
Supabase DB
    ↕ (Realtime postgres_changes subscription)
lib/use*.ts hooks  (fetch + subscribe, return typed data)
    ↓
components/templates/*  (page-level views, pass props down)
    ↓
components/organisms/*  (complex interactive sections)
    ↓
components/molecules/*  (smaller compositions)
    ↓
components/atoms/*      (primitive elements)
```

---

## 3. Component Structure — Atomic Design

The project uses [Atomic Design](https://atomicdesign.bradfrost.com/) with four levels:

### Atoms — `components/atoms/`

Primitive, stateless, single-purpose pieces. No business logic, no hooks.

| File | Purpose |
|------|---------|
| `Badge.tsx` | Colored tag/chip |
| `Button.tsx` | Styled button with variants |
| `Card.tsx` | Glassmorphism card wrapper |
| `CategoryLegend.tsx` | Color legend for category dots |
| `ChartTooltip.tsx` | Reusable chart tooltip |
| `Input.tsx` | Styled form input |
| `Particles.tsx` | Animated particle background |
| `ProductImage.tsx` | Thumbnail image with fallback |
| `Tilt.tsx` | 3D mouse-tracking tilt wrapper |
| `icons.tsx` | Custom SVG icon components |

**Rules for Atoms:**
- No `useState`, `useEffect`, or Supabase calls
- Props only — no direct imports from `lib/`
- Export named functions, not default exports

### Molecules — `components/molecules/`

Small groups of atoms. May contain local `useState` for simple UI state (open/close, hover), but no data fetching.

| File | Purpose |
|------|---------|
| `KpiRow.tsx` | Row of 5 KPI stat cards |
| `CategoryFolderGrid.tsx` | Grid of category folder cards |
| `ProductThumbnailGrid.tsx` | Grid of product thumbnail cards |
| `NotificationBell.tsx` | Bell icon + notification dropdown |
| `PageHeader.tsx` | Page title + overline + subtitle |
| `SearchBar.tsx` | Styled search input |
| `FilterCheckbox.tsx` | Checkbox filter element |
| `CardGrid.tsx` | Responsive grid wrapper |
| `ProductPrice.tsx` | Formatted price display |

### Organisms — `components/organisms/`

Complex, self-contained sections. Can use custom hooks (`useAuth`, `useIssues`, etc.), contain modals, handle user actions.

Key organisms: `AppHeader`, `TabBar`, `KanbanBoard`, `ProductFormModal`, `ProductionModal`, `ProductReviewModal`, `VideoModal`, `VideoVersionsPanel`, `StageHistoryLog`, `BuckyWidget`, `ProductionOutputWidget`, `ProjectProgressCard`, etc.

### Templates — `components/templates/`

Full tab/page views. Each template is the root component for one navigation tab.

| File | Tab | Visible to |
|------|-----|-----------|
| `Dashboard.tsx` | Shell (all tabs) | All |
| `OverviewView.tsx` | Overview | All |
| `CatalogView.tsx` | Catalog | All (Lead: write, others: read) |
| `VideoLibraryView.tsx` | Video Library | All (Admin: Published only) |
| `AnalyticsView.tsx` | Analytics | All |
| `PlanningView.tsx` | Planning | Lead only |
| `AdminView.tsx` | Admin | Admin only |
| `ProductionPlanView.tsx` | (inside Planning) | Lead only |
| `ManageUsersView.tsx` | (inside Admin) | Admin only |

---

## 4. Core Code Patterns

### Pattern 1: Supabase Realtime Hook

Every hook that reads from a table **must** also subscribe to Realtime. This is the canonical pattern — copy it exactly:

```typescript
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "./supabase/client";
import type { MyType } from "./types";

// 1. Define the raw DB row shape (snake_case, matches Postgres column names)
interface MyTableRow {
  id: string;
  some_field: string;
  other_field: number | null;
}

// 2. Define the app-facing TS type (camelCase, matches lib/types.ts)
// (import it from lib/types.ts instead of redefining)

// 3. Mapping function: DB row → TS type
function toMyType(row: MyTableRow): MyType {
  return {
    id: row.id,
    someField: row.some_field,
    otherField: row.other_field ?? 0,
  };
}

// 4. The hook itself
export function useMyData() {
  const [items, setItems] = useState<MyType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabaseRef = useRef(createClient());  // stable ref, never recreated

  const load = useCallback(async () => {
    const { data, error: fetchError } = await supabaseRef.current
      .from("my_table")
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setItems((data as MyTableRow[]).map(toMyType));
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = supabaseRef.current;
    load();

    // Random suffix prevents channel collision when multiple instances mount
    const channel = supabase
      .channel(`my-table-changes-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "my_table" }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);  // always clean up on unmount
    };
  }, [load]);

  return { items, loading, error };
}
```

> [!IMPORTANT]
> Always use `useRef(createClient())` — not `createClient()` inside `useEffect`. Creating the client inside the effect would recreate it on every render. The `useRef` keeps a single stable instance.

---

### Pattern 2: The DB is the Security Boundary

**Never rely on UI conditionals for security.** The UI hides buttons a role can't use, but the PostgreSQL triggers are what actually block unauthorized writes.

```typescript
// ✅ CORRECT — this is UI convenience only
const canManageCatalog = role === "lead";
// ...
{canManageCatalog ? <button>Edit Product</button> : null}
```

The real enforcement is in `supabase/schema.sql`:
- `enforce_product_update_permissions()` trigger — blocks wrong-role updates on `products`
- `enforce_profile_role_change()` trigger — blocks non-admins from changing roles
- RLS policies on every table — `get_my_role() = 'lead'` for write policies

**When adding a new action that's role-restricted:**
1. Add the DB-level check first (RLS policy or trigger)
2. Then add the UI conditional as a UX convenience

---

### Pattern 3: camelCase ↔ snake_case Mapping

TypeScript types use `camelCase`. Database columns use `snake_case`. Conversion always happens in the hook's `toXxx()` function — **never** in components.

```
DB:  review_status  →  TS: reviewStatus
DB:  owner_id       →  TS: ownerId
DB:  catalog_product_id → TS: catalogProductId
DB:  must_change_password → TS: mustChangePassword
```

When writing a Supabase update in a component:
```typescript
// Use snake_case for the DB column names
await supabase.from("products").update({ review_status: "Accepted" }).eq("id", product.id);
// NOT: { reviewStatus: "Accepted" }  ← wrong, PostgREST uses snake_case
```

---

### Pattern 4: Portal-Based Modals

All modals use `createPortal` to render at `document.body`, preventing z-index / overflow issues. Always guard with `useMounted()`:

```typescript
import { createPortal } from "react-dom";
import { useMounted } from "@/lib/useMounted";

export function MyModal({ onClose }: { onClose: () => void }) {
  const mounted = useMounted();

  if (!mounted) return null;  // prevents SSR hydration mismatch

  return createPortal(
    <div className="overlay show" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} role="presentation">
      <div className="modal form-modal">
        <button type="button" className="modal-close" onClick={onClose}>✕</button>
        {/* modal content */}
      </div>
    </div>,
    document.body
  );
}
```

---

### Pattern 5: React State Sync from Props (During Render)

When a component needs to sync local state from a prop change, use React's "adjust state during render" pattern — not `useEffect`. This avoids a double-render:

```typescript
// ✅ CORRECT — React's official pattern for prop → state sync
const [appliedSearch, setAppliedSearch] = useState<string | null | undefined>(undefined);
if (externalSearch && externalSearch !== appliedSearch) {
  setAppliedSearch(externalSearch);
  setSearchTerm(externalSearch);  // sync other dependent state here too
}

// ❌ AVOID for prop → state sync — causes extra render cycle
useEffect(() => {
  if (externalSearch) setSearchTerm(externalSearch);
}, [externalSearch]);
```

Use `useEffect` **only** for side effects on external systems (e.g., telling a parent "consumed"):
```typescript
useEffect(() => {
  if (externalSearch) onExternalSearchApplied?.();
}, [externalSearch, onExternalSearchApplied]);
```

---

### Pattern 6: `cn()` Utility for Class Names

Use `cn()` (from `lib/utils.ts`) for conditional class composition — it merges Tailwind classes correctly:

```typescript
import { cn } from "@/lib/utils";

<div className={cn("base-class", isActive && "active-class", hasError && "error-class")} />
```

---

### Pattern 7: Supabase RPCs for Complex Operations

For operations that require atomicity or multiple DB steps, use Postgres stored functions called via `.rpc()`:

```typescript
// Instead of multiple sequential updates:
const { error } = await supabase.rpc("submit_video_for_review", {
  p_product_id: product.id,
});

// Or for deliverable review:
const { error } = await supabase.rpc("review_stage_deliverable", {
  p_deliverable_id: currentDeliverable.id,
  p_decision: "accepted",  // or "rejected"
  p_note: note.trim() || null,
});
```

All RPCs are defined in `supabase/schema.sql`. If you need a new atomic operation, add it there as a `CREATE OR REPLACE FUNCTION`.

---

## 5. Database & Schema Workflow

### Schema File

The single source of truth is [`supabase/schema.sql`](file:///c:/Users/X1%20Carbon%20Gen9/Desktop/Buckedup/BuckedUp-Dashboard-Lifewood/buckedup_dashboard/supabase/schema.sql).

> [!CAUTION]
> **Always update `schema.sql` first** before touching the live database. The live DB has production data — never run destructive DDL (DROP TABLE, ALTER COLUMN) directly without backing up first.

### Tables Overview

| Table | Purpose | Who Writes |
|-------|---------|-----------|
| `profiles` | User accounts + roles | Admin (via trigger + ManageUsersView) |
| `products` | Video production queue — one row per video | Lead (CRUD), Operator (limited fields) |
| `catalog_products` | BuckedUp's master product catalog | Lead |
| `issues` | Flagged problems per product | All roles |
| `product_status_history` | Audit log of stage transitions (auto-written by trigger) | DB trigger only |
| `notifications` | In-app notifications | DB triggers only |
| `video_versions` | Uploaded video files per product | Operator, Lead |
| `stage_deliverables` | Per-stage doc/text deliverables | Operator (insert), Lead (review via RPC) |
| `production_plans` | Production targets + deadline | Lead |
| `daily_targets_history` | Historical daily target snapshots | Scripts |

### Adding a New Table

1. **Write the SQL** in `supabase/schema.sql`:
   ```sql
   create table my_new_table (
     id uuid primary key default gen_random_uuid(),
     product_id uuid not null references products(id) on delete cascade,
     value text not null,
     created_at timestamptz not null default now()
   );

   alter table my_new_table enable row level security;

   create policy "Public read" on my_new_table for select using (true);
   create policy "Auth insert" on my_new_table for insert with check (auth.role() = 'authenticated');
   ```

2. **Apply to the database** — run the SQL in the Supabase Dashboard SQL Editor (or write a migration script in `scripts/`).

3. **Write the TypeScript type** in `lib/types.ts`.

4. **Write the hook** in `lib/useMyNewTable.ts` following [Pattern 1](#pattern-1-supabase-realtime-hook).

5. **Enable Realtime** — in the Supabase Dashboard → Database → Replication, add the new table to the `supabase_realtime` publication.

### Writing Migration Scripts

For incremental changes after initial setup, create a script in `scripts/`:

```typescript
// scripts/migrate-my-change.ts
import { Client } from "pg";

async function main() {
  const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });
  await client.connect();
  try {
    await client.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS my_new_column text;
    `);
    console.log("Migration applied.");
  } finally {
    await client.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
```

Run it with:
```bash
tsx --env-file=.env.local scripts/migrate-my-change.ts
```

### Key Triggers (Don't Break These)

| Trigger | Table | What It Does |
|---------|-------|-------------|
| `on_auth_user_created` | `auth.users` | Auto-creates profiles row; first signup = admin |
| `enforce_profile_role_change` | `profiles` | Only admins can change roles |
| `enforce_product_update_permissions` | `products` | Column-level + role-level write rules |
| `products_log_status_change` | `products` | Auto-logs to `product_status_history` on status change |
| `products_notify_changes` | `products` | Sends notification on rejection or owner change |
| `issues_notify_owner` | `issues` | Notifies owner when issue reported |

> [!WARNING]
> If you add a new column to `products` that certain roles should not be able to edit, add it to the `enforce_product_update_permissions()` trigger in `schema.sql`. The trigger is what actually blocks unauthorized field writes — not the UI.

---

## 6. Authentication & Middleware

### How Auth Works

1. **Login** — `app/login/page.tsx` → `supabase.auth.signInWithPassword()` → Supabase sets session cookie
2. **Middleware** — `proxy.ts` runs on every request, calls `supabase.auth.getUser()` to refresh the token, redirects to `/login` if no session
3. **Role resolution** — `lib/useAuth.ts` fetches the user's `profiles.role` from Supabase after the session is established
4. **Force password change** — If `profiles.must_change_password = true`, `Dashboard.tsx` renders `ForcePasswordChangeView` instead of the normal UI

### The Middleware File

The middleware is at `proxy.ts` (not `middleware.ts` — the `matcher` config export is what Next.js picks up):

```typescript
// proxy.ts — the exported `config.matcher` is what Next.js uses
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|api|auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

> [!IMPORTANT]
> `api` and `auth` paths are explicitly excluded from the middleware. API routes do their own auth check. Auth callback routes (`/auth/confirm`) need to be reachable before a session exists.

### Adding a Protected API Route

```typescript
// app/api/my-route/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check role if needed
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ... rest of handler
}
```

---

## 7. API Routes

### Existing Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/admin/create-user` | POST | Admin only | Creates a new Supabase Auth user + profiles row + sends invite email |
| `/api/admin/users/[id]` | DELETE | Admin only | Deletes a user account (auth.users cascade → profiles) |
| `/api/bucky/chat` | POST | Authenticated | Bucky AI streaming chat via OpenRouter |

### Admin Routes Pattern

Admin routes use the **service-role client** (`lib/supabase/admin.ts`) for operations that the anon client can't do (like creating auth users). Always verify the requester is `admin` first using the regular server client:

```typescript
import { createClient } from "@/lib/supabase/server";  // verify role with this
import { createAdminClient } from "@/lib/supabase/admin";  // do admin ops with this
```

---

## 8. Styling System

### The Single CSS File Rule

> **All styles live in `app/globals.css`.** This is non-negotiable. Do not create component-level CSS files, CSS modules, or inline style objects for structural layout. Inline styles are only acceptable for dynamic values (colors from JS variables, calculated widths, etc.).

The file is large (~142KB) but intentionally unified. CSS variables drive the entire theme system.

### CSS Variables (Theme System)

The theming uses `data-theme="dark"` / `data-theme="light"` on `<html>`:

```css
:root {
  --ink: #ffffff;
  --ink-soft: rgba(255, 255, 255, 0.55);
  --glass-bg: rgba(255, 255, 255, 0.04);
  --glass-border: rgba(255, 255, 255, 0.08);
  --saffron: #ffb347;      /* primary accent — BuckedUp gold */
  --castleton: #046241;    /* success / published green */
}

[data-theme="light"] {
  --ink: #0d0d0d;
  --ink-soft: rgba(0, 0, 0, 0.5);
  --glass-bg: rgba(255, 255, 255, 0.7);
  /* ... light overrides */
}
```

### Adding New Styles

1. Open `app/globals.css`
2. Add your class in the relevant section (look for the section comments)
3. Use CSS variables for all colors and key values — never hardcode hex colors in components
4. Test both dark and light themes

### Tailwind CSS

Tailwind v4 is available as a utility supplement, but the project's primary styling is custom CSS classes. Tailwind utilities are used for:
- Responsive grid layouts (`grid-cols-1 lg:grid-cols-3`)
- Flex utilities in template views
- One-off spacing that doesn't warrant a new CSS class

Use `cn()` from `lib/utils.ts` when combining Tailwind with conditional classes.

### Status Colors

Stage colors are defined in `lib/data.ts` and must be used consistently:

```typescript
// In charts/components that need hex values:
import { STATUS_HEX, STATUS_HEX_LIGHT } from "@/lib/data";
// Use STATUS_HEX for dark mode, STATUS_HEX_LIGHT for light mode

// In CSS pill classes:
import { STATUS_CLASS } from "@/lib/data";
// Returns "st-not-started", "st-scripting", etc. (matching globals.css classes)
```

---

## 9. Adding a New Feature — Step-by-Step

### Checklist: New Data Entity (New Table + Hook + UI)

```
[ ] 1. Define the TypeScript type in lib/types.ts
[ ] 2. Write the SQL in supabase/schema.sql
      - CREATE TABLE with RLS
      - Appropriate RLS policies for each role
      - Any triggers needed
[ ] 3. Apply to database (SQL Editor or migration script)
[ ] 4. Enable Realtime for the table in Supabase Dashboard
[ ] 5. Write the hook in lib/useMyTable.ts
      - Follow the Realtime hook pattern
      - Include toMyType() mapping function
      - Export { items, loading, error }
[ ] 6. If the hook is used at the top level, add it to Dashboard.tsx or the relevant template
[ ] 7. Build UI components (atom → molecule → organism → template)
[ ] 8. Add any needed CSS classes to app/globals.css
[ ] 9. Test both dark and light themes
[ ] 10. Test all three roles (operator, lead, admin) to verify permissions work
```

### Checklist: New Pipeline Stage

The pipeline stages are defined in multiple places — all must be updated together:

```
[ ] 1. lib/types.ts — add to PipelineStatus union type
[ ] 2. lib/data.ts — add to STATUS_ORDER, STATUS_CLASS, STATUS_HEX, STATUS_HEX_LIGHT arrays
[ ] 3. supabase/schema.sql — update enforce_product_update_permissions() trigger
      to handle the new stage correctly for each role
[ ] 4. app/globals.css — add .st-<new-stage> CSS class for the pill styling
[ ] 5. VideoLibraryView.tsx — update OPERATOR_SUBMIT_STAGES and/or LEAD_REVIEW_STAGES if applicable
[ ] 6. ProductionModal.tsx — add handling for the new stage's deliverable type
[ ] 7. ProductReviewModal.tsx — add review handling for the new stage
```

### Checklist: New User Role

```
[ ] 1. lib/types.ts — add to UserRole type
[ ] 2. supabase/schema.sql — update user_role enum, all RLS policies, all triggers
[ ] 3. lib/utils.ts — add to roleLabel()
[ ] 4. components/templates/ManageUsersView.tsx — add to ROLE_OPTIONS
[ ] 5. components/organisms/TabBar.tsx — define which tabs this role sees
[ ] 6. Audit every role===check in every component
```

### Checklist: New API Route

```
[ ] 1. Create app/api/<path>/route.ts
[ ] 2. Import createClient from lib/supabase/server (not client)
[ ] 3. Always call supabase.auth.getUser() first
[ ] 4. Check profile.role if the route is role-restricted
[ ] 5. Use createAdminClient() from lib/supabase/admin for service-role operations
[ ] 6. Return NextResponse.json() — never return plain Response
[ ] 7. The proxy.ts middleware excludes /api/* — routes do their own auth
```

---

## 10. npm Scripts Reference

| Script | Command | When to Use |
|--------|---------|-------------|
| **Dev server** | `npm run dev` | Local development |
| **Production build** | `npm run build` | Verify build before deploy |
| **Production start** | `npm start` | Run built app locally |
| **Lint** | `npm run lint` | Check for ESLint errors |
| **Apply DB schema** | `npm run db:apply-schema` | Fresh Supabase project setup |
| **Seed catalog** | `npm run db:seed-catalog` | Populate catalog_products from CSV |
| **Scrape images** | `npm run db:scrape-images` | Fetch product thumbnails from BuckedUp website |
| **Run any migration** | `tsx --env-file=.env.local scripts/<name>.ts` | Apply incremental DB changes |

### Running One-Off Scripts

```bash
# Always use --env-file to inject the DB connection string
tsx --env-file=.env.local scripts/migrate-my-change.ts

# For scripts that need the service role key (user management, etc.)
tsx --env-file=.env scripts/my-admin-script.ts
```

---

## 11. Debugging Guide

### "Cannot read properties of null (reading 'role')" or similar auth errors

- The `role` from `useAuth()` is `null` while loading — always guard with `if (!role) return null` or show a loading state
- Check that `profiles` row exists for the user in Supabase Dashboard → Table Editor

### Realtime not updating

1. Check that the table is added to the `supabase_realtime` publication (Supabase Dashboard → Database → Replication)
2. Check the browser console for WebSocket errors
3. Verify the channel name is unique (use `Math.random()` suffix)
4. Check that the Supabase Realtime service is enabled for the project

### RLS blocking a write unexpectedly

1. Check the Supabase Dashboard → Logs → PostgreSQL logs for the specific RLS rejection
2. Temporarily disable RLS on the table (test only!) to confirm it's an RLS issue: `ALTER TABLE my_table DISABLE ROW LEVEL SECURITY;`
3. Re-read the relevant `CREATE POLICY` statements in `schema.sql`
4. Check if a trigger (not RLS) is the one rejecting — look for `RAISE EXCEPTION` in `schema.sql`

### Modal not rendering / hydration mismatch

- All portal modals must check `useMounted()` — if `!mounted` return `null`
- This prevents the `document.body` reference from running on the server during SSR

### "Table X does not exist" after schema changes

- The schema may have been applied partially — check which tables exist in Supabase Dashboard
- Write a migration script rather than re-running `apply-schema` (which would fail on existing tables)

### Type errors after DB column changes

- Update the row interface (e.g., `ProductRow` in `useVideoRequests.ts`) to match the new column
- Update the `toProduct()` / `toMyType()` mapping function
- Update the `lib/types.ts` type definition

### Build failing

```bash
npm run build 2>&1 | head -50   # see the first errors
npm run lint                     # check for lint errors separately
```

Common issues:
- `useEffect` missing dependency warning — add the dep or explain why with a comment
- Type errors in strict mode — TypeScript is set to `strict: true`
- Importing a server-only module in a client component — check `"use client"` directive

---

## 12. Critical Rules & Gotchas

> [!IMPORTANT]
> Read these before writing any code.

### 1. Do NOT remove the `getUser()` call in `proxy.ts`

```typescript
// proxy.ts — this call is MANDATORY
const { data: { user } } = await supabase.auth.getUser();
```

This refreshes the auth token on every request. Removing it breaks session refresh and causes random logouts.

---

### 2. Products always have `items` length = 1

The schema flattens video item fields onto the `products` row directly. The `items: VideoItem[]` array in the frontend type always has exactly one element. Use `product.items[0]` — never loop over `items` expecting multiple:

```typescript
const item = product.items[0];  // ✅ always safe
const status = item.status;
```

---

### 3. Never use `createClient()` inside `useEffect` without `useRef`

```typescript
// ❌ WRONG — creates a new client on every render
useEffect(() => {
  const supabase = createClient();
  // ...
}, []);

// ✅ CORRECT — single stable instance
const supabaseRef = useRef(createClient());
useEffect(() => {
  const supabase = supabaseRef.current;
  // ...
}, []);
```

---

### 4. Only ONE active production plan at a time

The DB enforces this via a unique partial index. The app always reads `is_active = true`. Don't insert a new plan row without deactivating the previous one first.

---

### 5. The `proxy.ts` matcher excludes `/api/*`

API routes are not protected by the auth middleware. Each API route handler must verify the session itself using `supabase.auth.getUser()`.

---

### 6. Next.js 16 has breaking changes

The `AGENTS.md` file says: **"This is NOT the Next.js you know."** Next.js 16 (App Router) has significant differences from older versions. Before writing any framework-specific code, check `node_modules/next/dist/docs/` or the official docs. In particular:
- `cookies()` from `next/headers` is async — must be `await cookies()`
- Route Handlers export named functions (`GET`, `POST`, etc.) not default exports
- Server Components vs Client Components — watch for `"use client"` placement

---

### 7. `schema.sql` is the contract — update it before the DB

When making schema changes:
1. ✅ Update `supabase/schema.sql` first
2. ✅ Run the change in the Supabase SQL Editor (or migration script)
3. ✅ Update TypeScript types in `lib/types.ts`
4. ✅ Update any affected hooks

---

### 8. Operators can only submit for their own assigned items

The `stage_deliverables` insert RLS policy requires `owner_id = auth.uid()`. The UI checks this too (`product.ownerId === user?.id`), but the DB is what actually blocks it. Don't show the submit button for items the operator doesn't own.

---

### 9. Admins see only Published items in the Library

`VideoLibraryView.tsx` filters this out:
```typescript
if (isAdmin && productBucket(product) !== "published") return false;
```
This is a UI filter — the DB doesn't restrict reads by role (all authenticated users can read all products). Don't remove this filter without understanding the business implications.

---

### 10. Color Changes — Use the Design System

When adding new colored elements, pull from CSS variables first. Never hardcode hex values in components. If you need a new color, add it as a CSS variable in `globals.css`. Stage colors come from `STATUS_HEX` in `data.ts` — don't duplicate them.
