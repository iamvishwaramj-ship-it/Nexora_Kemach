// Unit tests for the shared Zod builders in ./common.js.
//
// This repo has no test framework wired up yet (no vitest/jest in
// package.json, nothing installed under node_modules) and installing one is
// out of scope for this change, so these run on Node's own built-in test
// runner (`node --test`, available since Node 18) — no dependency needed
// beyond Node itself. If/when the repo adopts vitest, these translate
// directly: `describe`/`it` keep their names, and `assert.strictEqual` /
// `assert.equal` swap for `expect(...).toBe(...)`.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  personName,
  optionalPersonName,
  entityName,
  optionalEntityName,
  strictName,
  optionalStrictName,
  accountNumber,
  optionalAccountNumber,
  ifscCode,
  optionalIfscCode,
  phoneNumber,
  optionalPhoneNumber,
  mobileNumber,
  optionalMobileNumber,
  dateRange,
  hsnCodeRequired,
  uniqueItemCodes,
} from './common.js';
import { z } from 'zod';

describe('personName / optionalPersonName', () => {
  it('accepts valid names', () => {
    assert.equal(personName('Name').safeParse('Ravi Kumar').success, true);
    assert.equal(personName('Name').safeParse("O'Brien-Smith Jr.").success, true);
  });

  it('rejects invalid names', () => {
    assert.equal(personName('Name').safeParse('Ravi123').success, false);
    assert.equal(personName('Name').safeParse('A').success, false); // too short
    assert.equal(personName('Name').safeParse('   ').success, false); // whitespace only
    assert.equal(personName('Name').safeParse('Ravi_Kumar').success, false); // underscore not allowed
  });

  it('optional variant allows empty', () => {
    assert.equal(optionalPersonName('Name').safeParse('').success, true);
    assert.equal(optionalPersonName('Name').safeParse(undefined).success, true);
    assert.equal(optionalPersonName('Name').safeParse(null).success, true);
    assert.equal(optionalPersonName('Name').safeParse('Anita').success, true);
    assert.equal(optionalPersonName('Name').safeParse('Bob2').success, false);
  });
});

describe('entityName / optionalEntityName', () => {
  it('accepts valid entity names', () => {
    assert.equal(entityName('Name').safeParse('Sharma & Sons').success, true);
    assert.equal(entityName('Name').safeParse('ABC Traders (India)').success, true);
    assert.equal(entityName('Name').safeParse('7-Eleven').success, true);
  });

  it('rejects invalid entity names', () => {
    assert.equal(entityName('Name').safeParse('12345').success, false); // purely numeric
    assert.equal(entityName('Name').safeParse('Acme@Corp').success, false); // bad char
    assert.equal(entityName('Name').safeParse('').success, false); // required
  });

  it('optional variant allows empty', () => {
    assert.equal(optionalEntityName('Name').safeParse('').success, true);
    assert.equal(optionalEntityName('Name').safeParse('Unit-4/A').success, true);
    assert.equal(optionalEntityName('Name').safeParse('999').success, false);
  });
});

