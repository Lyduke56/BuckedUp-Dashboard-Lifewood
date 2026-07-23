# BuckedUp Dashboard — Role-Based Workflow & Flowcharts

> **System**: BuckedUp AIGC Video Production Dashboard  
> **Roles**: Operator · Admin · Super-Admin  
> **Last Updated**: July 23, 2026

---

## System Overview

The dashboard is a **video production pipeline tracker** for BuckedUp's AIGC (AI-Generated Content) operation. It moves video requests through a **5-stage pipeline** (`Not Started` → `Design` → `Production` → `In Review` → `Published`), with pre-video document deliverables (`Storyboarding` and `Scripting`) tracked inside the `stage_deliverables` table during the `Design` stage, and video uploads tracked inside `video_versions` during the `Production` stage.

> [!IMPORTANT]
> **The database is the real security boundary** — not the UI. Every permission below is enforced by PostgreSQL Row-Level Security (RLS) policies and `enforce_product_update_permissions()` triggers in `schema.sql`. The UI hides controls a role cannot use, but the DB actually blocks unauthorized writes.
>
> **Strict QA Gate Stage Transitions**: Stage jumping is disabled across all roles (`canMoveStage={false}`). Admins and Super-Admins cannot manually force arbitrary stage moves in dropdowns or Kanban drag-and-drop. Products move stages **only** through the official QA approval process.

---

## Role Summary

| Role | Who | Core Purpose |
|------|-----|-------------|
| **Operator** | Production staff (videographers, editors, AI operators) | Execute work — claim/unclaim products, upload document/video deliverables per stage (`stage_deliverables` / `video_versions`), report issues, and submit for QA review |
| **Admin** | Lifewood leadership / production managers (formerly Lead) | Own the pipeline — create listings, prioritize (`High/Medium/Low`), review and advance stages via the **Approvals Inbox** (`ReviewsView`), conduct QA checks, and manage Operators |
| **Super-Admin** | Governance-only administrators (formerly Admin) | Manage user accounts (`profiles`), import corporate Excel production plans (`Planning`), view AI audit logs (`Bucky`), and enforce system security while sharing full operational QA/catalog parity with Admins |
| **Client** | BuckedUp stakeholders | View published videos, provide feedback via qualitative reactions, review completed work |

---

## Navigation by Role

| Tab | Operator | Admin | Super-Admin | Client |
|-----|----------|-------|-------------|--------|
| **Overview** | ✅ Read-only | ✅ Read-only | ✅ Read-only | ❌ Not visible |
| **Approvals (`reviews`)** | ❌ Not visible | ✅ Full review access (`ReviewsView` inbox) | ✅ Full review access | ❌ Not visible |
| **Catalog** | ✅ View only | ✅ Full manage (add/edit/delete catalog items, request videos) | ✅ Full manage | ❌ Not visible |
| **Video Library** | ✅ Submit deliverables for owned items | ✅ Full pipeline QA control | ✅ Full pipeline QA control | ✅ View published only |
| **Analytics** | ❌ Blocked (redirects to Overview) | ✅ View all charts (`DailyProgressChart`) | ✅ View all charts | ❌ Blocked |
| **Planning** | ❌ Not visible | ❌ Not visible | ✅ Super-Admin corporate target imports & plan config (`ProductionPlanView`) | ❌ Not visible |
| **Admin** | ❌ Not visible | ❌ Not visible | ✅ User governance (`ManageUsersView`) | ❌ Not visible |
| **Bucky** | ❌ Not visible | ❌ Not visible | ✅ AI audit log viewer (`BuckyConversationsView`) | ❌ Not visible |

---

## Pipeline Stages, Deliverables & Strict QA Gates

```
Not Started → Design → Production → In Review → Published
```

