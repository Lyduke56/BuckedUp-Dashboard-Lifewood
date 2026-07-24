# BuckedUp AIGC Video Production Dashboard (Lifewood)

A comprehensive, enterprise-grade video production and pipeline management platform built with **Next.js 16 (App Router)**, **React 19**, **TypeScript**, and **Supabase (PostgreSQL with RLS)**. 

This platform serves as the mission control for Lifewood's AI-Generated Content (AIGC) production team—tracking, reviewing, and delivering video marketing assets across extensive product catalogs.

---

## 🌟 Core Features & Modules

### 🔒 1. Strict QA Approval Gate System (`ReviewsView`, `ProductReviewModal`)
- **Automated Stage Advancement**: Pipeline stages (`Not Started` ➔ `Design` ➔ `Production` ➔ `In Review` ➔ `Published`) can **only** be advanced by an Admin evaluating and approving Operator deliverables in the **Approvals Inbox**.
- **Enforced Governance**: Manual stage manipulation is locked across Kanban boards, product editing forms, and AI assistant execution tools to maintain strict QA standards.

### 👥 2. Role-Based Access Control (RBAC) & Supabase RLS
Enforced via Supabase Row-Level Security (RLS) policies and PostgreSQL trigger functions:
- **`Super-Admin`**: Operational governance, user account management (`/api/super-admin/create-user`), forced first-login password changes, corporate production plan configuration, and Bucky conversation auditing.
- **`Admin`**: Operational review manager—reviews submitted Storyboards, Scripts, and Video Revisions, approves deliverables, configures product catalog listings, and manages team workload.
- **`Operator`**: Production execution staff—claims assigned products, uploads pre-video deliverables and video revisions, and reports/resolves production issues.
- **`Client`**: Brand stakeholders—accesses a dedicated portal to view published deliverables and leave qualitative feedback.

### 🎬 3. Client Video Portal & Qualitative Reactions (`ClientVideoLibraryView`, `VideoModal`)
- **Published Deliverables Showcase**: Dedicated read-only view displaying approved marketing videos.
- **Smart View Filters**: Quick toggle filters for `All Videos`, `Unviewed` (with **NEW** indicator badges), `Viewed Only`, `Feedback Provided`, and `Recents (7 Days)`.
- **Qualitative Satisfaction Reactions**: Clients attach social reaction badges to comments:
  - 🔥 **Loved it** (`loved`)
  - 👍 **Good** (`good`)
  - 😐 **Neutral** (`neutral`)
  - 👎 **Needs Revision** (`needs_work`)
  - ❌ **Unsatisfied** (`unsatisfied`)

### 🤖 4. Integrated AI Assistant — "Bucky AI" (`BuckyWidget`, `/app/api/bucky/chat`)
- **Powered by OpenRouter & Vercel AI SDK**: Conversational AI assistant with real-time database context.
- **Role-Aware Toolset**: Features modular tool definitions (`shared.ts`, `operator.ts`, `admin.ts`) allowing Bucky to query video status, report issues, summarize daily progress, and assist in planning.
- **Audit & Transcript Inspection**: Includes `BuckyTranscriptModal.tsx` and `BuckyConversationsView.tsx` for Super-Admins to inspect conversation history and tool execution logs.

### 📦 5. Catalog Management & Production Planning (`CatalogView`, `ProductionPlanView`)
- **CSV Catalog Ingestion**: Supports parsing and seeding product catalogs from CSV/Excel data.
- **Target Tracking & Daily Pacing**: Configurable daily target output widgets (`ProductionOutputWidget.tsx`) and hero progress banners (`ProjectProgressCard.tsx`) with deadline pacing calculations.

### 📊 6. Analytics Suite (`AnalyticsView`)
Features 10 real-time analytical charts:
- Category Completion Rates
- Daily Target vs. Actual Pacing
- Pipeline Conversion Funnel
- Delivery Progress by Language
- Owner / Editor Workload Distribution
- Rejection Rate by Category
- Review Status Breakdown
- Average Days in Current Stage
- Pipeline Status Distribution

