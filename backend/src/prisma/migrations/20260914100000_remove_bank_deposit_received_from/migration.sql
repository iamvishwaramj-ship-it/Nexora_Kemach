BEGIN TRY

BEGIN TRAN;

-- Removes the "Received From" field entirely -- the frontend/backend no
-- longer expose, validate, or filter on it (see DepositEntry.jsx,
-- DepositRegister.jsx, bankingSchemas.js, resources.js, schema.prisma).
-- Free-text column with no FK/index of its own, so a plain guarded
-- DROP COLUMN is all this needs.

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[bank_deposits]') AND name = 'received_from')
BEGIN
    ALTER TABLE [dbo].[bank_deposits] DROP COLUMN [received_from];
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
