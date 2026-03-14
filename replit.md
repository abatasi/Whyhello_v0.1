# Workspace

## Overview

Contact Database SaaS application built on a pnpm workspace monorepo using TypeScript. Whyhello-branded.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS (artifacts/contact-db)
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Auth**: Replit OIDC/PKCE (`@workspace/replit-auth-web`)

## Features

- **Directory / Search** (`/`) — Multi-filter search for contacts and companies. Filters: industry, department, seniority, company size, location, country, and curated List membership. Paginated + sortable tables. Checkboxes for bulk "Add to List" actions with floating action bar. Collapsible filter sidebar — ChevronLeft button in the Filters header collapses the sidebar (AnimatePresence + framer-motion width animation 320→0); a "Filters" pill button with ChevronRight appears inline next to the h1 to re-expand; when collapsed the main content uses `max-w-5xl mx-auto` for a centered single-column layout.
- **Contact profile** (`/contacts/:id`) — Full profile with bio, contact info, social links, company card, and Personal Insights section.
- **Company profile** (`/companies/:id`) — Company details with employee list and linked contacts.
- **Lists** (`/lists`, `/lists/:id`) — Curated lists of contacts or companies. Create/delete lists. Add members from the directory via floating action bar. List detail shows all members in a paginated table with Insights badges. Export CSV button in the header.
- **Saved Searches** — Save a named set of filters for quick recall.
- **CSV Export** — From any List detail page, export all members to CSV. Contacts: 23 columns (17 profile fields + 6 insight fields) with one row per insight — contact data is repeated for each insight. Contacts without insights get one row with blank insight columns. Companies: 9 columns. Export records are stored in DB per user.
- **Profile page** (`/profile`) — User info card + Export History table (all past exports with Download button).
- **Notifications** (Bell icon in Navbar) — Dropdown showing 5 most recent exports with inline download; unread indicator dot when exports exist.

## API Routes (Express, prefix `/api`)

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Server health |
| GET | /contacts | Paginated contact list (filters, search, listId) |
| GET | /contacts/:id | Contact detail |
| GET | /contacts/:id/insights | Insights for a contact |
| GET | /companies | Paginated company list (filters, search, listId) |
| GET | /companies/:id | Company detail |
| GET | /filters/options | Filter dropdown values |
| GET | /saved-searches | List all saved searches |
| POST | /saved-searches | Create saved search |
| DELETE | /saved-searches/:id | Delete saved search |
| GET | /lists | List all lists |
| POST | /lists | Create a list |
| DELETE | /lists/:id | Delete a list |
| GET | /lists/:id | Get single list |
| GET | /lists/:id/members | Paginated list members |
| POST | /lists/:id/members | Add members to list |
| DELETE | /lists/:id/members/:memberId | Remove member |
| POST | /exports | Generate + store CSV export for a list |
| GET | /exports | List current user's exports (no csvData) |
| GET | /exports/:id/download | Download CSV file attachment |
| GET/POST | /auth/* | Replit OIDC authentication |

## Database Schema (`lib/db/src/schema/`)

| Table | Key Columns |
|-------|-------------|
| `users` | id (varchar), firstName, lastName, email, profileImageUrl |
| `contacts` | id, firstName, lastName, email, phone, jobTitle, department, seniority, location, country, linkedinUrl, twitterHandle, bio, companyId |
| `companies` | id, name, industry, website, location, country, size, employeeCount, foundedYear, description |
| `contact_insights` | id, contactId, category, content |
| `saved_searches` | id, name, tab, search, filters (jsonb) |
| `lists` | id, name, type (contacts|companies), createdAt |
| `list_contacts` | listId, contactId |
| `list_companies` | listId, companyId |
| `list_exports` | id, userId, listId, listName, listType, filename, csvData, memberCount, requestedAt |

## Structure

```text
artifacts/
├── api-server/              # Express API server
│   └── src/
│       ├── routes/
│       │   ├── contacts.ts
│       │   ├── companies.ts
│       │   ├── filters.ts
│       │   ├── insights.ts
│       │   ├── saved-searches.ts
│       │   ├── lists.ts
│       │   └── exports.ts
│       ├── middlewares/authMiddleware.ts
│       └── lib/auth.ts, seed.ts
└── contact-db/              # React frontend (Vite)
    └── src/
        ├── pages/
        │   ├── Search.tsx
        │   ├── ContactProfile.tsx
        │   ├── CompanyProfile.tsx
        │   ├── Lists.tsx
        │   ├── ListDetail.tsx
        │   ├── Profile.tsx
        │   └── Login.tsx
        └── components/layout/
            ├── Navbar.tsx   (bell notifications + profile link)
            └── Shell.tsx
lib/
├── api-client-react/        # React Query hooks (manually extended)
│   └── src/generated/
│       ├── api.ts           # All API functions + hooks incl. exports
│       └── api.schemas.ts   # TypeScript interfaces incl. ExportRecord
├── db/src/schema/           # Drizzle ORM schema tables
└── replit-auth-web/         # Replit OIDC client (React hook)
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

**Known pre-existing TS issue**: `replit-auth-web` is missing `composite: true` in its tsconfig — this shows as a TS6306 warning in the contact-db tsc check but does not affect runtime.

## DB Push

```bash
pnpm --filter @workspace/db run push
```

## Key Design Notes

- Lists filter in Search sidebar filters the directory to members of a specific list (SQL subquery via `listId` param).
- CSV export for contacts joins contacts + companies for full context (17 columns).
- Export history is per-user (userId FK to users table).
- Notifications dropdown shows up to 5 most recent exports with inline download; Bell icon shows a red dot when any exports exist.
- Download is via `GET /api/exports/:id/download` (cookie auth, returns `Content-Disposition: attachment`).