| Stage | Operator Action | Deliverable Type | Admin / Super-Admin Review Action & Gate Enforcement |
|-------|-----------------|------------------|----------------------------------------------------|
| **Not Started** | Claim product (`owner_id = auth.uid()`, moves to `Design`) | — | Admin assigns priority (`High/Medium/Low`) and owner. |
| **Design** | Submit Storyboard (`file`/`text`) and Script (`file`/`text`) via independent tabbed portals in `ProductionModal` | `stage_deliverables` rows | Admin/Super-Admin reviews in **Approvals Inbox** (`ReviewsView`) or `ProductReviewModal`. Calling `review_stage_deliverable(id, 'accepted', note)` evaluates both deliverables. When **BOTH Storyboard and Script are approved**, UI prompts confirmation and product **automatically promotes to `Production`**. |
| **Production** | Upload video revision (`video_versions`) with optional notes, then call `submit_video_for_review(product_id)`. Reactive UI enables review button instantly upon upload. | `video_versions` row + SQL RPC | Operator/Admin calls RPC; DB verifies ownership, verifies at least one video exists, and promotes product stage to `In Review`. |
| **In Review** | — (waiting on QA review) | — | Admin/Super-Admin reviews video in `ProductReviewModal`. Clicking **Accept & Publish** prompts confirmation and promotes to **`Published`** (`publish_date` recorded). Clicking **Reject to Production** prompts confirmation, sets rejection note, and returns stage to **`Production`**. |
| **Published** | — | — | Terminal completed state. Items with `deliveryType === "link"` enter directly as Published. |

> [!NOTE]
> **Stage Locking**: In `ProductFormModal`, the Stage field is disabled (`disabled={true}`) for all roles with the clear hint: *"Stage transitions are managed automatically via the QA Review process."* Drag-and-drop on `KanbanBoard` is set to `canMoveStage={false}` to prevent arbitrary stage skipping.

---

## 🟦 OPERATOR WORKFLOW

> **Operator = Production staff who execute the content work.**  
> They claim and are assigned products to work on, submit deliverables per stage, and flag issues. They never create catalog listings, never force arbitrary stage moves, and never review others' work.

### Access & Entry

```mermaid
flowchart TD
    A([Operator visits app]) --> B{Already logged in?}
    B -- No --> C["/login page - Email + Password"]
    C --> D{"First login? Invited by Super-Admin?"}
    D -- "Yes, must change password" --> E["ForcePasswordChangeView - Set new password"]
    E --> F[Dashboard loads]
    D -- No --> F
    B -- Yes --> F
    F --> G["Overview tab - default landing"]
    G --> H{Select navigation}
    H --> TAB1[Overview]
    H --> TAB2[Catalog]
    H --> TAB3[Video Library]
```

---

### Overview Tab (Read-Only)

```mermaid
flowchart TD
    A([Operator on Overview]) --> B["Views Project Progress Banner - Completion % · Pacing: On Track/At Risk/Late · Days to deadline"]
    B --> C["Views KPI Cards - Categories · Videos Planned · Published · In Progress · Not Started"]
    C --> D[Views Requests by Category - Horizontal bars per category]
    D --> E["Views Production Output Widget - Today's published count vs daily goal"]
    E --> F["Views Recent Deliveries - Latest 4 accepted/published items"]
    F --> G{Browse Library CTA?}
    G -- Yes --> H[Navigates to Video Library tab]
    G -- No --> I([Stays on Overview])

    style B fill:#1a2744,stroke:#4a6fa5,color:#e0e8ff
    style C fill:#1a2744,stroke:#4a6fa5,color:#e0e8ff
    style D fill:#1a2744,stroke:#4a6fa5,color:#e0e8ff
    style E fill:#1a2744,stroke:#4a6fa5,color:#e0e8ff
    style F fill:#1a2744,stroke:#4a6fa5,color:#e0e8ff
```

---

### Video Library Tab — Core Operator & Claim Flow

