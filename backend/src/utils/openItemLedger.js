/**
 * Open-item settlement ledger — the rules for applying a receipt or payment
 * against outstanding invoices.
 *
 * Customer collections and supplier payments do exactly the same thing to two
 * structurally identical tables, and each had its own copy of the logic. Both
 * copies carried the same three defects:
 *
 *   1. **Apply and reverse were not symmetric.** Apply clamped the balance at
 *      zero (`Math.max(0, balance - applied)`) while reverse clamped it at the
 *      invoice amount (`Math.min(invoiceAmount, balance + applied)`). Once two
 *      receipts had driven an invoice to zero, reversing the first one put the
 *      balance back to the wrong figure — the invoice showed money owing that
 *      had been paid, or money paid that was still owing, with no way to tell
 *      which. Reversing every receipt did not return the invoice to its
 *      original state.
 *
 *   2. **Nothing checked the receipt could cover what it settled.** A ₹1,000
 *      receipt could be applied ₹10,000 across invoices, clearing receivables
 *      that had never been paid.
 *
 *   3. **Nothing checked the invoice belonged to the party paying.** A receipt
 *      from one customer could settle another customer's invoice.
 *
 * The fix for (1) is to stop treating `balanceAmount` as an independently
 * mutable figure. It is derived: `balance = invoiceAmount - paidAmount`. Only
 * `paidAmount` moves, and it moves by exactly the amount applied in both
 * directions, so apply-then-reverse is an identity for any sequence of
 * operations in any order. `balanceAmount` is still written to the column
 * because reports and the frontend read it, but it is now always recomputed
 * rather than adjusted.
 */

const { round2 } = require('./documentTotals');

/** Tolerance for float noise arriving from the wire — half a paisa. */
const EPSILON = 0.005;

function num(value) {
  const v = Number(value);
  return Number.isFinite(v) ? v : 0;
}

/**
 * Settlement status for an invoice, from its own figures.
 *
 * `<= EPSILON` rather than `<= 0` so an invoice settled to a fraction of a
 * paisa by rounding still closes instead of lingering in the aging report
 * forever as a 0.00 open item.
 */
function settlementStatus(balanceAmount, paidAmount) {
  if (balanceAmount <= EPSILON) return 'Paid';
  if (paidAmount > EPSILON) return 'Partial';
  return 'Unpaid';
}

/**
 * Build the apply/reverse/validate trio for one side of the ledger.
 *
 * @param {object} config
 *   delegateOf  (tx) => Prisma delegate for the outstanding table
 *   partyField  'customerName' | 'supplierName'
 *   documentWord 'receipt' | 'payment'  — used in error messages
 */
function createOpenItemLedger({ delegateOf, partyField, documentWord }) {
  /** Locate the single outstanding row for an invoice number. */
  async function findOpenItem(tx, invoiceNo) {
    return delegateOf(tx).findFirst({ where: { invoiceNo } });
  }

  /**
   * Move an invoice's settled amount by `delta` (positive to apply, negative
   * to reverse) and rewrite the derived balance and status.
   */
  async function adjust(tx, invoiceNo, delta) {
    const row = await findOpenItem(tx, invoiceNo);
    if (!row) return;

    const invoiceAmount = num(row.invoiceAmount);
    const paidAmount = round2(num(row.paidAmount) + delta);
    const balanceAmount = round2(invoiceAmount - paidAmount);

    await delegateOf(tx).update({
      where: { id: row.id },
      data: {
        paidAmount,
        balanceAmount,
        status: settlementStatus(balanceAmount, paidAmount),
      },
    });
  }

  /**
   * Validate a set of applications before any of them is written.
   *
   * Runs as a whole-document check rather than per line so the caller either
   * posts a fully valid settlement or none of it — a partially applied receipt
   * is worse than a rejected one.
   *
   * Must be called AFTER any previous version of this document has been
   * reversed, so the balances it reads are the ones the new applications will
   * actually be measured against.
   */
  async function assertApplicationsValid(tx, applications, { paymentAmount, partyName }) {
    const errors = [];
    const rows = applications.filter((a) => a.invoiceNo && num(a.amountApplied) !== 0);

    for (const app of rows) {
      const applied = num(app.amountApplied);
      if (applied < 0) {
        errors.push(`${app.invoiceNo}: a negative amount cannot be applied`);
        continue;
      }

      const openItem = await findOpenItem(tx, app.invoiceNo);
      if (!openItem) {
        errors.push(`${app.invoiceNo}: no outstanding invoice with this number`);
        continue;
      }

      if (partyName && openItem[partyField] && openItem[partyField] !== partyName) {
        errors.push(
          `${app.invoiceNo}: belongs to ${openItem[partyField]}, not ${partyName}`
        );
        continue;
      }

      const openBalance = round2(num(openItem.invoiceAmount) - num(openItem.paidAmount));
      if (applied > openBalance + EPSILON) {
        errors.push(
          `${app.invoiceNo}: applying ${applied.toFixed(2)} against an outstanding balance of ${openBalance.toFixed(2)}`
        );
      }
    }

    // The document as a whole cannot settle more than it is worth.
    const totalApplied = round2(rows.reduce((sum, a) => sum + num(a.amountApplied), 0));
    const available = round2(num(paymentAmount));
    if (totalApplied > available + EPSILON) {
      errors.push(
        `total applied (${totalApplied.toFixed(2)}) exceeds the ${documentWord} amount (${available.toFixed(2)})`
      );
    }

    if (errors.length) {
      const err = new Error(`This ${documentWord} cannot be posted — ${errors.join('; ')}`);
      err.status = 400;
      throw err;
    }

    return { totalApplied };
  }

  /** Apply every line of a posted document to the open items it settles. */
  async function apply(tx, applications) {
    for (const app of applications) {
      const applied = num(app.amountApplied);
      if (!app.invoiceNo || applied === 0) continue;
      await adjust(tx, app.invoiceNo, applied);
    }
  }

  /**
   * Undo a previously applied document. Exactly inverse to apply(), so a
   * document can be edited, re-saved, unposted or deleted any number of times
   * and the invoices it touched return to precisely the state they were in.
   */
  async function reverse(tx, applications) {
    for (const app of applications) {
      const applied = num(app.amountApplied);
      if (!app.invoiceNo || applied === 0) continue;
      await adjust(tx, app.invoiceNo, -applied);
    }
  }

  return { apply, reverse, assertApplicationsValid, findOpenItem };
}

module.exports = { createOpenItemLedger, settlementStatus, EPSILON };
