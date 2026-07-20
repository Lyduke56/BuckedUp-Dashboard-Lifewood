# BuckedUp Dashboard — Complete Development Workflow

> **Repo**: `Lyduke56/BuckedUp-Dashboard-Lifewood`  
> **Stack**: Next.js 16.2.10 · React 19 · TypeScript · Supabase · Tailwind CSS v4  
> **Last Updated**: July 20, 2026

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

---

## 2. Project Architecture

### Directory Map

```
buckedup_dashboard/
├── app/                        # Next.js App Router — pages, layouts, API routes
│   ├── globals.css             # ⭐ Entire CSS design system (~150KB) — one file, no exceptions
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
│   ├── useDailyProgress.ts     # Daily progress chart data hook + Realtime
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
└── scripts/                    # Database migrations & seed scripts (`tsx`, run manually)
    ├── apply-schema.ts         # Apply schema.sql to a fresh DB
    ├── seed-catalog.ts         # Seed catalog_products from CSV
    ├── generate-test-plan-xlsx.js # Generates `Test Production Plan July 2026.xlsx`
    └── ...                     # Migration scripts (`migrate-*.ts`)
```

---

## 3. Component Structure — Atomic Design

### Organisms & Key Components

| File | Key Responsibilities |
|------|---------------------|
| `ProductionModal.tsx` | Stage deliverable modal (`Design` sub-tabs for Storyboard & Script with independent portals; `Production` stage video revision panel with reactive upload triggers) |
| `ProductReviewModal.tsx` | QA review modal for Lead/Admin (`Design` stage doc reviews & `In Review` stage video decisions) |
| `VideoVersionsPanel.tsx` | Revision history & file uploader for `Production` stage |
| `BuckyWidget.tsx` | Floating AI assistant widget (`Bucky`) with streaming tool calls |

### Templates (Tab Views)

| File | Tab | Visible to | Key Features |
|------|-----|-----------|--------------|
| `Dashboard.tsx` | Shell (all tabs) | All | Root tab manager, theme toggle, Bucky integration |
| `OverviewView.tsx` | Overview | All | KPI summary, Recent Deliveries, interactive links |
| `ReviewsView.tsx` | Approvals Inbox (`reviews`) | Lead & Admin | Unified QA inbox, `Pending (N)` vs `Reviewed`, search, stage filters, localStorage read/cleared state |
| `CatalogView.tsx` | Catalog | All (`canManageCatalog = Lead/Admin`) | Merchandise browser, Add/Edit/Request modals |
| `VideoLibraryView.tsx` | Video Library | All | Kanban board (`5 columns`), table view, grid view, claim/unclaim actions |
| `AnalyticsView.tsx` | Analytics | Lead & Admin (`Operator` blocked) | Power BI column chart (`DailyProgressChart`), pacing, stage funnel |
| `ProductionPlanView.tsx` | Planning | Admin only (`role === 'admin'`) | Excel production plan imports & daily target settings (`Set Targets` button upserts into `daily_target_history`) |
| `ManageUsersView.tsx` | Admin | Admin only | User governance, invite & role management |
| `BuckyConversationsView.tsx` | Bucky | Admin only | AI audit log and conversation history viewer |

---

## 4. Core Code Patterns

### Pattern 1: Supabase Realtime Hook

Every hook that reads from a table **must** subscribe to Postgres Realtime changes.

---

### Pattern 2: Target History & Analytics Syncing

When saving daily targets in `ProductionPlanView.tsx`:
1. `category_targets` and `language_targets` are updated on `production_plans`.
2. Today's sum target is upserted into `daily_target_history` (`date: YYYY-MM-DD`, `target: sumCategoryTargets`).
3. `useDailyProgress` subscribes to `daily_target_history` changes, instantly updating the **Daily target vs actual** chart in `AnalyticsView.tsx` and Overview widgets.

```typescript
// Upsert today's target into daily_target_history
const todayStr = new Date().toISOString().split("T")[0];
await supabase
  .from("daily_target_history")
  .upsert({ date: todayStr, target: sumCategoryTargets }, { onConflict: "date" });
```

---

### Pattern 3: Operator Claim & Unclaim Lifecycle

Operators can claim unowned products in `Not Started` or unclaim assigned products provided no deliverables exist:

```typescript
// Claim product:
await supabase.from("products").update({
  status: "Design",
  owner_id: user.id,
  owner: user.email,
}).eq("id", product.id);

// Unclaim product:
await supabase.from("products").update({
  status: "Not Started",
  owner_id: null,
  owner: null,
}).eq("id", product.id);
```

Enforced securely in `supabase/schema.sql` via `enforce_product_update_permissions()` trigger.

---

### Pattern 4: Design Stage Sub-Stage Portals (`ProductionModal.tsx`)

In `Design` stage, `Storyboarding` and `Scripting` deliverables are managed via separate mounted sub-stage portals. Inputs (`File` vs `Text`) stay mounted with `display: block / none` so switching tabs preserves user selections without state collision.

---

### Pattern 5: Supabase RPCs for Atomic Pipeline Transitions

```typescript
// Promoting video from Production -> In Review:
await supabase.rpc("submit_video_for_review", { p_product_id: product.id });

// Reviewing Design stage deliverables (Storyboarding/Scripting):
await supabase.rpc("review_stage_deliverable", {
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
| `products` | Video request queue (`status`, `priority`, `owner_id`) | Lead (CRUD), Operator (claim/unclaim/RPC) |
| `stage_deliverables` | Storyboarding & Scripting documents for `Design` stage | Operator (`insert`), Lead (`review_stage_deliverable` RPC) |
| `video_versions` | Uploaded video files for `Production` stage | Operator & Lead (`insert`/`update`) |
| `issues` | Problem tracking (`severity`: low/medium/high) | All roles |
| `daily_target_history` | Historical & live per-day video targets (`date`, `target`) | Admin (`ProductionPlanView` target config) |
| `product_status_history` | Audit trail of stage transitions (`from_status`, `to_status`) | DB trigger (`products_log_status_change`) |
| `production_plans` | Corporate daily targets & start/deadline dates | Admin (`PlanningView` Excel import & target form) |

---

## 6. npm Scripts Reference

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

## 7. Critical Rules & Gotchas

1. **Do Not Re-introduce Old 7-Stage Names**: The pipeline is strictly `Not Started`, `Design`, `Production`, `In Review`, and `Published`. `Storyboarding` and `Scripting` are `stage_deliverables` inside `Design`.
2. **The Database is the True Security Boundary**: UI hides controls, but PostgreSQL triggers and RLS enforce write permissions.
3. **Single CSS File Rule**: All structural and theme styling lives in `app/globals.css`.
