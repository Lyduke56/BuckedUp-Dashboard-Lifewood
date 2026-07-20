# BuckedUp Dashboard — Complete Development Workflow

> **Repo**: `Lyduke56/BuckedUp-Dashboard-Lifewood`  
> **Stack**: Next.js 16.2.10 · React 19 · TypeScript · Supabase · Tailwind CSS v4  
> **Last Updated**: July 19, 2026

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
10. [Testing & Spreadsheet Plan Imports](#10-testing--spreadsheet-plan-imports)
11. [npm Scripts Reference](#11-npm-scripts-reference)
12. [Debugging Guide](#12-debugging-guide)
13. [Critical Rules & Gotchas](#13-critical-rules--gotchas)

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
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=<smtp-password>
SMTP_FROM=BuckedUp Dashboard <noreply@example.com>

# Required for Bucky AI assistant (BuckyWidget)
OPENROUTER_API_KEY=<openrouter-key>
```

> [!IMPORTANT]
> `NEXT_PUBLIC_*` variables are exposed to the browser bundle. Never put secrets in `NEXT_PUBLIC_*` vars. The anon key is intentionally public — Supabase's RLS policies and triggers are the true security layer.

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

### First Login & Role Defaults

1. Navigate to `/login`
2. Create an account with email/password
3. **The first-ever signup automatically becomes Admin** — enforced by the `on_auth_user_created` Postgres trigger
4. All subsequent signups default to `operator` — an Admin can change roles via the Admin tab (`profiles_enforce_role_change` trigger blocks non-admins)

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
│   │   └── bucky/chat/route.ts        # POST — Bucky AI streaming chat endpoint (`ai@7`)
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
│   ├── data.ts                 # ⭐ Constants: CATEGORY_TREE, STATUS_ORDER (5 stages), priority logic
│   ├── utils.ts                # Pure helper functions (`cn()`, formatting)
│   ├── colors.ts               # Color utilities
│   ├── useAuth.ts              # Auth hook: session, role, signOut, mustChangePassword
│   ├── useVideoRequests.ts     # Products hook + Realtime
│   ├── useIssues.ts            # Issues hook + Realtime
│   ├── useNotifications.ts     # Notifications hook + Realtime
│   ├── useProductionPlan.ts    # Production plan hook + Realtime
│   ├── useProfiles.ts          # All profiles hook + Realtime
│   ├── useStageAge.ts          # Stage aging (time-in-stage) hook
│   ├── useStageDeliverables.ts # Stage deliverables hook + Realtime (`Design` leg)
│   ├── useTodayStats.ts        # Daily stats hook
│   ├── useDailyProgress.ts     # Daily progress chart data hook
│   ├── useCatalog.ts           # Catalog products hook + Realtime
│   ├── useMounted.ts           # SSR guard for portal modals
│   ├── bucky/
│   │   ├── systemPrompt.ts     # Bucky AI system prompt builder
│   │   └── tools.ts            # Bucky AI tool definitions (all DB operations)
│   └── supabase/
│       ├── client.ts           # Browser Supabase client (anon key)
│       ├── server.ts           # Server-side client (cookie-aware, for Route Handlers)
│       └── admin.ts            # Service-role client (for admin scripts only)
│
├── supabase/
│   └── schema.sql              # ⭐ Complete DB schema — source of truth for all DB changes
│
└── scripts/                    # One-off database scripts (`tsx`, run manually)
    ├── apply-schema.ts         # Apply schema.sql to a fresh DB
    ├── seed-catalog.ts         # Seed catalog_products from CSV
    ├── generate-test-plan-xlsx.js # Generates `Test Production Plan July 2026.xlsx`
    ├── migrate-pipeline-5-stages.ts # 5-stage pipeline migration script
    └── ...                     # Other migration scripts
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

### Molecules — `components/molecules/`

Small groups of atoms. May contain local `useState` for simple UI state, but no data fetching.

| File | Purpose |
|------|---------|
| `KpiRow.tsx` | Row of KPI stat cards |
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

Key organisms: `AppHeader`, `TabBar`, `KanbanBoard`, `ProductFormModal`, `ProductionModal`, `ProductReviewModal`, `VideoModal`, `VideoVersionsPanel`, `StageHistoryLog`, `BuckyWidget`, `ProductionOutputWidget`, `ProjectProgressCard`, `DailyProgressChart`.

### Templates — `components/templates/`

Full tab/page views. Each template is the root component for one navigation tab.

| File | Tab | Visible to | Key Features |
|------|-----|-----------|--------------|
| `Dashboard.tsx` | Shell (all tabs) | All | Root tab manager, theme toggle, Bucky integration |
| `OverviewView.tsx` | Overview | All | KPI summary, Recent Deliveries, interactive links |
| `ReviewsView.tsx` | Approvals Inbox (`reviews`) | Lead & Admin | Unified QA inbox, `Pending (N)` vs `Reviewed`, bulk select |
| `CatalogView.tsx` | Catalog | All (`canManageCatalog = Lead`) | Merchandise browser, Add/Edit/Request modals |
| `VideoLibraryView.tsx` | Video Library | All (`Admin` = Published only) | Kanban board (`5 columns`), table, priority filters |
| `AnalyticsView.tsx` | Analytics | Lead & Admin (`Operator` blocked) | Power BI column chart (`DailyProgressChart`), pacing |
| `PlanningView.tsx` | Planning | Admin only (`role === 'admin'`) | Excel production plan imports (`ProductionPlanView`) |
| `AdminView.tsx` | Admin | Admin only | User governance, invite & role management (`ManageUsersView`) |
| `BuckyConversationsView.tsx` | Bucky | Admin only | AI audit log and conversation history viewer |

---

## 4. Core Code Patterns

### Pattern 1: Supabase Realtime Hook

Every hook that reads from a table **must** also subscribe to Realtime. This is the canonical pattern:

```typescript
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "./supabase/client";
import type { MyType } from "./types";

interface MyTableRow {
  id: string;
  some_field: string;
  other_field: number | null;
}

function toMyType(row: MyTableRow): MyType {
  return {
    id: row.id,
    someField: row.some_field,
    otherField: row.other_field ?? 0,
  };
}

export function useMyData() {
  const [items, setItems] = useState<MyType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabaseRef = useRef(createClient());

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

    const channel = supabase
      .channel(`my-table-changes-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "my_table" }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { items, loading, error };
}
```

---

### Pattern 2: The DB is the Security Boundary

**Never rely on UI conditionals for security.** The UI hides buttons a role can't use, but PostgreSQL triggers and Row-Level Security (`RLS`) block unauthorized writes.

```typescript
// ✅ CORRECT — UI convenience only
const canManageCatalog = role === "lead";
{canManageCatalog ? <button>Edit Product</button> : null}
```

The real enforcement is in `supabase/schema.sql`:
- `enforce_product_update_permissions()` trigger — blocks unauthorized column/stage modifications.
- `enforce_profile_role_change()` trigger — blocks non-admins from updating user roles.
- RLS policies on `stage_deliverables`, `video_versions`, and `products`.

---

### Pattern 3: camelCase ↔ snake_case Mapping

TypeScript types use `camelCase`. Database columns use `snake_case`. Conversion always happens in the hook's `toXxx()` function — **never** in components.

```
DB: review_status → TS: reviewStatus
DB: owner_id      → TS: ownerId
DB: priority      → TS: priority ("High" | "Medium" | "Low")
```

---

### Pattern 4: Portal-Based Modals

All modals use `createPortal` to render at `document.body` and are guarded with `useMounted()`:

```typescript
import { createPortal } from "react-dom";
import { useMounted } from "@/lib/useMounted";

export function MyModal({ onClose }: { onClose: () => void }) {
  const mounted = useMounted();
  if (!mounted) return null;

  return createPortal(
    <div className="overlay show" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
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

### Pattern 5: Supabase RPCs for Atomic Pipeline Transitions

For operations requiring atomicity or multiple DB steps, call Postgres stored procedures via `.rpc()`:

```typescript
// Promoting video from Production -> In Review:
const { error } = await supabase.rpc("submit_video_for_review", {
  p_product_id: product.id,
});

// Reviewing Design stage deliverables (Storyboarding/Scripting):
const { error } = await supabase.rpc("review_stage_deliverable", {
  p_deliverable_id: currentDeliverable.id,
  p_decision: "accepted", // or "rejected"
  p_note: note.trim() || null,
});
```

---

## 5. Database & Schema Workflow

### The 5-Stage Pipeline (`data.ts` & `schema.sql`)

```typescript
export const STATUS_ORDER: PipelineStatus[] = [
  "Not Started",
  "Design",
  "Production",
  "In Review",
  "Published",
];
```

### Core Tables Overview

| Table | Purpose | Who Writes |
|-------|---------|-----------|
| `profiles` | User accounts + `user_role` (`operator`/`lead`/`admin`) | Admin (via trigger + `ManageUsersView`) |
| `products` | Video request queue (`status`, `priority`, `owner_id`) | Lead (CRUD), Operator (limited fields via RPC) |
| `stage_deliverables` | Storyboarding & Scripting documents for `Design` stage | Operator (`insert`), Lead (`review_stage_deliverable` RPC) |
| `video_versions` | Uploaded video files for `Production` stage | Operator & Lead (`insert`/`update`) |
| `issues` | Problem tracking (`severity`: low/medium/high) | All roles |
| `product_status_history` | Audit trail of stage transitions (`from_status`, `to_status`) | DB trigger (`products_log_status_change`) |
| `production_plans` | Corporate daily targets & start/deadline dates | Admin (`PlanningView` Excel import) |
| `notifications` | In-app alerts (`assigned`, `rejected`, `issue_reported`) | DB triggers only |

---

## 6. Authentication & Middleware

### How Auth Works

1. **Login** — `app/login/page.tsx` → `supabase.auth.signInWithPassword()` → Supabase sets session cookie.
2. **Middleware** — `proxy.ts` runs on every request, calling `supabase.auth.getUser()` and redirecting unauthenticated traffic.
3. **Role resolution** — `lib/useAuth.ts` fetches `profiles.role` (`operator`, `lead`, or `admin`).
4. **Force password change** — If `profiles.must_change_password = true`, `Dashboard.tsx` renders `ForcePasswordChangeView`.

### Middleware Configuration (`proxy.ts`)

```typescript
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|api|auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

---

## 7. API Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/admin/create-user` | POST | Admin only | Creates Auth user + `profiles` row + sends SMTP email |
| `/api/admin/users/[id]` | DELETE | Admin only | Deletes user account (`auth.users` cascade → `profiles`) |
| `/api/bucky/chat` | POST | Authenticated | Bucky AI streaming chat via OpenRouter (`ai@7`) |

---

## 8. Styling System

### The Single CSS File Rule

> **All styles live in `app/globals.css`.** Do not create component-level CSS files, CSS modules, or inline style objects for structural layout. Inline styles are only acceptable for dynamic values (colors, calculated widths, or chart bars).

### Chart Bounding & Layout Rules (`DailyProgressChart`)

When building or modifying charts inside `.panel` or `.column-chart`:
- Ensure grid containers (`.panel`) have `min-width: 0;` so they never overflow parent grid columns.
- Ensure chart columns (`.column-bar`) use flex compression (`flex: 1; max-width: 20px; min-width: 1px;`) to smoothly scale when rendering up to 90+ days of data.

---

## 9. Adding a New Feature — Step-by-Step

1. **Schema First**: If data changes, update `supabase/schema.sql` and add any required RLS policies or triggers.
2. **TypeScript Types**: Add or update interface definitions in `lib/types.ts`.
3. **Custom Hook**: Create or modify `lib/use*.ts` ensuring `postgres_changes` Realtime subscription is attached.
4. **UI Component**: Build atoms/molecules/organisms using existing design tokens from `globals.css`.
5. **Template Integration**: Wire into the appropriate template (`OverviewView`, `ReviewsView`, `VideoLibraryView`, etc.) and verify RBAC rules.

---

## 10. Testing & Spreadsheet Plan Imports

### Generating Test Production Plan Excel Files

When validating the `Daily target vs actual` analytics chart across realistic date ranges:

```bash
# Run the generator script inside buckedup_dashboard:
node scripts/generate-test-plan-xlsx.js
```

This generates `Test Production Plan July 2026.xlsx` in the parent repository directory with 92 rows spanning June 1, 2026 to August 31, 2026 (`Daily Targets` varying between `1` and `5`, plus accumulative sums).

### Importing & Testing in the UI

1. Log in as an **Admin** (`role === "admin"`).
2. Navigate to the **`Planning`** tab (`ProductionPlanView`).
3. Click **Import Excel Plan** and select `Test Production Plan July 2026.xlsx`.
4. Click **Save Plan** (upserts active row in `production_plans`).
5. Navigate to the **`Analytics`** tab (`PERFORMANCE` view) and inspect `Daily target vs actual` (`DailyProgressChart`)—all daily target bars and tooltips dynamically match the imported Excel data.

---

## 11. npm Scripts Reference

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "db:apply-schema": "tsx --env-file=.env.local scripts/apply-schema.ts",
  "db:seed-catalog": "tsx --env-file=.env.local scripts/seed-catalog.ts"
}
```

---

## 12. Debugging Guide

- **RLS Write Blocked ("new row violates row-level security policy")**: Check `auth.uid()` vs `owner_id`. If Operator is modifying a stage directly instead of calling `submit_video_for_review()`, the `enforce_product_update_permissions()` trigger will block it.
- **Chart / Grid Overflowing Parent Card**: Check `globals.css` and verify that the parent `.panel` has `min-width: 0; overflow: hidden;` applied.
- **Realtime Not Updating**: Verify the table is added to `supabase_realtime` publication inside Supabase Dashboard → Replication.

---

## 13. Critical Rules & Gotchas

1. **Do Not Re-introduce Old 7-Stage Names**: The pipeline is strictly `Not Started`, `Design`, `Production`, `In Review`, and `Published`. `Storyboarding` and `Scripting` are `stage_deliverables` inside `Design`.
2. **Do Not Use Inline Styles for Structural Layout**: Always use `globals.css` utility or component classes.
3. **Always Check Role Access**: Remember that `Planning` and `Admin` tabs are restricted to `Admin`, `Approvals` (`reviews`) is restricted to `Lead` and `Admin`, and `Analytics` blocks `Operator`.
