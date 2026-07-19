# BuckedUp Dashboard — Role-Based Workflow & Flowcharts

> **System**: BuckedUp AIGC Video Production Dashboard  
> **Roles**: Operator · Lead · Admin  
> **Last Analyzed**: July 19, 2026

---

## System Overview

The dashboard is a **video production pipeline tracker** for BuckedUp's AIGC (AI-Generated Content) operation. It moves video requests through a **5-stage pipeline** (`Not Started` → `Design` → `Production` → `In Review` → `Published`), with pre-video document deliverables (`Storyboarding` and `Scripting`) tracked inside the `stage_deliverables` table during the `Design` stage, and video uploads tracked inside `video_versions` during the `Production` stage.

> [!IMPORTANT]
> **The database is the real security boundary** — not the UI. Every permission below is enforced by PostgreSQL Row-Level Security (RLS) policies and `enforce_product_update_permissions()` triggers in `schema.sql`. The UI hides controls a role cannot use, but the DB actually blocks unauthorized writes.

---

## Role Summary

| Role | Who | Core Purpose |
|------|-----|-------------|
| **Operator** | Production staff (videographers, editors, AI operators) | Execute work — claim products, upload document/video deliverables per stage (`stage_deliverables` / `video_versions`), report issues, and submit for QA review |
| **Lead** | Lifewood leadership / production managers | Own the pipeline — create listings, prioritize (`High/Medium/Low`), review and advance stages via the **Approvals Inbox** (`ReviewsView`), and manage Operators |
| **Admin** | Governance-only administrators | Manage user accounts (`profiles`), import corporate Excel production plans (`Planning`), view AI audit logs (`Bucky`), and enforce system security without participating in day-to-day video production |

---

## Navigation by Role

| Tab | Operator | Lead | Admin |
|-----|----------|------|-------|
| **Overview** | ✅ Read-only | ✅ Read-only | ✅ Read-only |
| **Approvals (`reviews`)** | ❌ Not visible | ✅ Full review access (`ReviewsView` inbox) | ✅ Full review access |
| **Catalog** | ✅ View only | ✅ Full manage (add/edit/delete catalog items, request videos) | ✅ View only |
| **Video Library** | ✅ Submit deliverables for own items | ✅ Full pipeline control | ✅ Published items only (read) |
| **Analytics** | ❌ Blocked (redirects to Overview) | ✅ View all charts (`DailyProgressChart`) | ✅ View all charts |
| **Planning** | ❌ Not visible | ❌ Not visible | ✅ Admin-only corporate target imports (`ProductionPlanView`) |
| **Admin** | ❌ Not visible | ❌ Not visible | ✅ User governance (`ManageUsersView`) |
| **Bucky** | ❌ Not visible | ❌ Not visible | ✅ AI audit log viewer (`BuckyConversationsView`) |

---

## Pipeline Stages & Deliverables

```
Not Started → Design → Production → In Review → Published
```

| Stage | Operator Action | Deliverable Type | Lead Review Action |
|-------|-----------------|------------------|-------------------|
| **Not Started** | — | — | Lead assigns priority (`High/Medium/Low`), assigns owner, moves to `Design` |
| **Design** | Submit Storyboard (`file`/`text`) and Script (`file`/`text`) | `stage_deliverables` rows | Lead reviews in **Approvals Inbox** (`ReviewsView`) or Video Library modal. Calling `review_stage_deliverable(id, 'accepted', note)` checks if BOTH Storyboard and Script are accepted. If both pass, product **automatically promotes to `Production`** |
| **Production** | Upload video revision (`video_versions`) with optional notes, then call `submit_video_for_review(product_id)` | `video_versions` row + SQL RPC | Operator calls RPC; DB verifies ownership, verifies at least one video exists, and promotes to `In Review` |
| **In Review** | — (waiting on Lead QA) | — | Lead reviews in **Approvals Inbox** (`ReviewsView`) or Review Modal. Accept promotes to **`Published`**; Reject returns to `Production` (`rejection_reason` saved) |
| **Published** | — | — | Terminal completed state (`publish_date` recorded). Items with `deliveryType === "link"` enter directly as Published |

---

## 🟦 OPERATOR WORKFLOW

> **Operator = Production staff who execute the content work.**  
> They claim and are assigned products to work on, submit deliverables per stage, and flag issues. They never create listings, never move stages themselves, and never review others' work.

