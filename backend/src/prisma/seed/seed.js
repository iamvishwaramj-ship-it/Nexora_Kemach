// seed.js — the MINIMUM needed to log in and use the app.
// Seeds: the admin user, plus reference/config master data that the app's
// screens and numbering logic depend on (tax codes, document numbering,
// a default company profile, bank master list, units of measure).
// Never mix demo/mock business data (customers, products, transactions, etc.)
// into this script — that belongs in mockdataseed.js.
// Safe to re-run: every insert is upsert-or-skip-if-exists.

require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../client');

async function seedAdmin() {
  // userCode is the login identifier now (email is still accepted as a
  // second one — see services/authService.js), so the seeded admin gets
  // both: sign in as either 'admin' or 'admin@nexora.com'. findFirst rather
  // than findUnique because email is no longer declared @unique on the
  // Prisma model (see schema.prisma's AppUser comment).
  const userCode = 'admin';
  const email = 'admin@nexora.com';
  const password = 'Admin@2026';
  const existing = await prisma.appUser.findFirst({
    where: { OR: [{ userCode }, { email }] },
  });
  if (existing) {
    console.log('Admin user already exists — skipping.');
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.appUser.create({
    data: { name: 'Admin User', userCode, email, passwordHash, role: 'admin', status: 'Active' },
  });
  console.log(`Admin user seeded: ${userCode} (or ${email}) / ${password}`);
}

async function seedTaxCodes() {
  const rows = [
    { taxCode: 'GST5', taxName: 'GST 5%', taxType: 'GST', taxRate: 5.0, status: 'Active' },
    { taxCode: 'GST12', taxName: 'GST 12%', taxType: 'GST', taxRate: 12.0, status: 'Active' },
    { taxCode: 'GST18', taxName: 'GST 18%', taxType: 'GST', taxRate: 18.0, status: 'Active' },
  ];
  for (const row of rows) {
    await prisma.taxCode.upsert({ where: { taxCode: row.taxCode }, update: {}, create: row });
  }
  console.log('Tax codes ensured.');
}

// A financial year has to exist before numbering series can hang off it —
// series are keyed per FY. Seeds the current Indian FY (April-March) so a
// fresh install has somewhere to put its series.
async function seedFinancialYear() {
  const existing = await prisma.financialYear.findFirst();
  if (existing) {
    console.log('Financial year already present — skipping.');
    return existing;
  }
  const today = new Date();
  // Indian FY runs 1 Apr - 31 Mar; before April we're still in the prior FY.
  const startYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const fy = await prisma.financialYear.create({
    data: {
      financialYearName: `${startYear}-${startYear + 1}`,
      startDate: new Date(Date.UTC(startYear, 3, 1)),
      endDate: new Date(Date.UTC(startYear + 1, 2, 31)),
      status: 'Active',
    },
  });
  console.log(`Financial year seeded: ${fy.financialYearName}`);
  return fy;
}

// Document numbering series — seeds the baseline 'Series 1' series for each
// document type in the active financial year. A document type can hold
// several series, so this only ever creates the one named 'Series 1' and skips
// any document type that already has series of its own.
//
// Shape and defaults mirror DEFAULT_SERIES_SHAPE in
// backend/src/routes/company.js; the document list comes straight from the
// service catalog so there is a single source of truth for codes and prefixes.
async function seedDocumentNumbering() {
  const { DOCUMENT_CATALOG, deriveFyCode } = require('../../services/documentNumberService');

  const fy = await prisma.financialYear.findFirst({
    where: { status: 'Active' },
    orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
  }) || await prisma.financialYear.findFirst({ orderBy: { id: 'desc' } });

  if (!fy) {
    console.log('No financial year found — skipping document numbering.');
    return;
  }

  const fyCode = deriveFyCode(fy);

  for (const def of DOCUMENT_CATALOG) {
    // Any existing series means this document type is already configured —
    // leave it alone rather than adding a competing 'Series 1' alongside it.
    const existing = await prisma.documentNumbering.count({
      where: { documentCode: def.code, financialYearId: fy.id },
    });
    if (existing > 0) continue;

    await prisma.documentNumbering.create({
      data: {
        documentCode: def.code,
        documentName: def.name,
        seriesName: 'Series 1',
        financialYearId: fy.id,
        fyCode,
        prefix: def.prefix,
        suffix: null,
        separator: '-',
        includeFyInNumber: true,
        numberLength: 6,
        startNumber: 1,
        currentNumber: null,
        nextNumber: 1,
        endNumber: 999999,
        resetEveryFy: true,
        autoGenerate: true,
        manualEntry: false,
        status: 'Active',
        isDefault: true,
      },
    });
  }
  console.log(`Document numbering series ensured for ${fy.financialYearName} (${fyCode}).`);
}

async function seedCompanyDetails() {
  const count = await prisma.companyDetails.count();
  if (count > 0) {
    console.log('Company details already present — skipping.');
    return;
  }
  await prisma.companyDetails.create({
    data: {
      companyName: 'ABC Traders Pvt. Ltd.',
      legalName: 'ABC Traders Private Limited',
      currency: 'INR',
      phone: '9876543210',
      email: 'info@kemach.in',
      address: 'Delhi, India',
    },
  });
  console.log('Default company profile created.');
}

async function seedBankNames() {
  const banks = ['State Bank of India', 'HDFC Bank Ltd.', 'ICICI Bank Ltd.', 'Axis Bank Ltd.', 'Kotak Mahindra Bank Ltd.'];
  for (const bankName of banks) {
    await prisma.bankName.upsert({ where: { bankName }, update: {}, create: { bankName, status: 'Active' } });
  }
  console.log('Bank master list ensured.');
}

async function seedUoms() {
  const rows = [
    { uomCode: 'PCS', uomName: 'Pieces', unitType: 'Count', description: 'Used for single items or pieces' },
    { uomCode: 'BOX', uomName: 'Box', unitType: 'Count', description: 'Used for items packed in a box' },
    { uomCode: 'CTN', uomName: 'Carton', unitType: 'Count', description: 'Used for items packed in a carton' },
    { uomCode: 'SET', uomName: 'Set', unitType: 'Count', description: 'Used for set of items' },
    { uomCode: 'KG', uomName: 'Kilogram', unitType: 'Weight', description: 'Used to measure weight in kilograms' },
    { uomCode: 'GM', uomName: 'Gram', unitType: 'Weight', description: 'Used to measure weight in grams' },
    { uomCode: 'ML', uomName: 'Millilitre', unitType: 'Volume', description: 'Used to measure liquid volume in millilitres' },
    { uomCode: 'MTR', uomName: 'Metre', unitType: 'Length', description: 'Used to measure length in meters' },
    { uomCode: 'CM', uomName: 'Centimetre', unitType: 'Length', description: 'Used to measure length in centimetres' },
  ];
  for (const row of rows) {
    await prisma.uom.upsert({ where: { uomCode: row.uomCode }, update: {}, create: { ...row, status: 'Active' } });
  }
  console.log('Units of measure ensured.');
}

async function run() {
  console.log('Seeding core/reference data...');
  await seedAdmin();
  await seedTaxCodes();
  await seedFinancialYear();
  await seedDocumentNumbering();
  await seedCompanyDetails();
  await seedBankNames();
  await seedUoms();
  console.log('Seed complete. Log in with admin@nexora.com / Admin@2026');
}

run()
  .catch((err) => {
    console.error('Seed error:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
