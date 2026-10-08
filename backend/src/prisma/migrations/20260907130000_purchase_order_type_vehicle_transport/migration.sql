-- Purchase Order: drop Valid Upto, add Type of Purchase and Vehicle Type.
-- Transport Mode already exists on this table (see
-- 20260907090000_add_purchase_order_classification_and_ship_from).

ALTER TABLE [dbo].[purchase_orders] DROP COLUMN [valid_upto];

ALTER TABLE [dbo].[purchase_orders] ADD [type_of_purchase] NVARCHAR(50);

ALTER TABLE [dbo].[purchase_orders] ADD [vehicle_type] NVARCHAR(20);
