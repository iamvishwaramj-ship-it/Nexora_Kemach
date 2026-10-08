import { z } from 'zod';
import { requiredString, optionalString, optionalEmail, optionalMobileNumber, statusEnum, currencyAmount, optionalCurrencyAmount, pincode, optionalZipcode, anyDate, gstin, panNumber, entityName, personName, optionalPersonName, optionalEntityName, accountNumber, optionalIfscCode, taxLabel } from './common';

export const companyDetailsSchema = z.object({
  companyName: entityName('Company name'),
  legalName: optionalEntityName('Legal name'),
  registrationNumber: optionalString(),
  tinNumber: optionalString(),
  gstin: gstin(),
  pan: panNumber('PAN'),
  hsnNo: optionalString(),
  currency: requiredString('Currency'),
  phone: optionalMobileNumber('Phone'),
  email: optionalEmail(),
  website: optionalString(),
  address: optionalString(),
  country: optionalString(),
  state: optionalString(),
  city: optionalString(),
  pincode: pincode(),
});

export const branchSchema = z.object({
  branchCode: requiredString('Branch code'),
  branchName: entityName('Branch name'),
  address: optionalString(),
  streetNo: optionalString(),
  buildingFloorRoom: optionalString(),
  block: optionalString(),
  phone: optionalMobileNumber('Phone'),
  email: optionalEmail(),
  country: optionalString(),
  state: optionalString(),
  city: optionalString(),
  zipCode: optionalZipcode(),
  isDefault: z.boolean().optional(),
  defaultWarehouse: optionalString(),
  defaultCustomer: optionalString(),
  defaultVendor: optionalString(),
  status: statusEnum(),
});

export const financialYearSchema = z.object({
  financialYearName: requiredString('Financial year name'),
  startDate: anyDate('Start date'),
  endDate: anyDate('End date'),
  status: statusEnum(),
}).refine((d) => new Date(d.endDate) > new Date(d.startDate), {
  message: 'End date must be after start date', path: ['endDate'],
});

// Not currently wired to any form — TaxCode.jsx builds and uses its own
// buildTaxCodeDetailsSchema instead. Kept in sync with it anyway (taxLabel(),
// not requiredString()/entityName()) so this doesn't quietly drift into
// describing rules the live form no longer enforces.
export const taxCodeSchema = z.object({
  taxCode: taxLabel('Tax code'),
  taxName: taxLabel('Tax name'),
  taxType: optionalString(),
  taxRate: currencyAmount('Tax rate'),
  cgst: optionalCurrencyAmount('CGST'),
  sgst: optionalCurrencyAmount('SGST'),
  igst: optionalCurrencyAmount('IGST'),
  description: optionalString(),
  status: statusEnum(),
});

export const bankNameSchema = z.object({
  bankName: entityName('Bank name'),
  status: statusEnum(),
});

export const houseBankSchema = z.object({
  bankName: entityName('Bank name'),
  accountNumber: accountNumber('Account number'),
  accountName: optionalPersonName('Account name'),
  ifscCode: optionalIfscCode(),
  bankAddress: optionalString(),
  branchName: optionalEntityName('Branch name'),
  accountType: requiredString('Account type'),
  currency: requiredString('Currency'),
  openingBalance: currencyAmount('Opening balance'),
  openingDate: anyDate('Opening date'),
  description: optionalString(),
  status: statusEnum(),
});

export const salesEmployeeSchema = z.object({
  employeeCode: requiredString('Employee code'),
  employeeName: personName('Employee name'),
  email: optionalEmail(),
  phoneNumber: optionalMobileNumber('Phone number'),
  department: optionalString(),
  dateOfJoining: anyDate('Date of joining'),
  address: optionalString(),
  status: statusEnum(),
});

export const approvalFlowSchema = z.object({
  transactionName: requiredString('Transaction name'),
  approvalType: requiredString('Approval type'),
  appliedFor: requiredString('Applied for'),
  status: statusEnum(),
});

// Document Numbering Series.
//
// Mirrors validateSeriesPayload() in
// backend/src/services/documentNumberService.js — the server re-validates
// everything here (plus the locked-series rules it alone can check), so this
// schema is about giving the user immediate feedback, not about security.
const seriesInt = (label, { min = 0, max = 999999999999 } = {}) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z
      .number({ required_error: `${label} is required`, invalid_type_error: `${label} must be a number` })
      .int(`${label} must be a whole number`)
      .min(min, `${label} must be ${min} or more`)
      .max(max, `${label} is too large`)
  );

export const documentNumberingSchema = z
  .object({
    documentCode: requiredString('Document name'),
    // A document type can hold several series in one year, so the name is
    // what tells them apart — 'Default', 'Default-2', and so on.
    seriesName: z.preprocess(
      (v) => (v === null || v === undefined ? '' : String(v).trim()),
      z.string().min(1, 'Series name is required').max(100, 'Series name cannot exceed 100 characters')
    ),
    financialYearId: z.preprocess(
      (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
      z.number({ required_error: 'Financial year is required' }).int()
    ),
    // Letters, digits, a hyphen or a slash — mirrors PREFIX_PATTERN in
    // documentNumberService.js. Both are allowed (e.g. 'BP-OP', 'KEM/PO')
    // because the server always builds an exact-match regex from
    // prefix+separator+(fyCode+number)+separator rather than splitting the
    // assembled number apart, so an embedded hyphen or slash is never
    // ambiguous with whatever Separator is chosen alongside it. Anything
    // beyond that would risk colliding with the separator or producing an
    // unparseable number on manual entry.
    prefix: z.preprocess(
      (v) => (v === null || v === undefined ? '' : String(v).trim()),
      z
        .string()
        // Optional: a series may have no prefix at all (the number then
        // starts with the FY code / running number). The server already
        // builds and parses numbers without one.
        .max(10, 'Prefix cannot exceed 10 characters')
        .regex(/^[A-Za-z0-9/-]*$/, 'Prefix must be letters, digits, a hyphen or a slash only')
    ),
    suffix: z.preprocess(
      (v) => (v === null || v === undefined ? '' : String(v).trim()),
      z.string().max(10, 'Suffix cannot exceed 10 characters').regex(/^[A-Za-z0-9/-]*$/, 'Suffix must be letters, digits, a hyphen or a slash only')
    ),
    separator: z.preprocess(
      (v) => (v === null || v === undefined ? '-' : String(v)),
      z.enum(['-', '/', '_', '.', ''], { errorMap: () => ({ message: 'Choose a valid separator' }) })
    ),
    includeFyInNumber: z.boolean(),
    numberLength: seriesInt('Number length', { min: 1, max: 12 }),
    startNumber: seriesInt('Start No.'),
    endNumber: seriesInt('End No.'),
    resetEveryFy: z.boolean(),
    autoGenerate: z.boolean(),
    manualEntry: z.boolean(),
    status: statusEnum(),
  })
  // A series with both switches off can never produce a number at all.
  .refine((d) => d.autoGenerate || d.manualEntry, {
    message: 'Turn on Auto Generate or Manual Entry — otherwise no number can ever be produced',
    path: ['autoGenerate'],
  });
