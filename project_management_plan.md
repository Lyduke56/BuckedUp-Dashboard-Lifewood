# BuckedUp AIGC Video Production Dashboard — Project Management Plan

> **Project**: BuckedUp AIGC Video Monitoring Dashboard  
> **Client**: BuckedUp (via Lifewood)  
> **Last Updated**: July 23, 2026  
> **Repository**: `Lyduke56/BuckedUp-Dashboard-Lifewood`  

---

## 1. Project Overview

### What Is This?

This is an **internal production monitoring dashboard** for BuckedUp's AIGC (AI-Generated Content) video pipeline. It tracks the entire lifecycle of product marketing videos — from script to publish — across BuckedUp's full catalog of supplements, drinks, apparel, and gear.

Think of it as the mission control for Lifewood's video production team: every video request BuckedUp makes lands here, gets assigned to an operator, moves through a 5-stage pipeline with document/video QA reviews, gets evaluated by Lifewood leadership, and ultimately ships.

### Why Does It Exist?

Before this dashboard, the team was running on a **Google Sheet**. That broke down as the operation scaled — no role-based access, no real-time sync between editors, no audit trail, no review approval gate. This dashboard replaced the Google Sheet entirely with a proper Supabase-backed system featuring live editing, notifications, RBAC, analytics, and dedicated client feedback portals.

### Who Uses It?

| Role | Who | What They Do |
|------|-----|-------------|
| **Operator** | Production staff (videographers, editors, AI operators) | Claim assigned products, submit pre-video deliverables (Storyboards & Scripts) and video revisions, report issues |
| **Admin** | Lifewood leadership / production managers (formerly Lead) | Assign priority, review submitted deliverables via **Approvals Inbox**, evaluate QA approvals to advance stages, manage Operators |
| **Super-Admin** | Governance-only administrators | Manage user accounts (`profiles`), assign/promote other Super-Admins, configure granular tab permissions (`tab_permissions`) & Read-Only Access (`is_read_only`), import corporate production plans (`Planning`), audit AI execution logs (`Bucky`) |
| **Client** | BuckedUp stakeholders | Browse completed videos, leave feedback and qualitative reactions on published content |

---

## 2. Tech Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| **Framework** | Next.js (App Router) | 16.2.10 | React 19, TypeScript |
| **UI** | React + Framer Motion + Lucide Icons | React 19.2.4 | Dark/light theme, glassmorphism design, tilt effects |
| **Styling** | Tailwind CSS v4 + Vanilla CSS | ~150KB `globals.css` | Complete design system, disabled field rules |
| **Backend/DB** | Supabase (PostgreSQL) | `@supabase/supabase-js` 2.110 | Auth, Realtime, Storage, RLS |
| **Auth** | Supabase Auth | via `@supabase/ssr` 0.12 | Email/password, session middleware, auto-role provisioning |
| **Realtime** | Supabase Realtime (Postgres Changes) | — | Live sync on all core tables |
| **File Storage** | Supabase Storage | — | `videos` bucket, 2GB cap, video MIME types only |

---

## 3. Project Structure — Full File Map

