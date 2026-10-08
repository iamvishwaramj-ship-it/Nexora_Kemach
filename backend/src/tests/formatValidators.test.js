/**
 * formatValidators.js — dateRangeCheck, specifically the calendar-day fix.
 *
 * Run with:  node --test src/tests/formatValidators.test.js
 *
 * Regression coverage for: Sales Invoice / Purchase Invoice (and every other
 * document with a Due Date auto-filled from Payment Terms) rejecting
 * Payment Terms = Immediate with "Due date cannot be before invoice date"
 * even though both dates displayed as today. Root cause: invoiceDate is
 * `new Date()` (the current instant), while the payment-terms effect built
 * dueDate at UTC-midnight of the same calendar day — an earlier INSTANT
 * than "right now" in any timezone ahead of UTC (IST included), so the old
 * raw-instant comparison (`end < start`) read it as "before" even though
 * both are the same calendar day. dateRangeCheck now compares calendar days
 * only, via toCalendarDay(); this suite pins that behaviour directly rather
 * than through any one document's payment-terms effect, since the fix lives
 * in the shared validator and every caller benefits from it identically.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { dateRangeCheck } = require('../utils/formatValidators');

/** Runs a dateRangeCheck() chain against a body, the same way every route's
 *  own formatRules array does via runValidators(). */
async function validate(rule, body) {
  const req = { body };
  const { validationResult } = require('express-validator');
  await rule.run(req);
  const result = validationResult(req);
  return { ok: result.isEmpty(), errors: result.isEmpty() ? [] : result.array() };
}

test('same calendar day, different time-of-day (the Payment Terms = Immediate case) is valid', async () => {
  const rule = dateRangeCheck('invoiceDate', 'dueDate', { startLabel: 'Invoice date', endLabel: 'Due date' });
  // invoiceDate: "right now", 2:45 PM on the 5th. dueDate: UTC-midnight of
  // the 5th — exactly how the payment-terms auto-fill effect builds it.
  // As raw instants, dueDate is EARLIER than invoiceDate (00:00 UTC is
  // 05:30 IST, well before 2:45 PM) — the old bug.
  const { ok } = await validate(rule, {
    invoiceDate: new Date(2026, 8, 5, 14, 45, 0).toISOString(),
    dueDate: new Date(Date.UTC(2026, 8, 5)).toISOString(),
  });
  assert.equal(ok, true);
});

test('same calendar day even when the end date is earlier in the day than the start date', async () => {
  const rule = dateRangeCheck('invoiceDate', 'dueDate');
  const { ok } = await validate(rule, {
    invoiceDate: new Date(2026, 8, 5, 23, 59, 0).toISOString(), // 11:59 PM
    dueDate: new Date(2026, 8, 5, 0, 1, 0).toISOString(), // 12:01 AM, same day
  });
  assert.equal(ok, true);
});

test('a due date on a genuinely earlier calendar day is still rejected, regardless of time-of-day', async () => {
  const rule = dateRangeCheck('invoiceDate', 'dueDate', { startLabel: 'Invoice date', endLabel: 'Due date' });
  // dueDate's clock time (11:59 PM) is later in the day than invoiceDate's
  // (12:01 AM) — if this were still a raw-instant comparison it would look
  // "after". It must still be rejected: the 4th is before the 5th.
  const { ok, errors } = await validate(rule, {
    invoiceDate: new Date(2026, 8, 5, 0, 1, 0).toISOString(),
    dueDate: new Date(2026, 8, 4, 23, 59, 0).toISOString(),
  });
  assert.equal(ok, false);
  assert.match(errors[0].msg, /cannot be before/);
});

test('a due date one full calendar day earlier is rejected', async () => {
  const rule = dateRangeCheck('invoiceDate', 'dueDate', { startLabel: 'Invoice date', endLabel: 'Due date' });
  const { ok } = await validate(rule, {
    invoiceDate: new Date(2026, 8, 5).toISOString(),
    dueDate: new Date(2026, 8, 4).toISOString(),
  });
  assert.equal(ok, false);
});

test('allowEqual: false still rejects the exact same calendar day', async () => {
  const rule = dateRangeCheck('startDate', 'endDate', { allowEqual: false });
  const { ok } = await validate(rule, {
    startDate: new Date(2026, 8, 5, 9, 0, 0).toISOString(),
    endDate: new Date(2026, 8, 5, 17, 0, 0).toISOString(),
  });
  assert.equal(ok, false);
});

test('a due date on a genuinely later calendar day is accepted', async () => {
  const rule = dateRangeCheck('invoiceDate', 'dueDate');
  const { ok } = await validate(rule, {
    invoiceDate: new Date(2026, 8, 5, 23, 0, 0).toISOString(),
    dueDate: new Date(2026, 8, 6, 1, 0, 0).toISOString(),
  });
  assert.equal(ok, true);
});

test('a blank/missing end date is not evaluated (dateRangeCheck is opt-in per document)', async () => {
  const rule = dateRangeCheck('invoiceDate', 'dueDate');
  const { ok } = await validate(rule, { invoiceDate: new Date(2026, 8, 5).toISOString(), dueDate: '' });
  assert.equal(ok, true);
});