```mermaid
flowchart TD
    A([Operator on Video Library]) --> B["Filter defaults to My Items = checked - Shows assigned products"]
    B --> C{Product ownership status}
    C -- "Unassigned product in Not Started" --> D["Clicks Claim - moves product status: Not Started → Design, sets owner_id = auth.uid()"]
    C -- "Assigned product with no deliverables" --> E["Clicks Unclaim - resets product status → Not Started, owner_id = null"]
    C -- "Assigned product in Design or Production" --> F["Opens ProductionModal to submit deliverables"]

    F --> G{What stage is the item in?}
    G -- "Design Stage" --> H["Tabbed deliverable portals: Storyboarding tab & Scripting tab - Submit PDF/DOCX or Text independently without input state collision"]
    G -- "Production Stage" --> I["Upload video revisions to video_versions - Reactive upload state enables 'Submit for review' button immediately"]
    G -- "In Review Stage" --> J["Waiting on QA review - view submitted video version & note history"]
    G -- "Published Stage" --> K["Completed - view video player and publish timestamp"]
```

---

### Operator: What They CANNOT Do

```mermaid
flowchart LR
    subgraph BLOCKED_OP ["Actions Blocked for Operator - DB Enforced"]
        B1["Move product stage directly - DB trigger rejects status changes unless via submit_video_for_review RPC"]
        B2["Create new products or add product to pipeline"]
        B3["Edit catalog fields - name, category, owner, content angle"]
        B4["Delete products"]
        B5["Access Approvals tab - not rendered in TabBar for operator role"]
        B6["Access Analytics tab - route guard redirects to Overview"]
        B7["Submit deliverables for non-owned products - RLS blocks insert where owner_id does not match auth.uid"]
        B8["Change user roles"]
        B9["Create or edit production plan"]
        B10["Approve or reject deliverables - no Review buttons shown"]
        B11["Request videos from Catalog - Request from Catalog button hidden"]
    end
    style BLOCKED_OP fill:#3d1a1a,stroke:#dc3545
    style B1 fill:#3d1a1a,stroke:#dc3545,color:#ff8888
    style B2 fill:#3d1a1a,stroke:#dc3545,color:#ff8888
    style B3 fill:#3d1a1a,stroke:#dc3545,color:#ff8888
    style B4 fill:#3d1a1a,stroke:#dc3545,color:#ff8888
    style B5 fill:#3d1a1a,stroke:#dc3545,color:#ff8888
    style B6 fill:#3d1a1a,stroke:#dc3545,color:#ff8888
    style B7 fill:#3d1a1a,stroke:#dc3545,color:#ff8888
    style B8 fill:#3d1a1a,stroke:#dc3545,color:#ff8888
    style B9 fill:#3d1a1a,stroke:#dc3545,color:#ff8888
    style B10 fill:#3d1a1a,stroke:#dc3545,color:#ff8888
    style B11 fill:#3d1a1a,stroke:#dc3545,color:#ff8888
```

---

## 🟨 ADMIN WORKFLOW (formerly Lead)

> **Admin = The operational owner of the entire pipeline.**  
> Admins create video requests, assign priority (`High/Medium/Low`), configure targets, review all deliverables inside the **Approvals Inbox** (`ReviewsView`), and evaluate QA approvals to advance stages.

### Approvals Inbox Tab (`ReviewsView.tsx` — Core QA Center)

```mermaid
flowchart TD
    A([Admin on Approvals Inbox]) --> B["Views badge count: Approvals (N) in TabBar"]
    B --> C["Sub-navigation tabs: Pending (N) vs Reviewed (N)"]
    C --> D{Apply filters}
    D --> E[Search by product name]
    D --> F[Filter by Operator]
    D --> G["Filter by Stage: Design / In Review"]
    E & F & G --> H[Views actionable deliverables list]

    H --> I{Interact with deliverable}
    I -- "Click Pending item" --> J["Navigates to Video Library & opens ProductReviewModal / VideoModal for exact rank"]
    I -- "Click Reviewed item" --> K["Expands historical review record: reviewed at, decision, notes"]
    I -- "Bulk Selection in Reviewed tab" --> L["Select All / Deselect All / Clear Selected - persisted via localStorage"]
```

---

### Video Library — Admin: Reviewing Deliverables & Stage Progression (`ProductReviewModal`)

