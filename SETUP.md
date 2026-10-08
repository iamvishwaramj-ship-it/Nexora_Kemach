# Nexora KEMACH — Setup Guide

## Prerequisites
- Node.js 18+
- npm 9+
- Access to the Azure PostgreSQL instance configured in `backend/.env`

## Backend Setup

```bash
cd backend
npm install
```

`.env` is already configured with `DATABASE_URL` (Azure PostgreSQL), JWT secrets, and `PORT=5001`. Copy `.env.example` and adjust if you're pointing at a different database.

### Apply the schema

```bash
npm run prisma:generate
npm run prisma:migrate      # creates tables from prisma/schema.prisma
```

### Seed data

```bash
npm run seed            # admin user + reference/config data (tax codes, doc numbering, bank names, UOMs, company profile)
npm run seed:mock       # adds realistic demo data (customers, products, transactions, ...)
npm run seed:remove-mock  # removes ONLY the demo data, keeps admin + reference data
npm run seed:wipe -- --yes  # DESTRUCTIVE: wipes every table, including the admin user
```

Default admin login: `admin@nexora.com` / `Admin@2026`

### Run the API

```bash
npm run dev
```
API runs at http://localhost:5001. Health check: `GET /api/health`.

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```
App runs at http://localhost:3101 (configured in `vite.config.js`). `.env` sets `VITE_API_URL=http://localhost:5001`.

## Tech Stack

- **Frontend:** React 18 + Vite, MUI v5, Redux Toolkit + RTK Query, React Hook Form + Zod, React Router v6, i18next (English/Tamil/Hindi)
- **Backend:** Node.js + Express, Prisma ORM, PostgreSQL (Azure), JWT (access + refresh tokens), Helmet
- **Theming:** Orange (default), Blue, Green, Red, Purple, plus five two-color combinations — switchable per-user, light/dark mode, persisted to localStorage

## Folder Structure

```
Nexora_Trade_One/
├── frontend/
│   └── src/
│       ├── components/       # ui / form / layout / data-display / feedback / navigation
│       ├── features/         # RTK Query API slices, one per domain
│       ├── pages/            # route-level pages
│       ├── layouts/          # AuthLayout (MainLayout lives in components/layout)
│       ├── theme/            # MUI theme + color scheme tokens
│       ├── i18n/             # en.json, ta.json, hi.json + config
│       ├── lib/               # zod schemas, createCrudApi factory
│       ├── store/             # Redux store, slices
│       ├── router/            # navConfig (drives sidebar/breadcrumbs/tabs/search), AppRouter
│       └── App.jsx
└── backend/
    └── src/
        ├── routes/            # auth, company, dashboard, profile, resources (generic CRUD mounts)
        ├── controllers/, services/
        ├── middleware/        # JWT auth, error handler
        ├── prisma/
        │   ├── schema.prisma
        │   └── seed/          # seed.js, mockdataseed.js, removeseed.js, wipetable.js
        ├── utils/             # crudFactory / crudRouter (generic CRUD), asyncHandler, jwt
        └── app.js / server.js
```

## Notes on scope

A few pages (Barcode, Sales Price) are focused views over Product Master rather than separate tables. Two pages (Customer Discount, Transport Master) have no backing data model yet — they render as empty states, ready to be wired to a real table when that's needed.
