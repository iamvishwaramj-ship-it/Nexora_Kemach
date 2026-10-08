-- Purchase Order: add Cancel (isCancelled), so an order can be marked
-- Cancelled from the Actions column without deleting it. It stays in the
-- list (status "Cancelled") but is excluded from every Copy From / "pick a
-- source document" picker downstream, and View/Edit/Print are blocked for
-- it in the UI.
--
-- NOT YET APPLIED — written to review, not run. Apply with
-- `npm run prisma:migrate` from backend/ when ready (per the choice made
-- when this feature was scoped: prepare the migration, don't run it here).

ALTER TABLE [dbo].[purchase_orders] ADD [is_cancelled] BIT NOT NULL CONSTRAINT [DF_purchase_orders_is_cancelled] DEFAULT 0;
