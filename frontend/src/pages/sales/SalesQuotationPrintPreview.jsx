import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import Spinner from '../../components/ui/Spinner';
import SalesQuotationPrintable, { printSalesQuotation } from '../../components/print/SalesQuotationPrintable';
import { salesQuotationApi, customerApi, houseBankApi } from '../../features/resources';
import { useGetCompanyDetailsQuery } from '../../features/company/companyDetailsApi';

/**
 * Preview host for the live Sales Quotation print sheet.
 *
 * SalesQuotationPrintable.jsx used to be mounted with `display: none` at all
 * times and only ever became visible inside the browser's own print/PDF
 * dialog — there was no way to look at the laid-out A4 sheet, at its true
 * size, without actually starting a print job. This page fetches the real
 * quotation (by id, from the route) and every record its print template
 * reads from, and renders the same component normally on screen so it can be
 * inspected and scrolled through before printing.
 *
 * Mirrors PurchaseOrderPrintPreview.jsx's shape (screen-only toolbar + a
 * centered, scrollable frame with a hairline outline around the sheet) — the
 * difference is this preview drives the template with the same live data the
 * Sales Quotation page itself prints, not a static mock, since there is no
 * separate "signed-off mock" template for this document the way
 * PurchaseOrderPrintTemplate.jsx is for the Purchase Order.
 */
export default function SalesQuotationPrintPreview() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: order, isLoading: orderLoading, isError } = salesQuotationApi.useGet(id);
  const { data: customers } = customerApi.useList();
  const { data: company } = useGetCompanyDetailsQuery();
  const { data: houseBanks } = houseBankApi.useList();

  const customerRecord = useMemo(
    () => (customers || []).find((c) => c.customerName === order?.customer) || null,
    [customers, order]
  );
  // Same "first Active house bank" source the Sales Quotation page's own
  // inline print and SalesInvoice.jsx's print both read the Bank Details
  // block from.
  const houseBank = useMemo(
    // Prefer the house bank flagged as the default (HouseBank.isDefault);
    // only fall back to "first Active" when no default is set.
    () => (houseBanks || []).find((b) => b.isDefault === true) || (houseBanks || []).find((b) => b.status === 'Active') || null,
    [houseBanks]
  );

  const loading = orderLoading || !company;

  return (
    <Box>
      {/* Toolbar — screen only. @media print: { display: 'none' } keeps it
          off the paper without relying on any global stylesheet. */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        gap={1.5}
        sx={{ mb: 2, '@media print': { display: 'none' } }}
      >
        <Button type="button" variant="outlined" color="inherit" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
          Back
        </Button>
        <Typography variant="subtitle1" fontWeight={700}>
          {order?.quotationNo ? `Quotation ${order.quotationNo}` : 'Sales Quotation Preview'}
        </Typography>
        <Button
          type="button"
          variant="contained"
          startIcon={<PrintOutlinedIcon />}
          onClick={() => printSalesQuotation()}
          disabled={!order}
        >
          Print
        </Button>
      </Stack>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6, '@media print': { display: 'none' } }}>
          <Spinner />
        </Box>
      )}

      {!loading && (isError || !order) && (
        <Alert severity="error" sx={{ '@media print': { display: 'none' } }}>
          This quotation could not be found. It may have been deleted.
        </Alert>
      )}

      {!loading && order && (
        // The sheet is shown at its true A4 width with a hairline outline so
        // the page edge is visible on screen; the outline is not printed.
        // overflowX: auto keeps a narrower viewport scrollable instead of
        // clipping or shrinking the 210mm sheet.
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            overflowX: 'auto',
            pb: 4,
            '@media print': { display: 'block', overflow: 'visible', padding: 0 },
            '& .sqp-sheet': {
              outline: '1px solid #d0d0d0',
              '@media print': { outline: 'none' },
            },
          }}
        >
          <SalesQuotationPrintable order={order} company={company} customerRecord={customerRecord} houseBank={houseBank} />
        </Box>
      )}
    </Box>
  );
}