describe('strictName / optionalStrictName', () => {
  it('accepts a valid name', () => {
    assert.equal(strictName('Name').safeParse('Electronics 01').success, true);
  });

  it('rejects a leading digit', () => {
    assert.equal(strictName('Name').safeParse('1Group').success, false);
  });

  it('rejects a leading symbol', () => {
    assert.equal(strictName('Name').safeParse('-Group').success, false);
    assert.equal(strictName('Name').safeParse('_Group').success, false);
    assert.equal(strictName('Name').safeParse(' Group').success, true); // leading space is trimmed first
  });

  it('rejects a disallowed symbol (punctuation entityName would have allowed)', () => {
    assert.equal(strictName('Name').safeParse('Group@1').success, false);
    assert.equal(strictName('Name').safeParse('Group#1').success, false);
    assert.equal(strictName('Name').safeParse('Group.Ltd').success, false); // entityName allows '.', strictName does not
  });

  it('rejects empty string for the required variant', () => {
    assert.equal(strictName('Name').safeParse('').success, false);
  });

  it('rejects spaces-only input after trim', () => {
    assert.equal(strictName('Name').safeParse('   ').success, false);
  });

  it('accepts hyphens, underscores and digits in the middle', () => {
    assert.equal(strictName('Name').safeParse('Group-A_1').success, true);
  });

  it('carries the field label into the error message', () => {
    const result = strictName('Brand name').safeParse('1Bad');
    assert.equal(result.success, false);
    assert.equal(
      result.error.issues[0].message,
      'Brand name must start with a letter and can only contain letters, numbers, spaces, hyphens and underscores.'
    );
  });

  it('optional variant allows empty but still enforces the rule when a value is given', () => {
    assert.equal(optionalStrictName('Name').safeParse('').success, true);
    assert.equal(optionalStrictName('Name').safeParse('Valid Name').success, true);
    assert.equal(optionalStrictName('Name').safeParse('1Invalid').success, false);
    assert.equal(optionalStrictName('Name').safeParse('   ').success, false); // spaces-only trims to '' — but was non-empty input, still rejected as not a valid name form? see note below
  });
});

describe('accountNumber / optionalAccountNumber', () => {
  it('accepts valid account numbers, stripping spaces', () => {
    assert.equal(accountNumber('Account number').safeParse('123456789').success, true); // 9 digits
    const parsed = accountNumber('Account number').safeParse('1234 5678 90');
    assert.equal(parsed.success, true);
    assert.equal(parsed.data, '1234567890');
    assert.equal(accountNumber('Account number').safeParse('1'.repeat(18)).success, true);
  });

  it('rejects invalid account numbers', () => {
    assert.equal(accountNumber('Account number').safeParse('12345678').success, false); // 8 digits, too short
    assert.equal(accountNumber('Account number').safeParse('1'.repeat(19)).success, false); // too long
    assert.equal(accountNumber('Account number').safeParse('12345abc9').success, false); // non-digit
  });

  it('optional variant allows empty', () => {
    assert.equal(optionalAccountNumber('Account number').safeParse('').success, true);
    assert.equal(optionalAccountNumber('Account number').safeParse(undefined).success, true);
    assert.equal(optionalAccountNumber('Account number').safeParse('123abc789').success, false);
  });
});

describe('ifscCode / optionalIfscCode', () => {
  it('accepts and upper-cases valid IFSC codes', () => {
    const parsed = ifscCode('IFSC code').safeParse('sbin0001234');
    assert.equal(parsed.success, true);
    assert.equal(parsed.data, 'SBIN0001234');
    assert.equal(ifscCode('IFSC code').safeParse('HDFC0000123').success, true);
  });

  it('rejects invalid IFSC codes', () => {
    assert.equal(ifscCode('IFSC code').safeParse('SBIN1001234').success, false); // 5th char must be 0
    assert.equal(ifscCode('IFSC code').safeParse('SBI0001234').success, false); // only 3 letters
    assert.equal(ifscCode('IFSC code').safeParse('12340001234').success, false); // no letters
  });

  it('optional variant allows empty', () => {
    assert.equal(optionalIfscCode('IFSC code').safeParse('').success, true);
    assert.equal(optionalIfscCode('IFSC code').safeParse(null).success, true);
  });
});

