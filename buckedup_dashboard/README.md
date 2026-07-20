# BuckedUp Dashboard (Lifewood)

A comprehensive video production and pipeline management dashboard built with **Next.js**, **React**, and **Supabase**. This platform is designed to streamline the workflow between administrators, team leads, and operators in tracking, reviewing, and delivering video content.

## Features

- **Role-Based Access Control (RBAC)**: Secure access tailoring the experience for Admins, Leads, and Operators via Supabase Row Level Security (RLS).
  - *Admins*: Full system access, team management, pipeline planning, and role configuration.
  - *Leads*: Oversee production, manage reviews, assign stages, and track team analytics.
  - *Operators*: Focus on active video deliverables, editing, and uploading to the pipeline.
- **Video Pipeline Tracking**: Track products through multiple stages (Storyboarding, Scripting, Design, and Editing) with detailed delivery types and statuses.
- **Integrated AI Assistant (Bucky)**: Features an intelligent assistant (powered by OpenRouter) with conversational capabilities and proactive alerts to assist with planning and data queries.
- **Theme Persistence**: Built-in support for synchronized Light and Dark modes customized and saved per user.
- **Rich Analytics & Planning**: Custom views for analyzing output, daily targets, and overarching production goals.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React, TypeScript, Vanilla CSS
- **Backend & Auth**: Supabase (PostgreSQL, Edge Functions, Authentication, Storage)
- **AI Integrations**: OpenRouter API for Bucky AI Assistant

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm or pnpm
- A Supabase project

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Lyduke56/BuckedUp-Dashboard-Lifewood.git
   cd BuckedUp-Dashboard-Lifewood/buckedup_dashboard
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables. Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   SUPABASE_ACCESS_TOKEN=your_management_token
   OPENROUTER_API_KEY=your_openrouter_api_key
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Database & Migrations

The project utilizes Supabase Management API via custom one-off scripts to securely apply schema changes and handle Row Level Security without exposing DDL operations to the client.
You can find these administrative scripts in the `/scripts` directory.

To apply local scripts using your access token:
```bash
npx tsx --env-file=.env.local scripts/your-script.ts
```

## Contributing
- Create a feature branch off `main`
- Run local builds and ensure no strict TypeScript errors occur
- Submit a pull request for review

## License
Private and Confidential. All rights reserved.
