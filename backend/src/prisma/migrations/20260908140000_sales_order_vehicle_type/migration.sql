-- Sales Order: add Vehicle Type, so its "Other Details" section carries the
-- same fixed-option fields as Purchase Order's ("Other Details" — Billing
-- Type, Purchase Type, Type of Purchase, Type of Sales, Vehicle Type,
-- Transport Mode). Vehicle Type replaces the form's old Invoice Type field.

ALTER TABLE [dbo].[sales_orders] ADD [vehicle_type] NVARCHAR(20);