```
buckedup_dashboard/
├── app/
│   ├── globals.css              # Master stylesheet (~150KB) — design system & disabled rules
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
│   │   ├── TabBar.tsx           # Navigation tabs: Overview | Library | Analytics | Admin | Bucky
│   │   └── NotificationBell.tsx # Bell icon + dropdown for in-app notifications
│   │
│   ├── overview/
│   │   ├── OverviewView.tsx     # Overview tab root — KPIs, progress, activity, CTA
│   │   ├── KpiRow.tsx           # 5 KPI cards: Categories, Videos, Published, In Progress, Not Started
│   │   ├── ProjectProgressCard.tsx  # Hero banner with progress %, pacing, deadline, tilt effect
│   │   ├── OverviewSnapshot.tsx     # Category completion bars
│   │   ├── ProductionOutputWidget.tsx  # Today's target widget — daily goal, stage targets
│   │   └── RecentActivityWidget.tsx    # Latest 4 accepted/published deliveries
│   │
│   ├── library/
│   │   ├── VideoLibraryView.tsx     # Pipeline Library root — table/board toggle, read-only status pills
│   │   ├── ClientVideoLibraryView.tsx # Client Library — published videos, dynamic category filters, smart view filters, left-docked header
│   │   ├── KanbanBoard.tsx          # Drag-and-drop Kanban board (canMoveStage={false} locked)
│   │   ├── VideoModal.tsx           # Full video preview modal + Qualitative Satisfaction Reactions
│   │   ├── ProductFormModal.tsx     # Product editor (Stage field disabled={true} with QA hint)
│   │   ├── ProductionModal.tsx      # Operator: submit Storyboard/Script & video revisions
│   │   ├── ProductReviewModal.tsx   # Admin: QA review modal with advancement callouts & prompts
│   │   ├── VideoVersionsPanel.tsx   # Upload video files & revision history
│   │   └── StageHistoryLog.tsx      # Timeline of stage transitions
│   │
│   ├── analytics/
│   │   ├── AnalyticsView.tsx        # Analytics tab root — 10 charts in a 3-column grid
│   │   ├── CategoryChart.tsx        # Completion by category
│   │   ├── DailyProgressChart.tsx   # Daily target vs actual
│   │   ├── FunnelChart.tsx          # Pipeline conversion funnel
│   │   ├── LanguageProgressChart.tsx # Delivery progress by language
│   │   ├── OwnerWorkloadChart.tsx   # Assignment distribution per editor
│   │   ├── RejectionRateChart.tsx   # Rejection rate by category
│   │   ├── ReviewStatusChart.tsx    # Review status distribution
│   │   ├── StageAgeChart.tsx        # Average days in current stage
│   │   └── StatusChart.tsx          # Production stage distribution
│   │
│   ├── admin/
│   │   ├── AdminView.tsx            # Admin tab root — tabbed between Plan and Users
│   │   ├── ProductionPlanView.tsx   # Super-Admin: Create/edit production plan & daily targets
│   │   └── ManageUsersView.tsx      # User role management table
│   │
│   └── shared/
│       ├── Card.tsx                 # Glassmorphism card wrapper
│       ├── CardGrid.tsx             # Responsive grid for KPI cards
│       ├── Tilt.tsx                 # 3D mouse-tracking tilt effect wrapper
│       └── icons.tsx                # Custom SVG icons
│
├── lib/
│   ├── types.ts                 # All TypeScript types (FeedbackReaction, Product, etc.)
│   ├── data.ts                  # Constants: CATEGORY_TREE, STATUS_ORDER, pacing logic
│   ├── utils.ts                 # Pure helpers: formatting, parsing, role labels
│   ├── useAuth.ts               # Auth hook: session, role, signOut
│   ├── useFeedback.ts          # Feedback & Qualitative Reactions hook + useAllFeedbackSummary
│   ├── useVideoRequests.ts      # Products hook + Realtime
│   ├── useIssues.ts             # Issues hook + Realtime
│   ├── useNotifications.ts      # Notifications hook + Realtime
│   ├── useProductionPlan.ts     # Production plan hook + Realtime
│   ├── useProfiles.ts          # Profiles hook + Realtime
│   ├── useStageAge.ts          # Stage aging hook
│   ├── useTodayStats.ts        # Today's stats hook
│   └── supabase/
│       ├── client.ts            # Browser Supabase client
│       ├── server.ts            # Server-side Supabase client
│       └── admin.ts             # Service-role client
│
├── proxy.ts                     # Next.js middleware: auth refresh + route gates
└── supabase/
    └── schema.sql               # Complete database schema
```

---

## 4. Pipeline Stages & Strict QA Gates

The video production pipeline consists of **5 stages**:

```
Not Started → Design → Production → In Review → Published
```

| Stage | Who Advances | What Happens |
|-------|-------------|-------------|
| **Not Started** | Operator (via Claim) | Product is queued, no work begun. Claiming sets `owner_id` and advances to `Design`. |
| **Design** | Automated trigger via QA Approval | Operator submits Storyboard and Script deliverables. Admin approves both deliverables -> DB automatically promotes to `Production`. |
| **Production** | Operator (via `submit_video_for_review`) | Operator uploads video revision and calls RPC to submit for review -> Stage advances to `In Review`. |
| **In Review** | Admin / Super-Admin (via QA Review) | Admin accepts -> Stage advances to `Published`. Admin rejects -> Stage returns to `Production` with rejection notes. |
| **Published** | Completed state | Video is published and available on the Client Dashboard (`publish_date` recorded). |

