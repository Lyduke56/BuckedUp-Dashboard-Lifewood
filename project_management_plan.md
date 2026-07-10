# BuckedUp AIGC Video Production Dashboard — Project Management Plan

> **Project**: BuckedUp AIGC Video Monitoring Dashboard
> **Client**: BuckedUp (via Lifewood)
> **Last Updated**: July 10, 2026
> **Repository**: `Lyduke56/BuckedUp-Dashboard-Lifewood`

---

## 1. Project Overview

### What Is This?

This is an **internal production monitoring dashboard** for BuckedUp's AIGC (AI-Generated Content) video pipeline. It tracks the entire lifecycle of product marketing videos — from script to publish — across BuckedUp's full catalog of supplements, drinks, apparel, and gear.

Think of it as the mission control for Lifewood's video production team: every video request BuckedUp makes lands here, gets assigned to an editor, moves through a 7-stage pipeline, gets reviewed by Lifewood leadership, and ultimately ships.

### Why Does It Exist?

Before this dashboard, the team was running on a **Google Sheet**. That broke down as the operation scaled — no role-based access, no real-time sync between editors, no audit trail, no review approval gate. This dashboard replaced the Google Sheet entirely with a proper Supabase-backed system featuring live editing, notifications, RBAC, and analytics.

### Who Uses It?

| Role | Who | What They Do |
|------|-----|-------------|
| **Editor** | Production staff (videographers, editors) | Move videos through pipeline stages (Not Started → In Review), upload video files, manage their assigned queue |
| **Approver** | Lifewood leadership | Review submitted videos, accept (→ Scheduled) or reject with feedback |
| **Admin** | Unrestricted | Full CRUD on products, manage user roles, configure production plan targets, everything editors and approvers can do |

---

## 2. Tech Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| **Framework** | Next.js (App Router) | 16.2.10 | React 19, TypeScript |
| **UI** | React + Framer Motion + Lucide Icons | React 19.2.4 | Dark/light theme, glassmorphism design, tilt effects |
| **Styling** | Tailwind CSS v4 + Vanilla CSS | ~82KB `globals.css` | Custom design system with CSS variables |
| **Backend/DB** | Supabase (PostgreSQL) | `@supabase/supabase-js` 2.110 | Auth, Realtime, Storage, RLS |
| **Auth** | Supabase Auth | via `@supabase/ssr` 0.12 | Email/password, session middleware, auto-role provisioning |
| **Realtime** | Supabase Realtime (Postgres Changes) | — | Live sync on all 6 tables |
| **File Storage** | Supabase Storage | — | `videos` bucket, 2GB cap, video MIME types only |

---

## 3. Project Structure — Full File Map

