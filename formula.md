Got it — here are the queries to paste into SSMS yourself, plus how to combine the numbers by hand.

1. Raw journal rows (see every movement and its value)
SELECT
    BaseType,
    BaseNum,
    ItemCode,
    InQty,
    OutQty,
    StockPrice,
    ItemCost,
    ISNULL(StockPrice, ItemCost) AS EffectivePrice,
    InQty  * ISNULL(StockPrice, ItemCost) AS InValue,
    OutQty * ISNULL(StockPrice, ItemCost) AS OutValue,
    CreateDate
FROM dbo.Stock
ORDER BY CreateDate;

This is just a listing — no totals yet. Use it to sanity-check individual rows (e.g. pick one GRN row and confirm InValue matches what you'd expect from that GRN's amount).

2. Opening Stock Value
SELECT
    SUM(InQty * ISNULL(StockPrice, ItemCost))
  - SUM(OutQty * ISNULL(StockPrice, ItemCost)) AS OpeningStockValue
FROM dbo.Stock
WHERE BaseType = 'Opening Balance';
3. Inward Value (everything that is NOT Opening Balance, In side only)
SELECT
    SUM(InQty * ISNULL(StockPrice, ItemCost)) AS InwardValue
FROM dbo.Stock
WHERE BaseType <> 'Opening Balance';
4. Outward Value (everything that is NOT Opening Balance, Out side only)
SELECT
    SUM(OutQty * ISNULL(StockPrice, ItemCost)) AS OutwardValue
FROM dbo.Stock
WHERE BaseType <> 'Opening Balance';
5. Total Inventory Value — all three combined in one query (so SQL does the add/minus for you, and you can cross-check against your own manual sum)
SELECT
    OpeningStockValue,
    InwardValue,
    OutwardValue,
    OpeningStockValue + InwardValue - OutwardValue AS TotalInventoryValue
FROM (
    SELECT
        SUM(CASE WHEN BaseType = 'Opening Balance'
                 THEN InQty * ISNULL(StockPrice, ItemCost)
                      - OutQty * ISNULL(StockPrice, ItemCost)
                 ELSE 0 END) AS OpeningStockValue,
        SUM(CASE WHEN BaseType <> 'Opening Balance'
                 THEN InQty * ISNULL(StockPrice, ItemCost) ELSE 0 END) AS InwardValue,
        SUM(CASE WHEN BaseType <> 'Opening Balance'
                 THEN OutQty * ISNULL(StockPrice, ItemCost) ELSE 0 END) AS OutwardValue
    FROM dbo.Stock
) x;
How to add/minus it by hand

Run queries 2, 3, 4 separately, write down the three numbers, then:

Total Inventory Value = OpeningStockValue + InwardValue − OutwardValue

Example with made-up numbers:

OpeningStockValue = ₹50,000
InwardValue = ₹1,20,000 (sum of every GRN's InQty × price + every direct Purchase Invoice's InQty × price + Stock Receipts, etc.)
OutwardValue = ₹90,000 (sum of every Delivery Challan's OutQty × price + every direct Sales Invoice's OutQty × price + Stock Issues, etc.)
Total Inventory Value = 50,000 + 1,20,000 − 90,000 = ₹80,000

Query 5's result should equal this exact arithmetic — if it doesn't, one of your manual sums is wrong, not the formula.

6. Breakdown by document type (to see which docs are contributing, and prove GRN/Invoice never both post)
SELECT
    BaseType,
    COUNT(*)                       AS RowCount,
    SUM(InQty)                     AS TotalInQty,
    SUM(OutQty)                    AS TotalOutQty,
    SUM(InQty  * ISNULL(StockPrice, ItemCost)) AS InValue,
    SUM(OutQty * ISNULL(StockPrice, ItemCost)) AS OutValue
FROM dbo.Stock
GROUP BY BaseType
ORDER BY BaseType;

Look at the rows for 'Purchase GRN' vs 'Purchase Invoice', and 'Delivery Challan' vs 'Sales Invoice'. If a GRN was converted to an invoice, that invoice's line should not appear as a 'Purchase Invoice' row in dbo.Stock at all (only the GRN row does) — you can confirm this per-document with:

SELECT s.BaseNum, s.BaseType, pi.grnNo
FROM dbo.Stock s
JOIN dbo.purchase_invoices pi ON pi.invoiceNo = s.BaseNum
WHERE s.BaseType = 'Purchase Invoice';

Every row this returns should have grnNo as NULL or blank — that's what proves it's a direct invoice, and why its value is only counted once (never GRN + Invoice together).