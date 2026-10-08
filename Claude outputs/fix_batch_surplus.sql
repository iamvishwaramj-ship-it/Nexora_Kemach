/* ============================================================================
   fix_batch_surplus.sql  -  one-time correction of inflated product_batches
   ----------------------------------------------------------------------------
   Rule: live stock (dbo.Stock journal, minus stale rows of deleted Opening Balances) is the source of truth. For every (product, warehouse)
   where SUM(product_batches.quantity) is MORE than the ledger quantity, the
   surplus is removed from the NEWEST batch rows first (highest id) until the
   batch total equals the ledger.

   SAFETY:
   * Only rows with NO source document (grn_item_id, stock_receipt_item_id and
     purchase_invoice_item_id all NULL) are trimmed. Those are the rows created
     by Opening Balance / transfers / auto-heal - exactly where the inflation
     came from. Batches that belong to a GRN / Stock Receipt / Purchase Invoice
     (which may still be a Draft that has not posted to the ledger yet) are
     never touched.
   * Shortfalls (batch < ledger) are NOT touched - the app heals those itself.
   * Groups still in surplus after trimming are listed by STEP 2b so you can
     review them by hand (usually a Draft receipt or a transfer awaiting approval).

   Run order:  STEP 1 (backup) -> STEP 2 (preview) -> STEP 2b -> STEP 3 (apply)
   Do NOT run while users are posting documents.
   Deploy the fixed backend/src/routes/resources.js BEFORE running STEP 3,
   otherwise the next Opening Balance save can inflate the batches again.
   ========================================================================== */

/* ---- STEP 1: backup (run once) ------------------------------------------ */
-- SELECT * INTO dbo.product_batches_bak_20261006 FROM dbo.product_batches;