```
buckedup_dashboard/
├── app/
│   ├── globals.css              # Master stylesheet (~82KB) — entire design system
│   ├── layout.tsx               # Root layout with Geist font
│   ├── page.tsx                 # Home route → renders <Dashboard />
│   └── login/
│       └── page.tsx             # Login page (email/password, glassmorphism design)
│
├── components/
│   ├── Dashboard.tsx            # Root client component — state, routing, theme
│   │
│   ├── layout/
│   │   ├── AppHeader.tsx        # Top bar: branding, auth status, sign out, theme toggle
│   │   ├── TabBar.tsx           # Navigation tabs: Overview | Library | Analytics | Admin
│   │   └── NotificationBell.tsx # Bell icon + dropdown for in-app notifications
│   │
│   ├── overview/
│   │   ├── OverviewView.tsx     # Overview tab root — KPIs, progress, activity, CTA
│   │   ├── KpiRow.tsx           # 5 KPI cards: Categories, Videos, Published, In Progress, Not Started
│   │   ├── ProjectProgressCard.tsx  # Large hero banner with progress %, pacing, deadline, tilt effect
│   │   ├── OverviewSnapshot.tsx     # Category completion bars (published/total per category)
│   │   ├── ProductionOutputWidget.tsx  # Today's target widget — daily goal, stage targets, deadline edit
│   │   └── RecentActivityWidget.tsx    # Latest 4 approved/published deliveries
│   │
│   ├── library/
│   │   ├── VideoLibraryView.tsx     # Library tab root — table/board toggle, filters, search, CRUD
│   │   ├── KanbanBoard.tsx          # Drag-and-drop Kanban board across 7 pipeline stages
│   │   ├── VideoModal.tsx           # Full video detail modal with embedded player (Drive/YouTube/direct/Supabase)
│   │   ├── ProductFormModal.tsx     # Admin: add/edit/delete product (full catalog fields)
│   │   ├── ProductionModal.tsx      # Editor: change stage + upload video version
│   │   ├── ProductReviewModal.tsx   # Approver: set review status, accept→Scheduled, reject with reason
│   │   ├── VideoVersionsPanel.tsx   # Upload video files to Supabase Storage, version history
│   │   ├── StageHistoryLog.tsx      # Timeline of stage transitions for a product
│   │   └── CategoryLegend.tsx       # Shared legend component
│   │
│   ├── analytics/
│   │   ├── AnalyticsView.tsx        # Analytics tab root — 10 charts in a 3-column grid
│   │   ├── CategoryChart.tsx        # Completion by category (vs production plan targets)
│   │   ├── DailyProgressChart.tsx   # Daily target vs actual (placeholder data for now)
│   │   ├── FunnelChart.tsx          # Pipeline conversion funnel (Not Started → Published)
│   │   ├── LanguageProgressChart.tsx # Delivery progress by language (vs plan targets)
│   │   ├── OwnerWorkloadChart.tsx   # Assignment distribution and published count per editor
│   │   ├── RejectionRateChart.tsx   # Rejection rate by product category
│   │   ├── ReviewStatusChart.tsx    # Review status distribution (donut chart)
│   │   ├── StageAgeChart.tsx        # Average days in current stage per pipeline stage
│   │   └── StatusChart.tsx          # Production stage distribution (horizontal bars + targets)
│   │
│   ├── admin/
│   │   ├── AdminView.tsx            # Admin tab root — tabbed between Plan and Users
│   │   ├── ProductionPlanView.tsx   # Create/edit production plan: targets, deadlines, stage/category/language goals
│   │   └── ManageUsersView.tsx      # User role management table (promote/demote)
│   │
│   └── shared/
│       ├── Card.tsx                 # Glassmorphism card wrapper
│       ├── CardGrid.tsx             # Responsive grid for KPI cards
│       ├── Tilt.tsx                 # 3D mouse-tracking tilt effect wrapper
│       └── icons.tsx                # Custom SVG icons (Overview, Folder, Analytics, Users, Bell, Play, Camera)
│
├── lib/
│   ├── types.ts                 # All TypeScript types and interfaces
│   ├── data.ts                  # Constants: CATEGORY_TREE, STATUS_ORDER, STATUS_HEX, pacing logic
│   ├── utils.ts                 # Pure helpers: bucket logic, progress %, parsing, role labels
│   ├── colors.ts                # Color utilities
│   ├── useAuth.ts               # Auth hook: session, role, signOut
│   ├── useVideoRequests.ts      # Products hook: fetches all products + Realtime subscription
│   ├── useIssues.ts             # Issues hook: CRUD + Realtime
│   ├── useNotifications.ts      # Notifications hook: fetch, markRead, markAllRead + Realtime
│   ├── useProductionPlan.ts     # Production plan hook: active plan + Realtime
│   ├── useProfiles.ts           # Profiles hook: all users for assignment dropdowns + Realtime
│   ├── useStageAge.ts           # Stage aging hook: time-in-stage per product from history table
│   ├── useTodayStats.ts         # Today's stats hook: published today, by stage/category/language
│   ├── useMounted.ts            # SSR guard for portal-based modals
│   └── supabase/
│       ├── client.ts            # Browser Supabase client (singleton)
│       ├── server.ts            # Server-side Supabase client (cookie-aware)
│       └── admin.ts             # Service-role client for migrations
│
├── proxy.ts                     # Next.js middleware: auth refresh + login redirect gate
├── supabase/
│   └── schema.sql               # Complete database schema (440 lines)
├── scripts/
│   └── apply-schema.ts          # Schema migration runner (tsx)
├── public/                      # Static assets (logos, SVGs)
└── package.json                 # Dependencies and scripts
```

---

## 4. Database Architecture

### Tables