### Access & Entry

```mermaid
flowchart TD
    A([Operator visits app]) --> B{Already logged in?}
    B -- No --> C["/login page - Email + Password"]
    C --> D{"First login? Invited by Admin?"}
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

> [!NOTE]
> Operator sees the same Overview as Lead and Admin — it's entirely read-only. Operators cannot access `Analytics`, `Approvals`, or `Planning`.

---

### Catalog Tab (View Only)

```mermaid
flowchart TD
    A([Operator on Catalog]) --> B["Browses BuckedUp product catalog - All supplements, drinks, apparel and gear"]
    B --> C{Apply filters}
    C --> D[Search by name / variant]
    C --> E[Filter by Category / Subcategory]
    C --> F["Filter by AIGC Status - none / in-progress / published"]
    C --> G["Filter by Flag - Bestseller / New / Clearance"]
    C --> H["Filter by Availability - active / inactive / all"]
    D & E & F & G & H --> I[Views filtered product grid or list]
    I --> J{Open product detail?}
    J -- Yes --> K["Detail panel: name, category, variants, price, AIGC badge"]
    K --> L{Linked video production item?}
    L -- Yes --> M[Sees link to Video Library item]
    L -- No --> N["Sees 'No Video' badge"]
    J -- No --> O([Continue browsing])

    style B fill:#1a2744,stroke:#4a6fa5,color:#e0e8ff

    subgraph BLOCKED_OP_CAT ["Actions blocked for Operator in Catalog"]
        BL1["Cannot: Add catalog item"]
        BL2["Cannot: Edit catalog item"]
        BL3["Cannot: Delete catalog item"]
        BL4["Cannot: Request video from catalog"]
    end

    style BLOCKED_OP_CAT fill:#3d1a1a,stroke:#dc3545
    style BL1 fill:#3d1a1a,stroke:#dc3545,color:#ff8888
    style BL2 fill:#3d1a1a,stroke:#dc3545,color:#ff8888
    style BL3 fill:#3d1a1a,stroke:#dc3545,color:#ff8888
    style BL4 fill:#3d1a1a,stroke:#dc3545,color:#ff8888
```

---

### Video Library Tab — Core Operator Flow

```mermaid
flowchart TD
    A([Operator on Video Library]) --> B["Filter defaults to My Items = checked - Shows only assigned products"]
    B --> C{Apply additional filters}
    C --> D[Category / Subcategory dropdowns]
    C --> E[Priority filter pills: High / Medium / Low]
    C --> F["Stage filter pills: Not Started / Design / Production / In Review / Published"]
    C --> G[Search by product name]
    D & E & F & G --> H[Filtered view updates live via Supabase Realtime]

    H --> I{Choose layout}
    I --> I1["Table view - list rows with stage badges"]
    I --> I2["Grid view - category folders to thumbnail grid"]
    I --> I3["Board view - Kanban across 5 columns: Not Started · Design · Production · In Review · Published"]

    I1 & I2 & I3 --> J{Interact with item}
    J -- "Click card/row" --> K["Opens ProductionModal / VideoModal"]
    J -- "Expand row table only" --> L["Views row details: Owner, Priority tag, Content Angle, Stage History, Issues"]

    K --> M{What stage is the item in?}
    M -- "Design Stage" --> N["Submit Storyboarding & Scripting deliverables - upload PDF/DOCX or text notes - stage_deliverables inserted as pending"]
    M -- "Production Stage" --> O["Upload video file revisions to video_versions - attach optional note - once ready click Submit for review RPC"]
    M -- "In Review Stage" --> P["Waiting on Lead QA - view current submitted video version and history"]
    M -- "Published Stage" --> Q["Completed - view live video player and publish date"]
```

---

### Operator: Issue Tracking

```mermaid
flowchart TD
    A([Operator on any product row]) --> B["Clicks flag icon button - Opens expanded row detail"]
    B --> C[Sees Issues panel]
    C --> D{Any open issues?}
    D -- Yes --> E[Red badge on flag button shows count]
    D -- No --> F[Empty issues state]
    E & F --> G{Action?}
    G -- "Report issue" --> H["Selects severity: low / medium / high"]
    H --> I[Types description]
    I --> J["Submits - inserts into issues table - Product owner gets notification"]
    G -- "Resolve issue" --> K{Operator is authenticated?}
    K -- Yes --> L["Clicks Resolve on open issue - Updates status = resolved"]
    K -- No --> BLK2["Not authenticated - cannot resolve"]
    G -- "View history" --> M["Stage History Log - Chronological timeline of all stage transitions with timestamps"]

    style BLK2 fill:#3d1a1a,stroke:#dc3545,color:#ff8888
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

