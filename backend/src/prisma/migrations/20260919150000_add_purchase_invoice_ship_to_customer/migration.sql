BEGIN TRY

BEGIN TRAN;

-- AlterTable: "Ship to a different customer" on Purchase Invoice.
--
-- Adds two columns to purchase_invoices so the "Ship to a different
-- customer" checkbox on the Supplier & Document Details card can be
-- correctly re-populated when a saved invoice is reopened for edit:
--
--   ship_to_different_customer -- the checkbox state itself.
--   ship_to_customer            -- the selected Customer's Business Partner
--                                   NAME, same shape as the existing
--                                   `supplier` column on this table (not a
--                                   numeric id) -- every party CFL field in
--                                   this app stores the party's name as its
--                                   value, so this matches that convention.
--
-- ship_to itself (NVarChar(Max)) already exists and needs no change: it
-- already holds the final, already-resolved Shipping To text regardless of
-- which mode produced it -- derived from the Branch (unchecked, existing
-- behavior, unchanged), derived from the selected Customer's Business
-- Partner Shipping Address (checked, new), or hand-edited afterwards either
-- way. The print template keeps reading only ship_to; it does not need to
-- know which mode was used.
--
-- Both columns are nullable/defaulted so every existing Purchase Invoice
-- row keeps behaving exactly as it does today: ship_to_different_customer
-- defaults to 0 (unchecked) and ship_to_customer stays NULL.
-- Guarded on sys.columns so re-running this migration is a no-op if already
-- applied, same style as every other AlterTable migration in this project.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[purchase_invoices]') AND name = N'ship_to_different_customer')
BEGIN
    ALTER TABLE [dbo].[purchase_invoices] ADD [ship_to_different_customer] BIT NOT NULL CONSTRAINT [DF_purchase_invoices_ship_to_diff_customer] DEFAULT (0);
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[purchase_invoices]') AND name = N'ship_to_customer')
BEGIN
    ALTER TABLE [dbo].[purchase_invoices] ADD [ship_to_customer] NVARCHAR(100) NULL;
END;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