| Table | Purpose | RLS | Realtime |
|-------|---------|-----|----------|
| `profiles` | User accounts + roles (editor/approver/admin) | ✅ Auth read, admin update | ✅ |
| `products` | The video production queue — one row per video request | ✅ Public read, auth update, admin insert/delete | ✅ |
| `issues` | Flagged problems per product (low/medium/high severity) | ✅ Public read, auth insert/update | ✅ |
| `product_status_history` | Audit log of every stage transition (auto-logged by trigger) | ✅ Public read | ✅ |
| `notifications` | In-app notifications (issue reported, rejected, assigned) | ✅ Own-row only | ✅ |
| `video_versions` | Video file revision history per product | ✅ Public read, editor+admin insert/update | — |
| `production_plans` | Corporate-level targets and deadlines (one active at a time) | ✅ Public read, admin CUD | ✅ |

### Storage

| Bucket | Access | Limits |
|--------|--------|--------|
| `videos` | Public read, editor+admin upload, admin delete | 2GB per file, video MIME types only |

### Key Triggers & Functions

| Trigger | Table | What It Does |
|---------|-------|-------------|
| `on_auth_user_created` | `auth.users` | Auto-provisions a `profiles` row; first-ever signup becomes admin |
| `profiles_enforce_role_change` | `profiles` | Only admins can change roles |
| `products_enforce_update_permissions` | `products` | Column-level + value-level permission split by role |
| `products_set_updated_at` | `products` | Auto-updates `updated_at` on every edit |
| `products_log_status_change` | `products` | Logs stage transitions to `product_status_history` |
| `products_notify_changes` | `products` | Sends notifications on rejection or assignment change |
| `issues_notify_owner` | `issues` | Notifies product owner when an issue is reported |
| `set_current_video_version()` | — (RPC) | Atomically: unmarks old version, inserts new, syncs `products.video_url` |

---

## 5. RBAC (Role-Based Access Control) — Complete Matrix

> [!IMPORTANT]
> The UI hides controls a role can't use, but **the database is the real security boundary**. Every permission below is enforced by PostgreSQL triggers and RLS policies in [schema.sql](file:///c:/Users/Clyde%20Justine%20Rosal/Desktop/Projects/BuckedUp-Dashboard-Lifewood/buckedup_dashboard/supabase/schema.sql).

| Action | Editor | Approver | Admin |
|--------|--------|----------|-------|
| **View all products** | ✅ | ✅ | ✅ |
| **Move stage** (Not Started → In Review) | ✅ | ❌ | ✅ |
| **Move stage** to Scheduled | ❌ | ✅ (via accept) | ✅ |
| **Move stage** to Published | ❌ | ❌ | ✅ |
| **Change review status** | ❌ | ✅ | ✅ |
| **Set rejection reason** | ❌ | ✅ | ✅ |
| **Edit catalog fields** (name, category, owner, etc.) | ❌ | ❌ | ✅ |
| **Add product** | ❌ | ❌ | ✅ |
| **Delete product** | ❌ | ❌ | ✅ |
| **Upload video** | ✅ | ❌ | ✅ |
| **Report issues** | ✅ | ✅ | ✅ |
| **Resolve issues** | ✅ | ✅ | ✅ |
| **Manage user roles** | ❌ | ❌ | ✅ |
| **Create/edit production plan** | ❌ | ❌ | ✅ |
| **Edit deadline (inline)** | ❌ | ❌ | ✅ |
| **"My items" filter** | ✅ | — | — |

---

## 6. Pipeline Stages

The video production pipeline has **7 stages**, enforced as a text field (not a DB enum, for flexibility):

```
Not Started → Scripting → Filming → Editing → In Review → Scheduled → Published
```

| Stage | Who Advances | What Happens |
|-------|-------------|-------------|
| **Not Started** | Editor | Product is queued, no work begun |
| **Scripting** | Editor | Script is being written |
| **Filming** | Editor | Video is being shot |
| **Editing** | Editor | Post-production in progress |
| **In Review** | Editor → stops here | Submitted for Lifewood leadership review |
| **Scheduled** | Approver (via "Accepted" review) | Approved, scheduled for release |
| **Published** | Admin only | Video is live |

