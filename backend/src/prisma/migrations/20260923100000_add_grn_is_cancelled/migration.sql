-- Purchase GRN: add Cancel (isCancelled), same feature as Purchase Order's
-- own Cancel action (see 20260922150000_add_purchase_order_is_cancelled).
-- Lets a GRN be marked Cancelled from the Actions column without deleting
-- it. It stays in the list (status "Cancelled") but is excluded from every
-- Copy From / "pick a source document" picker downstream (Purchase Invoice,
-- Purchase Return), and View/Edit/Print/Delete are blocked for it in the UI.
--
-- NOT YET APPLIED — written to review, not run. Apply with
-- `npm run prisma:migrate` from backend/ when ready (same convention as the
-- Purchase Order migration above).

ALTER TABLE [dbo].[goods_received_notes] ADD [is_cancelled] BIT NOT NULL CONSTRAINT [DF_goods_received_notes_is_cancelled] DEFAULT 0;
