// seed_department_master.js — Department Master starter list.
//
// Unlike seed_location_master.js this isn't sourced from Master Data.xlsx —
// there's no such sheet for departments. The starter list below matches the
// hardcoded DEPARTMENT_OPTIONS that used to live directly in
// SalesEmployee.jsx before Department became an FK to this master.
//
// Self-sufficient: creates the [department_master] table if it doesn't
// already exist (in case this runs before `prisma migrate deploy` has been
// applied — see the CREATE_TABLE_SQL guard below) and then upserts every
// row keyed by code, so re-running this is always safe.
//
// Run with:  npm run department_master:seed

require('dotenv').config();
const prisma = require('../client');

// Mirrors backend/src/prisma/migrations/20260903110000_department_master/
// migration.sql's [department_master] table exactly, so a table this script
// creates and a table a later `prisma migrate deploy` would have created are
// identical.
const CREATE_TABLE_SQL = `
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'department_master')
BEGIN
  CREATE TABLE [dbo].[department_master] (
      [id] INT IDENTITY(1,1) NOT NULL,
      [code] NVARCHAR(50) NOT NULL,
      [name] NVARCHAR(150) NOT NULL,
      [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_department_master_status] DEFAULT N'Active',
      CONSTRAINT [department_master_pkey] PRIMARY KEY CLUSTERED ([id])
  );
  CREATE UNIQUE INDEX [department_master_code_key] ON [dbo].[department_master]([code]);
END
`;

async function ensureTable() {
  await prisma.$executeRawUnsafe(CREATE_TABLE_SQL);
}

// Bare running-integer codes — 1, 2, 3 … — matching how DepartmentMaster.jsx
// numbers new rows (nextDepartmentCode) and how Location Master / Account
// Group are numbered for the same reason.
const STARTER_DEPARTMENTS = [
  'Sales', 'Marketing', 'Finance', 'Operations', 'HR', 'IT', 'Support', 'Admin',
];

async function run() {
  await ensureTable();

  let created = 0;
  let skipped = 0;

  const existing = await prisma.departmentMaster.findMany();
  const usedCodes = existing
    .map((d) => String(d.code ?? '').trim())
    .filter((code) => /^\d+$/.test(code))
    .map(Number);
  let nextCode = (usedCodes.length ? Math.max(...usedCodes) : 0) + 1;
  const existingNames = new Set(existing.map((d) => d.name));

  for (const name of STARTER_DEPARTMENTS) {
    if (existingNames.has(name)) {
      skipped += 1;
      continue;
    }
    await prisma.departmentMaster.create({
      data: { code: String(nextCode), name, status: 'Active' },
    });
    nextCode += 1;
    created += 1;
  }

  console.log(`Department master: ${created} created, ${skipped} skipped (of ${STARTER_DEPARTMENTS.length} starter rows).`);
}

// Runnable directly (npm run department_master:seed) and also required by
// mockdataseed.js so Sales Employee's seed rows have a department_master row
// to point department_id at.
if (require.main === module) {
  run()
    .catch((err) => {
      console.error('department_master:seed failed:', err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { run };
