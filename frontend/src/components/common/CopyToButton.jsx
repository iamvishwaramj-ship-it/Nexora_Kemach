import React, { useState } from 'react';
import { Button, Menu, MenuItem, ListItemText } from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { openTab } from '../../store/tabsSlice';
import { setCopyIntent } from '../../store/copyIntentSlice';

/**
 * "Copy To" — the reverse of the existing per-document "Copy From" button
 * (CopyFromDocumentDialog.jsx), placed immediately to its LEFT. Where Copy
 * From pulls an earlier document's data INTO the form you're already on,
 * Copy To pushes the document you're CURRENTLY viewing forward into a new
 * document of one of the allowed next-step types — see the Purchase/Sales
 * document-chain matrix this was built against:
 *
 *   Purchase Quotation -> Purchase Order, GRN, Purchase Invoice
 *   Purchase Order     -> GRN, Purchase Invoice
 *   GRN                -> Purchase Return, Purchase Invoice
 *   Purchase Return     -> Purchase Invoice, Purchase Credit Memo
 *   Sales Quotation     -> Sales Order, Delivery Challan, Sales Invoice
 *   Sales Order         -> Delivery Challan, Sales Invoice
 *   Delivery Challan     -> Sales Return, Sales Invoice, Sales Credit Memo
 *   Sales Return         -> Sales Invoice
 *
 * Only ONE document is ever open per page/tab (see KeepAliveOutlet.jsx), so
 * there is no shared React state to hand the chosen source document through
 * to a page that may not even be mounted yet. copyIntentSlice is the
 * hand-off: picking a target here writes `{ targetKey, sourceType, sourceDoc
 * }` there, opens/activates that target's tab, and the target page's own
 * "consume pending copy intent" effect (living right next to its existing
 * apply<X> Copy-From function, inside its AppForm render prop) notices the
 * intent addressed to it, runs that same apply function against sourceDoc,
 * and clears the intent. This component only ever WRITES the intent — it
 * never talks to the target page directly.
 *
 * Props:
 *   sourceType   — this page's own document-type key (e.g.
 *                  'purchaseQuotation'), written into the intent as-is so a
 *                  target with more than one possible source (Purchase
 *                  Invoice: PO/GRN/Return/Quotation) can tell them apart.
 *   sourceDoc    — the full current document record (editingRow). Copy To
 *                  is gated on this being a SAVED document — a document
 *                  number is what every apply<X> function keys its copied
 *                  lines' provenance (`baseNo`) off, and there is nothing
 *                  meaningful to copy forward from an unsaved draft.
 *   sourceLabel  — human label prefix for the source, e.g. "Purchase
 *                  Quotation" (used to build sourceLabel/tab titles).
 *   docNoField   — the field on sourceDoc holding its own document number
 *                  (e.g. 'quotationNo'), purely for labels/titles.
 *   targets      — [{ key, label, path, description? }] — the allowed
 *                  next-step document types for this source, from the
 *                  matrix above. `key` matches the target page's own
 *                  targetKey; `path` is the target page's route (see
 *                  router/AppRouter.jsx); `description` is an optional
 *                  one-line subtitle shown under the label in the menu
 *                  (matches the descriptive style Copy From's own menu
 *                  already uses, e.g. "Bill against an order").
 *   disabled     — additional caller-supplied disable condition (e.g. the
 *                  create/update mutation is in flight).
 */
export default function CopyToButton({
  sourceType,
  sourceDoc,
  sourceLabel,
  docNoField,
  targets = [],
  disabled = false,
}) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState(null);

  const docNo = sourceDoc?.[docNoField];
  const isDisabled = disabled || !sourceDoc || !docNo || targets.length === 0;

  const handlePick = (target) => {
    setAnchor(null);
    dispatch(setCopyIntent({
      targetKey: target.key,
      sourceType,
      sourceLabel: docNo ? `${sourceLabel} ${docNo}` : sourceLabel,
      sourceDoc,
    }));
    dispatch(openTab({ path: target.path, title: `Create ${target.label}` }));
    navigate(target.path);
  };

  // Always a dropdown, even with a single allowed target -- matching Copy
  // From's own menu (CopyFromDocumentDialog's trigger on SalesInvoice.jsx
  // etc.), which always opens onto a list of labelled, described choices
  // rather than ever collapsing into a single-purpose button. A single
  // target used to skip straight to a plain "Copy To <Target>" button; that
  // read as a different control from Copy From's for a document with only
  // one next step (Sales Invoice -> Sales Credit Memo), so this now always
  // shows "Copy To" and opens the same menu shape regardless of how many
  // targets there are.
  return (
    <>
      <Button
        type="button"
        variant="outlined"
        startIcon={<ContentCopyOutlinedIcon />}
        endIcon={<ArrowDropDownIcon />}
        onClick={(e) => setAnchor(e.currentTarget)}
        disabled={isDisabled}
      >
        Copy To
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {targets.map((target) => (
          <MenuItem key={target.key} onClick={() => handlePick(target)}>
            <ListItemText primary={target.label} secondary={target.description} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
