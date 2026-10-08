import React, { Suspense, useMemo } from 'react';
import {
  Dialog, DialogContent, Box, Typography, IconButton, Alert, CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';

// Double-clicking a Route Map card opens the exact record it represents,
// read-only, in a popup on top of the map — this is that popup.
//
// Rather than building a second, cut-down view of every document type (which
// would drift out of sync with the real pages as they change), this loads
// the SAME page component the document is normally viewed on and renders it
// straight into the dialog, pointed at that one record via `openDocNo`. Each
// page already has a full read-only "View" mode (`handleView` sets
// `readOnly` and switches to the form) — that prop just tells the page to
// jump straight into it for a specific document instead of waiting for a
// click on a list row.
//
// Every page is imported lazily (`stageLoaders` returns a dynamic import, not
// the module itself) so opening the Route Map does not pull all thirteen
// document pages into its own bundle — only the one actually opened loads.
const stageLoaders = {
  sales: {
    'Sales Enquiry': () => import('../../pages/sales/Enquiry'),
    'Sales Quotation': () => import('../../pages/sales/SalesQuotation'),
    'Sales Order': () => import('../../pages/sales/SalesOrder'),
    'Delivery Challan': () => import('../../pages/sales/DeliveryChallan'),
    'Sales Invoice': () => import('../../pages/sales/SalesInvoice'),
    Return: () => import('../../pages/sales/SalesReturn'),
    'Credit Memo': () => import('../../pages/sales/SalesCreditMemo'),
    'Incoming Payment': () => import('../../pages/banking/PaymentReceipt'),
  },
  purchase: {
    'Purchase Quotation': () => import('../../pages/purchase/PurchaseQuotation'),
    'Purchase Order': () => import('../../pages/purchase/PurchaseOrder'),
    'Purchase GRN': () => import('../../pages/purchase/PurchaseGRN'),
    'Purchase Invoice': () => import('../../pages/purchase/PurchaseInvoice'),
    Return: () => import('../../pages/purchase/PurchaseReturn'),
    'Credit Memo': () => import('../../pages/purchase/PurchaseCreditMemo'),
    'Outgoing Payment': () => import('../../pages/banking/PaymentVoucher'),
  },
};

function PreviewLoading() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 10 }}>
      <CircularProgress size={28} />
    </Box>
  );
}

export default function RouteMapDocumentPreview({ open, onClose, flow, stage, docNo }) {
  const loader = stageLoaders[flow]?.[stage];

  // Re-lazy'd only when the actual target changes, not on every render —
  // calling React.lazy fresh each render would remount the page (and its
  // data fetches) on every parent re-render of this dialog.
  const LazyPage = useMemo(() => (loader ? React.lazy(loader) : null), [loader]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      scroll="paper"
      PaperProps={{ sx: { borderRadius: 2, overflow: 'hidden', minHeight: '70vh' } }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2.5,
          py: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <AccountTreeOutlinedIcon fontSize="small" color="action" />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={700} noWrap>{stage}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>{docNo} · view only</Typography>
        </Box>
        <IconButton onClick={onClose} size="small" aria-label="close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <DialogContent dividers sx={{ bgcolor: 'background.default' }}>
        {LazyPage ? (
          <Suspense fallback={<PreviewLoading />}>
            <LazyPage openDocNo={docNo} />
          </Suspense>
        ) : (
          <Alert severity="info">There is no detail view for this document type yet.</Alert>
        )}
      </DialogContent>
    </Dialog>
  );
}