```mermaid
flowchart TD
    A(["Admin opens ProductReviewModal from Approvals Inbox or Video Library button"]) --> B{What stage is the product in?}

    B -- "Design Stage" --> C["Document review path - Shows submitted Storyboarding and/or Scripting deliverables"]
    C --> C1{Read the submission}
    C1 --> D1["Click Accept on deliverable"]
    C1 --> D2["Click Reject on deliverable - Requires feedback note"]
    D1 --> E1["Calls review_stage_deliverable(id, 'accepted', note). Green banner displays if BOTH Storyboard & Script are approved. Admin confirms prompt -> DB promotes stage: Design → Production!"]
    D2 --> E2["Calls review_stage_deliverable(id, 'rejected', note). Yellow banner displays; product stays in Design stage; Operator sees feedback and re-submits."]

    B -- "In Review Stage" --> F["Video review path - Shows current video_versions upload with player and notes"]
    F --> F1{Watch/review the video}
    F1 --> G1["Click Accept & Publish -> Prompts confirmation -> Updates products: review_status=Accepted, status=Published, publish_date recorded"]
    F1 --> G2["Click Reject to Production -> Requires rejection note -> Prompts confirmation -> Updates products: review_status=Rejected, status=Production - Operator notified"]

    style E1 fill:#1a2d1a,stroke:#28a745,color:#88ff88
    style G1 fill:#1a2d1a,stroke:#28a745,color:#88ff88
    style E2 fill:#3d1a1a,stroke:#dc3545,color:#ff8888
    style G2 fill:#3d1a1a,stroke:#dc3545,color:#ff8888
```

---

## 🟥 SUPER-ADMIN WORKFLOW (formerly Admin)

> **Super-Admin = Governance, Corporate Planning & Shared Operational Parity.**  
> Super-Admins share full operational parity with Admins across the day-to-day video production pipeline (`Video Library across all stages`, `Catalog management`, and `Approvals Inbox`). In addition, Super-Admins exclusively manage user accounts (`profiles`), import corporate Excel spreadsheets (`PlanningView`), and audit AI execution logs (`Bucky`).

### Planning Tab — Super-Admin Exclusive (`ProductionPlanView.tsx`)

```mermaid
flowchart TD
    A([Super-Admin clicks Planning tab]) --> B["ProductionPlanView renders - Corporate Production Plan Workspace"]
    B --> C["Section 1: Plan Core Config - Plan Name, Total Video Target, Start Date, Deadline, Notes"]
    C --> D["Primary Action Button: Create plan / Save plan changes (positioned above Today's targets)"]
    D --> E["Section 2: Today's Targets - Category & Language daily goals"]
    E --> F["Separate Action Button: Set Targets (positioned below target cards)"]
    F --> G["Updates production_plans table & upserts today's date into daily_target_history table"]
    G --> H["DailyProgressChart in AnalyticsView & Overview widgets update in real-time"]
```

---

## 🟩 CLIENT DASHBOARD WORKFLOW (`ClientVideoLibraryView.tsx`)

> **Client Dashboard = Dedicated Portal for Client Video Browsing, Download & Feedback.**  
> Clients view published marketing deliverables with dynamic filtering and a qualitative satisfaction reaction system.

```mermaid
flowchart TD
    A([Client accesses Dashboard]) --> B["ClientVideoLibraryView renders published videos"]
    B --> C{Filter & Search Options}
    C --> C1["Search bar - Product Catalog glass design with 22px pill border radius"]
    C --> C2["Dynamic Category & Subcategory dropdowns - derived from published videos"]
    C --> C3["Smart View Filters: All Videos · Unviewed (NEW badge) · Viewed Only · Feedback Provided · Recents (7 Days)"]

    B --> D[Click Video Card]
    D --> E["Registers video as Viewed in localStorage"]
    D --> F["Opens VideoModal with preview player & Feedback Section"]

    F --> G{Submit Feedback / Comment}
    G --> H["Select Qualitative Reaction: 🔥 Loved it · 👍 Good · 😐 Neutral · 👎 Needs Revision · ❌ Unsatisfied"]
    H --> I["Submits feedback -> Saved in feedback table (reaction column)"]
    I --> J["Displays reaction badge on comment bubble & aggregates reaction chips (🔥 2, 👍 1) on library cards"]
```

