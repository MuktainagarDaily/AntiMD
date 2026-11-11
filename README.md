# Muktainagar Daily (मुक्ताईनगर डेली)

> A bilingual (English + Marathi), mobile-first hyperlocal civic, business, and living directory platform for Muktainagar, Bhusawal, Bodwad, Varangaon, Jalgaon, Pune, Maval, and surrounding clusters in Maharashtra.

Find local businesses, mess and dining halls, student & worker PG hostels, schools & colleges, municipal authorities & emergency services, and bus schedules with contact details, opening hours, WhatsApp chat, customer reviews, and GPS directions.

---

## Tech Stack

- **Frontend:** React 18, Vite 5.4, TypeScript 5.8, React Router v6
- **UI & Components:** Tailwind CSS, shadcn/ui (Radix Primitives), Lucide Icons
- **State & Caching:** TanStack React Query v5 (2m staleTime, localStorage sync persister)
- **Database & Auth:** External Supabase PostgreSQL with Row Level Security (RLS) & PostgREST Table Grants
- **Multi-Location Engine:** Path-scoped routing (`/:citySlug/...`), dynamic town branding, and 5-tier geographic hierarchy (`geo_countries` down to `geo_villages`)
- **Civic & Living Verticals:** Dedicated Mess & Dining directories (daily menus), PG & Student Hostels (live vacancies), and Essential Services & Local Authorities (outage broadcasts & emergency helplines)
- **Rich Media:** Multi-image uploads with interactive canvas crop and modern WebP compression
- **Community:** 5-star customer reviews and ratings with unique constraints and helpfulness votes
- **Offline / PWA:** Vite PWA + Workbox Service Worker caching
- **AI Agent Surface:** Model Context Protocol (MCP) server over OAuth 2.0
- **Hosting / Edge CDN:** Vercel (Primary) & Lovable Cloud
- **Footer Attribution:** Global footer powered by [Vibe Forge](https://vibe-forge.in/)

---

## Local Development

### Requirements
- **Node.js** (v18+ or v20+) and **npm** / **pnpm**, or **Bun**.

### Getting Started

```bash
# 1. Clone repository
git clone <YOUR_GIT_URL>
cd muktainagar-daily-main

# 2. Install dependencies
npm install

# 3. Start local development server (port 8080)
npm run dev

# 4. Run tests
npm test

# 5. Build for production (includes sitemap + SEO prerender pass)
npm run build

# 6. Preview the production build locally
npm run preview
```

---

## Deploying to Vercel

Muktainagar Daily is fully configured for deployment on [Vercel](https://vercel.com) via `vercel.json`.

### 1. One-Click / Git Deployment
1. Push this repository to GitHub, GitLab, or Bitbucket.
2. In the Vercel dashboard, click **Add New $\to$ Project** and import the repository.
3. Framework Preset: **Vite** (auto-detected).
4. Build Command: `npm run build` (auto-detected).
5. Output Directory: `dist` (auto-detected).

### 2. Environment Variables
Configure these in **Vercel Project Settings $\to$ Environment Variables**:

| Variable | Description | Example |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase Project URL | `https://fhlaqgzensagjangkpop.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase Anon Key | `eyJhbGciOiJIUzI1Ni...` |
| `VITE_SUPABASE_PROJECT_ID` | Supabase Project ID | `fhlaqgzensagjangkpop` |
| `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` | Google Maps API Key | `AIzaSy...` |
| `VITE_SITE_URL` | Canonical Site URL | `https://muktainagardaily.com` |

*(Note: Fallback credentials are built into the source, ensuring test builds succeed even before environment variables are configured).*

### 3. Supabase Auth Configuration
In your **Supabase Dashboard $\to$ Authentication $\to$ URL Configuration**, add your Vercel deployment URL (e.g. `https://<your-project>.vercel.app/**`) and your custom domain to **Redirect URLs**.

For detailed migration steps, custom domain setup, and caching details, see the complete [Vercel Migration Plan](docs/VERCEL_MIGRATION_PLAN.md).

---

## Documentation Index

- [Vercel Migration Plan](docs/VERCEL_MIGRATION_PLAN.md) — Comprehensive production runbook & deployment guide.
- [Project Bible](docs/PROJECT_BIBLE.md) — Mission, user roles, business model, and high-level architecture.
- [Architecture](docs/ARCHITECTURE.md) — Technical stack, routing table, state management, and security model.
- [Multi-Location Architecture](docs/MULTI_LOCATION_ARCHITECTURE.md) — 5-tier geographic hierarchy and path-scoped routing.
- [Database Reference](docs/DATABASE_REFERENCE.md) — Authoritative catalog of all 26 tables, views, triggers, and RPCs.
- [Features](docs/FEATURES.md) — Detailed specifications of all visitor, owner, community, and admin capabilities.
- [Component Catalog](docs/COMPONENT_CATALOG.md) — Reusable UI, forms, reviews, admin layouts, and navigation components.
- [Admin System](docs/ADMIN_SYSTEM.md) — Modular Hub & Leaf administrative console and moderation pipeline.
- [Workflows](docs/WORKFLOWS.md) — End-to-end user and admin step-by-step sequence flows.
- [API Reference](docs/API_REFERENCE.md) — RPCs, PostgREST tables, 4-bucket storage layout, and MCP tools.
- [Technical Debt](docs/TECHNICAL_DEBT.md) — Resolved items, refactoring opportunities, and risk register.
- [Sentinel Context](docs/SENTINEL_CONTEXT.md) — Critical workflows and deletion-protected systems.
- [AI Changelog](docs/CHANGELOG_AI.md) — Complete audit trail of project changes.
