-- Purchase Invoice, Purchase Return, Purchase Credit Memo: add Cancel
-- (isCancelled), same feature as Purchase Order's and Purchase GRN's own
-- Cancel action (see 20260922150000_add_purchase_order_is_cancelled and
-- 20260923100000_add_grn_is_cancelled). Lets each document be marked
-- Cancelled from the Actions column without deleting it. It stays in the
-- list (status "Cancelled") but is excluded from every Copy From / "pick a
-- source document" picker downstream where one exists (Purchase Credit Memo
-- picking a Purchase Invoice), and View/Edit/Print/Delete are blocked for it
-- in the UI.
--
-- NOT YET APPLIED — written to review, not run. Apply with
-- `npm run prisma:migrate` from backend/ when ready (same convention as the
-- Purchase Order / Purchase GRN migrations above).

ALTER TABLE [dbo].[purchase_invoices] ADD [is_cancelled] BIT NOT NULL CONSTRAINT [DF_purchase_invoices_is_cancelled] DEFAULT 0;
ALTER TABLE [dbo].[purchase_returns] ADD [is_cancelled] BIT NOT NULL CONSTRAINT [DF_purchase_returns_is_cancelled] DEFAULT 0;
ALTER TABLE [dbo].[purchase_credit_memos] ADD [is_cancelled] BIT NOT NULL CONSTRAINT [DF_purchase_credit_memos_is_cancelled] DEFAULT 0;