describe('phoneNumber / optionalPhoneNumber', () => {
  it('accepts valid landline numbers, stripping separators', () => {
    const parsed = phoneNumber('Phone number').safeParse('(080) 2345-6789');
    assert.equal(parsed.success, true);
    assert.equal(parsed.data, '08023456789');
    assert.equal(phoneNumber('Phone number').safeParse('123456').success, true); // 6 digits, min
  });

  it('rejects invalid landline numbers', () => {
    assert.equal(phoneNumber('Phone number').safeParse('12345').success, false); // too short
    assert.equal(phoneNumber('Phone number').safeParse('1'.repeat(16)).success, false); // too long
    assert.equal(phoneNumber('Phone number').safeParse('12345a').success, false); // non-digit after strip
  });

  it('optional variant allows empty', () => {
    assert.equal(optionalPhoneNumber('Phone number').safeParse('').success, true);
    assert.equal(optionalPhoneNumber('Phone number').safeParse(undefined).success, true);
  });
});

describe('mobileNumber / optionalMobileNumber (tightened)', () => {
  it('accepts valid mobile numbers, stripping +91/91/0 prefix and separators', () => {
    assert.equal(mobileNumber('Mobile number').safeParse('9876543210').success, true);
    const withPrefix = mobileNumber('Mobile number').safeParse('+91 98765 43210');
    assert.equal(withPrefix.success, true);
    assert.equal(withPrefix.data, '9876543210');
    const withZero = mobileNumber('Mobile number').safeParse('09876543210');
    assert.equal(withZero.success, true);
    assert.equal(withZero.data, '9876543210');
  });

  it('rejects numbers not starting with 6-9, and wrong lengths', () => {
    assert.equal(mobileNumber('Mobile number').safeParse('5876543210').success, false); // starts with 5
    assert.equal(mobileNumber('Mobile number').safeParse('987654321').success, false); // 9 digits
    assert.equal(mobileNumber('Mobile number').safeParse('98765432101').success, false); // 11 digits
  });

  it('optional variant allows empty', () => {
    assert.equal(optionalMobileNumber('Mobile number').safeParse('').success, true);
    assert.equal(optionalMobileNumber('Mobile number').safeParse(undefined).success, true);
    assert.equal(optionalMobileNumber('Mobile number').safeParse('5876543210').success, false);
  });
});

describe('hsnCodeRequired', () => {
  it('accepts valid 4/6/8-digit codes', () => {
    assert.equal(hsnCodeRequired('HSN code').safeParse('1234').success, true);
    assert.equal(hsnCodeRequired('HSN code').safeParse('123456').success, true);
    assert.equal(hsnCodeRequired('HSN code').safeParse('12345678').success, true);
  });

  it('rejects blank and malformed codes', () => {
    assert.equal(hsnCodeRequired('HSN code').safeParse('').success, false); // required
    assert.equal(hsnCodeRequired('HSN code').safeParse('123').success, false); // 3 digits
    assert.equal(hsnCodeRequired('HSN code').safeParse('12345').success, false); // 5 digits
    assert.equal(hsnCodeRequired('HSN code').safeParse('abcd').success, false); // non-numeric
  });
});

