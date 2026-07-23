# BuckedUp Dashboard — Complete Development Workflow

> **Repo**: `Lyduke56/BuckedUp-Dashboard-Lifewood`  
> **Stack**: Next.js 16.2.10 · React 19 · TypeScript · Supabase · Tailwind CSS v4  
> **Last Updated**: July 23, 2026

---

## Table of Contents

1. [Environment Setup](#1-environment-setup)
2. [Project Architecture](#2-project-architecture)
3. [Component Structure — Atomic Design](#3-component-structure--atomic-design)
4. [Core Code Patterns & Strict QA Gates](#4-core-code-patterns--strict-qa-gates)
5. [Database & Schema Workflow](#5-database--schema-workflow)
6. [Authentication & Middleware](#6-authentication--middleware)
7. [API Routes](#7-api-routes)
8. [Styling System](#8-styling-system)
9. [Adding a New Feature — Step-by-Step](#9-adding-a-new-feature--step-by-step)
10: [Testing & Spreadsheet Plan Imports](#10-testing--spreadsheet-plan-imports)
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

# Required for user invite emails (ManageUsersView → /api/super-admin/create-user)
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
│   ├── globals.css             # ⭐ Entire CSS design system (~150KB) — disabled input rules & themes
│   ├── layout.tsx              # Root layout (Geist font, HTML shell)
│   ├── page.tsx                # / → renders <Dashboard />
│   ├── login/page.tsx          # /login → glassmorphism login page
│   ├── api/
│   │   ├── super-admin/
│   │   │   ├── create-user/route.ts   # POST — super-admin creates new user + sends invite email
│   │   │   └── users/[id]/route.ts    # DELETE — super-admin deletes user account
│   │   └── bucky/chat/route.ts        # POST — Bucky AI streaming chat endpoint (`ai@7`)
│   └── auth/confirm/route.ts          # GET — handles Supabase invite/recovery email links
│
├── components/                 # UI components — Atomic Design hierarchy
│   ├── atoms/                  # Primitive, stateless UI pieces
│   ├── molecules/              # Small compositions of atoms (SearchBar)
│   ├── organisms/              # Complex, self-contained sections (VideoModal, ProductReviewModal)
│   ├── templates/              # Full page layouts (ClientVideoLibraryView, VideoLibraryView, etc.)
│   └── auth/                   # Auth-specific components
│
├── lib/                        # Business logic, hooks, utilities
│   ├── types.ts                # ⭐ All TypeScript types (FeedbackReaction, Product, etc.)
│   ├── data.ts                 # ⭐ Constants: CATEGORY_TREE, STATUS_ORDER (5 stages), priority logic
│   ├── utils.ts                # Pure helper functions (`cn()`, formatting)
│   ├── colors.ts               # Color utilities
│   ├── useAuth.ts              # Auth hook: session, role, signOut, mustChangePassword
│   ├── useFeedback.ts          # Feedback & Qualitative Reactions hook + useAllFeedbackSummary
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
│   │   └── tools/              # Bucky AI tool definitions (move_product_stage disabled)
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
    ├── migrate-feedback-reaction.ts # Adds reaction column to feedback table
    ├── seed-catalog.ts         # Seed catalog_products from CSV
    └── generate-test-plan-xlsx.js # Generates test production plan
```

---

## 3. Component Structure — Atomic Design

### Organisms & Key Components

| File | Key Responsibilities |
|------|---------------------|
| `ProductionModal.tsx` | Stage deliverable modal (`Design` sub-tabs for Storyboard & Script with independent portals; `Production` stage video revision panel with reactive upload triggers) |
| `ProductReviewModal.tsx` | QA review modal for Admin/Super-Admin (`Design` stage doc reviews with auto-promotion banners; `In Review` stage video decisions with confirmation prompts) |
| `VideoModal.tsx` | Full video preview player + Qualitative Satisfaction Reaction Selector (🔥 Loved it, 👍 Good, 😐 Neutral, 👎 Needs Revision, ❌ Unsatisfied) |
| `ProductFormModal.tsx` | Admin product editor — Stage dropdown disabled (`disabled={true}`) with QA review hint |
| `BuckyWidget.tsx` | Floating AI assistant widget (`Bucky`) with streaming tool calls |

### Templates (Tab Views)

| File | Tab | Visible to | Key Features |
|------|-----|-----------|--------------|
| `Dashboard.tsx` | Shell (all tabs) | All | Root tab manager, theme toggle, Bucky integration |
| `OverviewView.tsx` | Overview | All (Client blocked) | KPI summary, Recent Deliveries, interactive links |
| `ReviewsView.tsx` | Approvals Inbox (`reviews`) | Admin & Super-Admin | Unified QA inbox, `Pending (N)` vs `Reviewed`, search, stage filters, localStorage read/cleared state |
| `CatalogView.tsx` | Catalog | All (Client blocked, `canManageCatalog = Admin/Super-Admin`) | Merchandise browser, active/inactive stats, Add/Edit/Request modals |
| `VideoLibraryView.tsx` | Video Library | All (Client uses `ClientVideoLibraryView`) | Kanban board (`5 columns`, `canMoveStage={false}`), table view with status pills |
| `ClientVideoLibraryView.tsx` | Client Library | Clients / All | Published videos only, dynamic category/subcategory filters, left-docked header, smart view filters (Unviewed, Viewed, Feedback Provided, Recents), qualitative reaction badges |
| `AnalyticsView.tsx` | Analytics | Admin & Super-Admin (`Operator` and `Client` blocked) | Power BI column chart (`DailyProgressChart`), pacing, stage funnel |
| `ProductionPlanView.tsx` | Planning | Super-Admin only (`role === 'super-admin'`) | Excel production plan imports & daily target settings (`Set Targets` button upserts into `daily_target_history`) |
| `ManageUsersView.tsx` | Admin | Super-Admin only | User governance, invite & role management |
| `BuckyConversationsView.tsx` | Bucky | Super-Admin only | AI audit log and conversation history viewer |

---

## 4. Core Code Patterns & Strict QA Gates

### Pattern 1: Strict Stage QA Gates & Locked Stage Fields

1. **No Arbitrary Stage Modifications**:
   - `KanbanBoard`: Passed `canMoveStage={false}` to prevent drag-and-drop stage jumping.
   - `VideoLibraryView`: Replaced inline stage dropdowns with read-only status pills `<span className="status-pill">`.
   - `ProductFormModal`: Set `disabled={true}` on Stage select with hint *"Stage transitions are managed automatically via the QA Review process."*
   - `Bucky AI`: Updated `move_product_stage` tool to return an error directing users to the QA review workflow.

2. **Automated & Prompted Stage Transitions**:
   - `Design ➔ Production`: `review_stage_deliverable` RPC evaluates deliverables. When both Storyboard and Script are approved, UI displays a green advancement callout and prompts explicit confirmation (`window.confirm(...)`).
   - `In Review ➔ Published`: UI displays acceptance callout and prompts confirmation before publishing.
   - `In Review ➔ Production`: UI displays rejection callout and prompts confirmation before returning to Production.

---

### Pattern 2: Qualitative Feedback Reactions (`useFeedback.ts`)

`feedback` table contains optional `reaction` column (`'loved'`, `'good'`, `'neutral'`, `'needs_work'`, `'unsatisfied'`).

```typescript
// Insert feedback with qualitative reaction:
await addFeedback(productId, contentText, selectedReaction);

// Global summary hook for client library filtering:
const { feedbackProductIds, reactionsByProduct } = useAllFeedbackSummary();
```

---

### Pattern 3: Disabled Input Styling (`globals.css`)

Global CSS rules ensure disabled form controls across all themes look visually distinct and non-interactable:

```css
input:disabled,
select:disabled,
textarea:disabled,
button:disabled {
  opacity: 0.45 !important;
  cursor: not-allowed !important;
  background: rgba(255, 255, 255, 0.02) !important;
  color: var(--ink-soft, #94a3b8) !important;
  border: 1px dashed rgba(255, 255, 255, 0.18) !important;
  pointer-events: none !important;
  filter: grayscale(0.5);
}
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

| Table | Purpose | RLS | Realtime |
|-------|---------|-----|----------|
| `profiles` | User accounts + roles (operator/admin/super-admin/client) | ✅ Auth read, super-admin update | ✅ |
| `products` | Video production queue — one row per video request | ✅ Public read, auth update, admin insert/delete | ✅ |
| `feedback` | Comments + qualitative reactions per product (`reaction` column) | ✅ Public read, auth insert/delete | ✅ |
| `stage_deliverables` | Storyboarding and Scripting documents | ✅ Public read, auth insert/update | ✅ |
| `video_versions` | Video revision files per product | ✅ Public read, auth insert/update | ✅ |
| `issues` | Flagged problems per product | ✅ Public read, auth insert/update | ✅ |
| `production_plans` | Corporate targets and deadlines | ✅ Public read, super-admin CUD | ✅ |
| `daily_target_history` | Historical daily category/language target logs | ✅ Public read, super-admin insert | ✅ |