> [!NOTE]
> Editors **cannot skip the review gate**. The DB trigger rejects any editor trying to set status to Scheduled or Published. Approving a video is the *only* way to advance past In Review — this mirrors the real business workflow.

---

## 7. Product Categories

BuckedUp's catalog is organized into **10 top-level categories** with **42 subcategories**:

| Category | Subcategories |
|----------|--------------|
| Pre-Workout & Energy | Fat Burn & Thermogenic, High Stimulant, On The Go Energy, Standard Stim, Stim Free & Pump |
| Drinks | Energy Drinks, Hydration Drinks, Protein Drinks |
| Creatine | Creatine Gummies, Creatine Powder |
| Vitamins & Wellness | Antioxidants & Specialty, Greens, Joint & Bone, Multivitamins, Omegas & Healthy Fats |
| BCAA & Amino Acids | BCAA, EAAs |
| Deer Antler Spray | Deer Antler Spray |
| Stacks | Stacks |
| Babe by Bucked Up | Babe By Bucked Up |
| Clearance & Last Chance | Clearance & Last Chance |
| Apparel & Gear | 16 subcategories (Mens, Womens, Accessories, Fitness Gear, etc.) |

---

## 8. Core Features — Complete Inventory

### 8.1 Overview Tab
- [x] **Project Progress Banner** — Animated hero card showing overall completion %, pacing status (On Track / At Risk / Late / Complete), days to deadline, progress bar with target pace marker, mouse-tracking tilt + shimmer effects
- [x] **KPI Row** — 5 glassmorphism cards: Categories Requested, Videos Planned, Published, In Progress, Not Started (with tilt effects and Lucide icons)
- [x] **Requests by Category** — Horizontal progress bars showing published/total per category
- [x] **Production Output Widget** — Today's published count vs daily goal, per-stage target breakdown, editable deadline (admin-only inline edit)
- [x] **Recent Deliveries** — Latest 4 accepted/published products with category and date
- [x] **Browse Library CTA** — Interactive tilt card linking to the Video Library tab

### 8.2 Video Library Tab
- [x] **Table View** — Sortable table with columns: ID, Video name, Language (with flag emoji), Stage (colored pill), Review Status (colored pill), Completed date, Progress bar, Actions
- [x] **Board View (Kanban)** — Drag-and-drop Kanban board across all 7 pipeline stages, with card tooltips showing category/owner/language/issues
- [x] **Layout Toggle** — Switch between Table and Board views
- [x] **Filtering System** — Category dropdown, Subcategory dropdown (dependent on category), Status pills (All/Not Started/In Progress/Published), "My Items" filter (editor-only), "Rejected" filter, Text search by product name
- [x] **Row Detail Expand** — Expandable row showing: Owner, Product URL, Content Angle callout, Stage History timeline, Issues panel with report/resolve
- [x] **Product Form Modal (Admin)** — Full CRUD: Rank, Name, Category/Subcategory, Stage, Content Type, Language, Owner (dropdown of profiles), Publish Date, Product URL, Video URL, Content Angle, Delete with confirmation
- [x] **Production Modal (Editor)** — Stage change + video version upload
- [x] **Review Modal (Approver)** — Set review status (Not Started / In Production / Accepted / Rejected), rejection reason textarea, accepting auto-advances to Scheduled
- [x] **Video Detail Modal** — Split layout: left column with product details, right column with embedded video player (supports Google Drive, YouTube, direct video files, external link fallback, Supabase-hosted files)
- [x] **Video Versions Panel** — File upload to Supabase Storage, version history list with "Current" badge, notes per version
- [x] **Stage History Log** — Chronological timeline of all stage transitions with timestamps
- [x] **Issue Tracking** — Report issues with severity (low/medium/high), resolve issues, badge count on flag button
- [x] **Add Product Button** — Admin-only, opens form modal in add mode

