const { Prisma } = require('@prisma/client');

function notFoundHandler(req, res) {
  res.status(404).json({ success: false, message: 'Route not found' });
}

// Centralized error handler — normalizes Prisma errors, validation errors, and generic errors
// into a consistent { success, message } shape. Never leaks stack traces in production.
function errorHandler(err, req, res, next) {
  console.error(err);

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      // On Postgres/MySQL, Prisma's P2002 meta.target is an array of column
      // names. On SQL Server (this app's provider) it is instead the
      // constraint name as a single string, e.g.
      // 'currency_masters_currency_code_key' — calling .join on that string
      // threw and crashed this handler, which is what surfaced as a second,
      // unrelated 500 on top of the original duplicate-key error. Handle both
      // shapes, and tidy the SQL Server constraint-name form into something
      // readable rather than exposing the raw index name.
      const target = err.meta?.target;
      const field = Array.isArray(target)
        ? target.join(', ')
        : (typeof target === 'string' && target
          ? target.replace(/_(key|pkey|idx)$/i, '').replace(/_/g, ' ')
          : 'field');
      return res.status(409).json({ success: false, message: `A record with this ${field} already exists.` });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Record not found.' });
    }
    if (err.code === 'P2003') {
      return res.status(409).json({ success: false, message: 'This record is referenced by other data and cannot be modified.' });
    }
    // Two of these routes' own transactions collided on the same underlying
    // row (e.g. two Sales Orders raised from the same Sales Quotation being
    // deleted in the same instant both try to read-then-update that
    // quotation's status inside recomputeSalesQuotationStatus) and the
    // database's deadlock detector picked one to roll back. P2034 is
    // Prisma's own code for exactly that — a write conflict/deadlock, NOT a
    // bug in the query — so this is retryable, unlike everything else in
    // this handler. Surfaced as a plain unlabeled 500 before this, which is
    // what made a mass-delete look like it was randomly failing instead of
    // just needing another attempt.
    if (err.code === 'P2034') {
      return res.status(409).json({
        success: false,
        message: 'This record was being changed by another action at the same moment. Please try again.',
        retryable: true,
      });
    }
    if (err.code === 'P2024') {
      return res.status(503).json({
        success: false,
        message: 'The database connection pool is busy. Please try again in a moment.',
        retryable: true,
      });
    }
    // A long interactive transaction (the Sales/Purchase Invoice save is the
    // worst offender — a dozen-plus round trips: tax treatment, totals,
    // credit-limit and negative-stock checks, cost stamping, document-number
    // allocation, the create itself, then outstanding/order/challan
    // recompute, stock posting and GL posting, all in one transaction) can
    // outrun Prisma's own transaction timeout (raised to 20s in
    // prisma/client.js, but not unlimited). When that happens Prisma closes
    // the transaction out from under whatever query was still in flight and
    // throws P2028 ("Transaction already closed") — which, unhandled here,
    // fell through to the generic 500 below and looked like a random,
    // unexplained failure. It is neither a bug in the query nor data
    // corruption — the transaction rolled back cleanly — so, like P2034/P2024
    // above, this is safe to retry.
    if (err.code === 'P2028') {
      return res.status(503).json({
        success: false,
        message: 'The save took too long and was rolled back. Please try again.',
        retryable: true,
      });
    }
    // A value submitted for one of the fields was longer than the column
    // allows (e.g. an address "Street No." longer than the DB column's
    // NVarChar width). SQL Server rejects the insert/update outright and
    // Prisma surfaces it as P2000, which — unhandled here — fell through to
    // the generic, unhelpful "Internal Server Error" below and gave no clue
    // which field or value was the problem. err.meta.column_name is the
    // Prisma-normalized column name on SQL Server; fall back to a generic
    // message if that shape ever changes.
    if (err.code === 'P2000') {
      const column = err.meta?.column_name || err.meta?.target;
      const field = typeof column === 'string' && column
        ? column.replace(/_/g, ' ')
        : 'a field';
      return res.status(400).json({
        success: false,
        message: `The value entered for ${field} is too long. Please shorten it and try again.`,
      });
    }
  }

  // Same deadlock case as P2034 above, but for drivers/versions where Prisma
  // doesn't wrap it as a PrismaClientKnownRequestError at all — SQL Server's
  // own deadlock victim error (msg 1205) can come through as a bare
  // PrismaClientUnknownRequestError instead. Matched on message text since
  // there's no structured code to check here.
  if (/deadlock/i.test(err?.message || '')) {
    return res.status(409).json({
      success: false,
      message: 'This record was being changed by another action at the same moment. Please try again.',
      retryable: true,
    });
  }

  const status = err.status || err.statusCode || 500;
  const message = status === 500 && process.env.NODE_ENV === 'production'
    ? 'Internal Server Error'
    : (err.message || 'Internal Server Error');

  res.status(status).json({
    success: false,
    message,
    // Field-tagged validation messages (see badRequest in routes/company.js)
    // so a form can show each error under the input it belongs to, not just
    // as one combined toast.
    ...(Array.isArray(err.errors) ? { errors: err.errors } : {}),
    ...(process.env.NODE_ENV !== 'production' ? { stack: err.stack } : {}),
  });
}

module.exports = { notFoundHandler, errorHandler };
