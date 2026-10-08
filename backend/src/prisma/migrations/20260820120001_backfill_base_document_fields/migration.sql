BEGIN TRY

BEGIN TRAN;

-- ---------------------------------------------------------------------------
-- Backfill from the links this schema already records.
--
-- Every document already names its predecessor by NUMBER on the header
-- (purchase_orders.reference_no, goods_received_notes.po_no,
-- purchase_invoices.grn_no, delivery_challans.order_no, ...). That is enough
-- to reconstruct base_type / base_entry / base_no for existing rows.
--
-- base_line is matched by PRODUCT CODE against the source document's lines,
-- numbering both sides by [id] order — the same order the UI renders and the
-- one the copy actually happened in. Where a product appears on a source line
-- more than once the first is taken; a guess beyond that would be inventing
-- history, so anything unmatched is left NULL rather than filled with a
-- plausible-looking number.
--
-- Only rows whose base fields are still NULL are touched, so re-running this
-- never overwrites a value the application has since written.
-- ---------------------------------------------------------------------------

-- Purchase Order <- Purchase Quotation  (header link: reference_no)
;WITH src AS (
    SELECT i.id AS line_id, q.id AS base_entry, q.quotation_no AS base_no,
           ROW_NUMBER() OVER (PARTITION BY qi.quotation_id ORDER BY qi.id) AS base_line
      FROM [dbo].[purchase_order_items] i
      JOIN [dbo].[purchase_orders]      o  ON o.id = i.order_id
      JOIN [dbo].[purchase_quotations]  q  ON q.quotation_no = o.reference_no
      JOIN [dbo].[purchase_quotation_items] qi
             ON qi.quotation_id = q.id AND qi.product_code = i.product_code
     WHERE i.base_entry IS NULL AND i.product_code IS NOT NULL
)
UPDATE i
   SET i.base_type = N'Purchase Quotation',
       i.base_entry = s.base_entry,
       i.base_no    = s.base_no,
       i.base_line  = s.base_line
  FROM [dbo].[purchase_order_items] i
  JOIN src s ON s.line_id = i.id;

-- Purchase GRN <- Purchase Order  (header link: po_no)
;WITH src AS (
    SELECT i.id AS line_id, o.id AS base_entry, o.po_no AS base_no,
           ROW_NUMBER() OVER (PARTITION BY oi.order_id ORDER BY oi.id) AS base_line
      FROM [dbo].[goods_received_note_items] i
      JOIN [dbo].[goods_received_notes] g ON g.id = i.grn_id
      JOIN [dbo].[purchase_orders]      o ON o.po_no = g.po_no
      JOIN [dbo].[purchase_order_items] oi
             ON oi.order_id = o.id AND oi.product_code = i.product_code
     WHERE i.base_entry IS NULL AND i.product_code IS NOT NULL
)
UPDATE i
   SET i.base_type = N'Purchase Order',
       i.base_entry = s.base_entry,
       i.base_no    = s.base_no,
       i.base_line  = s.base_line
  FROM [dbo].[goods_received_note_items] i
  JOIN src s ON s.line_id = i.id;

-- Purchase Invoice <- Purchase GRN  (header link: grn_no)
;WITH src AS (
    SELECT i.id AS line_id, g.id AS base_entry, g.grn_no AS base_no,
           ROW_NUMBER() OVER (PARTITION BY gi.grn_id ORDER BY gi.id) AS base_line
      FROM [dbo].[purchase_invoice_items] i
      JOIN [dbo].[purchase_invoices]      p ON p.id = i.invoice_id
      JOIN [dbo].[goods_received_notes]   g ON g.grn_no = p.grn_no
      JOIN [dbo].[goods_received_note_items] gi
             ON gi.grn_id = g.id AND gi.product_code = i.product_code
     WHERE i.base_entry IS NULL AND i.product_code IS NOT NULL
)
UPDATE i
   SET i.base_type = N'Purchase GRN',
       i.base_entry = s.base_entry,
       i.base_no    = s.base_no,
       i.base_line  = s.base_line
  FROM [dbo].[purchase_invoice_items] i
  JOIN src s ON s.line_id = i.id;