### 8.3 Analytics Tab (9 Charts)
- [x] **Daily Target vs Actual** — Line chart showing daily video output vs target (currently placeholder/mock data)
- [x] **Review Status Distribution** — Donut chart (Not Started, In Production, Accepted, Rejected)
- [x] **Stage Transition Funnel** — Cumulative funnel showing pipeline conversion rates
- [x] **Time in Current Stage** — Horizontal bar chart showing average days per stage (from `product_status_history`)
- [x] **Production Stage Distribution** — Horizontal bars with target markers from production plan
- [x] **Completion by Category** — Per-category progress bars with plan targets
- [x] **Rejection Rate by Category** — Per-category rejection percentages
- [x] **Delivery Progress by Language** — Per-language progress bars with plan targets
- [x] **Owner Workload Distribution** — Stacked bars showing active vs published per person
- [x] **Production Pipeline Insights** — Info cards explaining queue fill rates and live editing

### 8.4 Admin Tab
- [x] **Production Plan Form** — Name, Total Video Target, Start Date, Deadline, Notes
- [x] **Today's Targets Dashboard** — 4 interactive stat cards:
  - Video Output: today's published vs daily goal + progress bar
  - Stage Output: dropdown to pick a stage, set its daily goal, see today's progress
  - Category Output: dropdown to pick a category, set its daily goal, see today's progress
  - Language Output: dropdown to pick a language (+ add new), set daily goal, see progress
- [x] **Manage Users** — Table of all registered profiles with role dropdown (Editor/Approver/Admin)

### 8.5 System Features
- [x] **Authentication** — Supabase Auth with email/password, session middleware (proxy.ts), auto-redirect to /login
- [x] **Auto-Provisioning** — First signup becomes admin automatically, subsequent signups default to editor
- [x] **Realtime Sync** — All 6 tables publish to `supabase_realtime`; every hook subscribes to `postgres_changes` for live updates
- [x] **In-App Notifications** — Bell icon with unread count badge, notification types: issue_reported, rejected, assigned; mark read / mark all read; click-to-navigate to product in library
- [x] **Dark/Light Theme** — Toggle switch in header, CSS variable-based theming, persisted via DOM attribute
- [x] **Responsive Design** — Mobile-friendly, responsive grid layouts (`grid-cols-1 lg:grid-cols-3`)
- [x] **Glassmorphism UI** — Premium glass card effects, gradients, animated tab indicator with spring physics
- [x] **3D Tilt Effects** — Mouse-tracking tilt on KPI cards, progress banner, production output, CTA card, recent deliveries

---

## 9. Development History & Milestones

The project evolved through clear phases, each building on the last:

| Phase | Commit(s) | What Was Built |
|-------|-----------|---------------|
| **Phase 0: Supabase Migration** | `5c02eee` → `808d56b` | Scaffolded Supabase schema, clients, migration script; cut over from Google Sheet; retired all Sheet references |
| **Phase A: Roles & Permissions** | `827d2ae` | Editor/Approver/Admin roles, DB-enforced column-level permissions, auto-provisioning trigger |
| **Phase B: Ownership** | `a6d6320` | Real owner_id (FK to profiles), "My Items" filter for editors |
| **Phase C: Rejection Flow** | `f6158fa` | Review modal, rejection reasons, approval → Scheduled gate |
| **Phase D: Stage Aging** | `95bb68b` | `product_status_history` table, StageAgeChart, bottleneck visibility |
| **Phase E: Notifications** | `06c85bc` | `notifications` table, trigger-based events, NotificationBell dropdown |
| **Phase F: Video Versions** | `654c773` | `video_versions` table, Supabase Storage upload, `set_current_video_version()` RPC |
| **Phase G: Kanban Board** | `715ef8b` | Drag-and-drop board view, stage columns, floating tooltips |
| **UI Overhaul** | `53e2141` | Gold accents, masonry columns, smooth theme toggle, glassmorphism |
| **Production Plan** | `47867f4` → `ee4db62` | `production_plans` table, admin form, dropdown output cards, today's stats |
| **Login Redesign** | `fe36320` → `a818116` | Premium dark glassmorphism, dynamic glowing orbs, shift-gradient backgrounds |
| **Analytics Alignment** | `73fcba9` | Structured 3-column grid, progress bar charts redesign, target visual markers |
| **Overview Enhancement** | `9e040a1` → `a4fda6c` | Project plan header, column height alignment, setState warning fixes |
| **Auth Fix** | `800ae60` | Redirect to /login on sign out |

---

## 10. Current Status

> [!TIP]
> The dashboard is **fully functional and in active use**. All core features are implemented, deployed, and connected to live Supabase data.