### 🏢 7. Multi-Company Partner Architecture Ready (`AppHeader`)
- **Partner Context Filter**: Subtle dropdown filter in `AppHeader.tsx` accessible to `Super-Admin` and `Admin` roles (switching between `BuckedUp`, `Red Bull`, `Monster Energy`, `Celsius`, `NutraBio`).
- **Scalability Placeholder**: Serves as the UI entryway for full multi-tenant AIGC hub expansion. See [MULTI_COMPANY_REARCHITECTURE_PLAN.md](./MULTI_COMPANY_REARCHITECTURE_PLAN.md).

### 🌓 8. Theme System
- **Synchronized Dark & Light Modes**: Uses CSS custom variables with persistent user preferences saved to Supabase profiles.

---

## 🗺️ Application Navigation & View Structure

| View ID | Component | Target Role | Primary Function |
| :--- | :--- | :--- | :--- |
| `overview` | `OverviewView.tsx` | All Users | Dashboard KPIs, daily targets, recent activity, hero progress |
| `catalog` | `CatalogView.tsx` | Admin / Super-Admin | Product Catalog management, categories, CSV ingestion |
| `library` | `VideoLibraryView.tsx` | Admin / Operator | Operational video pipeline tracking (Kanban & Table) |
| `client-library` | `ClientVideoLibraryView.tsx` | Client | Published video portal with Qualitative Reactions |
| `reviews` | `ReviewsView.tsx` | Admin | QA Approvals Inbox for reviewing storyboards & videos |
| `analytics` | `AnalyticsView.tsx` | All Users | 10 real-time analytics & workload distribution charts |
| `planning` | `ProductionPlanView.tsx` | Admin / Super-Admin | Corporate production plan configuration & target setting |
| `super-admin` | `ManageUsersView.tsx` | Super-Admin | User account provisioning & role management |
| `bucky` | `BuckyConversationsView.tsx` | Super-Admin | Bucky AI execution logs & conversation audit transcripts |

---

## 🛠️ Tech Stack & Dependencies

### Core Framework
- **Framework**: Next.js 16.2.10 (App Router)
- **UI Engine**: React 19.2.4 + TypeScript 5
- **Database & Auth**: Supabase PostgreSQL, Storage, Realtime, `@supabase/ssr` 0.12.0
- **Styling**: Tailwind CSS v4, PostCSS, Custom Vanilla CSS (`globals.css`)

### Production Dependencies (`package.json`)
| Package | Version | Purpose |
| :--- | :--- | :--- |
| `next` | `16.2.10` | Production React App Router framework |
| `react` & `react-dom` | `19.2.4` | Core UI library and DOM renderer |
| `@supabase/supabase-js` | `^2.110.1` | Supabase JavaScript client for DB, Auth, and Storage |
| `@supabase/ssr` | `^0.12.0` | Server-side authentication and session helpers |
| `ai` | `^7.0.26` | Vercel AI SDK Core for structured LLM interactions |
| `@ai-sdk/react` | `^4.0.27` | React UI hooks (`useChat`) for Bucky AI Assistant |
| `@openrouter/ai-sdk-provider` | `^3.0.0` | OpenRouter model provider for Vercel AI SDK |
| `framer-motion` | `^12.42.2` | Fluid UI animations, tilt effects, and modal transitions |
| `lucide-react` | `^1.23.0` | Modern UI icon set |
| `clsx` & `tailwind-merge` | `^2.1.1` / `^3.6.0` | Class string construction and Tailwind class deduplication |
| `papaparse` | `^5.5.4` | CSV parsing library for product catalog imports |
| `xlsx` | `^0.18.5` | Spreadsheet parser for production plan `.xlsx` uploads |
| `cheerio` | `^1.2.0` | Fast HTML parsing utility for product image scraping |
| `nodemailer` | `^9.0.3` | Email service integration for user invites and system alerts |
| `react-markdown` & `remark-gfm` | `^10.1.0` / `^4.0.1` | Markdown renderer with GitHub Flavored Markdown support |
| `zod` | `^4.4.3` | Schema validation library |