-- Purchase Invoice <- Purchase Order   (one-step buy: no GRN in between)
;WITH src AS (
    SELECT i.id AS line_id, o.id AS base_entry, o.po_no AS base_no,
           ROW_NUMBER() OVER (PARTITION BY oi.order_id ORDER BY oi.id) AS base_line
      FROM [dbo].[purchase_invoice_items] i
      JOIN [dbo].[purchase_invoices]  p ON p.id = i.invoice_id
      JOIN [dbo].[purchase_orders]    o ON o.po_no = p.po_no
      JOIN [dbo].[purchase_order_items] oi
             ON oi.order_id = o.id AND oi.product_code = i.product_code
     WHERE i.base_entry IS NULL AND i.product_code IS NOT NULL
       AND (p.grn_no IS NULL OR p.grn_no = N'')
)
UPDATE i
   SET i.base_type = N'Purchase Order',
       i.base_entry = s.base_entry,
       i.base_no    = s.base_no,
       i.base_line  = s.base_line
  FROM [dbo].[purchase_invoice_items] i
  JOIN src s ON s.line_id = i.id;

-- Purchase Return <- Purchase GRN  (header link: grn_no)
;WITH src AS (
    SELECT i.id AS line_id, g.id AS base_entry, g.grn_no AS base_no,
           ROW_NUMBER() OVER (PARTITION BY gi.grn_id ORDER BY gi.id) AS base_line
      FROM [dbo].[purchase_return_items] i
      JOIN [dbo].[purchase_returns]     r ON r.id = i.return_id
      JOIN [dbo].[goods_received_notes] g ON g.grn_no = r.grn_no
      JOIN [dbo].[goods_received_note_items] gi
             ON gi.grn_id = g.id AND gi.product_code = i.product_code
     WHERE i.base_entry IS NULL AND i.product_code IS NOT NULL
)
UPDATE i
   SET i.base_type = N'Purchase GRN',
       i.base_entry = s.base_entry,
       i.base_no    = s.base_no,
       i.base_line  = s.base_line
  FROM [dbo].[purchase_return_items] i
  JOIN src s ON s.line_id = i.id;

-- Purchase Credit Memo <- Purchase Invoice  (header link: invoice_no)
;WITH src AS (
    SELECT i.id AS line_id, p.id AS base_entry, p.invoice_no AS base_no,
           ROW_NUMBER() OVER (PARTITION BY pi.invoice_id ORDER BY pi.id) AS base_line
      FROM [dbo].[purchase_credit_memo_items] i
      JOIN [dbo].[purchase_credit_memos] c ON c.id = i.credit_memo_id
      JOIN [dbo].[purchase_invoices]     p ON p.invoice_no = c.invoice_no
      JOIN [dbo].[purchase_invoice_items] pi
             ON pi.invoice_id = p.id AND pi.product_code = i.product_code
     WHERE i.base_entry IS NULL AND i.product_code IS NOT NULL
)
UPDATE i
   SET i.base_type = N'Purchase Invoice',
       i.base_entry = s.base_entry,
       i.base_no    = s.base_no,
       i.base_line  = s.base_line
  FROM [dbo].[purchase_credit_memo_items] i
  JOIN src s ON s.line_id = i.id;

-- Sales Order <- Sales Quotation  (header link: quotation_no)
;WITH src AS (
    SELECT i.id AS line_id, q.id AS base_entry, q.quotation_no AS base_no,
           ROW_NUMBER() OVER (PARTITION BY qi.quotation_id ORDER BY qi.id) AS base_line
      FROM [dbo].[sales_order_items] i
      JOIN [dbo].[sales_orders]     o ON o.id = i.order_id
      JOIN [dbo].[sales_quotations] q ON q.quotation_no = o.quotation_no
      JOIN [dbo].[sales_quotation_items] qi
             ON qi.quotation_id = q.id AND qi.product_code = i.product_code
     WHERE i.base_entry IS NULL AND i.product_code IS NOT NULL
)
UPDATE i
   SET i.base_type = N'Sales Quotation',
       i.base_entry = s.base_entry,
       i.base_no    = s.base_no,
       i.base_line  = s.base_line
  FROM [dbo].[sales_order_items] i
  JOIN src s ON s.line_id = i.id;

-- Delivery Challan <- Sales Order  (header link: order_no)
;WITH src AS (
    SELECT i.id AS line_id, o.id AS base_entry, o.order_no AS base_no,
           ROW_NUMBER() OVER (PARTITION BY oi.order_id ORDER BY oi.id) AS base_line
      FROM [dbo].[delivery_challan_items] i
      JOIN [dbo].[delivery_challans] d ON d.id = i.challan_id
      JOIN [dbo].[sales_orders]      o ON o.order_no = d.order_no
      JOIN [dbo].[sales_order_items] oi
             ON oi.order_id = o.id AND oi.product_code = i.product_code
     WHERE i.base_entry IS NULL AND i.product_code IS NOT NULL
)
UPDATE i
   SET i.base_type = N'Sales Order',
       i.base_entry = s.base_entry,
       i.base_no    = s.base_no,
       i.base_line  = s.base_line
  FROM [dbo].[delivery_challan_items] i
  JOIN src s ON s.line_id = i.id;