### Notifications — Operator

```mermaid
flowchart TD
    A(["Operator - Bell icon in header"]) --> B{Unread notifications?}
    B -- Yes --> C[Red badge with unread count]
    C --> D["Clicks bell - Dropdown opens"]
    D --> E{Notification type}
    E -- assigned --> F["You were assigned to a product - Lead changed the owner_id to this Operator"]
    E -- rejected --> G["A product was rejected - Lead rejected a deliverable with a note"]
    E -- issue_reported --> H["Issue reported on a product - Someone flagged a problem on an item you own"]
    E -- bucky_stale_item --> I["Stale alert - Item in your queue inactive >5 days"]
    F & G & H & I --> J["Click notification - navigate to product in Library"]
    J --> K["Clicks Mark all read or individual dismiss"]
    B -- No --> L[Bell shows no badge]
```

---

## 🟨 LEAD WORKFLOW

> **Lead = The operational owner of the entire pipeline.**  
> Leads create video requests, assign priority (`High/Medium/Low`), configure targets, review all deliverables inside the **Approvals Inbox** (`ReviewsView`), and are the only ones who can advance a product past QA gates or drag items across stages.

### Access & Entry

```mermaid
flowchart TD
    A([Lead visits app]) --> B{Already logged in?}
    B -- No --> C["/login page - Email + Password"]
    C --> D{First login?}
    D -- Yes --> E[ForcePasswordChangeView]
    E --> F[Dashboard loads]
    D -- No --> F
    B -- Yes --> F
    F --> G["Overview tab - default landing"]
    G --> H{Select navigation}
    H --> TAB1[Overview]
    H --> TAB2["Approvals Inbox (Reviews) - Lead/Admin QA center"]
    H --> TAB3[Catalog]
    H --> TAB4[Video Library]
    H --> TAB5[Analytics]
```

---

### Approvals Inbox Tab (`ReviewsView.tsx` — Core QA Center)

```mermaid
flowchart TD
    A([Lead on Approvals Inbox]) --> B["Views badge count: Approvals (N) in TabBar"]
    B --> C["Sub-navigation tabs: Pending (N) vs Reviewed (N)"]
    C --> D{Apply filters}
    D --> E[Search by product name]
    D --> F[Filter by Operator]
    D --> G["Filter by Stage: Design / In Review"]
    E & F & G --> H[Views actionable deliverables list]

    H --> I{Interact with deliverable}
    I -- "Click Pending item" --> J["Automatically navigates to Video Library and opens ProductReviewModal / VideoModal for exact rank"]
    I -- "Click Reviewed item" --> K["Expands historical review record: reviewed at, decision, notes"]
    I -- "Bulk Selection in Reviewed tab" --> L["Select All / Deselect All / Clear Selected - purges from local view"]
```

---

### Catalog Tab — Lead (Full Management)

```mermaid
flowchart TD
    A([Lead on Catalog]) --> B["Browses full BuckedUp product catalog with AIGC status badges on every item"]
    B --> C{Apply filters}
    C --> D[Search by name / variant]
    C --> E[Category / Subcategory]
    C --> F["AIGC Status: none / in-progress / published"]
    C --> G["Flag: Bestseller / New / Clearance"]
    C --> H["Availability: active / inactive / all"]
    D & E & F & G & H --> I[Views filtered catalog]

    I --> J{What to do?}

    J -- "Add new catalog item" --> K["Clicks Add product - Opens CatalogProductFormModal in Add mode"]
    K --> K1["Fills: Name, Category, Subcategory, Variants, Price, Flag, Product URL, Thumbnail URL, Active toggle"]
    K1 --> K2["Saves - inserts into catalog_products table"]

    J -- "Edit catalog item" --> L["Clicks edit on product card - Opens CatalogProductFormModal in Edit mode"]
    L --> L1[Modifies any catalog field]
    L1 --> L2["Saves - updates catalog_products row"]

    J -- "Delete catalog item" --> M["Clicks delete - confirmation dialog: This cannot be undone"]
    M --> M1{Confirmed?}
    M1 -- Yes --> M2[Deletes from catalog_products]
    M1 -- No --> M3["Dismissed - no change"]

    J -- "Request video for product" --> N["Clicks Request from Catalog button - Opens RequestVideoModal"]
    N --> N1{"Product pre-selected or choose inside modal?"}
    N1 -- "Choose in modal" --> N2["Search/filter catalog inside modal - Select a product"]
    N1 -- "Already selected" --> N3[Product details shown]
    N2 & N3 --> N4["Fills: Language, Content Type, Content Angle, Priority (High/Medium/Low), Owner assignment, Rank"]
    N4 --> N5["Saves - inserts into products table - Linked via catalog_product_id FK - Starts at Not Started stage"]
```

