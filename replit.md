# Workspace

## Overview

Contact Database SaaS application built on a pnpm workspace monorepo using TypeScript.

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
- **Build**: esbuild (CJS bundle)

## Features

- **Search page** (`/`) — Filter contacts and companies by industry, department, seniority, company size, location, and country with full-text search
- **Contact profile page** (`/contacts/:id`) — Full profile with bio, contact info, social links, and company card
- **Company profile page** (`/companies/:id`) — Company details with employee list

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   │   └── src/routes/
│   │       ├── contacts.ts   # GET /api/contacts, GET /api/contacts/:id
│   │       ├── companies.ts  # GET /api/companies, GET /api/companies/:id
│   │       └── filters.ts    # GET /api/filters/options
│   └── contact-db/         # React frontend (Vite)
│       └── src/
│           ├── pages/
│           │   ├── Search.tsx
│           │   ├── ContactProfile.tsx
│           │   └── CompanyProfile.tsx
│           └── components/
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/
│       └── src/schema/
│           ├── companies.ts  # companies table
│           └── contacts.ts   # contacts table
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array

## API Routes

- `GET /api/contacts` — list contacts with filters: search, jobTitle, department, seniority, industry, companySize, location, country, companyId, page, limit
- `GET /api/contacts/:id` — get contact detail
- `GET /api/companies` — list companies with filters: search, industry, size, location, country, page, limit
- `GET /api/companies/:id` — get company detail with contacts list
- `GET /api/filters/options` — get distinct filter values from the DB

## Database Schema

- `companies` — id, name, industry, size, location, country, website, description, employee_count, founded_year, linkedin_url
- `contacts` — id, first_name, last_name, job_title, department, seniority, email, phone, location, country, linkedin_url, twitter_handle, bio, company_id

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references
- `pnpm --filter @workspace/api-spec run codegen` — re-generate React Query hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — sync DB schema
