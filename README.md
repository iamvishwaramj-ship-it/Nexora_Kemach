# Nexora KEMACH
Smart Trading & Distribution Management Platform

## Quick Start

See `SETUP.md` for full setup instructions (Prisma migrate, seeding, env vars).

### Backend
```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run seed        # admin user + reference data
npm run seed:mock   # optional demo data
npm run dev
# → http://localhost:5001/api/health
# → http://localhost:5001/api/health
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# → http://localhost:3101
# Login: admin@nexora.com / Admin@2026
```

## What's Included

| Module | Pages |
|--------|-------|
| Auth | Login |
| Dashboard | Stats, Charts, Recent Transactions |
| Company Setup | Details, Branch, Financial Year, Doc Numbering, Tax Code, Bank Details, House Bank, Sales Employee, Approval Flow |
| Product Setup | Group, Sub-Group, Brand, UOM, Product Master, Catalog, Barcode, Purchase Price, Sales Price, Customer Discount |
| Business Partner | Customer Master, Supplier Master, Transport Master |
| Purchase | Quotation, Order, GRN, Invoice |
| Sales | Quotation, Order, Delivery Challan, Invoice |
| Inventory | Stock Receipt, Stock Issue, Stock Adjustment |
| Receivables | Customer Outstanding, Collection Entry |
| Payables | Supplier Outstanding, Payment Entry |
| Banking | Deposit Entry, Bank Reconciliation, Cheque Print |
| Settings | Theme (color + light/dark), Language, Max Open Tabs |
| Profile | Edit Profile + Photo, Reset Password |

## Tech Stack
- **Frontend**: React 18 + Vite, MUI v5, Redux Toolkit + RTK Query, React Hook Form + Zod, React Router v6, i18next (English/Tamil/Hindi)
- **Backend**: Node.js + Express, Prisma ORM, PostgreSQL (Azure), JWT auth, Helmet
- **Theme**: Orange (default), Blue, Green, Red, Purple + two-color combinations, light/dark mode