---

### Video Library Tab — Lead: Full Pipeline Control

```mermaid
flowchart TD
    A([Lead on Video Library]) --> B["Sees ALL products at ALL stages - No ownership restriction"]
    B --> C{Apply filters}
    C --> D[Category / Subcategory]
    C --> E[Priority filter pills: High / Medium / Low]
    C --> F[Stage filter pills]
    C --> G[Rejected filter]
    C --> H[Search]
    D & E & F & G & H --> I[Filtered view updates live via Realtime]

    I --> J{Choose layout}
    J --> J1["Table view - list with inline stage dropdowns and priority badges"]
    J --> J2["Grid view - category folders to thumbnail grid"]
    J --> J3["Board view - Kanban drag-and-drop across all 5 columns: Not Started · Design · Production · In Review · Published"]
```

---

### Video Library — Lead: Reviewing Deliverables (`ProductReviewModal`)

```mermaid
flowchart TD
    A(["Lead opens ProductReviewModal from Approvals Inbox or Video Library button"]) --> B{What stage is the product in?}

    B -- "Design Stage" --> C["Document review path - Shows submitted Storyboarding and/or Scripting deliverables"]
    C --> C1{Read the submission}
    C1 --> D1["Click Accept on deliverable"]
    C1 --> D2["Click Reject on deliverable - Requires feedback note"]
    D1 --> E1["Calls review_stage_deliverable(id, 'accepted', note). If BOTH Storyboarding and Scripting are accepted, DB automatically promotes status from Design → Production!"]
    D2 --> E2["Calls review_stage_deliverable(id, 'rejected', note). Product stays at Design stage; Operator sees feedback and re-submits."]

    B -- "In Review Stage" --> F["Video review path - Shows current video_versions upload with player and notes"]
    F --> F1{Watch/review the video}
    F1 --> G1["Click Accept & Publish - Updates products: review_status=Accepted, status=Published, publish_date recorded"]
    F1 --> G2["Click Reject to Production - Requires rejection note - Updates products: review_status=Rejected, status=Production - Operator notified"]

    style E1 fill:#1a2d1a,stroke:#28a745,color:#88ff88
    style G1 fill:#1a2d1a,stroke:#28a745,color:#88ff88
    style E2 fill:#3d1a1a,stroke:#dc3545,color:#ff8888
    style G2 fill:#3d1a1a,stroke:#dc3545,color:#ff8888
```

---

### Lead: What They CANNOT Do

```mermaid
flowchart LR
    subgraph BLOCKED_LEAD ["Actions Blocked for Lead - DB and UI Enforced"]
        B1["Access Planning tab - Admin-only corporate Excel target import"]
        B2["Access Admin tab - User governance tab is Admin-only"]
        B3["Create/invite/delete user accounts - Admin-only API route /api/admin/create-user"]
        B4["Change user roles - profiles_enforce_role_change trigger blocks non-admin writes"]
        B5["View Bucky AI Audit Logs tab - Admin-only"]
    end
    style BLOCKED_LEAD fill:#3d1a1a,stroke:#dc3545
    style B1 fill:#3d1a1a,stroke:#dc3545,color:#ff8888
    style B2 fill:#3d1a1a,stroke:#dc3545,color:#ff8888
    style B3 fill:#3d1a1a,stroke:#dc3545,color:#ff8888
    style B4 fill:#3d1a1a,stroke:#dc3545,color:#ff8888
    style B5 fill:#3d1a1a,stroke:#dc3545,color:#ff8888
```

---

## 🟥 ADMIN WORKFLOW

> **Admin = Governance & Corporate Planning.**  
> Admins manage user accounts (`profiles`), import corporate Excel spreadsheets (`PlanningView`), and audit AI execution logs (`Bucky`). They have **no write access to the day-to-day video production pipeline**. In the Video Library, they only see Published items.

