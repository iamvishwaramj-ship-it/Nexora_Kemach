import React from 'react';
import { Box, Button } from '@mui/material';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import PurchaseOrderPrintTemplate, { printPurchaseOrderTemplate } from '../../components/print/PurchaseOrderPrintTemplate';

/**
 * Preview host for the Purchase Order A4 print template.
 *
 * UI only — the template it renders carries static mock data and no business
 * logic, so this page exists purely so the A4 layout can be looked at on
 * screen and sent to the printer for a real print-preview check.
 *
 * Everything on this page except the sheet itself is marked
 * `po3-screen-only`, which the template's own @media print block removes, so
 * the toolbar and Print button never reach the paper.
 */
export default function PurchaseOrderPrintPreview() {
  return (
    <Box>
      <Box
        className="po3-screen-only"
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 1.5,
          mb: 2,
        }}
      >
        <Button
          type="button"
          variant="contained"
          startIcon={<PrintOutlinedIcon />}
          onClick={() => printPurchaseOrderTemplate()}
        >
          Print
        </Button>
      </Box>

      {/* The sheet is shown at its true A4 width with a hairline outline so
          the page edge is visible on screen; the outline is not printed. */}
      <Box
        className="po3-screen-only-frame"
        sx={{
          display: 'flex',
          justifyContent: 'center',
          overflowX: 'auto',
          '& .po3-page': {
            outline: '1px solid #d0d0d0',
            '@media print': { outline: 'none' },
          },
        }}
      >
        <PurchaseOrderPrintTemplate />
      </Box>
    </Box>
  );
}