### What's Working ✅
- Complete RBAC with DB-enforced permissions
- Full video production pipeline (7 stages)
- Live Realtime sync across all editors
- Video upload to Supabase Storage with version history
- In-app notifications for assignments, rejections, and issues
- Review/approval workflow with business gate
- 9 analytics charts
- Production plan configuration with today's targets
- User management
- Dark/light theme
- Responsive glassmorphism UI
- Authentication with session middleware

### Known Limitations ⚠️
- **Daily Progress Chart uses mock data** — The `MOCK_DAILY_PROGRESS` array in [data.ts](file:///c:/Users/Clyde%20Justine%20Rosal/Desktop/Projects/BuckedUp-Dashboard-Lifewood/buckedup_dashboard/lib/data.ts#L121-L129) is illustrative. A real snapshot/cron job to aggregate daily completions doesn't exist yet. The `DailyCompletionPoint` type is [already defined](file:///c:/Users/Clyde%20Justine%20Rosal/Desktop/Projects/BuckedUp-Dashboard-Lifewood/buckedup_dashboard/lib/types.ts#L90-L94) and ready.
- **No test suite** — Zero unit, integration, or E2E tests
- **No CI/CD pipeline** — No automated build/deploy/test pipeline
- **No audit log for non-stage edits** — `product_status_history` only tracks stage changes. Edits to owner, content angle, etc. are not logged.
- **Video preview relies on third-party embeds** — Google Drive preview can be blocked by org-level sharing settings
- **Single active plan constraint** — Only one production plan can be active at a time (by design, DB-enforced)

---

## 11. Environment Setup for New Members

### Prerequisites
- Node.js (v18+)
- npm
- A Supabase project (with the schema applied)

### Setup Steps

```bash
# 1. Clone the repo
git clone <repo-url>
cd BuckedUp-Dashboard-Lifewood/buckedup_dashboard

# 2. Install dependencies
npm install

# 3. Set up environment variables
# Create .env.local with:
#   NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
#   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>  (for migrations only)
#   DATABASE_URL=<postgres-connection-string>  (for migrations only)

# 4. Apply the database schema (if fresh project)
npm run db:apply-schema

# 5. Start the dev server
npm run dev
# → Open http://localhost:3000
```

### First Login
1. Go to `/login` and create an account
2. The **first-ever signup** automatically becomes **admin**
3. All subsequent signups default to **editor** — an admin must promote them

---

## 12. Key Conventions & Patterns

### For New Developers — Read This Before Writing Code

1. **Every custom hook subscribes to Supabase Realtime** — When you create a new hook that reads from a table, subscribe to `postgres_changes` on that table so edits from other users appear live. See [useVideoRequests.ts](file:///c:/Users/Clyde%20Justine%20Rosal/Desktop/Projects/BuckedUp-Dashboard-Lifewood/buckedup_dashboard/lib/useVideoRequests.ts) for the pattern.

2. **The DB is the security boundary, not the UI** — Never rely on the UI to enforce permissions. The dashboard hides buttons a role can't use, but [enforce_product_update_permissions()](file:///c:/Users/Clyde%20Justine%20Rosal/Desktop/Projects/BuckedUp-Dashboard-Lifewood/buckedup_dashboard/supabase/schema.sql#L133-L190) in `schema.sql` is what actually blocks unauthorized writes.

3. **React's sanctioned "adjust state during render" pattern** — Several components (e.g., [VideoLibraryView](file:///c:/Users/Clyde%20Justine%20Rosal/Desktop/Projects/BuckedUp-Dashboard-Lifewood/buckedup_dashboard/components/library/VideoLibraryView.tsx#L70-L81), [ProductionPlanView](file:///c:/Users/Clyde%20Justine%20Rosal/Desktop/Projects/BuckedUp-Dashboard-Lifewood/buckedup_dashboard/components/admin/ProductionPlanView.tsx#L76-L81)) sync state from props *during render* rather than in `useEffect`. This is intentional — it's React's official pattern for prop→state sync.

4. **Portal-based modals** — All modals use `createPortal(…, document.body)` for viewport-fixed overlays. The `useMounted()` guard prevents SSR hydration mismatches.

5. **Single CSS file** — All styles live in [globals.css](file:///c:/Users/Clyde%20Justine%20Rosal/Desktop/Projects/BuckedUp-Dashboard-Lifewood/buckedup_dashboard/app/globals.css). It's big (~82KB) but unified. CSS variables drive the theme system.

6. **`products` has exactly one video item per row** — The schema comment explains: "every real row so far has had exactly one video item, so VideoItem's fields are flattened directly onto the product row rather than a separate table." The `items[]` array in the frontend type exists for backward compatibility but always has length 1.

7. **camelCase in TS, snake_case in DB** — Types use `camelCase` (e.g., `reviewStatus`), database columns use `snake_case` (e.g., `review_status`). Conversion happens in each hook's `toXxx()` function.

8. **Production plan is optional** — The dashboard works without a production plan. Widgets show empty states, and fallback constants in [data.ts](file:///c:/Users/Clyde%20Justine%20Rosal/Desktop/Projects/BuckedUp-Dashboard-Lifewood/buckedup_dashboard/lib/data.ts#L114-L116) are used for pacing calculations.

---

## 13. Future Roadmap & Open Work Items

### High Priority
- [ ] **Real daily snapshot job** — Replace `MOCK_DAILY_PROGRESS` with a cron/edge function that snapshots daily completion counts into a new table. The `DailyCompletionPoint` type is already defined.
- [ ] **Testing** — Add unit tests for utility functions (utils.ts, data.ts), integration tests for hooks, and E2E tests (Playwright) for critical workflows (login, stage change, review, product CRUD).
- [ ] **CI/CD** — Set up GitHub Actions for build verification, lint, and (eventually) test runs on PRs.

### Medium Priority
- [ ] **Full audit log** — Extend `product_status_history` (or create a separate `audit_log` table) to track all product field changes, not just stage transitions.
- [ ] **Bulk operations** — Select multiple products and change stage, assign owner, or move category in batch.
- [ ] **Export** — CSV/Excel export of filtered library data.
- [ ] **Search improvements** — Search across all fields (category, owner, content angle), not just product name.
- [ ] **Sorting** — Column-header click sorting in the table view.
- [ ] **Pagination** — The library currently loads all products at once. As the catalog grows, add server-side pagination or virtual scrolling.

### Nice to Have
- [ ] **Activity feed** — A timeline of all actions across all products (who changed what, when).
- [ ] **Email notifications** — Supabase edge function to send emails on rejection/assignment, not just in-app.
- [ ] **Multi-plan support** — Archive completed plans and create new ones while keeping historical data.
- [ ] **Dashboard customization** — Let users pin/reorder widgets on the Overview tab.
- [ ] **Video thumbnails** — Auto-generate thumbnails from uploaded videos for the library table.
- [ ] **Mobile app** — React Native wrapper for on-the-go stage updates by editors on set.

---

## 14. Glossary

| Term | Meaning |
|------|---------|
| **Pipeline Stage** (`products.status`) | Where a video is in production: Not Started → Scripting → Filming → Editing → In Review → Scheduled → Published |
| **Review Status** (`products.review_status`) | Approval state, separate from pipeline: Not Started / In Production / Accepted / Rejected |
| **Product** | A single video request — one row in the `products` table, one entry in the Video Library |
| **Rank** | Priority number, unique per product — the queue position |
| **Content Angle** | The creative brief / description of what the video should focus on |
| **Stage Age** | How many days a product has been sitting in its current stage (from `product_status_history`) |
| **Production Plan** | Admin-configured targets: total videos, daily throughput, per-stage/category/language breakdowns, deadline |
| **Pacing** | Calculated metric: expected progress % (based on elapsed time) vs actual progress %. Determines On Track / At Risk / Late status |
| **RLS** | Row Level Security — Supabase/PostgreSQL feature that filters which rows a user can see/modify based on their auth state |

---

> [!CAUTION]
> **Before making any schema changes**, always update [schema.sql](file:///c:/Users/Clyde%20Justine%20Rosal/Desktop/Projects/BuckedUp-Dashboard-Lifewood/buckedup_dashboard/supabase/schema.sql) first and test in a staging Supabase project. The production database has live data — never run destructive DDL directly.