---

## Role Permission Matrix (Complete Reference)

| Action | Operator | Admin | Super-Admin | Client | DB / UI Enforcement |
|--------|----------|-------|-------------|--------|---------------------|
| **Login / sign out** | ✅ | ✅ | ✅ | ✅ | Supabase Auth |
| **View Overview** | ✅ | ✅ | ✅ | ❌ | — |
| **View Approvals Inbox (`reviews`)** | ❌ | ✅ | ✅ | ❌ | TabBar role check (`role === 'admin' || role === 'super-admin'`) |
| **Browse Catalog** | ✅ | ✅ | ✅ | ❌ | — |
| **Add/edit/delete catalog items** | ❌ | ✅ | ✅ | ❌ | `catalog_products` RLS & UI check |
| **Request video from catalog** | ❌ | ✅ | ✅ | ❌ | `products` insert RLS |
| **Claim / Unclaim product** | ✅ | ✅ | ✅ | ❌ | `enforce_product_update_permissions` trigger |
| **View Library — all stages** | ✅ | ✅ | ✅ | ❌ (published only) | Same video library for all roles |
| **Board (Kanban) layout** | ✅ (view only) | ✅ (view only) | ✅ (view only) | ❌ | Stage moves locked (`canMoveStage={false}`) |
| **Submit document deliverables** | ✅ | ✅ | ✅ | ❌ | `stage_deliverables` RLS |
| **Upload video version (`video_versions`)** | ✅ (own items) | ✅ | ✅ | ❌ | `video_versions` RLS |
| **Submit for review (`RPC`)** | ✅ (own items) | ✅ | ✅ | ❌ | `submit_video_for_review()` SQL validation |
| **Review stage deliverables (`RPC`)** | ❌ | ✅ | ✅ | ❌ | `review_stage_deliverable()` SQL check |
| **Accept both docs → auto-advance to Production** | ❌ | ✅ | ✅ | ❌ | Automated SQL trigger / function + confirmation prompt |
| **Accept video → publish** | ❌ | ✅ | ✅ | ❌ | `products` update RLS + confirmation prompt |
| **Reject video → back to Production** | ❌ | ✅ | ✅ | ❌ | `products` update RLS (`rejection_reason`) + confirmation prompt |
| **Arbitrary Stage Jump Dropdown / Override** | ❌ | ❌ | ❌ | ❌ | Stage field disabled (`disabled={true}`) for all roles |
| **Add / edit / delete product** | ❌ | ✅ | ✅ | ❌ | `enforce_product_update_permissions` trigger |
| **Set priority (`High/Medium/Low`)** | ❌ | ✅ | ✅ | ❌ | `products` update RLS |
| **Report / resolve issues** | ✅ | ✅ | ✅ | ❌ | `issues` RLS |
| **View Analytics charts** | ❌ (redirects) | ✅ | ✅ | ❌ | Route guard + UI check |
| **View Planning tab (Excel imports & targets)** | ❌ | ❌ | ✅ | ❌ | TabBar role check (`role === 'super-admin'`) & DB RLS |
| **Set daily category/language targets** | ❌ | ❌ | ✅ | ❌ | Writes to `production_plans` & `daily_target_history` |
| **View Admin tab (User governance)** | ❌ | ❌ | ✅ | ❌ | TabBar role check (`role === 'super-admin'`) |
| **View Bucky AI Audit Logs tab** | ❌ | ❌ | ✅ | ❌ | TabBar role check (`role === 'super-admin'`) |
| **Bucky AI Assistant (`BuckyWidget`)** | ✅ | ✅ | ✅ | ✅ | Contextual streaming chat (`move_product_stage` disabled) |