/* ---- STEP 2: PREVIEW - nothing is changed -------------------------------- */
;WITH led AS (
    SELECT ItemCode, Warehouse, SUM(InQty - OutQty) AS ledgerQty
    FROM dbo.Stock st
    /* ignore stale Opening Balance journal rows whose document was deleted */
    WHERE NOT (st.BaseType IN ('Opening Balance','Opening Balance Reversal')
               AND NOT EXISTS (SELECT 1 FROM dbo.opening_balance ob WHERE ob.id = st.BaseEntry))
    GROUP BY ItemCode, Warehouse
),
b AS (
    SELECT pb.id, pb.product_code, pb.warehouse, pb.batch_no, pb.quantity,
           CASE WHEN pb.grn_item_id IS NULL AND pb.stock_receipt_item_id IS NULL
                     AND pb.purchase_invoice_item_id IS NULL THEN 1 ELSE 0 END AS eligible,
           CASE WHEN ISNULL(l.ledgerQty,0) < 0 THEN 0 ELSE ISNULL(l.ledgerQty,0) END AS ledgerQty,
           SUM(pb.quantity) OVER (PARTITION BY pb.product_code, pb.warehouse) AS batchTotal
    FROM dbo.product_batches pb
    LEFT JOIN led l ON l.ItemCode = pb.product_code AND l.Warehouse = pb.warehouse
    WHERE pb.warehouse IS NOT NULL AND pb.warehouse <> ''
),
c AS (
    SELECT *,
           SUM(CASE WHEN eligible = 1 THEN quantity ELSE 0 END)
               OVER (PARTITION BY product_code, warehouse ORDER BY id DESC
                     ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS priorQty
    FROM b
),
x AS (
    SELECT *,
           CASE WHEN eligible = 0 OR batchTotal <= ledgerQty THEN 0
                WHEN (batchTotal - ledgerQty) - ISNULL(priorQty,0) <= 0 THEN 0
                WHEN (batchTotal - ledgerQty) - ISNULL(priorQty,0) >= quantity THEN quantity
                ELSE (batchTotal - ledgerQty) - ISNULL(priorQty,0) END AS reduceBy
    FROM c
)
SELECT id, product_code, warehouse, batch_no, quantity AS oldQty,
       reduceBy, quantity - reduceBy AS newQty, ledgerQty, batchTotal
FROM x WHERE reduceBy > 0
ORDER BY product_code, warehouse, id DESC;

/* ---- STEP 2b: groups that will STILL be in surplus after STEP 3 ----------- */
/* (surplus held by rows tied to a GRN / Stock Receipt / Purchase Invoice -
    check for Draft documents before deciding anything)                        */
-- Run this AFTER step 3; it should list only genuine Draft/pending cases.
-- SELECT b.product_code, b.warehouse, SUM(b.quantity) batchQty, s.stockQty
-- FROM dbo.product_batches b
-- CROSS APPLY (SELECT SUM(InQty-OutQty) stockQty FROM dbo.Stock
--              WHERE ItemCode=b.product_code AND Warehouse=b.warehouse) s
-- GROUP BY b.product_code, b.warehouse, s.stockQty
-- HAVING SUM(b.quantity) > ISNULL(s.stockQty,0);

/* ---- STEP 3: APPLY (uncomment, run, check, COMMIT) ------------------------ */
/*
BEGIN TRAN;
;WITH led AS (
    SELECT ItemCode, Warehouse, SUM(InQty - OutQty) AS ledgerQty
    FROM dbo.Stock st
    /* ignore stale Opening Balance journal rows whose document was deleted */
    WHERE NOT (st.BaseType IN ('Opening Balance','Opening Balance Reversal')
               AND NOT EXISTS (SELECT 1 FROM dbo.opening_balance ob WHERE ob.id = st.BaseEntry))
    GROUP BY ItemCode, Warehouse
),
b AS (
    SELECT pb.id, pb.product_code, pb.warehouse, pb.quantity,
           CASE WHEN pb.grn_item_id IS NULL AND pb.stock_receipt_item_id IS NULL
                     AND pb.purchase_invoice_item_id IS NULL THEN 1 ELSE 0 END AS eligible,
           CASE WHEN ISNULL(l.ledgerQty,0) < 0 THEN 0 ELSE ISNULL(l.ledgerQty,0) END AS ledgerQty,
           SUM(pb.quantity) OVER (PARTITION BY pb.product_code, pb.warehouse) AS batchTotal
    FROM dbo.product_batches pb
    LEFT JOIN led l ON l.ItemCode = pb.product_code AND l.Warehouse = pb.warehouse
    WHERE pb.warehouse IS NOT NULL AND pb.warehouse <> ''
),
c AS (
    SELECT *,
           SUM(CASE WHEN eligible = 1 THEN quantity ELSE 0 END)
               OVER (PARTITION BY product_code, warehouse ORDER BY id DESC
                     ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS priorQty
    FROM b
),
x AS (
    SELECT id, quantity,
           CASE WHEN eligible = 0 OR batchTotal <= ledgerQty THEN 0
                WHEN (batchTotal - ledgerQty) - ISNULL(priorQty,0) <= 0 THEN 0
                WHEN (batchTotal - ledgerQty) - ISNULL(priorQty,0) >= quantity THEN quantity
                ELSE (batchTotal - ledgerQty) - ISNULL(priorQty,0) END AS reduceBy
    FROM c
)
UPDATE pb SET pb.quantity = pb.quantity - x.reduceBy, pb.updated_at = SYSDATETIME()
FROM dbo.product_batches pb JOIN x ON x.id = pb.id
WHERE x.reduceBy > 0;

-- verify: remaining surplus (should only be Draft / pending-document cases)
SELECT b.product_code, b.warehouse, SUM(b.quantity) batchQty, s.stockQty
FROM dbo.product_batches b
CROSS APPLY (SELECT SUM(InQty-OutQty) stockQty FROM dbo.Stock
             WHERE ItemCode=b.product_code AND Warehouse=b.warehouse) s
GROUP BY b.product_code, b.warehouse, s.stockQty
HAVING SUM(b.quantity) > ISNULL(s.stockQty,0);

-- COMMIT;   -- or ROLLBACK;
*/
