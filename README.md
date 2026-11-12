# Muktainagar Daily (मुक्ताईनगर डेली)

> A bilingual (English + Marathi), mobile-first hyperlocal civic, business, education, news, and living directory platform (**ApnaLocal** / `<Town> Daily`) for Muktainagar, Bhusawal, Bodwad, Varangaon, Jalgaon, Pune/Maval (Parandwadi), and surrounding clusters in Maharashtra.

Find local businesses, mess and dining halls, student & worker PG hostels, schools & colleges (with live admission notices & fee structures), local town news, municipal authorities & emergency services, bus schedules, and ask **Sahayak AI** — with contact details, opening hours, WhatsApp chat, community reviews, and GPS directions.

---

## Tech Stack

- **Frontend:** React 18, Vite 5.4, TypeScript 5.8, React Router v6 (`ApnaLocal` metadata)
- **UI & Components:** Tailwind CSS, shadcn/ui (Radix Primitives), Lucide Icons
- **State & Caching:** TanStack React Query v5 (2m staleTime, localStorage sync persister)
- **Database, Auth & Edge:** External Supabase PostgreSQL (RLS + PostgREST + Storage + Realtime) and 3 Deno Edge Functions (`mcp`, `town-assistant`, `scrape-local-news`)
- **Multi-Location Engine:** Path-scoped routing (`/:citySlug/...`), dynamic town branding (`<Town> Daily`), and 5-tier geographic hierarchy (`geo_countries` down to `geo_villages`)
- **Civic, Education & Living Verticals:** Dedicated **Mess & Dining** (`/:citySlug/mess`, `/mess/:id`), **PG & Student Hostels** (`/:citySlug/pg`, `/pg/:id`), **Education & Institutes** (`/:citySlug/schools`, `/schools/:id` with admission notices, claims & `SchoolOwnerHub`), **Local News** (`/:citySlug/news` with RSS/web scraper), **Essential Services & Local Authorities** (`/:citySlug/services`), and **Bus Timetable** (`/:citySlug/bus-timetable`)
- **Sahayak AI Assistant:** Bilingual (EN / MR / Hinglish) conversational & voice-enabled town assistant across all 7 platform verticals (with 20s idle nudge pill + AI Marathi translation mode) powered by Gemini Gateway + deterministic local fallback
- **Rich Media, OpenStreetMap & Owner Hubs:** Zero-config Leaflet/OpenStreetMap `LocationMapPicker` (optional Google Maps fallback), multi-image WebP uploads with canvas cropping, unified Owner Hubs (`/my-shop`, `/my-institute`), and production **Examiner Mode** for evaluators
- **Community:** 5-star customer reviews and helpfulness votes for both Shops (`shop_reviews`) and Schools/Institutes (`school_reviews`)
- **Offline / PWA:** Vite PWA + Workbox Service Worker caching + `mobile-web-app-capable` metadata
- **Admin Backup & Health:** 20-dataset FK-safe Master ZIP/CSV Backup & Restore, per-module RFC 4180 CSV export/import, and 4-panel Storage & System Health Diagnostics
- **AI Agent Surface:** OAuth 2.0-protected Model Context Protocol (MCP) server exposing 7 read-only town tools
- **Hosting / Edge CDN:** Vercel (Primary) & Lovable Cloud
- **Footer Attribution:** Localized copyright active in [`Footer.tsx`](src/components/shared/Footer.tsx) (external Vibe Forge hackathon badge temporarily commented out / hidden)

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
| `VITE_GOOGLE_MAPS_API_KEY` | Optional Google Maps API Key (defaults to zero-config OpenStreetMap) | `AIzaSy...` |
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
- [Database Reference](docs/DATABASE_REFERENCE.md) — Authoritative catalog of all 42 tables, 2 materialized views, 4 views, triggers, and RPCs.
- [Features](docs/FEATURES.md) — Detailed specifications of all visitor, owner, community, AI, and admin capabilities.
- [Component Catalog](docs/COMPONENT_CATALOG.md) — Reusable UI, forms, reviews, owner hubs, admin layouts, and navigation components.
- [Admin System](docs/ADMIN_SYSTEM.md) — Modular Hub & Leaf administrative console, CSV/ZIP tools, storage health suite, and moderation pipeline.
- [Workflows](docs/WORKFLOWS.md) — End-to-end user, owner, AI, and admin step-by-step sequence flows.
- [API Reference](docs/API_REFERENCE.md) — RPCs, Edge Functions (`mcp`, `town-assistant`, `scrape-local-news`), PostgREST tables, 4-bucket storage layout, and 7 MCP tools.
- [Technical Debt](docs/TECHNICAL_DEBT.md) — Resolved items, refactoring opportunities, and risk register.
- [Sentinel Context](docs/SENTINEL_CONTEXT.md) — Critical workflows and deletion-protected systems.
- [AI Changelog](docs/CHANGELOG_AI.md) — Complete audit trail of project changes.