### Access & Entry

```mermaid
flowchart TD
    A([Admin visits app]) --> B{Already logged in?}
    B -- No --> C["/login page - Email + Password"]
    C --> D[Authenticates via Supabase Auth]
    D --> E{First account ever created?}
    E -- "Yes, first ever signup" --> F["Auto-provisioned as Admin - on_auth_user_created trigger sets role=admin"]
    E -- "No, invited by admin" --> G["ForcePasswordChangeView - set password"]
    F & G --> H[Dashboard loads]
    B -- Yes --> H
    H --> I["Overview tab - default landing"]
    I --> J{Select navigation}
    J --> TAB1[Overview]
    J --> TAB2["Approvals Inbox (Reviews) - QA visibility"]
    J --> TAB3["Catalog - view only"]
    J --> TAB4["Video Library - Published only"]
    J --> TAB5[Analytics]
    J --> TAB6["Planning - Admin exclusive Excel target imports"]
    J --> TAB7["Admin - exclusive User Governance"]
    J --> TAB8["Bucky - exclusive AI Audit Log viewer"]
```

---

### Planning Tab — Admin Exclusive (`PlanningView.tsx`)

```mermaid
flowchart TD
    A([Admin clicks Planning tab]) --> B["PlanningView renders - Corporate Production Plan Workspace"]
    B --> C{Action?}
    C -- "Import Excel Plan" --> D["Select and upload corporate spreadsheet e.g. Test Production Plan July 2026.xlsx"]
    D --> E["Parser reads Daily Targets and Target Accumulative across dates"]
    E --> F["Upserts into production_plans table - Active targets immediately power DailyProgressChart inside AnalyticsView"]
    C -- "View / Edit Plan Details" --> G["Inline modification of Total Target, Start Date, and Deadline"]
```

---

### Admin Tab — User Governance (Admin Exclusive)

```mermaid
flowchart TD
    A([Admin clicks Admin tab]) --> B["ManageUsersView renders - PageHeader: GOVERNANCE"]
    B --> C["Section 1: Create user - enter email, select role (Operator / Lead / Admin), send invite via POST /api/admin/create-user"]
    C --> D["Section 2: Existing users table - list all profiles, change role via PATCH, delete account via DELETE /api/admin/users/:id"]
```

---

### Bucky Tab — AI Audit Logs (Admin Exclusive)

```mermaid
flowchart TD
    A([Admin clicks Bucky tab]) --> B["BuckyConversationsView renders - Organization-wide AI Ledger"]
    B --> C["Audit trail of all Bucky tool executions across users: create_product, change_status, delete_product, and restore_deleted_product"]
```

---

## Complete Pipeline Lifecycle — All Roles Together

