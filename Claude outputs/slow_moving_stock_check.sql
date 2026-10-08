-- Slow Moving Stock diagnostic query
-- Mirrors buildSlowMovingReportData() in backend/src/routes/resources.js:
--   onHandQty   = SUM(Stock.InQty - Stock.OutQty) for the item (journal-based)
--   lastSaleDate = MAX(order_date across Sales Order lines, invoice_date across Sales Invoice lines)
--   slow moving  = onHandQty > 0 AND (never sold OR days since last sale > @ThresholdDays)
-- Adjust @ThresholdDays / @AsOnDate / @Warehouse / @ProductGroup / @ItemCategory to match
-- the filters you used on the report page.

DECLARE @AsOnDate      DATE = '2026-09-22';
DECLARE @ThresholdDays INT  = 90;
DECLARE @Warehouse     NVARCHAR(150) = NULL;  -- e.g. N'Main Warehouse', or NULL for All Warehouses
DECLARE @ProductGroup  NVARCHAR(100) = NULL;  -- e.g. N'Spares', or NULL for All Groups
DECLARE @ItemCategory  NVARCHAR(50)  = NULL;  -- product_type column, or NULL for All Categories

;WITH OnHand AS (
    SELECT ItemCode, SUM(InQty - OutQty) AS OnHandQty
    FROM [dbo].[Stock]
    GROUP BY ItemCode
),
LastSale AS (
    SELECT ProductCode, MAX(SaleDate) AS LastSaleDate
    FROM (
        SELECT soi.product_code AS ProductCode, so.order_date AS SaleDate
        FROM sales_order_items soi
        JOIN sales_orders so ON so.id = soi.order_id
        WHERE so.order_date <= @AsOnDate
        UNION ALL
        SELECT sii.product_code AS ProductCode, si.invoice_date AS SaleDate
        FROM sales_invoice_items sii
        JOIN sales_invoices si ON si.id = sii.invoice_id
        WHERE si.invoice_date <= @AsOnDate
    ) x
    GROUP BY ProductCode
)
SELECT
    p.product_code,
    p.product_name,
    p.product_group,
    p.default_location AS warehouse,
    ISNULL(oh.OnHandQty, 0) AS on_hand_qty,
    ls.LastSaleDate AS last_sale_date,
    CASE WHEN ls.LastSaleDate IS NULL THEN NULL
         ELSE DATEDIFF(DAY, ls.LastSaleDate, @AsOnDate) END AS days_in_stock,
    p.cost_price,
    ISNULL(oh.OnHandQty, 0) * p.cost_price AS stock_value
FROM products p
LEFT JOIN OnHand oh   ON oh.ItemCode = p.product_code
LEFT JOIN LastSale ls ON ls.ProductCode = p.product_code
WHERE (@Warehouse    IS NULL OR p.default_location = @Warehouse)
  AND (@ProductGroup IS NULL OR p.product_group   = @ProductGroup)
  AND (@ItemCategory IS NULL OR p.product_type    = @ItemCategory)
  AND ISNULL(oh.OnHandQty, 0) > 0
  AND (ls.LastSaleDate IS NULL OR DATEDIFF(DAY, ls.LastSaleDate, @AsOnDate) > @ThresholdDays)
ORDER BY days_in_stock DESC;