> [!IMPORTANT]
> **Strict QA Gate Enforcement**:
> - Stage dropdowns in `VideoLibraryView` replaced with read-only status pills `<span className="status-pill">`.
> - Stage input in `ProductFormModal` disabled (`disabled={true}`) with hint *"Stage transitions are managed automatically via the QA Review process."*
> - Drag-and-drop on `KanbanBoard` set to `canMoveStage={false}`.
> - Direct stage move AI tool `move_product_stage` disabled.

---

## 5. Client Video Library & Qualitative Reactions

### 5.1 Client Video Portal Features (`ClientVideoLibraryView.tsx`)
- **Published Videos Only**: Displays only completed published deliverables.
- **Dynamic Category & Subcategory Dropdowns**: Dynamically derives available categories and subcategories from published items.
- **Left-Docked Header Layout**: Search bar matching Product Catalog design (`var(--glass-bg)`, `var(--glass-border)`, `borderRadius: 22px`), left-aligned with equal spacing.
- **Smart View & Feedback Filters**:
  - `All Videos`
  - `Unviewed` (with **NEW** indicator badge and counter)
  - `Viewed Only` (opened and reviewed)
  - `Feedback Provided` (with client comments/reactions)
  - `Recents (7 Days)` (published in the last 7 days)

### 5.2 Qualitative Satisfaction Reaction System (`VideoModal.tsx` & `useFeedback.ts`)
- Allows clients to attach social-media style qualitative reactions to comments:
  - 🔥 **Loved it** (`loved`)
  - 👍 **Good** (`good`)
  - 😐 **Neutral** (`neutral`)
  - 👎 **Needs Revision** (`needs_work`)
  - ❌ **Unsatisfied** (`unsatisfied`)
- Stored in `feedback` table (`reaction` column).
- Displayed as badges on comment bubbles and aggregated as chips (e.g. `🔥 2`, `👍 1`) on video library cards.

---

## 6. Multi-Company Architectural Transformation & Header Filter Placeholder

> **Full Blueprint & Developer Handover Document**: [MULTI_COMPANY_REARCHITECTURE_PLAN.md](./MULTI_COMPANY_REARCHITECTURE_PLAN.md)

### 6.1 Strategic Pivot Context
To support Lifewood's expansion across multiple brand clients, the platform is transitioning from a single-tenant system (BuckedUp only) to a **Multi-Tenant AIGC Production Hub** managing content for multiple partnered companies (e.g., BuckedUp, Red Bull, Monster Energy, Celsius, NutraBio).

### 6.2 Phase 1: Header Company Dropdown Placeholder (`AppHeader.tsx`)
- **Subtle Styling**: Appears as clean, un-styled flat text when unhovered; reveals glassmorphic background (`var(--header-badge-bg)`), rounded border (`6px`), and rotating chevron (`ChevronDown`) on hover or click.
- **RBAC Guarded**: Restricted strictly to `super-admin` and `admin` roles. Non-admin users see the standard static title.
- **Theme-Aware**: Supports seamless rendering across both Dark and Light mode themes using panel-aware CSS variables (`var(--panel-bg-opaque)`, `var(--ink)`, `var(--ink-soft)`, `var(--castleton)`).
- **Static Demo Data**: Loaded with interactive partner options (`BuckedUp`, `Red Bull`, `Monster Energy`, `Celsius`, `NutraBio`) to demonstrate real-time title updating.

### 6.3 Future Engineering Roadmap
1. **Database Multi-Tenancy**: Create `companies` table and add `company_id uuid references companies(id)` to `products`, `issues`, `production_plans`, `video_requests`, and `bucky_conversations`.
2. **Supabase RLS Enforcers**: Update Postgres RLS policies to isolate tenant data per user session.
3. **Global `CompanyContext`**: Wrap app in `CompanyContext` to drive state across custom hooks (`useCatalog`, `useProductionPlan`, `useIssues`, etc.).
4. **Bucky AI Scoping**: Filter vector queries and RAG prompt contexts by `company_id` to maintain strict multi-tenant privacy.