```mermaid
flowchart TD
    START(["Lead requests video from Catalog with Priority tag: High / Medium / Low"]) --> LEAD_CREATE

    subgraph LEAD ["Lead Actions"]
        LEAD_CREATE["Product row created at Not Started stage"]
        LEAD_KICKOFF["Lead moves product from Not Started to Design - Operator receives assignment notification"]
        LEAD_REVIEW_DOC["Lead opens Approvals Inbox or ProductReviewModal - reviews submitted Storyboard & Script deliverables"]
        LEAD_ACCEPT_DOC["Accept - when BOTH Storyboard & Script are accepted, DB auto-advances status to Production!"]
        LEAD_REJECT_DOC["Reject deliverable - note recorded - product stays in Design stage for revision"]
        LEAD_REVIEW_VID["Lead reviews submitted video revision in In Review stage"]
        LEAD_ACCEPT_VID["Accept & Publish - products.status=Published, publish_date saved"]
        LEAD_REJECT_VID["Reject to Production - rejection_reason saved - Operator notified"]
    end

    subgraph OPERATOR ["Operator Actions"]
        OP_SUBMIT_DOC["Operator submits Storyboarding & Scripting deliverables during Design stage"]
        OP_RESUBMIT_DOC["Operator re-submits after rejection based on Lead notes"]
        OP_UPLOAD_VID["Operator uploads video revision to video_versions during Production stage"]
        OP_SUBMIT_REVIEW["Operator clicks Submit for review RPC - DB verifies video exists - status becomes In Review"]
        OP_REVISE_VID["Operator uploads revised video version after rejection and re-submits"]
    end

    subgraph ADMIN ["Admin Actions"]
        ADMIN_PLAN["Admin imports Excel target plan in Planning tab to set daily velocity goals"]
        ADMIN_VIEW["Admin views Published videos in Library and checks Bucky AI audit logs"]
    end

    LEAD_CREATE --> LEAD_KICKOFF
    LEAD_KICKOFF --> OP_SUBMIT_DOC
    OP_SUBMIT_DOC --> LEAD_REVIEW_DOC
    LEAD_REVIEW_DOC --> LEAD_ACCEPT_DOC
    LEAD_REVIEW_DOC --> LEAD_REJECT_DOC
    LEAD_REJECT_DOC --> OP_RESUBMIT_DOC
    OP_RESUBMIT_DOC --> LEAD_REVIEW_DOC
    LEAD_ACCEPT_DOC --> OP_UPLOAD_VID
    OP_UPLOAD_VID --> OP_SUBMIT_REVIEW
    OP_SUBMIT_REVIEW --> LEAD_REVIEW_VID
    LEAD_REVIEW_VID --> LEAD_ACCEPT_VID
    LEAD_REVIEW_VID --> LEAD_REJECT_VID
    LEAD_REJECT_VID --> OP_REVISE_VID
    OP_REVISE_VID --> OP_SUBMIT_REVIEW
    LEAD_ACCEPT_VID --> PUBLISHED(["Video Published"])
    PUBLISHED --> ADMIN_VIEW

    style PUBLISHED fill:#1a2d1a,stroke:#28a745,color:#88ff88
```

---

## Role Permission Matrix (Complete Reference)

| Action | Operator | Lead | Admin | DB / UI Enforcement |
|--------|----------|------|-------|---------------------|
| **Login / sign out** | ✅ | ✅ | ✅ | Supabase Auth |
| **View Overview** | ✅ | ✅ | ✅ | — |
| **View Approvals Inbox (`reviews`)** | ❌ | ✅ | ✅ | TabBar role check (`role === 'lead' || role === 'admin'`) |
| **Browse Catalog** | ✅ | ✅ | ✅ | — |
| **Add/edit/delete catalog items** | ❌ | ✅ | ❌ | `catalog_products` RLS & UI check |
| **Request video from catalog** | ❌ | ✅ | ❌ | `products` insert RLS |
| **View Library — all stages** | ✅ | ✅ | ❌ (Published only) | UI filter (`isAdmin && status !== 'Published'`) |
| **Board (Kanban) layout** | ✅ (view only) | ✅ + drag | ❌ | UI (`canMoveStage = isLead`) |
| **Submit document deliverables** | ✅ | ❌ | ❌ | `stage_deliverables` RLS |
| **Upload video version (`video_versions`)** | ✅ (own items) | ✅ | ❌ | `video_versions` RLS |
| **Submit for review (`RPC`)** | ✅ (own items) | ❌ | ❌ | `submit_video_for_review()` SQL validation |
| **Review stage deliverables (`RPC`)** | ❌ | ✅ | ❌ | `review_stage_deliverable()` SQL check |
| **Accept both docs → auto-advance to Production** | ❌ | ✅ | ❌ | Automated SQL trigger / function |
| **Accept video → publish** | ❌ | ✅ | ❌ | `products` update RLS |
| **Reject video → back to Production** | ❌ | ✅ | ❌ | `products` update RLS (`rejection_reason`) |
| **Add / edit / delete product** | ❌ | ✅ | ❌ | `enforce_product_update_permissions` trigger |
| **Set priority (`High/Medium/Low`)** | ❌ | ✅ | ❌ | `products` update RLS |
| **Report / resolve issues** | ✅ | ✅ | ✅ (Published only) | `issues` RLS |
| **View Analytics charts** | ❌ (redirects) | ✅ | ✅ | Route guard + UI check |
| **View Planning tab (Excel imports)** | ❌ | ❌ | ✅ | TabBar role check (`role === 'admin'`) |
| **View Admin tab (User governance)** | ❌ | ❌ | ✅ | TabBar role check (`role === 'admin'`) |
| **View Bucky AI Audit Logs tab** | ❌ | ❌ | ✅ | TabBar role check (`role === 'admin'`) |
| **Bucky AI Assistant (`BuckyWidget`)** | ✅ | ✅ | ✅ | Contextual streaming chat |