-- Sales Invoice <- Delivery Challan  (header link: delivery_challan_no)
;WITH src AS (
    SELECT i.id AS line_id, d.id AS base_entry, d.challan_no AS base_no,
           ROW_NUMBER() OVER (PARTITION BY di.challan_id ORDER BY di.id) AS base_line
      FROM [dbo].[sales_invoice_items] i
      JOIN [dbo].[sales_invoices]    s2 ON s2.id = i.invoice_id
      JOIN [dbo].[delivery_challans] d  ON d.challan_no = s2.delivery_challan_no
      JOIN [dbo].[delivery_challan_items] di
             ON di.challan_id = d.id AND di.product_code = i.product_code
     WHERE i.base_entry IS NULL AND i.product_code IS NOT NULL
)
UPDATE i
   SET i.base_type = N'Delivery Challan',
       i.base_entry = s.base_entry,
       i.base_no    = s.base_no,
       i.base_line  = s.base_line
  FROM [dbo].[sales_invoice_items] i
  JOIN src s ON s.line_id = i.id;

-- Sales Invoice <- Sales Order   (one-step sale: no challan in between)
;WITH src AS (
    SELECT i.id AS line_id, o.id AS base_entry, o.order_no AS base_no,
           ROW_NUMBER() OVER (PARTITION BY oi.order_id ORDER BY oi.id) AS base_line
      FROM [dbo].[sales_invoice_items] i
      JOIN [dbo].[sales_invoices] s2 ON s2.id = i.invoice_id
      JOIN [dbo].[sales_orders]   o  ON o.order_no = s2.order_no
      JOIN [dbo].[sales_order_items] oi
             ON oi.order_id = o.id AND oi.product_code = i.product_code
     WHERE i.base_entry IS NULL AND i.product_code IS NOT NULL
       AND (s2.delivery_challan_no IS NULL OR s2.delivery_challan_no = N'')
)
UPDATE i
   SET i.base_type = N'Sales Order',
       i.base_entry = s.base_entry,
       i.base_no    = s.base_no,
       i.base_line  = s.base_line
  FROM [dbo].[sales_invoice_items] i
  JOIN src s ON s.line_id = i.id;

-- Sales Return <- Delivery Challan  (header link: challan_no)
;WITH src AS (
    SELECT i.id AS line_id, d.id AS base_entry, d.challan_no AS base_no,
           ROW_NUMBER() OVER (PARTITION BY di.challan_id ORDER BY di.id) AS base_line
      FROM [dbo].[sales_return_items] i
      JOIN [dbo].[sales_returns]     r ON r.id = i.return_id
      JOIN [dbo].[delivery_challans] d ON d.challan_no = r.challan_no
      JOIN [dbo].[delivery_challan_items] di
             ON di.challan_id = d.id AND di.product_code = i.product_code
     WHERE i.base_entry IS NULL AND i.product_code IS NOT NULL
)
UPDATE i
   SET i.base_type = N'Delivery Challan',
       i.base_entry = s.base_entry,
       i.base_no    = s.base_no,
       i.base_line  = s.base_line
  FROM [dbo].[sales_return_items] i
  JOIN src s ON s.line_id = i.id;

-- Sales Credit Memo <- Sales Invoice  (header link: invoice_no)
;WITH src AS (
    SELECT i.id AS line_id, s2.id AS base_entry, s2.invoice_no AS base_no,
           ROW_NUMBER() OVER (PARTITION BY si.invoice_id ORDER BY si.id) AS base_line
      FROM [dbo].[sales_credit_memo_items] i
      JOIN [dbo].[sales_credit_memos] c  ON c.id = i.credit_memo_id
      JOIN [dbo].[sales_invoices]     s2 ON s2.invoice_no = c.invoice_no
      JOIN [dbo].[sales_invoice_items] si
             ON si.invoice_id = s2.id AND si.product_code = i.product_code
     WHERE i.base_entry IS NULL AND i.product_code IS NOT NULL
)
UPDATE i
   SET i.base_type = N'Sales Invoice',
       i.base_entry = s.base_entry,
       i.base_no    = s.base_no,
       i.base_line  = s.base_line
  FROM [dbo].[sales_credit_memo_items] i
  JOIN src s ON s.line_id = i.id;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;

THROW

END CATCH