### Development Dependencies (`devDependencies`)
| Package | Version | Purpose |
| :--- | :--- | :--- |
| `typescript` | `^5` | Static type checking |
| `tsx` | `^4.23.0` | Executable TypeScript runner for database scripts |
| `@tailwindcss/postcss` & `tailwindcss` | `^4` | Utility-first CSS engine |
| `eslint` & `eslint-config-next` | `^9` / `16.2.10` | Code quality and linting |
| `pg` & `@types/pg` | `^8.22.0` | PostgreSQL client for administrative DB seed scripts |
| `puppeteer` | `^25.3.0` | Headless Chrome browser for image web scraping |

---

## 📁 Repository Directory Structure

```
BuckedUp-Dashboard-Lifewood/
├── MULTI_COMPANY_REARCHITECTURE_PLAN.md  # Multi-tenant migration blueprint
├── project_management_plan.md            # Detailed PM plan & role workflows
├── README.md                             # Repository overview & setup
└── buckedup_dashboard/                   # Next.js Application Root
    ├── app/                              # App Router pages & API routes
    │   ├── globals.css                   # Master design system & CSS variables
    │   ├── layout.tsx                    # Root layout
    │   ├── page.tsx                      # Main dashboard route (<Dashboard />)
    │   ├── login/                        # Glassmorphism login page
    │   └── api/                          # Server API endpoints
    │       ├── bucky/chat/               # Bucky AI chat endpoint (OpenRouter)
    │       └── super-admin/              # User creation & management routes
    │
    ├── components/                       # Atomic & Component Architecture
    │   ├── atoms/                        # Basic UI primitives
    │   ├── molecules/                    # Notification bell, search inputs
    │   ├── organisms/                    # Modals, charts, header, Bucky widget
    │   └── templates/                    # Full view layouts (Overview, Library, etc.)
    │
    ├── lib/                              # Business logic, state & API hooks
    │   ├── bucky/                        # Bucky AI prompt builders & tool definitions
    │   ├── supabase/                     # Supabase client & server instances
    │   ├── types.ts                      # Shared TypeScript interfaces
    │   ├── useAuth.ts                    # Auth state & session hook
    │   ├── useCatalog.ts                 # Product catalog state hook
    │   ├── useDailyProgress.ts           # Target tracking hook
    │   ├── useFeedback.ts                # Qualitative reactions hook
    │   ├── useIssues.ts                  # Production issue reporting hook
    │   └── useProductionPlan.ts          # Corporate plan data hook
    │
    ├── scripts/                          # DB schema & seeding utilities
    │   ├── apply-schema.ts               # Supabase schema migration script
    │   ├── seed-catalog.ts               # Catalog seeding script
    │   └── scrape-images.ts              # Catalog image web scraper
    │
    └── supabase/                         # Database Schemas & Migrations
        └── schema.sql                    # Production Postgres schema & RLS policies
```

---

## 🏛️ Multi-Company System Architecture & Migration Plan

The system includes a strategic blueprint to transition from a single-company instance to a **centralized Multi-Tenant AIGC Production Hub** managing multiple partnered brands (BuckedUp, Red Bull, Monster Energy, Celsius, NutraBio).

For complete technical scan findings, database schema refactoring blueprints, RLS security isolation guides, and developer handover documentation, see:
👉 **[`MULTI_COMPANY_REARCHITECTURE_PLAN.md`](./MULTI_COMPANY_REARCHITECTURE_PLAN.md)**

---

## 🚀 Getting Started

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **Package Manager**: `npm` (v9+) or `pnpm`
* **Supabase Instance**: Active Supabase project with PostgreSQL database & Auth enabled

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Lyduke56/BuckedUp-Dashboard-Lifewood.git
   cd BuckedUp-Dashboard-Lifewood/buckedup_dashboard
   ```

2. **Install project dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env.local` file inside the `buckedup_dashboard` directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   SUPABASE_ACCESS_TOKEN=your-management-access-token
   OPENROUTER_API_KEY=your-openrouter-api-key
   ```

4. **Initialize Database Schema** (if connecting to a fresh Supabase instance):
   Execute `supabase/schema.sql` inside your Supabase SQL Editor, or run:
   ```bash
   npm run db:apply-schema
   ```

5. **Start Development Server**:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Verification & Type Safety

Before committing changes, run static type checking:
```bash
npx tsc --noEmit
```

---

## 🔒 Security & License
Private and Confidential. Built for Lifewood & BuckedUp AIGC Production. All rights reserved.