describe('dateRange', () => {
  const buildSchema = (opts) =>
    z
      .object({ startDate: z.date().optional(), endDate: z.date().optional() })
      .superRefine(dateRange('startDate', 'endDate', opts));

  it('passes when end is after start', () => {
    const schema = buildSchema({ endLabel: 'End date', startLabel: 'Start date' });
    const result = schema.safeParse({ startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10') });
    assert.equal(result.success, true);
  });

  it('passes when either side is missing (nothing to compare)', () => {
    const schema = buildSchema();
    assert.equal(schema.safeParse({ startDate: new Date('2026-01-01') }).success, true);
    assert.equal(schema.safeParse({ endDate: new Date('2026-01-01') }).success, true);
    assert.equal(schema.safeParse({}).success, true);
  });

  it('fails when end is before start, with the right path and message', () => {
    const schema = buildSchema({ endLabel: 'End date', startLabel: 'Start date' });
    const result = schema.safeParse({ startDate: new Date('2026-01-10'), endDate: new Date('2026-01-01') });
    assert.equal(result.success, false);
    assert.equal(result.error.issues[0].path.join('.'), 'endDate');
    assert.equal(result.error.issues[0].message, 'End date cannot be before Start date');
  });

  it('allowEqual: false rejects equal dates, allowEqual: true (default) accepts them', () => {
    const same = new Date('2026-01-05');
    const strict = buildSchema({ allowEqual: false });
    const lenient = buildSchema();
    assert.equal(strict.safeParse({ startDate: same, endDate: same }).success, false);
    assert.equal(lenient.safeParse({ startDate: same, endDate: same }).success, true);
  });

  // Regression coverage for: Sales Invoice / Purchase Invoice (and every
  // other document with a Due Date auto-filled from Payment Terms) rejecting
  // Payment Terms = Immediate with "Due date cannot be before invoice date"
  // even though both dates displayed as today. Root cause: invoiceDate is
  // `new Date()` (the current instant), while the payment-terms auto-fill
  // effect built dueDate at UTC-midnight of the same calendar day — an
  // earlier INSTANT than "right now" in any timezone ahead of UTC (IST
  // included), so the old raw-instant comparison (`end < start`) read it as
  // "before" even though both are the same calendar day. dateRange() now
  // compares calendar days only, via toCalendarDay() — these cases pin that
  // behaviour directly against the shared validator.
  it('same calendar day, different time-of-day (the Payment Terms = Immediate case) is valid', () => {
    const schema = buildSchema();
    const result = schema.safeParse({
      startDate: new Date(2026, 8, 5, 14, 45, 0),
      endDate: new Date(Date.UTC(2026, 8, 5)),
    });
    assert.equal(result.success, true);
  });

  it('same calendar day even when the end date is earlier in the day than the start date', () => {
    const schema = buildSchema();
    const result = schema.safeParse({
      startDate: new Date(2026, 8, 5, 23, 59, 0),
      endDate: new Date(2026, 8, 5, 0, 1, 0),
    });
    assert.equal(result.success, true);
  });

  it('a due date on a genuinely earlier calendar day is still rejected, regardless of time-of-day', () => {
    // endDate's clock time (11:59 PM) is later in the day than startDate's
    // (12:01 AM) — if this were still a raw-instant comparison it would look
    // "after". It must still be rejected: the 4th is before the 5th.
    const schema = buildSchema({ startLabel: 'Invoice date', endLabel: 'Due date' });
    const result = schema.safeParse({
      startDate: new Date(2026, 8, 5, 0, 1, 0),
      endDate: new Date(2026, 8, 4, 23, 59, 0),
    });
    assert.equal(result.success, false);
    assert.equal(result.error.issues[0].path.join('.'), 'endDate');
    assert.match(result.error.issues[0].message, /cannot be before/);
  });
});

describe('uniqueItemCodes', () => {
  const schema = z.object({
    items: z.array(z.object({
      productCode: z.string(),
      quantity: z.number().optional(),
    })),
  }).superRefine(uniqueItemCodes('items', 'productCode', { label: 'Product' }));

  it('accepts distinct items', () => {
    const res = schema.safeParse({
      items: [
        { productCode: 'ITEM-1' },
        { productCode: 'ITEM-2' },
        { productCode: 'ITEM-3' },
      ],
    });
    assert.equal(res.success, true);
  });

  it('ignores empty productCode entries', () => {
    const res = schema.safeParse({
      items: [
        { productCode: '' },
        { productCode: '' },
        { productCode: 'ITEM-1' },
      ],
    });
    assert.equal(res.success, true);
  });

  it('rejects duplicate items case-insensitively with accurate path and message', () => {
    const res = schema.safeParse({
      items: [
        { productCode: 'ITEM-1' },
        { productCode: 'item-1' },
      ],
    });
    assert.equal(res.success, false);
    assert.equal(res.error.issues.length, 1);
    assert.equal(res.error.issues[0].path.join('.'), 'items.1.productCode');
    assert.match(res.error.issues[0].message, /Product code must be unique.*also used in item #1/);
  });
});

