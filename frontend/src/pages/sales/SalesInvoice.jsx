import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatPartnerAddress, cleanAddressText } from '../../lib/addressFormat';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import {
  Box, Typography, Button, Card, CardContent, Stack, TextField, InputAdornment, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton, Menu, MenuItem,
  ListItemIcon, ListItemText, Checkbox, Autocomplete, Popover, Grid, Tooltip,
  Collapse, CircularProgress, Tabs, Tab, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Divider,
} from '@mui/material';
import { useFieldArray } from 'react-hook-form';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import WhatsAppShareButton from '../../components/common/WhatsAppShareButton';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import EventIcon from '@mui/icons-material/Event';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import WarehouseCodeSelect from '../../components/form/WarehouseCodeSelect';
import PartyCodeSelect, { buildPartyCodeOptions } from '../../components/form/PartyCodeSelect';
import SalesShipTo from '../../components/form/SalesShipTo';
import { applySalesPartyAddresses } from '../../lib/salesPartyAddress';
import MachineryCodeSelect from '../../components/form/MachineryCodeSelect';
import FormDatePicker from '../../components/form/FormDatePicker';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import CompanyBadge from '../../components/common/CompanyBadge';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import FilterAutocomplete from '../../components/data-display/FilterAutocomplete';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import MobileItemCard from '../../components/data-display/MobileItemCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import useDragScroll from '../../components/data-display/useDragScroll';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { salesInvoiceSchema, SALES_INVOICE_STATUS_OPTIONS, SALES_INVOICE_PAYMENT_STATUS_OPTIONS, ENQUIRY_SOURCE_OPTIONS } from '../../lib/validation/salesSchemas';
import { isNonStockSalesCategory } from '../../lib/validation/common';
import { buildDocument, round2, isInterState, computeFreightGross, computeItemDiscountTotal } from '../../lib/documentTotals';
import DocumentTotalsPanel from '../../components/form/DocumentTotalsPanel';
import { PAYMENT_TERMS_OPTIONS } from '../../lib/validation/partnerSchemas';
import { useCurrencyOptions } from '../../lib/currencyOptions';
import {
  salesInvoiceApi, salesQuotationApi, deliveryChallanApi, salesReturnApi, salesOrderApi, customerApi, supplierApi, productApi, salesEmployeeApi, taxCodeApi, houseBankApi,
  useGenerateEInvoiceMutation, useCancelEInvoiceMutation, useGenerateEWayBillMutation, useCancelEWayBillMutation, useSendSalesInvoiceWhatsAppMutation,
  useMarkSalesInvoicePrintedMutation, useResetSalesInvoicePrintedMutation,
} from '../../features/resources';
import { isAdmin } from '../../lib/permissions';
import { useBranchNameOptions } from '../../lib/useBranchOptions';
import { productOptionsFor, PRODUCT_USAGE } from '../../lib/productUsage';
import { buildTaxCodeOptions, taxTypeFamilyFor, buildTaxCodeIdByRate, pickDefaultTaxCode, withDefaultTaxCode } from '../../lib/taxCodeOptions';
import { itemTableSx } from '../../lib/columnWidth';
import { useWarehouseOptions, warehouseCodesForBranch } from '../../lib/useWarehouseOptions';
import { useWarehouseStock } from '../../lib/useWarehouseStock';
import { useGetCompanyDetailsQuery } from '../../features/company/companyDetailsApi';
import DocumentSeriesNoField from '../../components/form/DocumentSeriesNoField';
import usePriceListRates from '../../hooks/usePriceListRates';
import SalesInvoicePrintable, { printSalesInvoice, captureSalesInvoicePdf } from '../../components/print/SalesInvoicePrintable';
import useServerListTable from '../../components/data-display/useServerListTable';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer, { dragScrollbarSx } from '../../components/data-display/ScrollableTableContainer';

import { CanAdd, CanEdit, CanDelete, CanCancel } from '../../components/common/PermissionGate';
import { canDelete } from '../../config/deleteConfig';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';
import RouteMapButton from '../../components/common/RouteMapButton';
import RouteMapContextMenu from '../../components/common/RouteMapContextMenu';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import CopyFromDocumentDialog from '../../components/common/CopyFromDocumentDialog';
import CopyToButton from '../../components/common/CopyToButton';
import JournalEntryViewDialog from '../../components/accounting/JournalEntryViewDialog';
import BatchSerialSelectionDialog from '../../components/common/BatchSerialSelectionDialog';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import { useDispatch, useSelector } from 'react-redux';
import { selectCurrentUser } from '../../store/authSlice';
import { clearCopyIntent } from '../../store/copyIntentSlice';
import BulkImportDialog from '../../components/common/BulkImportDialog';
import ImportItemsDialog from '../../components/common/ImportItemsDialog';
import BoltIcon from '@mui/icons-material/Bolt';  
import SmartAddHistoryDialog from '../../components/common/SmartAddHistoryDialog';

// A sales invoice can be raised off either step of the chain above it: the
// Sales Order (billed before or without a despatch) or the Delivery Challan
// (billed against what actually shipped). Copy From therefore asks which one
// first, then opens the matching Find dialog. Each source gets its own columns
// because each document names things differently.
//
// "Due Date" on the order reads off its `deliveryDate` — a sales order has no
// `dueDate` of its own, and the date it is due is the date it promised
// delivery.
const SALES_ORDER_COPY_COLUMNS = [
  { field: 'orderNo', headerName: 'Order No', nowrap: true },
  { field: 'customer', headerName: 'Customer Name' },
  { field: 'deliveryDate', headerName: 'Due Date', type: 'date' },
  { field: 'remarks', headerName: 'Comments', type: 'optional' },
];

const CHALLAN_COPY_COLUMNS = [
  { field: 'challanNo', headerName: 'Delivery No', nowrap: true },
  { field: 'customer', headerName: 'Customer Name' },
  { field: 'deliveryDate', headerName: 'Delivery Date', type: 'date' },
  { field: 'remarks', headerName: 'Comments', type: 'optional' },
];
const emptyItem = {
  productCode: '', productName: '', description: '', hsnCode: '', uom: '', quantity: 1, unitPrice: 0, discountPercent: 0, taxPercent: 18, taxCodeId: null, warehouse: '',
  // Populated via the "Batches Number - Selection" / "Serial Numbers -
  // Selection" dialog — see BatchSerialSelectionDialog and the Batch/Serial
  // column below. Only ever shown (and only ever meaningful) when this
  // invoice is direct — no base Delivery Challan, see isDirectInvoice below
  // — since a challan-backed invoice moves no stock and the challan itself
  // already recorded whatever it consumed. Mirrors DeliveryChallan.jsx's
  // own emptyItem exactly.
  batchAllocations: [], serialAllocations: [],
};

/**
 * Batch/Serial selection on a direct invoice (no base Delivery Challan — see
 * isDirectInvoice) is optional, not mandatory: a line left without full
 * batch/serial coverage no longer blocks Save, matching the server's own
 * assertBatchSerialIssueAllocation({ optional: true }) in
 * utils/businessRules.js. This still catches the one thing that stays an
 * error either way — the same batch or serial number selected on more than
 * one line — since that's a data-integrity problem regardless of whether
 * coverage is complete. Mirrors DeliveryChallan.jsx's own
 * validateBatchSerialAllocation for the duplicate-key rationale (why
 * productCode has to be part of the within-document key).
 */
function validateBatchSerialAllocation(items) {
  const seenBatchKeys = new Map();
  const seenSerialNos = new Map();

  for (let i = 0; i < (items || []).length; i++) {
    const item = items[i];
    const warehouse = item.warehouse || null;

    for (const b of item.batchAllocations || []) {
      const no = (b.batchNo || '').trim();
      if (!no) continue;
      const key = `${no}::${warehouse || ''}::${item.productCode || ''}`;
      if (seenBatchKeys.has(key)) {
        return `Batch number "${no}" is used on more than one line for warehouse "${warehouse || '—'}".`;
      }
      seenBatchKeys.set(key, i);
    }
    for (const s of item.serialAllocations || []) {
      const no = (s.serialNo || '').trim();
      if (!no) continue;
      if (seenSerialNos.has(no)) return `Serial number "${no}" is used on more than one line.`;
      seenSerialNos.set(no, i);
    }
  }
  return null;
}

// "Other Details" classification fields — fixed-option (CFL-style) selects,
// not free text. Billing Type/Purchase Type/Type of Purchase/Type of
// Sales/Transport Mode reuse the exact same vocabulary as Purchase Order's
// own "Other Details" section (see PurchaseOrder.jsx).
const BILLING_TYPE_OPTIONS = ['B2B', 'B2C'].map((v) => ({ label: v, value: v }));
const SALES_TYPE_OPTIONS = ['UPI', 'NEFT', 'CASH', 'CHECK', 'DEBIT/CREDIT CARD'].map((v) => ({ label: v, value: v }));
const SALES_CATEGORY_OPTIONS = ['Parts', 'Machine', 'Services', 'Claims'].map((v) => ({ label: v, value: v }));
const TYPE_OF_PURCHASE_OPTIONS = [
  'Breakdown with Warranty', 'Stock Order', 'Machine Order', 'Non Warranty Order',
  'Branch Transfer', 'Services', 'Standard Priority Order', 'Sales', 'Admin',
].map((v) => ({ label: v, value: v }));
const TRANSPORT_MODE_OPTIONS = ['Road', 'Air', 'Rail', 'Ship'].map((v) => ({ label: v, value: v }));

// Bill To/Ship To are frozen, derived display fields now — not user-editable
// free text. Formatting mirrors PurchaseOrder.jsx's own
// formatBusinessPartnerAddress (Ship From auto-fill there), reused verbatim
// here so a Business Partner address reads identically on both sides.
function formatBusinessPartnerAddress(addr) {
  // Address Name, Street, Street No, Building/Floor/Room, Block, Country,
  // State, City, Zip Code -- see lib/addressFormat.js (no double commas).
  return formatPartnerAddress(addr);
}

// Picks the customer's default (or first) address of the given type
// ('Billing' or 'Shipping') off their Business Partner record's addresses
// array — customerApi rows already carry `.addresses` (see resources.js'
// makeLegacyPartnerApi), same as supplierApi on the Purchase side.
function customerAddressFor(customerRecord, addressType) {
  const list = (customerRecord?.addresses || []).filter((a) => a.addressType === addressType);
  const chosen = list.find((a) => a.isDefault) || list[0];
  return formatBusinessPartnerAddress(chosen) || '';
}

// GST No. field — same "customer's own Business Partner default (or first)
// Billing address" lookup deriveBillingType already does, just returning the
// GST number itself instead of the B2B/B2C classification derived from it.
function customerGstNo(customerRecord) {
  const list = (customerRecord?.addresses || []).filter((a) => a.addressType === 'Billing');
  const chosen = list.find((a) => a.isDefault) || list[0];
  return (chosen?.gstNumber || '').trim();
}

// Same selection as customerAddressFor's Billing lookup, but returns just
// the state off that address — what Place of Supply auto-fills from below.
// A BusinessPartner row has no `state` field of its own (see schema.prisma —
// state only lives on each row in its addresses[]), so the customer-change
// effect's old `found.state` was always undefined: Place of Supply never
// auto-filled for ANY customer, and with no visible input for it on this
// form either, every direct Sales Invoice was stuck on Save with a "Needs
// attention: Place of supply" tooltip and no way to clear it.
function customerStateFor(customerRecord) {
  const list = (customerRecord?.addresses || []).filter((a) => a.addressType === 'Billing');
  const chosen = list.find((a) => a.isDefault) || list[0];
  return chosen?.state || '';
}

// GSTIN format check — same regex as lib/validation/common.js' gstin(),
// reused verbatim so "valid GST number" means the same thing here as it
// does on the Business Partner Address form that captures it.
const GSTIN_FORMAT_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z][A-Z0-9]$/;

// Billing Type is frozen/derived, not hand-picked: B2B when the customer's
// own Business Partner default (or first) Billing address carries a
// non-empty, valid-format GST number, B2C otherwise.
function deriveBillingType(customerRecord) {
  const list = (customerRecord?.addresses || []).filter((a) => a.addressType === 'Billing');
  const chosen = list.find((a) => a.isDefault) || list[0];
  const gst = (chosen?.gstNumber || '').trim().toUpperCase();
  return GSTIN_FORMAT_REGEX.test(gst) ? 'B2B' : 'B2C';
}

function getEmptyValues(preparedBy, defaultTaxCode) {
  return {
    customerState: '',
    invoiceNo: '', seriesId: '', branch: '', customer: '', supplier: '', contactPerson: '', invoiceDate: new Date(), orderNo: '', orderDate: null,
    deliveryChallanNo: '', challanDate: null, dueDate: null, customerRefNo: '',
    warehouse: '',
    currency: 'INR', paymentTerms: '', salesPerson: '', source: '', placeOfSupply: '',
    machineryCode: '', gstNo: '',
    receiver: '', receiverPhone: '',
    billingAddress: '', shippingAddress: '', shipToDifferentCustomer: false, shipToCustomer: '', billToDifferentCustomer: false, billToCustomer: '', billToGstNo: '', billToGstType: '', billToPanNo: '', shipToGstNo: '', shipToGstType: '', shipToPanNo: '', remarks: '', termsConditions: '',
    preparedBy: preparedBy || '', approvedBy: '', attachmentName: '',
    discountPercent: 0, status: 'Draft', paymentStatus: 'Unpaid',
    // "Other Details" classification fields — see the constants above.
    billingType: '', typeOfPurchase: '', salesType: '', transportMode: '', invoiceType: '',
    salesCategory: 'Parts',
    // Road Tax (manual entry on this document, unlike Sales Quotation's own
    // auto-computed 8.2%) and Freight Charges — see FreightChargesEditor.
    // freightGrossAmount is kept in sync live by that component.
    roadTax: 0,
    freightTransportId: null, freightName: '', freightRemarks: '', freightTaxCodeId: null,
    freightTaxAmount: 0, freightNetAmount: 0, freightGrossAmount: 0,
    items: [withDefaultTaxCode({ ...emptyItem }, defaultTaxCode)],
  };
}

// Totals come from the shared engine in lib/documentTotals.js, which the
// backend mirrors exactly — the figures shown here while editing are the
// figures that get saved. Each page used to carry its own copy of this
// arithmetic and the copies had drifted apart; this document in particular
// used to hard-code CGST and SGST at 9% each regardless of what the goods
// actually attract.
//
// `interState` must be passed through rather than defaulted: the server
// decides CGST/SGST vs IGST by comparing this document's Place of Supply
// against the company's registered state, and for a long time this page
// never passed the flag at all — so an inter-state invoice displayed a
// CGST/SGST split while the record it saved held IGST.
//
// `grandTotal` and `discount` are kept in the returned shape because the
// totals panel below reads those names.
//
// Freight Charges is intentionally NOT folded into Taxable Amount here
// (unlike the other seven document pages, which still pass freightAmount
// into buildDocument). Freight Charges already carries its own tax — the
// Net/Tax Amount typed into FreightChargesEditor — so folding its net into
// the taxable base and running it through the same per-line GST ratio as
// the goods double-taxes it: once implicitly via the inflated ratio, and
// again explicitly when freightTaxAmount used to get added to grandTotal
// below. Taxable Amount and CGST/SGST here now reflect the goods only;
// Freight Charges' Net + Tax (freightGrossAmount) is added to Grand Total
// as a single already-taxed lump sum instead.
function computeTotals(items, discountPercent, interState = false, extraCharges = {}) {
  const { totals } = buildDocument(items, discountPercent, {
    interState,
    roundOff: true,
  });
  // Company policy: Road Tax must never affect Sales Invoice's Grand Total,
  // no matter how the field gets a value (manual entry, or Copy From/To a
  // document that has Road Tax applied). The figure is still surfaced in the
  // returned shape (some callers/printouts may want to show it informationally),
  // but it is deliberately left out of the grandTotal sum below.
  const roadTax = round2(Number(extraCharges.roadTax) || 0);
  const freightGrossAmount = computeFreightGross(extraCharges.freightNetAmount, extraCharges.freightTaxAmount);
  return {
    ...totals,
    discount: computeItemDiscountTotal(items),
    roadTax,
    freightGrossAmount,
    grandTotal: round2(totals.amount + freightGrossAmount),
  };
}

function rowToFormValues(row, taxCodes) {
  const taxCodeIdByRate = buildTaxCodeIdByRate(taxCodes);
  return {
    customerState: row.customerState || '',
    invoiceNo: row.invoiceNo, seriesId: '', branch: row.branch || '', customer: row.customer || '', supplier: row.supplier || '', contactPerson: row.contactPerson || '', invoiceDate: row.invoiceDate,
    orderNo: row.orderNo || '', orderDate: row.orderDate || null,
    deliveryChallanNo: row.deliveryChallanNo || '', challanDate: row.challanDate || null, dueDate: row.dueDate, customerRefNo: row.customerRefNo || '',
    warehouse: row.warehouse || '',
    currency: row.currency || 'INR', paymentTerms: row.paymentTerms || '', salesPerson: row.salesPerson || '',
    source: row.source || '',
    placeOfSupply: row.placeOfSupply || '',
    machineryCode: row.machineryCode || '', gstNo: row.gstNo || '',
    receiver: row.receiver || '', receiverPhone: row.receiverPhone || '',
    billingAddress: cleanAddressText(row.billingAddress), shippingAddress: cleanAddressText(row.shippingAddress), shipToDifferentCustomer: !!row.shipToDifferentCustomer, shipToCustomer: row.shipToCustomer || '', billToDifferentCustomer: false, billToCustomer: '', billToGstNo: row.billToGstNo || '', billToGstType: row.billToGstType || '', billToPanNo: row.billToPanNo || '', shipToGstNo: row.shipToGstNo || '', shipToGstType: row.shipToGstType || '', shipToPanNo: row.shipToPanNo || '',
    remarks: row.remarks || '', termsConditions: row.termsConditions || '',
    preparedBy: row.preparedBy || '', approvedBy: row.approvedBy || '', attachmentName: row.attachmentName || '',
    discountPercent: row.discountPercent != null ? Number(row.discountPercent) : 0,
    status: row.status || 'Draft', paymentStatus: row.paymentStatus || 'Unpaid',
    billingType: row.billingType || '', typeOfPurchase: row.typeOfPurchase || '',
    salesType: row.salesType || '', transportMode: row.transportMode || '', invoiceType: row.invoiceType || '',
    salesCategory: row.salesCategory || 'Parts',
    machineSerialNo: row.machineSerialNo || '', engineNo: row.engineNo || '', hypothecation: row.hypothecation || '',
    roadTax: row.roadTax != null ? Number(row.roadTax) : 0,
    freightTransportId: row.freightTransportId != null ? Number(row.freightTransportId) : null,
    freightName: row.freightName || '', freightRemarks: row.freightRemarks || '',
    freightTaxCodeId: row.freightTaxCodeId != null ? Number(row.freightTaxCodeId) : null,
    freightTaxAmount: row.freightTaxAmount != null ? Number(row.freightTaxAmount) : 0,
    freightNetAmount: row.freightNetAmount != null ? Number(row.freightNetAmount) : 0,
    freightGrossAmount: row.freightGrossAmount != null ? Number(row.freightGrossAmount) : 0,
    items: (row.items && row.items.length ? row.items : [{ ...emptyItem }]).map((i) => ({
      productCode: i.productCode || '', productName: i.productName || '', description: i.description || '',
      hsnCode: i.hsnCode || '', uom: i.uom || '',
      quantity: i.quantity != null ? Number(i.quantity) : 1,
      unitPrice: i.unitPrice != null ? Number(i.unitPrice) : 0,
      discountPercent: i.discountPercent != null ? Number(i.discountPercent) : 0,
      taxPercent: i.taxPercent != null ? Number(i.taxPercent) : 18,
      taxCodeId: i.taxCodeId != null
        ? Number(i.taxCodeId)
        : (taxCodeIdByRate.get(i.taxPercent != null ? Number(i.taxPercent) : 18) ?? null),
      // Line-first, header-fallback — same convention as GRN's
      // toGrnItemData: a row saved before this field existed still shows the
      // invoice's own warehouse rather than a blank.
      warehouse: i.warehouse || row.warehouse || '',
      // Coerced like quantity/unitPrice above — the API returns a saved
      // allocation's quantity as a string, and batchAllocationLineSchema
      // wants a number. Only ever populated when this invoice was direct at
      // save time — see salesInvoiceInclude in resources.js.
      batchAllocations: (i.batchAllocations || []).map((b) => ({ batchNo: b.batchNo, quantity: Number(b.quantity) || 0 })),
      serialAllocations: (i.serialAllocations || []).map((s) => ({ serialNo: s.serialNo })),
    })),
  };
}

const PAGE_SIZE = 10;
const STATUS_FILTERS = ['All Status', ...SALES_INVOICE_STATUS_OPTIONS];
const PAYMENT_STATUS_FILTERS = ['All Payment Status', ...SALES_INVOICE_PAYMENT_STATUS_OPTIONS];

const STATUS_COLORS = { Draft: 'default', Sent: 'info', Paid: 'success', Overdue: 'error', Cancelled: 'error' };
const PAYMENT_STATUS_COLORS = { Unpaid: 'error', 'Partially Paid': 'warning', Paid: 'success' };

const SALES_INVOICE_LIST_TABLE_ROW_HEIGHT = 0;
const SALES_INVOICE_LIST_TABLE_CELL_PADDING_Y = 6;
export default function SalesInvoice({ openDocNo } = {}) {
  const currentUser = useSelector(selectCurrentUser);
  // Every currency dropdown reads live from Currency Master instead of a
  // hardcoded list — see lib/currencyOptions.js.
  const currencyOptions = useCurrencyOptions();
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const [sendInvoiceWhatsAppMutation, { isLoading: sendingInvoiceWhatsApp }] = useSendSalesInvoiceWhatsAppMutation();
  // Shared by both the form footer's WhatsAppShareButton (already viewing
  // the row being sent) and the list row's own icon (which first switches
  // into viewing that row -- see handleSendRowWhatsApp below -- so that by
  // the time this runs, captureSalesInvoicePdf() is screenshotting THIS
  // row's printable, not whatever was on screen before).
  const handleSendInvoiceWhatsApp = async (row) => {
    try {
      const pdfBlob = await captureSalesInvoicePdf();
      const formData = new FormData();
      formData.append('file', pdfBlob, `${row.invoiceNo || 'invoice'}.pdf`);
      const targetPhone = row.receiverPhone || (customers || []).find((c) => c.customerName === row.customer || c.customerCode === row.customer)?.phone;
      if (targetPhone) formData.append('phone', targetPhone);
      await sendInvoiceWhatsAppMutation({ id: row.id, formData }).unwrap();
      notify.success('Sent via WhatsApp');
    } catch (err) {
      notify.error(err?.data?.message || err?.message || 'Could not send via WhatsApp');
    }
  };
  const isMobile = useIsMobileListView();
  const itemScrollRef = useDragScroll();
  // Phase 6 of the data-loading performance work (pure data-access, no
  // business-logic change) — this list now fetches ONE page at a time via
  // salesInvoiceApi.useListPaged (see useServerListTable below and the
  // paginatedFindMany-based /sales/invoices route in
  // backend/src/routes/resources.js), instead of the whole invoice table
  // with full item includes on every mount. `invoices`/`isLoading`/
  // `refetchInvoices` are gone; the loaded page lives in `table.rows`,
  // refetch is `refetchInvoices` below.
  //
  // invoicesForHistory/deliveryChallans/salesReturns/salesOrders/quotations
  // below stay on `.useList()` — they feed cross-document lookups (Smart Add
  // History, Copy From) that need to see records across the whole set, not
  // one page — but that call is itself now capped server-side (see
  // paginatedFindMany's `maxPageSize`) instead of genuinely unbounded.
  const { data: invoicesForHistory } = salesInvoiceApi.useList();
  const { data: deliveryChallans } = deliveryChallanApi.useList();
  // Needed to know which challans have already had a Sales Return raised
  // against them — see copyableChallans below.
  const { data: salesReturns } = salesReturnApi.useList();
  const { data: salesOrders } = salesOrderApi.useList();

  const { data: quotations } = salesQuotationApi.useList();
  const allSalesDocuments = useMemo(() => {
    return [
      ...(quotations || []),
      ...(salesOrders || []),
      ...(deliveryChallans || []),
      ...(invoicesForHistory || []),
    ];
  }, [quotations, salesOrders, deliveryChallans, invoicesForHistory]);

  // A Sales Order already fully fulfilled comes back from
  // recomputeSalesOrder (utils/documentFlow.js) as 'Closed' — same terminal
  // status Purchase Order uses (see copyablePurchaseOrders in
  // PurchaseInvoice.jsx) — so it's dropped from the Copy From dialog the
  // same way. This dialog was passing the raw, unfiltered `salesOrders` list
  // straight through, which is why a closed order still showed up as
  // pickable here even though it has nothing left to invoice.
  const copyableSalesOrders = useMemo(
    () => (salesOrders || []).filter((o) => o.status !== 'Closed' && o.status !== 'Cancelled'),
    [salesOrders]
  );
  const { data: customers, isLoading: customersLoading } = customerApi.useList();
  // Supplier (Business Partner / Vendor) chosen so their logo can be printed
  // alongside the KEMACH logo — see SalesQuotation.jsx's own Supplier field.
  const { data: suppliers } = supplierApi.useList();
  const { data: products, isLoading: productsLoading } = productApi.useList({ view: 'picker' });
  // Looked up per row to decide whether the Batch/Serial column applies —
  // Product Master's Manage Item By select is what makes a line ask for it.
  // Mirrors DeliveryChallan.jsx's own productsByCode exactly.
  const productsByCode = useMemo(
    () => Object.fromEntries((products || []).map((p) => [p.productCode, p])),
    [products]
  );
  // Which row's Batch/Serial "Selection" dialog is open, if any — see
  // BatchSerialCell and the BatchSerialSelectionDialog render below.
  const [batchDialog, setBatchDialog] = useState(null);
  const { rates: priceListRates } = usePriceListRates('CLP');
  const { data: salesEmployees } = salesEmployeeApi.useList();
  // Warehouse master, for validating a warehouse still belongs to the branch
  // when the branch changes — see the effect in the form body.
  const { warehouses } = useWarehouseOptions();
  const { data: taxCodes, isLoading: taxCodesLoading } = taxCodeApi.useList();
  // A brand-new item row's Tax (%) CFL defaults to this Tax Code instead of
  // showing empty — see pickDefaultTaxCode's own doc comment.
  const defaultTaxCode = useMemo(() => pickDefaultTaxCode(taxCodes), [taxCodes]);
  // Tax (%) is now a Tax Code CFL: every active Tax Code master entry gets
  // its own option (never collapsed by rate — see buildTaxCodeOptions),
  // keyed by taxCodeId (not the rate), so two Tax Codes that happen to
  // share a rate both still show up in the dropdown, and GL posting
  // (backend/src/utils/glPosting.js) can prefer that exact Tax Code's own
  // Sales account over GlAccountDetermination's company-wide default.
  // Filtered live to the GST/IGST family the document's own Place of Supply
  // vs. Company State comparison calls for — computed inside the form body
  // below (requiredTaxFamily), since that comparison needs
  // `watch('placeOfSupply')`.
  // The printed invoice's "Company's Bank Details" block — the first Active
  // house bank, so the details are maintained in the House Bank master rather
  // than hardcoded into the print template.
  const { data: houseBanks } = houseBankApi.useList();
  const printHouseBank = useMemo(
    // Prefer the house bank flagged as the default (HouseBank.isDefault);
    // only fall back to "first Active" when no default is set.
    () => (houseBanks || []).find((b) => b.isDefault === true) || (houseBanks || []).find((b) => b.status === 'Active') || null,
    [houseBanks]
  );
  const { data: company, isLoading: companyLoading } = useGetCompanyDetailsQuery();
  // View toggles between the invoice list and the full-page Create/Edit
  // form — same page, no dialog/popup, per the standard CRUD page template.
  // Declared here (ahead of where it's used further down originally) so
  // editingRow is available to seed useBranchNameOptions' currentValue.
  const [view, setView] = useState('list');
  const [editingRow, setEditingRow] = useState(null);
  const { options: branchOptions, isLoading: branchesLoading, branches } = useBranchNameOptions({ currentValue: editingRow?.branch });
  // The masters this page cannot meaningfully render without — customer/
  // product pickers, tax rates, branch list, the company record the tax
  // calc needs. Gating first paint on all of them together (rather than
  // only salesInvoiceApi's own isLoading, as before) means the page renders
  // once with everything it needs instead of painting once per response as
  // each query resolves on its own — that trickle was the "loads multiple
  // times" re-render churn on first open. See the CircularProgress guard
  // below, which now checks this alongside the existing openDocNo case.
  const mastersLoading = customersLoading || productsLoading || branchesLoading || taxCodesLoading || companyLoading;
  const [create, { isLoading: creating }] = salesInvoiceApi.useCreate();
  const [update, { isLoading: updating }] = salesInvoiceApi.useUpdate();
  const [remove] = salesInvoiceApi.useDelete();
  const [cancelInvoice] = salesInvoiceApi.useCancel();

  // Memoized so these option arrays are only rebuilt when the query data
  // that feeds them actually changes, instead of on every render (typing in
  // a field, opening a menu, ...) — same reasoning as the mastersLoading
  // gate below: this page used to re-render once per master query as each
  // one resolved, on top of rebuilding every option array each time.
  const customerOptions = useMemo(
    () => (customers || []).map((c) => ({ label: c.customerName, value: c.customerName })),
    [customers]
  );
  // Create/edit form's Customer field only (the shared PartyCodeSelect) —
  // shows Code/Name, value stays the customer name. The list-view filter
  // keeps using customerOptions (names) unchanged.
  const customerFieldOptions = useMemo(
    () => buildPartyCodeOptions(customers, 'customerCode', 'customerName'),
    [customers]
  );
  // Same Code/Name party-select shape as customerFieldOptions, for the new
  // Supplier field.
  const supplierFieldOptions = useMemo(
    () => buildPartyCodeOptions(suppliers, 'supplierCode', 'supplierName'),
    [suppliers]
  );
  const salesPersonOptions = useMemo(
    () => (salesEmployees || []).map((s) => ({ label: s.employeeName, value: s.employeeName })),
    [salesEmployees]
  );
  // Prepared By lists every Sales Employee; Approved By is scoped to the
  // ones flagged with approval authorization on the Sales Employee master.
  const approvedByOptions = useMemo(
    () => (salesEmployees || []).filter((s) => s.approvalAuthorization === true).map((s) => ({ label: s.employeeName, value: s.employeeName })),
    [salesEmployees]
  );
  // Sales orders and delivery challans are no longer offered as dropdowns on
  // the form — they are picked through the Copy From dialogs, which scope
  // their lists to the selected customer. Those dialogs take the raw record
  // lists.
  const sourceOptions = useMemo(
    () => ENQUIRY_SOURCE_OPTIONS.map((s) => ({ label: s, value: s })),
    []
  );
  // selectableProducts/productCodeOptions/productNameOptions used to live
  // here, computed from editingRow?.items — a static snapshot that only
  // reflected the record's lines as of page load. That went stale the moment
  // Copy From replaced the items array with a different document's lines, so
  // it's now computed live inside AppForm's render prop instead, keyed off
  // watchedItems (the form's actual current rows).
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  // Journal Entry view popup — opened from the header's "View Journal Entry"
  // icon (rendered only once editingRow.journalEntryId exists, i.e. this
  // invoice already has a linked entry). Same pattern as Purchase GRN.
  const [journalViewOpen, setJournalViewOpen] = useState(false);
  // Copy From. Two pieces of state because it is a two-step control: the
  // button opens a source menu (anchored to it), and the chosen source then
  // opens the matching Find dialog. Both live at page level rather than inside
  // AppForm's render prop so remounting the form on formKey change can't leave
  // a menu or dialog orphaned open over a freshly reset form.
  const [copyFromAnchor, setCopyFromAnchor] = useState(null);
  const [copyFromSource, setCopyFromSource] = useState(null); // 'order' | 'challan' | null

  // A delivery challan can be picked here for as long as ANY of its lines
  // still has quantity that hasn't gone back on a return — quantity-aware,
  // not merely "has this challan ever had a return raised against it":
  // shipping 10 and returning 1-9 still leaves something to invoice, and
  // only returning the full 10 empties it out. (A return itself can only be
  // raised before the challan is invoiced — see assertReturnAllowed in
  // utils/routeMap.js — so this is the matching guard on the other side of
  // that same rule.)
  //
  // Returned-so-far is summed per product code across every non-cancelled
  // Sales Return raised against the challan — a challan can be returned
  // against more than once over time, and each one only carries its own
  // increment.
  const returnedByChallanProduct = useMemo(() => {
    const totals = new Map(); // "<challanNo>::<productCode>" -> quantity returned
    (salesReturns || [])
      .filter((r) => r.status !== 'Cancelled' && r.challanNo)
      .forEach((r) => {
        (r.items || []).forEach((item) => {
          if (!item.productCode) return;
          const key = `${r.challanNo}::${item.productCode}`;
          totals.set(key, (totals.get(key) || 0) + (Number(item.returnQuantity) || 0));
        });
      });
    return totals;
  }, [salesReturns]);

  // A challan with no lines at all is left alone (nothing to judge it by)
  // rather than being treated as fully returned.
  const fullyReturnedChallanNos = useMemo(() => {
    const fully = new Set();
    (deliveryChallans || []).forEach((c) => {
      const items = c.items || [];
      if (!items.length) return;
      const somethingRemains = items.some((item) => {
        const delivered = Number(item.quantity) || 0;
        const returned = returnedByChallanProduct.get(`${c.challanNo}::${item.productCode}`) || 0;
        return delivered - returned > 0.005;
      });
      if (!somethingRemains) fully.add(c.challanNo);
    });
    return fully;
  }, [deliveryChallans, returnedByChallanProduct]);

  // What the Copy From > Delivery Challan dialog is allowed to offer. A challan
  // whose every line has already come back on a sales return has nothing left
  // to bill, so copying from it could only produce an invoice for goods the
  // customer no longer holds.
  //
  // This used to build the options for a challan dropdown; it is now the
  // record list handed to the dialog. The "already on the record being edited
  // stays selectable" case the dropdown needed is gone with it — the field is
  // read-only now, so an existing invoice's own link is simply displayed and
  // never has to survive a filter to keep showing.
  const copyableChallans = useMemo(
    () => (deliveryChallans || []).filter((c) => c.status !== 'Closed' && !fullyReturnedChallanNos.has(c.challanNo)),
    [deliveryChallans, fullyReturnedChallanNos]
  );

  const [dateAnchor, setDateAnchor] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [checkedIds, setCheckedIds] = useState([]);
  const [rowMenuAnchor, setRowMenuAnchor] = useState(null);
  const [rowMenuTarget, setRowMenuTarget] = useState(null);
  const pendingStatusRef = useRef('Draft');

  // Column definitions drive the global search, the sort icons and the
  // per-column filter popover — see useServerListTable.js. `server: true`
  // pushes that column's sort/filter to the /sales/invoices route (see its
  // SALES_INVOICE_FILTER_SPEC/SALES_INVOICE_SORT_FIELDS in
  // backend/src/routes/resources.js) instead of applying it only to
  // whatever page happens to already be loaded. The Customer/Status/Payment
  // Status/Sales Person Autocomplete row below (the page's own bespoke
  // filter UI) writes into this SAME `table.filters` state via
  // `table.setFilter` — one filter engine, two widgets, so neither can
  // silently disagree with the other about what "filtered" means.
  const tableColumns = useMemo(() => ([
    { field: 'id', headerName: 'Select', filter: false, searchable: false },
    { field: 'invoiceNo', headerName: 'Invoice No.', filter: 'text', server: true },
    { field: 'invoiceDate', headerName: 'Invoice Date', filter: 'dateRange', server: true, sortValue: (row) => (row.invoiceDate ? new Date(row.invoiceDate).getTime() : null) },
    { field: 'customer', headerName: 'Customer', filter: 'text', server: true },
    { field: 'orderNo', headerName: 'Order No.', filter: 'text', server: true },
    { field: 'dueDate', headerName: 'Due Date', filter: 'dateRange', server: true, sortValue: (row) => (row.dueDate ? new Date(row.dueDate).getTime() : null) },
    { field: 'amount', headerName: 'Amount (₹)', filter: 'numberRange', server: true, sortValue: (row) => (row.amount == null || row.amount === '' ? null : Number(row.amount)) },
    { field: 'status', headerName: 'Status', filter: 'select', server: true },
    { field: 'paymentStatus', headerName: 'Payment Status', filter: 'select', server: true },
    // Not a rendered column (`filter: false` keeps it out of the generic
    // filter panel) — exists only so the Sales Person Autocomplete below has
    // a `server: true` slot to write into via table.setFilter, the same way
    // it does for Customer/Status/Payment Status above.
    { field: 'salesPerson', headerName: 'Sales Person', filter: false, server: true },
  ]), []);
  const table = useServerListTable(salesInvoiceApi.useListPaged, {
    columns: tableColumns,
    initialPageSize: PAGE_SIZE,
  });
  const { page, setPage, pageSize, setPageSize } = table;
  const rows = table.rows;
  const filteredRows = rows;
  const pagedRows = rows;
  const isLoading = table.isLoading;
  const refetchInvoices = table.refetch;

  const customerFilter = table.filters.customer ? { value: table.filters.customer } : null;
  const setCustomerFilter = (v) => table.setFilter('customer', v?.value || '');
  const statusFilter = table.filters.status || 'All Status';
  const setStatusFilter = (v) => table.setFilter('status', v === 'All Status' ? '' : v);
  const paymentStatusFilter = table.filters.paymentStatus || 'All Payment Status';
  const setPaymentStatusFilter = (v) => table.setFilter('paymentStatus', v === 'All Payment Status' ? '' : v);
  const salesPersonFilter = table.filters.salesPerson ? { value: table.filters.salesPerson } : null;
  const setSalesPersonFilter = (v) => table.setFilter('salesPerson', v?.value || '');
  const invoiceDateFilter = table.filters.invoiceDate || {};
  const dateFrom = invoiceDateFilter.from ? dayjs(invoiceDateFilter.from) : null;
  const dateTo = invoiceDateFilter.to ? dayjs(invoiceDateFilter.to) : null;
  const setDateFrom = (v) => table.setFilter('invoiceDate', { ...invoiceDateFilter, from: v ? v.format('YYYY-MM-DD') : '' });
  const setDateTo = (v) => table.setFilter('invoiceDate', { ...invoiceDateFilter, to: v ? v.format('YYYY-MM-DD') : '' });

  const openCreate = () => {
    setEditingRow(null);
    setReadOnly(false);
    setFormKey((k) => k + 1);
    setView('form');
  };

  const backToList = () => {
    setView('list');
    setEditingRow(null);
    setReadOnly(false);
    setCopyFromAnchor(null);
    setCopyFromSource(null);
  };

  const handleView = (row) => {
    setEditingRow(row);
    setReadOnly(true);
    setFormKey((k) => k + 1);
    setView('form');
  };

  // Opened from the Route Map's document preview popup: jump straight into
  // this record's own read-only View, exactly as clicking it in the list
  // would, instead of requiring the user to find and click the row.
  useEffect(() => {
    if (!openDocNo) return;
    if (editingRow && editingRow.invoiceNo === openDocNo) return;
    const match = rows.find((r) => r.invoiceNo === openDocNo);
    if (match) handleView(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDocNo, rows]);

  // "Copy To > Sales Invoice" lands the browser on this page's route, but
  // that alone used to leave the user on the LIST view — the intent-
  // consuming effect that actually applies the source document's data lives
  // inside AppForm's render prop below, which only mounts once `view` is
  // 'form', so nothing happened until the user clicked "+ Add New"
  // themselves first. Mirrors the openDocNo effect just above: notice a
  // pending intent addressed to this page on arrival and open the create
  // form immediately, so the user lands straight on a pre-filled invoice.
  const pendingCopyIntentForAutoOpen = useSelector((s) => s.copyIntent.pending);
  useEffect(() => {
    if (!pendingCopyIntentForAutoOpen || pendingCopyIntentForAutoOpen.targetKey !== 'salesInvoice') return;
    if (view === 'form') return;
    openCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCopyIntentForAutoOpen]);

  const handleEdit = (row) => {
    setEditingRow(row);
    setReadOnly(false);
    setFormKey((k) => k + 1);
    setView('form');
    setRowMenuAnchor(null);
  };

  // Printing a row from the list needs the FORM to actually finish
  // re-rendering with THIS row's data before window.print() runs -- a fixed
  // setTimeout(..., 300) is a guess, and when it fires too early the
  // previously-viewed document (e.g. a Sales Order looked at earlier in
  // this tab's session) is still what's on screen and gets printed/opened
  // instead -- see SalesQuotation.jsx's identical printRequestQuotationNo
  // treatment. printRequestInvoiceNo + the effect below only fire the print
  // once editingRow has actually become the row that was clicked. Also:
  // printSalesInvoice() (not a raw window.print()) is what actually
  // activates this document's print-only CSS and waits for its images (see
  // SalesInvoicePrintable.jsx's PRINTING_CLASS gating and
  // purchaseStationery.jsx's makeScopedPrint) -- a bare window.print() here
  // printed nothing at all, since nothing ever added that class.
  const [printRequestInvoiceNo, setPrintRequestInvoiceNo] = useState(null);

  // --- Print copies -------------------------------------------------------
  // The first print of an invoice is three full sets: Original (Finance
  // Copy), Customer Copy, Duplicate. When that print dialog closes the user
  // is asked whether it really printed; "Yes" marks the invoice printed
  // (server-side, so it holds for every user and device) and every later
  // print is the Duplicate alone. "No" leaves it unmarked, so the next print
  // is the full three sets again. An admin can reset the mark from the row
  // menu (Reset Print Status).
  const ALL_PRINT_COPIES = ['Original (Finance Copy)', 'Customer Copy', 'Duplicate'];
  const DUPLICATE_ONLY = ['Duplicate'];
  const [printCopies, setPrintCopies] = useState(null);
  const printInvoiceRef = useRef(null);
  const printInFlightRef = useRef(false);
  const [markPrinted] = useMarkSalesInvoicePrintedMutation();
  const [resetPrinted] = useResetSalesInvoicePrintedMutation();

  // The saved record can be a stale snapshot (the form keeps the row it was
  // opened with), so prefer the freshest copy the lists hold.
  const isInvoicePrinted = (inv) => {
    if (!inv?.id) return false;
    const fresh = (table.rows || []).find((r) => r.id === inv.id) || (invoicesForHistory || []).find((r) => r.id === inv.id);
    return !!(fresh ?? inv).isPrinted;
  };

  const startPrint = (inv) => {
    if (printInFlightRef.current) return;
    printInFlightRef.current = true;
    printInvoiceRef.current = { id: inv?.id || null, wasPrinted: isInvoicePrinted(inv) };
    setPrintCopies(printInvoiceRef.current.wasPrinted ? DUPLICATE_ONLY : ALL_PRINT_COPIES);
  };

  // Runs once the printable has re-rendered with the chosen copies.
  useEffect(() => {
    if (!printCopies) return undefined;
    const { id, wasPrinted } = printInvoiceRef.current || {};
    const onAfterPrint = async () => {
      window.removeEventListener('afterprint', onAfterPrint);
      setPrintCopies(null);
      printInFlightRef.current = false;
      // Nothing to record for a Duplicate-only print or an unsaved invoice.
      if (wasPrinted || !id) return;
      const printed = await confirmDialog({
        title: 'Print confirmation',
        message: 'Was the invoice printed? Choose "Yes" if it printed successfully — later prints of this invoice will then be the Duplicate copy only.',
        confirmLabel: 'Yes, printed',
        cancelLabel: 'No, not printed',
      });
      if (!printed) return;
      try {
        await markPrinted(id).unwrap();
        notify.success('Invoice marked as printed');
      } catch (err) {
        notify.error(err?.data?.message || 'Could not record the print status');
      }
    };
    window.addEventListener('afterprint', onAfterPrint);
    // Some PDF drivers never fire afterprint; don't leave Print locked out.
    const unlockTimer = setTimeout(() => { printInFlightRef.current = false; }, 90000);
    printSalesInvoice();
    return () => { window.removeEventListener('afterprint', onAfterPrint); clearTimeout(unlockTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printCopies]);

  const handleResetPrinted = async (row) => {
    setRowMenuAnchor(null);
    const ok = await confirmDialog({
      title: 'Reset print status',
      message: `Mark invoice "${row.invoiceNo}" as not printed? Its next print will include the Original (Finance Copy), Customer Copy and Duplicate again.`,
      confirmLabel: 'Reset',
    });
    if (!ok) return;
    try {
      await resetPrinted(row.id).unwrap();
      notify.success('Print status reset');
    } catch (err) {
      notify.error(err?.data?.message || 'Could not reset the print status');
    }
  };

  const handlePrint = (row) => {
    setRowMenuAnchor(null);
    handleView(row);
    setPrintRequestInvoiceNo(row.invoiceNo);
  };

  useEffect(() => {
    if (!printRequestInvoiceNo) return;
    if (!editingRow || editingRow.invoiceNo !== printRequestInvoiceNo) return;
    setPrintRequestInvoiceNo(null);
    // Printing from the LIST should leave the user back on the list once
    // the browser's print dialog is dismissed, not stranded inside the
    // invoice it had to open in order to print -- 'afterprint' fires either
    // way (printed or cancelled). The form footer's own Print button calls
    // printSalesInvoice() directly, not through this effect, so it's
    // deliberately unaffected -- staying on the form there is correct.
    const returnToListAfterPrint = () => {
      window.removeEventListener('afterprint', returnToListAfterPrint);
      backToList();
    };
    window.addEventListener('afterprint', returnToListAfterPrint);
    startPrint(editingRow);
  }, [printRequestInvoiceNo, editingRow]);

  // Same "switch into viewing this row, then act once it's actually on
  // screen" trick as Print above -- captureSalesInvoicePdf() screenshots
  // whatever's currently rendered, so it has to wait for editingRow to
  // actually become this row first.
  const [whatsappRequestInvoiceNo, setWhatsappRequestInvoiceNo] = useState(null);

  const handleSendRowWhatsApp = (row) => {
    setRowMenuAnchor(null);
    handleView(row);
    setWhatsappRequestInvoiceNo(row.invoiceNo);
  };

  useEffect(() => {
    if (!whatsappRequestInvoiceNo) return;
    if (!editingRow || editingRow.invoiceNo !== whatsappRequestInvoiceNo) return;
    setWhatsappRequestInvoiceNo(null);
    // Sending from the LIST should leave the user back on the list once the
    // send finishes (success or failure -- handleSendInvoiceWhatsApp already
    // shows its own toast either way), not stranded inside the invoice it
    // had to open in order to capture the PDF. The form footer's own
    // WhatsAppShareButton calls handleSendInvoiceWhatsApp directly, not
    // through this effect, so it's deliberately unaffected -- staying on
    // the form there is correct.
    handleSendInvoiceWhatsApp(editingRow).then(() => backToList());
  }, [whatsappRequestInvoiceNo, editingRow]);

  const handleDelete = async (row) => {
    setRowMenuAnchor(null);
    const ok = await confirmDialog({
      title: 'Delete sales invoice',
      message: `Are you sure you want to delete "${row.invoiceNo}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Sales invoice deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  // Cancel — a soft alternative to Delete: the invoice stays in the list
  // (status becomes "Cancelled") but is dropped from every Copy From / "pick
  // a source document" picker downstream (see copyableInvoices in
  // SalesCreditMemo.jsx) and View/Edit/Print get blocked for it below, once
  // isCancelled is true. Only allowed while no collection is applied against
  // it and no live Sales Credit Memo references it yet — the backend
  // enforces this and returns a clear message if not, same as Purchase
  // Order's identical Cancel action.
  const handleCancel = async (row) => {
    setRowMenuAnchor(null);
    const ok = await confirmDialog({
      title: 'Cancel sales invoice',
      message: `Are you sure you want to cancel "${row.invoiceNo}"? This cannot be undone — the invoice will be locked and hidden from Credit Memo creation.`,
      confirmLabel: 'Cancel Invoice',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await cancelInvoice(row.id).unwrap();
      notify.success('Sales invoice cancelled');
    } catch (err) {
      notify.error(err?.data?.message || 'Cancel failed');
    }
  };

  const removeSelected = async () => {
    const ok = await confirmDialog({
      title: 'Delete selected invoices',
      message: `Delete ${checkedIds.length} selected invoice${checkedIds.length > 1 ? 's' : ''}? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await Promise.all(checkedIds.map((id) => remove(id).unwrap()));
      notify.success('Selected invoices deleted');
      setCheckedIds([]);
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    // A Batch/Serial-tracked line whose quantity isn't fully covered by its
    // selected batches/serials cannot be saved — see
    // validateBatchSerialAllocation above. The server enforces the same
    // rule (assertBatchSerialIssueAllocation) so this is a fast local
    // check, not the only line of defence. Only reached when this invoice
    // is direct — a challan-backed invoice never shows the Batch/Serial
    // column and carries no selections of its own to check.
    const isDirect = !values.deliveryChallanNo || String(values.deliveryChallanNo).trim() === '';
    if (isDirect) {
      const allocationError = validateBatchSerialAllocation(values.items);
      if (allocationError) {
        notify.error(allocationError);
        return;
      }
    }
    const payload = { ...values, status: pendingStatusRef.current };
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...payload }).unwrap();
        notify.success('Sales invoice updated');
      } else {
        await create(payload).unwrap();
        notify.success('Sales invoice saved');
      }
      backToList();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  const dateRangeLabel = dateFrom && dateTo
    ? `${dateFrom.format('DD/MM/YYYY')} - ${dateTo.format('DD/MM/YYYY')}`
    : 'Select date range';

  // mastersLoading added alongside the existing openDocNo wait: both are
  // "there is nothing sensible to paint yet" states, so both use the same
  // spinner rather than the page flashing its shell before the data it
  // needs has arrived.
  if ((openDocNo && (!editingRow || editingRow.invoiceNo !== openDocNo)) || mastersLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box>

      {view === 'form' ? (
        <RouteMapContextMenu flow="sales" type="invoice" docNo={editingRow?.invoiceNo}>
          <AppForm
            key={formKey}
            schema={salesInvoiceSchema}
            defaultValues={editingRow ? rowToFormValues(editingRow, taxCodes) : getEmptyValues(currentUser?.name || currentUser?.email, defaultTaxCode)}
            onSubmit={handleSubmit}
          >
            {(methods) => {
              const { control, watch, setValue } = methods;
              // Machine No./Engine No./Hypothecation only make sense on a
              // Parts/Services/Claims document -- switching to "Machine"
              // blanks them out (both on screen and in what gets saved)
              // instead of leaving stale data on a Machine document.
              // Switching back to Parts/Services/Claims within the same
              // editing session restores whatever was typed before the
              // switch, via this ref, rather than losing it for good.
              const machineFieldsCacheRef = useRef({ machineSerialNo: '', engineNo: '', hypothecation: '' });
              const salesCategoryValue = watch('salesCategory');
              const prevSalesCategoryRef = useRef(salesCategoryValue);
              useEffect(() => {
                const prevCategory = prevSalesCategoryRef.current;
                prevSalesCategoryRef.current = salesCategoryValue;
                if (prevCategory === salesCategoryValue) return;
                if (salesCategoryValue === 'Machine') {
                  machineFieldsCacheRef.current = {
                    machineSerialNo: methods.getValues('machineSerialNo') || '',
                    engineNo: methods.getValues('engineNo') || '',
                    hypothecation: methods.getValues('hypothecation') || '',
                  };
                  setValue('machineSerialNo', '');
                  setValue('engineNo', '');
                  setValue('hypothecation', '');
                } else if (salesCategoryValue !== 'Machine' && prevCategory === 'Machine') {
                  const cached = machineFieldsCacheRef.current;
                  setValue('machineSerialNo', cached.machineSerialNo);
                  setValue('engineNo', cached.engineNo);
                  setValue('hypothecation', cached.hypothecation);
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [salesCategoryValue]);
              // Claims/Services: this whole document never moves stock (see
              // isNonStockSalesCategory in lib/validation/common.js — the
              // same test salesSchemas.js's requireWarehouseUnlessNonStockCategory
              // uses to skip the per-line Warehouse requirement server/schema
              // side). The per-line Warehouse column is hidden entirely below
              // rather than just left optional, and any values already on the
              // lines are cleared so a document switched INTO Claims/Services
              // doesn't silently keep a stale warehouse that no longer means
              // anything (and switching back out starts clean, same as any
              // other required field would).
              const isNonStockCategory = isNonStockSalesCategory(salesCategoryValue);
              const prevNonStockCategoryRef = useRef(isNonStockCategory);
              useEffect(() => {
                if (prevNonStockCategoryRef.current === isNonStockCategory) return;
                prevNonStockCategoryRef.current = isNonStockCategory;
                if (!isNonStockCategory) return;
                setValue('warehouse', '');
                (methods.getValues('items') || []).forEach((_it, idx) => {
                  setValue(`items.${idx}.warehouse`, '');
                });
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [isNonStockCategory]);
              const { fields, append, remove: removeItem, replace: replaceItems } = useFieldArray({ control, name: 'items' });
              // "Copy To" hand-off — see copyIntentSlice.js and CopyToButton.jsx.
              const dispatch = useDispatch();
              const pendingCopyIntent = useSelector((s) => s.copyIntent.pending);
              const watchedItems = watch('items') || [];
              // "Import Items from Excel" — adds rows to THIS document's item
              // table, distinct from the list page's BulkImportDialog (which
              // creates whole new invoices). See resolveImportedItem below.
              const [itemsImportOpen, setItemsImportOpen] = useState(false);

              // "Item Details" card — Item Detail / E-Invoice / E-Way Bill tabs.
              // Same pattern as ProductMaster.jsx's General/Purchase/Sales/
              // Inventory tabs: a `tab` index plus MUI Tabs/Tab, switched with
              // conditional `tab === n` blocks below rather than unmounting
              // anything (the item grid keeps its react-hook-form field-array
              // state either way).
              const [tab, setTab] = useState(0);

              // TaxPro GSP e-invoice / e-way bill actions (see
              // services/taxproGsp.service.js on the backend). These are
              // deliberately NOT react-hook-form fields: they're system-
              // generated values that only ever change via these four API
              // calls, never by the user typing into the main Save/Update
              // flow, so they're read straight off `editingRow` (kept fresh
              // below by updating it with each mutation's response) instead
              // of round-tripping through the header form's own submit.
              const [generateEInvoice, { isLoading: generatingEInvoice }] = useGenerateEInvoiceMutation();
              const [cancelEInvoiceMutation, { isLoading: cancellingEInvoice }] = useCancelEInvoiceMutation();
              const [generateEWayBillMutation, { isLoading: generatingEWayBill }] = useGenerateEWayBillMutation();
              const [cancelEWayBillMutation, { isLoading: cancellingEWayBill }] = useCancelEWayBillMutation();
              const [edocError, setEdocError] = useState('');
              // null | 'einvoice' | 'eway-bill' — which action the Cancel
              // Reason dialog below is currently prompting for.
              const [cancelDialogFor, setCancelDialogFor] = useState(null);
              const [cancelReason, setCancelReason] = useState('');
              // E-Way Bill's own fields (Transporter Name/GSTIN, Vehicle No,
              // Distance) aren't part of the main invoice form/schema either —
              // seeded once from editingRow, like prevCustomer/prevPaymentTerms
              // below, since this component instance is remounted (via
              // formKey) whenever a different invoice is opened.
              const [ewbTransporterName, setEwbTransporterName] = useState(editingRow?.transporterName || '');
              const [ewbTransporterGstin, setEwbTransporterGstin] = useState(editingRow?.transporterGstin || '');
              const [ewbVehicleNo, setEwbVehicleNo] = useState(editingRow?.vehicleNo || '');
              const [ewbDistanceKm, setEwbDistanceKm] = useState(editingRow?.ewayDistanceKm != null ? String(editingRow.ewayDistanceKm) : '');

              const einvoiceStatus = editingRow?.einvoiceStatus || 'Not Generated';
              const ewayBillStatus = editingRow?.ewayBillStatus || 'Not Generated';
              const canGenerateEDocs = Boolean(editingRow?.id && editingRow?.invoiceNo);
              const statusChipColor = (s) => (s === 'Generated' ? 'success' : s === 'Cancelled' ? 'error' : 'default');

              const handleGenerateEInvoice = async () => {
                setEdocError('');
                try {
                  const updated = await generateEInvoice(editingRow.id).unwrap();
                  setEditingRow((prev) => (prev ? { ...prev, ...updated } : prev));
                  notify.success('E-Invoice generated');
                } catch (err) {
                  setEdocError(err?.data?.message || 'Could not generate the e-invoice');
                }
              };

              const handleGenerateEWayBill = async () => {
                setEdocError('');
                try {
                  const updated = await generateEWayBillMutation({
                    id: editingRow.id,
                    transporterName: ewbTransporterName,
                    transporterGstin: ewbTransporterGstin,
                    vehicleNo: ewbVehicleNo,
                    transportMode: watch('transportMode'),
                    distanceKm: ewbDistanceKm === '' ? null : Number(ewbDistanceKm),
                  }).unwrap();
                  setEditingRow((prev) => (prev ? { ...prev, ...updated } : prev));
                  notify.success('E-Way Bill generated');
                } catch (err) {
                  setEdocError(err?.data?.message || 'Could not generate the e-way bill');
                }
              };

              const openCancelDialog = (which) => {
                setEdocError('');
                setCancelReason('');
                setCancelDialogFor(which);
              };

              const handleConfirmCancel = async () => {
                if (!cancelReason.trim()) return;
                setEdocError('');
                try {
                  const updated = cancelDialogFor === 'einvoice'
                    ? await cancelEInvoiceMutation({ id: editingRow.id, cancelReason }).unwrap()
                    : await cancelEWayBillMutation({ id: editingRow.id, cancelReason }).unwrap();
                  setEditingRow((prev) => (prev ? { ...prev, ...updated } : prev));
                  notify.success(cancelDialogFor === 'einvoice' ? 'E-Invoice cancelled' : 'E-Way Bill cancelled');
                  setCancelDialogFor(null);
                  setCancelReason('');
                } catch (err) {
                  setEdocError(err?.data?.message || 'Could not cancel');
                }
              };

              // Shadows the outer-scope selectableProducts (computed from
              // editingRow?.items, a static snapshot) with a live version
              // keyed off the form's actual current lines -- a product Copy
              // From just brought in wasn't in that static list and its
              // Item No / Description Select rendered blank.
              // Recomputing this from the FULL product master on every render
              // (productOptionsFor filters/maps the whole list, then two more maps
              // build the Select options) is wasted work whenever the render was
              // triggered by something that isn't a product-code change on any line —
              // typing in a header field, a date, the Branch, etc. all re-run this
              // render-prop function, but none of them change which product codes are
              // on the form, and the two fresh option arrays were also handing every
              // line's Autocomplete a new options identity each keystroke. Keyed on
              // the joined codes (a cheap string, not the products list itself) so it
              // only recomputes when a line's product actually changes. Output is
              // identical to calling productOptionsFor directly — this only skips
              // redundant re-invocations on unchanged inputs. Same shape as the
              // already-proven version in PurchaseGRN.jsx.
              const itemProductCodesKey = watchedItems.map((i) => i.productCode || '').join('\u0001');
              const selectableProducts = useMemo(
                () => productOptionsFor(
                  products,
                  PRODUCT_USAGE.SALES,
                  watchedItems.map((i) => i.productCode)
                ),
                // eslint-disable-next-line react-hooks/exhaustive-deps
                [products, itemProductCodesKey]
              );
              const productCodeOptions = useMemo(
                () => selectableProducts.map((p) => ({ label: p.productCode, value: p.productCode })),
                [selectableProducts]
              );
              const productNameOptions = useMemo(
                () => selectableProducts.map((p) => ({ label: p.productName, value: p.productCode })),
                [selectableProducts]
              );
              const invoiceDateValueForRange = watch('invoiceDate');
              const dueDateMinDate = invoiceDateValueForRange ? dayjs(invoiceDateValueForRange) : undefined;

              // Inter-state supplies are taxed wholly as IGST. Computed here
              // (ahead of the item columns/Tax (%) options below, which both
              // depend on it) by comparing Place of Supply against the
              // company's registered state — the same comparison the server
              // makes when it recomputes GST at save time.
              // State -- display-only, auto-filled from the selected customer's
              // Business Partner Billing address (same pattern as the purchase
              // documents' supplier State), never hand-typed. This -- NOT Place
              // of Supply -- decides CGST/SGST vs IGST and which Tax Code family
              // the Tax (%) column offers.
              const selectedCustomerForState = watch('customer');
              const derivedCustomerState = useMemo(() => {
                const selected = selectedCustomerForState;
                const found = selected
                  ? (customers || []).find((c) => c.customerName === selected || c.customerCode === selected)
                  : null;
                const billing = (found?.addresses || []).filter((a) => a.addressType === 'Billing');
                const defaultBilling = billing.find((a) => a.isDefault) || billing[0];
                return defaultBilling?.state || '';
              }, [customers, selectedCustomerForState]);
              useEffect(() => {
                // Wait for the customer list so an existing document's saved
                // State isn't blanked while it is still loading.
                if (!customers) return;
                setValue('customerState', derivedCustomerState || '', { shouldValidate: true });
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [customers, derivedCustomerState]);
              const interState = isInterState(watch('customerState'), company?.state);
              // Tax (%) only ever offers the type this comparison calls for:
              // GST (CGST+SGST) intra-state, IGST inter-state. Recomputed live
              // as Place of Supply changes, so picking a different state
              // switches the dropdown's contents immediately rather than only
              // on the next save.
              const requiredTaxFamily = taxTypeFamilyFor(interState);
              const taxCodeOptions = useMemo(
                () => buildTaxCodeOptions(taxCodes, { taxType: requiredTaxFamily }),
                [taxCodes, requiredTaxFamily]
              );
              const taxCodeById = useMemo(() => new Map(taxCodeOptions.map((o) => [o.value, o])), [taxCodeOptions]);
              // Default Tax Code for a row added via "Add Item" once Place of
              // Supply is known — GST@18% intra-state, IGST@18% inter-state,
              // following the same requiredTaxFamily the dropdown itself is
              // filtered to. The plain top-level defaultTaxCode (GST@18%) is
              // still what seeds getEmptyValues' very first row, since Place
              // of Supply defaults to the company's own state at that point.
              const liveDefaultTaxCode = useMemo(
                () => pickDefaultTaxCode(taxCodes, { taxType: requiredTaxFamily }),
                [taxCodes, requiredTaxFamily]
              );
              // A Tax Code left over from before Place of Supply flipped intra
              // <-> inter-state (e.g. an IGST code still selected on a line
              // after the invoice became intra-state) is no longer one of the
              // options above. Skipped on first render — same prevRef pattern
              // as the branch/warehouse effect below — so loading an existing,
              // already-consistent invoice for edit/view never clears its
              // rows; it only resets a row picked before the user's own change
              // to Place of Supply made it invalid.
              const prevRequiredTaxFamily = useRef(requiredTaxFamily);
              useEffect(() => {
                if (prevRequiredTaxFamily.current === requiredTaxFamily) return;
                prevRequiredTaxFamily.current = requiredTaxFamily;
                const validTaxCodeIds = new Set(taxCodeOptions.map((o) => o.value));
                watchedItems.forEach((item, idx) => {
                  if (item?.taxCodeId != null && !validTaxCodeIds.has(Number(item.taxCodeId))) {
                    // Re-default to the OTHER family's plain rate (GST<->IGST)
                    // rather than clearing the field blank — Place of Supply
                    // changing is what invalidated the old code in the first
                    // place, so the row should follow it to the new family's
                    // own default, same as a brand-new row would.
                    setValue(`items.${idx}.taxCodeId`, liveDefaultTaxCode ? liveDefaultTaxCode.id : null, { shouldValidate: true });
                    setValue(`items.${idx}.taxPercent`, liveDefaultTaxCode ? liveDefaultTaxCode.rate : null, { shouldValidate: true });
                  }
                });
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [requiredTaxFamily, taxCodeOptions, liveDefaultTaxCode]);

              // Belt-and-braces for a brand-new invoice opened before the Tax
              // Code master had finished loading: getEmptyValues' own default
              // (defaultTaxCode, computed from taxCodes at the moment this
              // page first mounted) can resolve to nothing if that fetch was
              // still in flight, leaving the first row's Tax (%) genuinely
              // blank with no invalid code for the effect above to catch and
              // replace. This backfills it the moment Tax Codes (and so
              // liveDefaultTaxCode) become available — once only, and only
              // for a genuinely new document, so it never touches a row the
              // user (or Copy From/Smart Add/Import) deliberately left blank
              // afterwards.
              const backfilledDefaultTaxCode = useRef(false);
              useEffect(() => {
                if (editingRow || backfilledDefaultTaxCode.current || !liveDefaultTaxCode) return;
                backfilledDefaultTaxCode.current = true;
                watchedItems.forEach((item, idx) => {
                  if (item?.taxCodeId == null) {
                    setValue(`items.${idx}.taxCodeId`, liveDefaultTaxCode.id, { shouldValidate: true });
                    setValue(`items.${idx}.taxPercent`, liveDefaultTaxCode.rate, { shouldValidate: true });
                  }
                });
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [liveDefaultTaxCode]);

              // A sales invoice with no delivery challan behind it is the
              // document that despatches the goods (see the salesInvoice
              // headerFilter in backend utils/stockLedger.js), so it — and only
              // it — has to name the warehouse they leave from. With a challan
              // this invoice is finance-only.
              const deliveryChallanNo = watch('deliveryChallanNo');
              const isDirectInvoice = !deliveryChallanNo || String(deliveryChallanNo).trim() === '';
              const branch = watch('branch');
              // Both the header warehouse (direct invoice) and each line's own
              // warehouse need to survive edit/view even when they don't
              // belong to the currently-selected branch's list — see
              // useWarehouseOptions.js.
              const { options: branchWarehouseOptions } = useWarehouseOptions({
                currentValue: [editingRow?.warehouse, ...watchedItems.map((i) => i.warehouse)],
                branch,
              });

              // Turns one row parsed by the server from an uploaded sheet
              // (just { productCode, description, quantity, unitPrice,
              // taxCode, warehouse } — see the /sales/invoices/items-import
              // route, which does no master lookups of its own) into a full
              // item row, resolved against the SAME masters already loaded
              // for this form — products, taxCodes, branchWarehouseOptions —
              // so an imported row ends up identical to one built by hand:
              // picking a product code auto-fills productName/hsnCode/uom
              // (mirrors ProductCell's own effect below), and a Tax Code
              // resolves to its id + rate the same way the Tax (%) select's
              // onValueChange does. An unmatched Tax Code or Warehouse is
              // left blank/as-is rather than rejected — this only stages
              // rows into the table for the user to review before Save,
              // which still enforces every real requirement.
              const resolveImportedItem = (raw) => {
                const found = (products || []).find(
                  (p) => String(p.productCode || '').trim().toLowerCase() === String(raw.productCode || '').trim().toLowerCase()
                );
                const taxMatch = raw.taxCode
                  ? (taxCodes || []).find(
                      (t) => String(t.taxCode || '').trim().toLowerCase() === String(raw.taxCode).trim().toLowerCase()
                    )
                  : null;
                return {
                  ...emptyItem,
                  productCode: found ? found.productCode : raw.productCode,
                  productName: found ? found.productName : '',
                  description: raw.description || (found ? found.productName : ''),
                  hsnCode: found ? (found.hsnCode || '').replace(/[.\s-]/g, '') : '',
                  uom: found ? (found.uom || '') : '',
                  quantity: raw.quantity,
                  unitPrice: raw.unitPrice,
                  taxCodeId: taxMatch ? taxMatch.id : null,
                  taxPercent: taxMatch ? (Number(taxMatch.taxRate) || 0) : 0,
                  warehouse: raw.warehouse || watch('warehouse') || '',
                };
              };

              const handleItemsImported = (rawItems) => {
                append(rawItems.map(resolveImportedItem));
              };

              // Switching branch invalidates a warehouse from the old one.
              // Skipped on first render so loading a record for edit/view does
              // not wipe the value it just loaded.
              const prevBranchRef = useRef(branch);
              useEffect(() => {
                if (prevBranchRef.current === branch) return;
                prevBranchRef.current = branch;
                const allowed = warehouseCodesForBranch(warehouses, branch);
                if (watch('warehouse') && !allowed.has(watch('warehouse'))) setValue('warehouse', '');
                // Same invalidation, per row — a line's own Warehouse has no
                // more meaning under the new branch than the header's did.
                (watch('items') || []).forEach((it, idx) => {
                  if (it.warehouse && !allowed.has(it.warehouse)) setValue(`items.${idx}.warehouse`, '');
                });
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [branch]);

              const headerWarehouse = watch('warehouse');
              const prevHeaderWarehouseRef = useRef(headerWarehouse);
              useEffect(() => {
                if (prevHeaderWarehouseRef.current === headerWarehouse) return;
                const oldWh = prevHeaderWarehouseRef.current;
                prevHeaderWarehouseRef.current = headerWarehouse;
                if(!headerWarehouse) return;
                (watch('items') || []).forEach((it, idx) => {
                  if(!it.warehouse || it.warehouse === oldWh){
                    setValue(`items.${idx}.warehouse`, headerWarehouse, { shouldValidate: true});
                  }
                });
              }, [headerWarehouse])

              // Tracks, per row (keyed by field.id so it survives index
              // shifts from add/remove), whether that line's Quantity
              // exceeds live available stock in its own selected Warehouse —
              // computed by AvailableStockCell below via useWarehouseStock.
              // No static zod rule can express this (it needs a live server
              // fetch), so it is component state that gates the Save
              // buttons, mirroring StockIssue.jsx's identical idiom. Only
              // meaningful on the direct path (no delivery challan): with a
              // challan behind it, this invoice is finance-only and moves no
              // stock, so AvailableStockCell isn't even rendered for those
              // rows (see the isDirectInvoice gate below) and can never
              // report an error into this map.
              const [stockErrors, setStockErrors] = useState({});
              const handleStockErrorChange = React.useCallback((fieldId, hasError) => {
                setStockErrors((prev) => {
                  if (!!prev[fieldId] === hasError) return prev;
                  const next = { ...prev, [fieldId]: hasError };
                  if (!hasError) delete next[fieldId];
                  return next;
                });
              }, []);
              // Save / Update are no longer disabled by the Available-stock hint:
              // that hint only mounted on the Item Detail tab, so the buttons
              // flipped on and off with the tab. The server still refuses a save
              // that would take stock negative and says which item.

              // Every column of this item table is sized to show its values IN FULL —
              // no ellipsis, no wrapping, no hover, however long the text is. The
              // spec below is positional: it mirrors the header row top to bottom,
              // and `null` leaves a column (the # counter, the action column) at
              // whatever width it already has. See itemTableSx in lib/columnWidth.js.
              // Claims/Services documents move no stock, so the item grid hides
              // its Warehouse column entirely (header, cells and width spec).
              const itemColumnsSx = itemTableSx(watchedItems, [
                null,
                { header: 'Item No *', get: (i) => i?.productCode, field: 'select' },
                { header: 'Description', get: (i) => i?.productName, field: 'select' },
                { header: 'HSN/SAC', get: (i) => i?.hsnCode, field: 'text' },
                { header: 'Unit', get: (i) => i?.uom, field: 'text' },
                // Warehouse column dropped entirely on a Claims/Services
                // document — see isNonStockCategory above — since nothing on
                // that document ever moves stock. Required label only shown
                // on the direct path otherwise — mirrors Purchase Invoice's
                // identical Warehouse column.
                ...(isNonStockCategory ? [] : [
                  { header: isDirectInvoice ? 'Warehouse *' : 'Warehouse', get: (i) => i?.warehouse, field: 'select' },
                ]),
                { header: 'Quantity *', get: (i) => i?.quantity, field: 'text' },
                { header: 'Rate (₹) *', get: (i) => i?.unitPrice, field: 'text' },
                { header: 'Discount (%)', get: (i) => i?.discountPercent, field: 'text' },
                { header: 'Tax (%)', get: (i) => taxCodeById.get(i?.taxCodeId)?.label ?? i?.taxPercent, field: 'select' },
                { header: 'Amount (₹)', get: (i) => ((Number(i?.quantity) || 0) * (Number(i?.unitPrice) || 0)).toFixed(2), field: 'plain', min: 110 },
                null,
              ]);
              // Discount % in the totals panel is a header-level discount taken
              // off the sum of the (already line-discounted) item amounts —
              // exactly what the server does with the `discountPercent` it
              // receives.
              //
              // It used to be a read-only mirror of whichever item row was
              // edited last, and computeTotals was called with a hard-coded 0
              // so the mirrored figure wouldn't deduct the line discount twice
              // on screen. But the mirrored figure was still posted, and the
              // server had no way to know it was only meant for display: it
              // applied that percentage on top of line amounts that already had
              // it baked in. A 10% line discount saved an invoice ~10% below
              // the total the user had just approved.
              const discountPercent = watch('discountPercent');
              // interState was already computed above (ahead of the Tax (%)
              // options, which need it too) — reused here rather than
              // recomputed so the totals panel and the dropdown can never
              // disagree about which state this document is in.
              // taxType (from each line's own taxCodeId) drives the TCS
              // carve-out in documentTotals.js's computeTotals -- see
              // buildTaxCodeOptions/taxCodeById above, which now carries
              // taxType alongside label/value/rate.
              const itemsForTotals = watchedItems.map((it) => ({ ...it, taxType: taxCodeById.get(it.taxCodeId)?.taxType || '' }));
              const freightNetAmount = watch('freightNetAmount');
              const freightTaxAmount = watch('freightTaxAmount');
              const roadTaxWatched = watch('roadTax');
              const totals = computeTotals(itemsForTotals, discountPercent, interState, { roadTax: roadTaxWatched, freightNetAmount, freightTaxAmount });

              // Snapshot of every current form field — printCustomerRecord/
              // printSupplierRecord/printSalesEmployeeRecord/printBranchRecord/
              // printOrder below all read off this single watch() call rather
              // than each re-watching their own field, so they can never
              // disagree about which render's values they're looking at.
              const allValues = watch();

              const printCustomerRecord = (customers || []).find((c) => {
                const target = (allValues.customer || '').trim().toLowerCase();
                if (!target) return false;
                return (
                  (c.customerName || '').trim().toLowerCase() === target ||
                  (c.customerCode || '').trim().toLowerCase() === target ||
                  (c.partnerName || '').trim().toLowerCase() === target ||
                  (c.partnerCode || '').trim().toLowerCase() === target
                );
              });
              // The chosen Supplier's own Business Partner row — carries
              // logoUrl/logoVisible for SalesInvoicePrintable's
              // supplier-logo block.
              const printSupplierRecord = (suppliers || []).find((s) => s.supplierName === allValues.supplier);
              const printSalesEmployeeRecord = (salesEmployees || []).find((s) => s.employeeName === allValues.salesPerson);
              // The invoice's own Branch resolved against Branch Master — see
              // SalesOrderPrintable.jsx's branchRecord prop.
              const printBranchRecord = (branches || []).find((b) => (b.branchName || '').trim() === (allValues.branch || '').trim());
              // items: itemsForTotals so each line carries its resolved
              // taxType -- SalesInvoicePrintable's own local recompute reads
              // item.taxType to detect a TCS-typed line, and the raw watched
              // item only ever has taxCodeId.
              // irn: like status just above, this is NOT a field the main
              // form registers (see einvoiceStatus/ewayBillStatus etc. a
              // little further up, which are deliberately read straight off
              // editingRow for the same reason) -- it only ever changes via
              // the separate Generate IRN action, which writes straight to
              // editingRow via setEditingRow, never through the form. Reading
              // it off allValues (watch()) instead left the printed/PDF "IRN
              // No" box permanently blank even once the E-Invoice tab itself
              // showed a real IRN.
              const printOrder = { ...allValues, items: itemsForTotals, status: editingRow?.status || 'Draft', irn: editingRow?.irn || '', qrCode: editingRow?.qrCode || '', ackNo: editingRow?.ackNo || '', ackDate: editingRow?.ackDate || null };
              // Signature shown on the printable is the approver's own uploaded
              // signature (SalesEmployee.signatureUrl), not the default stamp —
              // blank when the approver has none on file.
              const approverSignatureUrl = (salesEmployees || []).find((s) => s.employeeName === allValues.approvedBy)?.signatureUrl || null;

              const customerValue = watch('customer');
              const supplierValue = watch('supplier');
              // MachineryCodeSelect needs the selected Customer's Business
              // Partner id (Machineries are scoped per partner, not global —
              // see the "Machineries" tab on BusinessPartner.jsx), but this
              // form only stores the customer's NAME (see PartyCodeSelect's
              // own convention). Resolved the same way the customer-change
              // effect below looks the customer row up.
              const machineryBusinessPartnerId = (customers || []).find((c) => c.customerName === customerValue)?.id || null;
              const prevCustomer = useRef(editingRow ? editingRow.customer : null);
              useEffect(() => {
                if (customerValue !== prevCustomer.current) {
                  const found = (customers || []).find((c) => c.customerName === customerValue);
                  // A Machinery picked for the PREVIOUS customer is almost
                  // certainly not one of the new customer's own machineries
                  // (Machineries are scoped per Business Partner) — cleared
                  // on every actual customer change.
                  setValue('machineryCode', '', { shouldValidate: true });
                  if (found) {
                    // Bill To/Ship To are frozen fields now — always the
                    // selected customer's own Business Partner Billing/
                    // Shipping address, never hand-typed.
                    // Bill To follows the customer (SalesShipTo's SalesBillTo keeps the picked Billing address).
                    if (!watch('billToDifferentCustomer')) setValue('billingAddress', customerAddressFor(found, 'Billing'), { shouldValidate: true });
                    // Ship To keeps the address picked under "Ship to a different customer"
                    // (see SalesShipTo) instead of snapping back to this customer's own.
                    if (!watch('shipToDifferentCustomer')) setValue('shippingAddress', customerAddressFor(found, 'Shipping'), { shouldValidate: true });
                    setValue('billingType', deriveBillingType(found), { shouldValidate: true });
                    if (found.paymentTerms) setValue('paymentTerms', found.paymentTerms, { shouldValidate: true });
                    const customerState = customerStateFor(found);
                    if (customerState) setValue('placeOfSupply', customerState, { shouldValidate: true });
                    setValue('gstNo', customerGstNo(found), { shouldValidate: true });
                  }
                  prevCustomer.current = customerValue;
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [customerValue]);

              // Copy From > Delivery Challan pulls every field that exists
              // on that challan across onto the invoice — order no.,
              // challan date, sales person, billing/shipping address, terms &
              // conditions, remarks, and item lines (product, HSN/SAC, unit,
              // quantity, unit price).
              //
              // Those fields used to be marked `disabled` on the grounds that
              // they aren't invoice-specific data. But the Delivery Challan is
              // optional, and locking them made a direct invoice impossible to
              // write: Customer and Sales Person are required yet unfillable,
              // and "Add Item" produced a row with no typeable product,
              // quantity or rate. They are editable now — the challan lookup
              // still pre-fills them, it just no longer forbids a correction or
              // a from-scratch invoice. Also syncs the customer-effect's own
              // "previous value" ref so it doesn't re-fire and clobber the
              // values just set here from the challan's snapshot (same class
              // of bug fixed on Purchase Order's Reference/Contact Person).
              //
              // The customer is not copied back — the dialog was already
              // filtered by it, so it can only hold the value it already has.
              //
              // This used to run as an effect watching the Delivery Challan No.
              // dropdown. It is a plain function now, called only from the
              // dialog's Choose button: an effect keyed on a form value also
              // fires when that value is restored on edit or reset, which is why
              // it needed the prevChallan bookkeeping to tell "user picked a
              // challan" apart from "form loaded". An explicit call has no such
              // ambiguity.
              const applyChallan = (found) => {
                if (found) {
                  setValue('deliveryChallanNo', found.challanNo || '', { shouldValidate: true });
                  setValue('branch', found.branch || '', { shouldValidate: true });
                  // Via this page's own Copy From dialog the customer is
                  // already fixed (the dialog was filtered by it), so this
                  // is a no-op there. But applyChallan is also called from
                  // the Copy To intent effect below, landing on a brand new
                  // invoice with no customer picked at all — there, leaving
                  // this out meant Customer never came across from Copy To.
                  setValue('customer', found.customer || '', { shouldValidate: true });
                  prevCustomer.current = found.customer || '';
                  // A second, unrelated party field — the Business Partner
                  // (Vendor) picked purely so its logo prints alongside the
                  // KEMACH logo. Distinct from Customer above; missed
                  // entirely in the first pass at this fix.
                  setValue('supplier', found.supplier || '', { shouldValidate: true });
                  setValue('orderNo', found.orderNo || '', { shouldValidate: true });
                  setValue('challanDate', found.challanDate || null, { shouldValidate: true });
                  setValue('salesPerson', found.salesPerson || '', { shouldValidate: true });
                  // The order this challan was despatched against — looked
                  // up up front so customerRefNo's fallback below (and the
                  // orderDate/currency/source/discount block further down)
                  // can both use it; referencing it before this point used
                  // to throw (a `const` declared later in this same function
                  // is in the temporal dead zone for every line above it,
                  // not just the ones after it) — which silently aborted the
                  // rest of applyChallan, including Customer and every line
                  // item, whenever the challan itself had no customerRefNo.
                  const order = (salesOrders || []).find((o) => o.orderNo === found.orderNo);
                  // Bill To/Ship To are frozen/derived — re-derive from the
                  // challan's own customer's Business Partner record rather
                  // than copying the challan's (now-legacy) stored strings.
                  {
                    const challanCustomerRecord = (customers || []).find((c) => c.customerName === found.customer);
                    applySalesPartyAddresses(setValue, found, challanCustomerRecord, customerAddressFor);
                    setValue('billingType', deriveBillingType(challanCustomerRecord), { shouldValidate: true });
                    setValue('gstNo', customerGstNo(challanCustomerRecord), { shouldValidate: true });
                  }
                  setValue('termsConditions', found.termsConditions || '', { shouldValidate: true });
                  setValue('remarks', found.remarks || '', { shouldValidate: true });
                  setValue('customerRefNo', found.customerRefNo || order?.customerRefNo || order?.referenceNo || '', { shouldValidate: true });
                  // Carried on the challan but previously left behind on
                  // Copy To — see the matching fix on SalesOrder.jsx's own
                  // applyQuotation.
                  setValue('receiver', found.receiver || '', { shouldValidate: true });
                  setValue('receiverPhone', found.receiverPhone || '', { shouldValidate: true });
                  setValue('approvedBy', found.approvedBy || '', { shouldValidate: true });
                  setValue('typeOfPurchase', found.typeOfPurchase || '', { shouldValidate: true });
                  setValue('salesType', found.salesType || '', { shouldValidate: true });
                  setValue('transportMode', found.transportMode || '', { shouldValidate: true });
                  setValue('invoiceType', found.invoiceType || '', { shouldValidate: true });
                  // Machine Serial No./Engine No./Hypothecation and the
                  // Sales Type they depend on were missed when this Copy
                  // From/To mapping was originally written -- they didn't
                  // exist yet. salesCategory MUST be set before (or in the
                  // same tick as) machineSerialNo: MachineryCodeSelect's
                  // creatable/read-only behaviour reads watch('salesCategory')
                  // live, so setting it after would leave a copied Machine
                  // serial sitting in a field still locked to strict Parts
                  // mode for one render.
                  setValue('salesCategory', found.salesCategory || 'Parts', { shouldValidate: true });
                  // Keep the switch-effect's own bookkeeping in sync with this
                  // programmatic change (see the customer-effect's identical fix
                  // above) -- otherwise, on the very next render, that effect sees
                  // salesCategory change from the form's default and treats it as
                  // the user flipping categories by hand, wiping the Machine
                  // Serial No./Engine No./Hypothecation just copied in below right
                  // back out to blank.
                  prevSalesCategoryRef.current = found.salesCategory || 'Parts';
                  setValue('machineSerialNo', found.machineSerialNo || '', { shouldValidate: true });
                  setValue('engineNo', found.engineNo || '', { shouldValidate: true });
                  setValue('hypothecation', found.hypothecation || '', { shouldValidate: true });
                  // order was already looked up above, before its first use.
                  if (order) {
                    setValue('orderDate', order.orderDate || null, { shouldValidate: true });
                    // The Delivery Challan itself carries no currency/source/
                    // discount — those live one level further up, on the
                    // Sales Order it was despatched against. order is
                    // already looked up here for orderDate, so no extra
                    // fetch is needed.
                    setValue('currency', order.currency || 'INR', { shouldValidate: true });
                    setValue('source', order.source || '', { shouldValidate: true });
                    setValue('discountPercent', order.discountPercent != null ? Number(order.discountPercent) : 0, { shouldValidate: true });
                  }
                  if (found.items && found.items.length) {
                    // Invoice only what the challan shipped MINUS what has
                    // already gone back on a Sales Return against it — pulling
                    // the full delivered quantity would let goods that were
                    // already returned get invoiced anyway.
                    // returnedByChallanProduct is the same per-product return
                    // total the challan dropdown itself is filtered by (see
                    // fullyReturnedChallanNos above), so the two can never
                    // disagree about what's left. A line with nothing
                    // remaining is dropped rather than pulled in at zero — a
                    // zero-quantity line would fail validation anyway.
                    // `line` is captured BEFORE the filter: base_line has to
                    // name the row's position on the challan, not its position
                    // in whatever subset survived the remaining-quantity filter.
                    const remaining = found.items
                      .map((i, n) => {
                        const delivered = i.quantity != null ? Number(i.quantity) : 0;
                        const returned = returnedByChallanProduct.get(`${found.challanNo}::${i.productCode}`) || 0;
                        return { item: i, line: n + 1, qty: round2(delivered - returned) };
                      })
                      .filter(({ qty }) => qty > 0.005);
                    const mappedItems = remaining.length
                      ? remaining.map(({ item: i, line, qty }) => ({
                        productCode: i.productCode || '', productName: i.productName || '', description: i.description || '',
                        hsnCode: i.hsnCode || '', uom: i.uom || '',
                        quantity: qty,
                        unitPrice: (i.unitPrice != null ? Number(i.unitPrice) : null) ?? priceListRates?.get(i.productCode) ?? 0,
                        discountPercent: 0,
                        taxPercent: i.taxPercent != null ? Number(i.taxPercent) : 18,
                        taxCodeId: i.taxCodeId != null ? Number(i.taxCodeId) : null,
                        // A challan-backed invoice is finance-only (the
                        // challan already moved the stock), so the line's
                        // warehouse is display-only here — carried across in
                        // case it's ever shown, never required.
                        warehouse: i.warehouse || '',
                        // Copy From: the challan, which is the immediate
                        // source — not the order behind it.
                        baseType: 'Delivery Challan',
                        baseEntry: found.id ?? null,
                        baseNo: found.challanNo || null,
                        baseLine: line,
                      }))
                      : [{ ...emptyItem }];
                    replaceItems(mappedItems);
                    // Belt-and-braces: each row's own Product Code cell
                    // (ProductCell) has its own master-lookup effect that
                    // re-fills Description/HSN/Unit/Rate from the Product
                    // Master the instant it notices a productCode change.
                    // replaceItems() giving every row a fresh field id is
                    // meant to stop that effect from treating this as a
                    // "change" in the first place, but that guard has been
                    // observed losing the race in practice (reported: Rate
                    // landing at the Product Master's own default instead of
                    // the source document's). Reasserting the correct values
                    // a moment later — after that cell's effect has had every
                    // chance to run and lose — guarantees the copied figures
                    // win regardless of exactly how that race goes.
                    if (remaining.length) {
                      setTimeout(() => {
                        mappedItems.forEach((item, idx) => {
                          setValue(`items.${idx}.unitPrice`, item.unitPrice, { shouldValidate: true });
                          setValue(`items.${idx}.hsnCode`, item.hsnCode, { shouldValidate: true });
                          setValue(`items.${idx}.uom`, item.uom, { shouldValidate: true });
                          setValue(`items.${idx}.productName`, item.productName, { shouldValidate: true });
                          setValue(`items.${idx}.taxPercent`, item.taxPercent, { shouldValidate: true });
                        });
                      }, 60);
                    }
                  }
                }
              };

              // Copy From > Sales Order. Billing straight off the order — before
              // anything is despatched, or for a charge that never passes through
              // a challan at all — so the full ordered quantity is pulled and
              // there is no returns arithmetic to do: nothing can have come back
              // on goods that were never delivered.
              //
              // The challan link is cleared, not left as it was: the invoice now
              // references this order directly, and leaving a stale despatch
              // number beside it would claim a provenance the lines no longer
              // have (their baseType/baseNo below name the order).
              const applyOrder = (found) => {
                if (!found) return;
                setValue('orderNo', found.orderNo || '', { shouldValidate: true });
                setValue('deliveryChallanNo', '', { shouldValidate: true });
                setValue('challanDate', null, { shouldValidate: true });
                setValue('branch', found.branch || '', { shouldValidate: true });
                // Only reachable via Copy To (not this page's own Copy
                // From menu) — see the matching note on applyChallan above.
                setValue('customer', found.customer || '', { shouldValidate: true });
                prevCustomer.current = found.customer || '';
                // A second, unrelated party field — the Business Partner
                // (Vendor) picked purely so its logo prints alongside the
                // KEMACH logo. Distinct from Customer above; missed entirely
                // in the first pass at this fix.
                setValue('supplier', found.supplier || '', { shouldValidate: true });
                setValue('orderDate', found.orderDate || null, { shouldValidate: true });
                setValue('currency', found.currency || 'INR', { shouldValidate: true });
                setValue('source', found.source || '', { shouldValidate: true });
                setValue('salesPerson', found.salesPerson || '', { shouldValidate: true });
                // Bill To/Ship To are frozen/derived — re-derive from the
                // order's own customer's Business Partner record rather than
                // copying the order's (now-legacy) stored strings.
                {
                  const orderCustomerRecord = (customers || []).find((c) => c.customerName === found.customer);
                  applySalesPartyAddresses(setValue, found, orderCustomerRecord, customerAddressFor);
                  setValue('billingType', deriveBillingType(orderCustomerRecord), { shouldValidate: true });
                  setValue('gstNo', customerGstNo(orderCustomerRecord), { shouldValidate: true });
                }
                setValue('termsConditions', found.termsConditions || '', { shouldValidate: true });
                setValue('remarks', found.remarks || '', { shouldValidate: true });
                setValue('customerRefNo', found.customerRefNo || found.referenceNo || '', { shouldValidate: true });
                // Header-level discount was never carried across — each
                // line's own discountPercent copies fine below, but the
                // order's overall discountPercent was left at whatever this
                // form already had, silently dropping it from the totals.
                setValue('discountPercent', found.discountPercent != null ? Number(found.discountPercent) : 0, { shouldValidate: true });
                // Carried on the order but previously left behind on
                // Copy To — see the matching fix on SalesOrder.jsx's own
                // applyQuotation.
                setValue('receiver', found.receiver || '', { shouldValidate: true });
                setValue('receiverPhone', found.receiverPhone || '', { shouldValidate: true });
                setValue('approvedBy', found.approvedBy || '', { shouldValidate: true });
                setValue('typeOfPurchase', found.typeOfPurchase || '', { shouldValidate: true });
                setValue('salesType', found.salesType || '', { shouldValidate: true });
                setValue('transportMode', found.transportMode || '', { shouldValidate: true });
                setValue('invoiceType', found.invoiceType || '', { shouldValidate: true });
                // Machine Serial No./Engine No./Hypothecation and the Sales
                // Type they depend on were missed when this Copy From/To
                // mapping was originally written -- they didn't exist yet.
                // salesCategory MUST be set before (or in the same tick as)
                // machineSerialNo: MachineryCodeSelect's creatable/read-only
                // behaviour reads watch('salesCategory') live, so setting it
                // after would leave a copied Machine serial sitting in a
                // field still locked to strict Parts mode for one render.
                setValue('salesCategory', found.salesCategory || 'Parts', { shouldValidate: true });
                // Keep the switch-effect's own bookkeeping in sync with this
                // programmatic change (see the customer-effect's identical fix
                // above) -- otherwise, on the very next render, that effect sees
                // salesCategory change from the form's default and treats it as
                // the user flipping categories by hand, wiping the Machine
                // Serial No./Engine No./Hypothecation just copied in below right
                // back out to blank.
                prevSalesCategoryRef.current = found.salesCategory || 'Parts';
                setValue('machineSerialNo', found.machineSerialNo || '', { shouldValidate: true });
                setValue('engineNo', found.engineNo || '', { shouldValidate: true });
                setValue('hypothecation', found.hypothecation || '', { shouldValidate: true });
                if (found.items && found.items.length) {
                  const mappedItems = found.items.map((i, n) => ({
                    productCode: i.productCode || '', productName: i.productName || '', description: i.description || '',
                    hsnCode: i.hsnCode || '', uom: i.uom || '',
                    quantity: i.quantity != null ? Number(i.quantity) : 1,
                    unitPrice: (i.unitPrice != null ? Number(i.unitPrice) : null) ?? priceListRates?.get(i.productCode) ?? 0,
                    discountPercent: i.discountPercent != null ? Number(i.discountPercent) : 0,
                    taxPercent: i.taxPercent != null ? Number(i.taxPercent) : 18,
                    taxCodeId: i.taxCodeId != null ? Number(i.taxCodeId) : null,
                    // Billed straight off the order with no challan behind
                    // it — this IS the direct path, so seed each line's
                    // Warehouse from the order's own line, falling back to
                    // this invoice's header Warehouse (same as a freshly
                    // Added row).
                    warehouse: i.warehouse || '',
                    // Copy From: the order, which is the immediate source here —
                    // this invoice was raised against it, not against a despatch.
                    baseType: 'Sales Order',
                    baseEntry: found.id ?? null,
                    baseNo: found.orderNo || null,
                    baseLine: n + 1,
                  }));
                  replaceItems(mappedItems);
                  // Belt-and-braces reassert — see the matching comment on
                  // applyChallan above.
                  setTimeout(() => {
                    mappedItems.forEach((item, idx) => {
                      setValue(`items.${idx}.unitPrice`, item.unitPrice, { shouldValidate: true });
                      setValue(`items.${idx}.hsnCode`, item.hsnCode, { shouldValidate: true });
                      setValue(`items.${idx}.uom`, item.uom, { shouldValidate: true });
                      setValue(`items.${idx}.productName`, item.productName, { shouldValidate: true });
                      setValue(`items.${idx}.taxPercent`, item.taxPercent, { shouldValidate: true });
                    });
                  }, 60);
                }
              };

              // "Copy To > Sales Invoice" from a Sales Quotation — not reachable
              // from this page's own Copy From menu (Order/Challan only), only
              // from the intent-consuming effect below. Billed direct off the
              // quotation, before any order/challan exists, so — like applyOrder
              // above — there is no returns/despatch arithmetic to do.
              const applyQuotation = (found) => {
                if (!found) return;
                setValue('orderNo', '', { shouldValidate: true });
                setValue('deliveryChallanNo', '', { shouldValidate: true });
                setValue('challanDate', null, { shouldValidate: true });
                setValue('branch', found.branch || '', { shouldValidate: true });
                // Only reachable via Copy To — see the matching note on
                // applyChallan above.
                setValue('customer', found.customer || '', { shouldValidate: true });
                prevCustomer.current = found.customer || '';
                // A second, unrelated party field — the Business Partner
                // (Vendor) picked purely so its logo prints alongside the
                // KEMACH logo. Distinct from Customer above; missed entirely
                // in the first pass at this fix.
                setValue('supplier', found.supplier || '', { shouldValidate: true });
                setValue('orderDate', found.quotationDate || null, { shouldValidate: true });
                setValue('currency', found.currency || 'INR', { shouldValidate: true });
                setValue('salesPerson', found.salesPerson || '', { shouldValidate: true });
                {
                  const quotationCustomerRecord = (customers || []).find((c) => c.customerName === found.customer);
                  applySalesPartyAddresses(setValue, found, quotationCustomerRecord, customerAddressFor);
                  setValue('billingType', deriveBillingType(quotationCustomerRecord), { shouldValidate: true });
                  setValue('gstNo', customerGstNo(quotationCustomerRecord), { shouldValidate: true });
                }
                setValue('termsConditions', found.termsConditions || '', { shouldValidate: true });
                setValue('remarks', found.notes || '', { shouldValidate: true });
                setValue('customerRefNo', found.customerRefNo || found.referenceNo || '', { shouldValidate: true });
                setValue('discountPercent', found.discountPercent != null ? Number(found.discountPercent) : 0, { shouldValidate: true });
                // Carried on the quotation but previously left behind on
                // Copy To — see the matching fix on SalesOrder.jsx's own
                // applyQuotation.
                setValue('receiver', found.receiver || '', { shouldValidate: true });
                setValue('receiverPhone', found.receiverPhone || '', { shouldValidate: true });
                setValue('approvedBy', found.approvedBy || '', { shouldValidate: true });
                setValue('typeOfPurchase', found.typeOfPurchase || '', { shouldValidate: true });
                setValue('salesType', found.salesType || '', { shouldValidate: true });
                setValue('transportMode', found.transportMode || '', { shouldValidate: true });
                setValue('invoiceType', found.invoiceType || '', { shouldValidate: true });
                // Machine Serial No./Engine No./Hypothecation and the Sales
                // Type they depend on were missed when this Copy From/To
                // mapping was originally written -- they didn't exist yet.
                // salesCategory MUST be set before (or in the same tick as)
                // machineSerialNo: MachineryCodeSelect's creatable/read-only
                // behaviour reads watch('salesCategory') live, so setting it
                // after would leave a copied Machine serial sitting in a
                // field still locked to strict Parts mode for one render.
                setValue('salesCategory', found.salesCategory || 'Parts', { shouldValidate: true });
                // Keep the switch-effect's own bookkeeping in sync with this
                // programmatic change (see the customer-effect's identical fix
                // above) -- otherwise, on the very next render, that effect sees
                // salesCategory change from the form's default and treats it as
                // the user flipping categories by hand, wiping the Machine
                // Serial No./Engine No./Hypothecation just copied in below right
                // back out to blank.
                prevSalesCategoryRef.current = found.salesCategory || 'Parts';
                setValue('machineSerialNo', found.machineSerialNo || '', { shouldValidate: true });
                setValue('engineNo', found.engineNo || '', { shouldValidate: true });
                setValue('hypothecation', found.hypothecation || '', { shouldValidate: true });
                // Company policy: Road Tax never affects Sales Invoice's
                // Grand Total, so Copy From no longer needs to recompute or
                // seed a Road Tax figure here at all.
                if (found.items && found.items.length) {
                  const mappedItems = found.items.map((i, n) => ({
                    productCode: i.productCode || '', productName: i.productName || '', description: i.description || '',
                    hsnCode: i.hsnCode || '', uom: i.uom || '',
                    quantity: i.quantity != null ? Number(i.quantity) : 1,
                    unitPrice: (i.unitPrice != null ? Number(i.unitPrice) : null) ?? priceListRates?.get(i.productCode) ?? 0,
                    discountPercent: i.discountPercent != null ? Number(i.discountPercent) : 0,
                    taxPercent: i.taxPercent != null ? Number(i.taxPercent) : 18,
                    taxCodeId: i.taxCodeId != null ? Number(i.taxCodeId) : null,
                    warehouse: i.warehouse || '',
                    baseType: 'Sales Quotation',
                    baseEntry: found.id ?? null,
                    baseNo: found.quotationNo || null,
                    baseLine: n + 1,
                  }));
                  replaceItems(mappedItems);
                  // Belt-and-braces reassert — see the matching comment on
                  // applyChallan above.
                  setTimeout(() => {
                    mappedItems.forEach((item, idx) => {
                      setValue(`items.${idx}.unitPrice`, item.unitPrice, { shouldValidate: true });
                      setValue(`items.${idx}.hsnCode`, item.hsnCode, { shouldValidate: true });
                      setValue(`items.${idx}.uom`, item.uom, { shouldValidate: true });
                      setValue(`items.${idx}.productName`, item.productName, { shouldValidate: true });
                      setValue(`items.${idx}.taxPercent`, item.taxPercent, { shouldValidate: true });
                    });
                  }, 60);
                }
              };

              // "Copy To > Sales Invoice" from a Sales Return — also only
              // reachable via the intent-consuming effect below, not this
              // page's own Copy From menu. Each returned line's own
              // returnQuantity becomes the invoice line's quantity.
              const applyReturn = (found) => {
                if (!found) return;
                setValue('orderNo', '', { shouldValidate: true });
                setValue('deliveryChallanNo', found.challanNo || '', { shouldValidate: true });
                setValue('challanDate', null, { shouldValidate: true });
                setValue('branch', found.branch || '', { shouldValidate: true });
                // Only reachable via Copy To — see the matching note on
                // applyChallan above.
                setValue('customer', found.customer || '', { shouldValidate: true });
                prevCustomer.current = found.customer || '';
                setValue('orderDate', found.documentDate || null, { shouldValidate: true });
                setValue('termsConditions', found.termsConditions || '', { shouldValidate: true });
                setValue('remarks', found.comments || found.narration || '', { shouldValidate: true });
                setValue('customerRefNo', found.customerRefNo || '', { shouldValidate: true });
                {
                  const returnCustomerRecord = (customers || []).find((c) => c.customerName === found.customer);
                  applySalesPartyAddresses(setValue, found, returnCustomerRecord, customerAddressFor);
                  setValue('billingType', deriveBillingType(returnCustomerRecord), { shouldValidate: true });
                  setValue('gstNo', customerGstNo(returnCustomerRecord), { shouldValidate: true });
                }
                setValue('discountPercent', found.discountPercent != null ? Number(found.discountPercent) : 0, { shouldValidate: true });
                // Carried on the return but previously left behind on
                // Copy To (the return schema has no Receiver/Other Details
                // block, so this is all there is to bring across).
                setValue('approvedBy', found.approvedBy || '', { shouldValidate: true });
                // Machine Serial No./Engine No./Hypothecation and the Sales
                // Type they depend on were missed when this Copy From/To
                // mapping was originally written -- they didn't exist yet.
                // salesCategory MUST be set before (or in the same tick as)
                // machineSerialNo: MachineryCodeSelect's creatable/read-only
                // behaviour reads watch('salesCategory') live, so setting it
                // after would leave a copied Machine serial sitting in a
                // field still locked to strict Parts mode for one render.
                setValue('salesCategory', found.salesCategory || 'Parts', { shouldValidate: true });
                // Keep the switch-effect's own bookkeeping in sync with this
                // programmatic change (see the customer-effect's identical fix
                // above) -- otherwise, on the very next render, that effect sees
                // salesCategory change from the form's default and treats it as
                // the user flipping categories by hand, wiping the Machine
                // Serial No./Engine No./Hypothecation just copied in below right
                // back out to blank.
                prevSalesCategoryRef.current = found.salesCategory || 'Parts';
                setValue('machineSerialNo', found.machineSerialNo || '', { shouldValidate: true });
                setValue('engineNo', found.engineNo || '', { shouldValidate: true });
                setValue('hypothecation', found.hypothecation || '', { shouldValidate: true });
                const items = (found.items || []).filter((i) => (Number(i.returnQuantity) || 0) > 0.005);
                const mappedItems = items.length
                  ? items.map((i, n) => ({
                    productCode: i.productCode || '', productName: i.productName || '', description: i.description || '',
                    hsnCode: i.hsnCode || '', uom: i.uom || '',
                    quantity: Number(i.returnQuantity) || 0,
                    unitPrice: (i.unitPrice != null ? Number(i.unitPrice) : null) ?? priceListRates?.get(i.productCode) ?? 0,
                    discountPercent: i.discountPercent != null ? Number(i.discountPercent) : 0,
                    taxPercent: i.taxPercent != null ? Number(i.taxPercent) : 18,
                    taxCodeId: i.taxCodeId != null ? Number(i.taxCodeId) : null,
                    warehouse: i.warehouse || '',
                    baseType: 'Sales Return',
                    baseEntry: found.id ?? null,
                    baseNo: found.returnNo || null,
                    baseLine: n + 1,
                  }))
                  : [{ ...emptyItem }];
                replaceItems(mappedItems);
                // Belt-and-braces reassert — see the matching comment on
                // applyChallan above.
                if (items.length) {
                  setTimeout(() => {
                    mappedItems.forEach((item, idx) => {
                      setValue(`items.${idx}.unitPrice`, item.unitPrice, { shouldValidate: true });
                      setValue(`items.${idx}.hsnCode`, item.hsnCode, { shouldValidate: true });
                      setValue(`items.${idx}.uom`, item.uom, { shouldValidate: true });
                      setValue(`items.${idx}.productName`, item.productName, { shouldValidate: true });
                      setValue(`items.${idx}.taxPercent`, item.taxPercent, { shouldValidate: true });
                    });
                  }, 60);
                }
              };

              // Undo a Copy From: drop both links and the values that came across
              // with them, rather than leaving a stale document's figures sitting
              // in an invoice that no longer claims to reference it.
              //
              // The customer is deliberately NOT cleared. It is the user's own
              // selection — it is what made Copy From available in the first
              // place, and clearing it would close the dialogs off and force a
              // re-pick just to try a different source from the same customer.
              // The addresses stay too: they belong to the customer.
              const challanValue = watch('deliveryChallanNo');
              const orderValue = watch('orderNo');
              const clearSource = () => {
                setValue('deliveryChallanNo', '', { shouldValidate: true });
                setValue('orderNo', '', { shouldValidate: true });
                setValue('challanDate', null, { shouldValidate: true });
                setValue('orderDate', null, { shouldValidate: true });
                setValue('currency', 'INR', { shouldValidate: true });
                setValue('source', '', { shouldValidate: true });
                setValue('salesPerson', '', { shouldValidate: true });
                setValue('termsConditions', '', { shouldValidate: true });
                setValue('customerRefNo', '', { shouldValidate: true });
                setValue('remarks', '', { shouldValidate: true });
                setValue('discountPercent', 0, { shouldValidate: true });
                replaceItems([{ ...emptyItem, warehouse: watch('warehouse') || '' }]);
              };

              // Selecting a Payment Terms option ("Net 15", "Net 30", ...)
              // computes Due Date as Invoice Date + that many days —
              // "Immediate" (no number in the label) resolves to the invoice
              // date itself. Also recomputes if Invoice Date is edited
              // afterwards while a term is still selected, so the two stay in
              // sync rather than leaving Due Date pinned to whatever the
              // invoice date happened to be at the moment Payment Terms was
              // picked. Stored the same way FormDatePicker itself stores a
              // pick: a UTC-midnight Date, not a local-time one, so the value
              // that round-trips back through the picker doesn't drift a day
              // depending on the browser's timezone. Only fires on an actual
              // user change to either field, not on initial load of an
              // existing invoice, so it doesn't clobber a due date that was
              // manually adjusted away from the term's default.
              const paymentTermsValue = watch('paymentTerms');
              const invoiceDateValue = watch('invoiceDate');
              const prevPaymentTerms = useRef(editingRow ? editingRow.paymentTerms : null);
              const prevInvoiceDate = useRef(editingRow ? editingRow.invoiceDate : null);
              useEffect(() => {
                const termsChanged = paymentTermsValue !== prevPaymentTerms.current;
                const dateChanged = invoiceDateValue !== prevInvoiceDate.current;
                if (termsChanged || dateChanged) {
                  if (paymentTermsValue) {
                    const days = Number(paymentTermsValue.match(/\d+/)?.[0] || 0);
                    const base = invoiceDateValue ? dayjs(invoiceDateValue) : dayjs();
                    const due = base.add(days, 'day');
                    setValue('dueDate', new Date(Date.UTC(due.year(), due.month(), due.date())), { shouldValidate: true });
                  }
                  prevPaymentTerms.current = paymentTermsValue;
                  prevInvoiceDate.current = invoiceDateValue;
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [paymentTermsValue, invoiceDateValue]);

              const handleFile = (file) => {
                if (file) setValue('attachmentName', file.name, { shouldValidate: true });
              };

              const [smartAddOpen, setSmartAddOpen] = useState(false);
              const smartAddEnabled = useSelector((s) => s.theme.smartAddEnabled);
              const handleSmartAddImport = (selectedItems) => {
                const currentItems = watch('items') || [];
                const isFirstItemEmpty = currentItems.length === 1 && !currentItems[0].productCode && !currentItems[0].productName;
                const mappedItems = selectedItems.map((item) => ({
                  ...emptyItem,
                  productCode: item.productCode || '',
                  productName: item.productName || '',
                  description: item.description || item.productName || '',
                  hsnCode: item.hsnCode || '',
                  uom: item.uom || '',
                  quantity: Number(item.quantity) || 1,
                  unitPrice: Number(item.unitPrice) || 0,
                  discountPercent: Number(item.discountPercent) || 0,
                  taxPercent: Number(item.taxPercent) || 18,
                  taxCodeId: Number(item.taxCodeId) || null,
                  warehouse: item.warehouse || watch('warehouse') || '',
                }));
                if(isFirstItemEmpty) {
                  replaceItems(mappedItems);
                } else {
                  mappedItems.forEach((item) => append(item));
                }
                setSmartAddOpen(false);
              };

              // Consume a pending "Copy To" intent addressed to this page —
              // see copyIntentSlice.js and CopyToButton.jsx.
              useEffect(() => {
                if (!pendingCopyIntent || pendingCopyIntent.targetKey !== 'salesInvoice') return;
                if (pendingCopyIntent.sourceType === 'salesOrder') applyOrder(pendingCopyIntent.sourceDoc);
                else if (pendingCopyIntent.sourceType === 'deliveryChallan') applyChallan(pendingCopyIntent.sourceDoc);
                else if (pendingCopyIntent.sourceType === 'salesQuotation') applyQuotation(pendingCopyIntent.sourceDoc);
                else if (pendingCopyIntent.sourceType === 'salesReturn') applyReturn(pendingCopyIntent.sourceDoc);
                dispatch(clearCopyIntent());
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [pendingCopyIntent]);

              return (
                // minWidth: 0 is required — fieldsets default to min-width: min-content,
                // which lets the wide item table blow out the page width on mobile.
                // The Back to List / Cancel buttons are kept outside the fieldset(s)
                // so they stay clickable in read-only (view) mode -- a native
                // <fieldset disabled> disables every descendant control, buttons
                // included.
                <>
                  {/* One dialog component, two configurations — which one is
                  mounted follows the source picked from the Copy From menu. */}
                  <CopyFromDocumentDialog
                    open={copyFromSource === 'order'}
                    onClose={() => setCopyFromSource(null)}
                    onChoose={applyOrder}
                    documents={copyableSalesOrders}
                    party={customerValue}
                    partyField="customer"
                    partyLabel="customer"
                    title="Find Sales Order"
                    columns={SALES_ORDER_COPY_COLUMNS}
                    emptyMessage="No sales orders found for"
                  />
                  <CopyFromDocumentDialog
                    open={copyFromSource === 'challan'}
                    onClose={() => setCopyFromSource(null)}
                    onChoose={applyChallan}
                    documents={copyableChallans}
                    party={customerValue}
                    partyField="customer"
                    partyLabel="customer"
                    title="Find Sales Delivery"
                    columns={CHALLAN_COPY_COLUMNS}
                    emptyMessage="No deliveries left to invoice for"
                  />
                  <Menu
                    anchorEl={copyFromAnchor}
                    open={Boolean(copyFromAnchor)}
                    onClose={() => setCopyFromAnchor(null)}
                  >
                    <MenuItem onClick={() => { setCopyFromAnchor(null); setCopyFromSource('order'); }}>
                      <ListItemText primary="Sales Order" secondary="Bill against an order" />
                    </MenuItem>
                    <MenuItem onClick={() => { setCopyFromAnchor(null); setCopyFromSource('challan'); }}>
                      <ListItemText primary="Delivery Challan" secondary="Bill against goods despatched" />
                    </MenuItem>
                  </Menu>
                  <SalesInvoicePrintable
                    order={printOrder}
                    company={company}
                    customerRecord={printCustomerRecord}
                    supplierRecord={printSupplierRecord}
                    salesEmployeeRecord={printSalesEmployeeRecord}
                    branchRecord={printBranchRecord}
                    houseBank={printHouseBank}
                    approverSignatureUrl={approverSignatureUrl}
                    copyLabels={printCopies}
                  />
                  <Card variant="outlined" sx={{ mb: 2 }}>
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                        <Typography variant="subtitle1" fontWeight={700}>
                          {readOnly ? 'Customer & Invoice Details (View Only)' : 'Customer & Invoice Details'}
                        </Typography>
                        <Button type="button" variant="outlined" color="inherit" startIcon={<ArrowBackIcon />} onClick={backToList}>
                          Back to List
                        </Button>
                      </Stack>

                      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, width: '100%', display: 'block' }}>
                        {/* Laid out as the 11 left|right pairs requested:
                        Sales Type|Invoice No, Branch|Invoice Date, Customer
                        Code|Contact No, Customer Name|GST No, Currency|Sales
                        Person, Payment Terms|Due Date, Supplier Code|Supplier
                        Name, Receiver|Receiver Phone No, Bill To|Ship To,
                        Machine No|Engine No, Hypothecation (alone). Contact
                        No was added specifically for this -- this document
                        never had one before (see the SalesInvoice Prisma
                        model's own comment on `contactPerson`). Customer
                        Reference No. is hidden per the sheet's explicit
                        "remove" note (kept mounted, not removed, so its
                        defaultValue/schema wiring stays intact -- it still
                        submits whatever value it holds, it's just not
                        shown). FormGrid fills left-to-right/top-to-bottom in
                        child order, so the pairing above is exactly this
                        list's order; a hidden (display:none) field drops out
                        of grid layout entirely, so it doesn't disturb that.
                        The Machine fields are folded into this same grid
                        rather than their own -- nothing here conditionally
                        shows/hides them, only their VALUES get cleared when
                        Sales Type leaves "Machine" -- so sharing one grid is
                        safe.
                        Delivery Challan No./Date, Order No./Date, Source and
                        Place of Supply are still not shown on this card —
                        they still exist on the record (Place of Supply set
                        by the customer-change effect below, others by Copy
                        From or optional) and still submit with the form,
                        just with no visible input. Place of Supply is
                        optional at the schema level for exactly this reason
                        — with nothing on this form to set it by hand, it
                        must never block Save if the auto-fill comes up
                        empty. */}
                        <FormGrid columns={2} singleColumnOnMobile rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                          <LabeledField label="Sales Type *">
                            <FormSelect name="salesCategory" label="" placeholder="Select sales type" options={SALES_CATEGORY_OPTIONS} />
                          </LabeledField>
                          <LabeledField label="Invoice No. *">
                            <DocumentSeriesNoField documentCode="SI" seriesFieldName="seriesId" numberFieldName="invoiceNo" isCreate={!editingRow} />
                          </LabeledField>

                          <LabeledField label="Branch *">
                            <FormSelect name="branch" label="" placeholder="Select branch" options={branchOptions} />
                          </LabeledField>
                          <LabeledField label="Invoice Date *">
                            <FormDatePicker name="invoiceDate" label="" maxDate={dayjs()} triggerFields={['dueDate']} />
                          </LabeledField>

                          <LabeledField label="Customer Code *">
                            {/* showNameBelow off — this label-left layout packs
                            rows with zero vertical gap (FIELD_ROW_SPACING), so
                            PartyCodeSelect's own "name echoed below" caption had
                            no room of its own and visually ran into the very
                            next row below it. Purchase Order's Supplier field
                            turns the same caption off for the same reason. */}
                            <PartyCodeSelect name="customer" label="" placeholder="Select customer" options={customerFieldOptions} showNameBelow={false} />
                          </LabeledField>
                          <LabeledField label="Contact No">
                            <FormTextField name="contactPerson" label="" placeholder="Auto-filled from customer" disabled />
                          </LabeledField>

                          {/* Read-only echo of the selected customer's full
                          name — the Customer field above shows only its Code,
                          so this is what tells the user which customer that
                          code actually is. Not a stored field: it just
                          displays the current value of `customer`, which
                          already holds the customer's name (see
                          customerFieldOptions above). Same pattern as
                          Purchase Order's Supplier Name field. */}
                          <LabeledField label="Customer Name">
                            <TextField
                              value={customerValue || ''}
                              label=""
                              placeholder="—"
                              fullWidth
                              size="small"
                              InputProps={{ readOnly: true }}
                              sx={{ '& .MuiInputBase-input': { color: 'text.secondary' } }}
                            />
                          </LabeledField>
                          <LabeledField label="GST No.">
                            <FormTextField name="gstNo" label="" placeholder="Auto-filled from customer" disabled />
                          </LabeledField>

                          {/* Display-only, auto-filled from the selected customer's
                          Business Partner address -- drives CGST/SGST vs IGST. The
                          empty cell beside it keeps every row below paired as before. */}
                          <LabeledField label="State">
                            <FormTextField name="customerState" label="" placeholder="Auto-filled from customer" disabled />
                          </LabeledField>
                          <Box sx={{ display: { xs: 'none', sm: 'block' } }} />

                          <LabeledField label="Currency *">
                            <FormSelect name="currency" label="" options={currencyOptions} />
                          </LabeledField>
                          <LabeledField label="Sales Person *">
                            <FormSelect name="salesPerson" label="" placeholder="Select sales person" options={salesPersonOptions} />
                          </LabeledField>

                          {/* Payment Terms sits directly left of Due Date, which
                          is the pairing that reads best: the terms are what
                          DERIVE the due date (see the payment-terms effect
                          below, which adds the terms' day count to Invoice Date
                          to fill this Due Date in), so the cause sits next to
                          its result. */}
                          <LabeledField label="Payment Terms *">
                            <FormSelect name="paymentTerms" label="" placeholder="Select payment terms" options={PAYMENT_TERMS_OPTIONS} />
                          </LabeledField>
                          <LabeledField label="Due Date *">
                            <FormDatePicker name="dueDate" label="" minDate={dueDateMinDate} triggerFields={['invoiceDate']} />
                          </LabeledField>

                          {/* Supplier — a Business Partner (Vendor), separate from
                          the Customer above, chosen purely so their logo can be
                          printed next to the KEMACH logo when the partner's own
                          Logo Visibility is Yes (see SalesInvoicePrintable.jsx).
                          Kept as an ADJACENT PAIR (same grid row) with its
                          read-only Supplier Name echo: the two are one
                          Code-field/Name-echo unit. */}
                          <LabeledField label="Supplier Code">
                            <PartyCodeSelect name="supplier" label="" placeholder="Select supplier" options={supplierFieldOptions} showNameBelow={false} />
                          </LabeledField>
                          <LabeledField label="Supplier Name">
                            <TextField
                              value={supplierValue || ''}
                              label=""
                              placeholder="—"
                              fullWidth
                              size="small"
                              InputProps={{ readOnly: true }}
                              sx={{ '& .MuiInputBase-input': { color: 'text.secondary' } }}
                            />
                          </LabeledField>

                          <LabeledField label="Receiver">
                            <FormTextField name="receiver" label="" placeholder="Enter receiver name" />
                          </LabeledField>
                          <LabeledField label="Receiver Phone No.">
                            <FormTextField name="receiverPhone" label="" placeholder="Enter receiver phone no." />
                          </LabeledField>

                          <LabeledField label="Bill To">
                            <SalesShipTo mode="bill" customers={customers} formatAddress={formatBusinessPartnerAddress} />
                          </LabeledField>
                          <LabeledField label="Ship To">
                            <SalesShipTo customers={customers} formatAddress={formatBusinessPartnerAddress} />
                          </LabeledField>

                          <LabeledField label={!['Machine', 'Claims', 'Services'].includes(watch('salesCategory')) ? 'Machine No. *' : 'Machine No.'}>
                              {/* Same as Sales Quotation/Order/Delivery Challan: Machine = free-typed (creatable),
                                  every other Sales Type = strict pick-from-list. */}
                              <MachineryCodeSelect name="machineSerialNo" label="" placeholder="Select machine serial no." businessPartnerId={machineryBusinessPartnerId} creatable={watch('salesCategory') === 'Machine'} showNameBelow={false} />
                            </LabeledField>
                          <LabeledField label="Engine No.">
                              <FormTextField name="engineNo" label="" placeholder="Enter engine no." />
                            </LabeledField>

                          <LabeledField label="Hypothecation">
                              <FormTextField name="hypothecation" label="" placeholder="Enter hypothecation" />
                            </LabeledField>

                          <LabeledField label="Customer PO No.">
                            <FormTextField name="customerRefNo" label="" placeholder="Enter customer PO no." />
                          </LabeledField>
                        </FormGrid>
                      </fieldset>

                      {/* Deliberately OUTSIDE the <fieldset disabled={readOnly}> above —
                      see the matching comment on Purchase GRN for why. */}
                      {editingRow?.journalEntryNo && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1.5 }}>
                          <Typography variant="caption" color="text.secondary">Journal Entry:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>{editingRow.journalEntryNo}</Typography>
                          <Tooltip title="View Journal Entry">
                            <IconButton
                              size="small"
                              type="button"
                              onClick={() => setJournalViewOpen(true)}
                            >
                              <VisibilityOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      )}
                    </CardContent>
                  </Card>

                  <Card variant="outlined" sx={{ mb: 2 }}>
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Other Details</Typography>
                      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, width: '100%', display: 'block' }}>
                        <FormGrid columns={2} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING} singleColumnOnMobile>
                          <LabeledField label="Billing Type">
                            <FormSelect name="billingType" label="" placeholder="Select billing type" options={BILLING_TYPE_OPTIONS} disabled />
                          </LabeledField>
                          <LabeledField label="Type of Purchase">
                            <FormSelect name="typeOfPurchase" label="" placeholder="Select type of purchase" options={TYPE_OF_PURCHASE_OPTIONS} />
                          </LabeledField>
                          <LabeledField label="Payment Method *">
                            <FormSelect name="salesType" label="" placeholder="Select payment method" options={SALES_TYPE_OPTIONS} />
                          </LabeledField>
                          <LabeledField label="Transport Mode">
                            <FormSelect name="transportMode" label="" placeholder="Select transport mode" options={TRANSPORT_MODE_OPTIONS} />
                          </LabeledField>
                        </FormGrid>
                      </fieldset>
                    </CardContent>
                  </Card>

                    <Card variant="outlined" sx={{ mb: 2 }}>
                      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                        {/* Tabs sit OUTSIDE the read-only fieldset: a disabled
                            fieldset disables every button inside it, which made
                            the E-Invoice / E-Way Bill tab unclickable in View. */}
                        <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
                          <Tab label="Item Detail" />
                          <Tab label="E-Invoice / E-Way Bill" />
                        </Tabs>
                        <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, width: '100%', display: 'block' }}>

                        {tab === 0 && (
                        <>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                          <Typography variant="subtitle1" fontWeight={700}>Item Details</Typography>
                          <Stack direction="row" spacing={1.5}>
                            <Button type="button" variant="outlined" color="inherit" size="small" startIcon={<UploadFileIcon />} onClick={() => setItemsImportOpen(true)}>
                              Import from Excel
                            </Button>
                            <Button type="button" variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => append(withDefaultTaxCode({ ...emptyItem, warehouse: watch('warehouse') || '' }, liveDefaultTaxCode))}>
                              Add Item
                            </Button>
                            {smartAddEnabled && (
                              <Button type="button" variant="outlined" color="primary" size="small" startIcon={<BoltIcon />} onClick={() => {
                                if (!watch('customer')) {
                                  notify.error('Please select a customer first to use Smart Add.');
                                  return;
                                }
                                setSmartAddOpen(true);
                              }}>
                                Smart Add
                              </Button>
                            )}
                          </Stack>
                        </Stack>

                        <ImportItemsDialog
                          open={itemsImportOpen}
                          onClose={() => setItemsImportOpen(false)}
                          resourceName="Sales Invoice Items"
                          templateUrl="/sales/invoices/items-import/template"
                          importUrl="/sales/invoices/items-import"
                          onImported={handleItemsImported}
                        />

                        <SmartAddHistoryDialog
                          open={smartAddOpen}
                          onClose={() => setSmartAddOpen(false)}
                          onImport={handleSmartAddImport}
                          customer={watch('customer')}
                          documents={allSalesDocuments}
                          products={products || []}
                          defaultWarehouse={watch('warehouse')}
                        />

                        {isMobile ? (
                          <Box>
                            {fields.map((field, index) => {
                              const qty = Number(watch(`items.${index}.quantity`)) || 0;
                              const price = Number(watch(`items.${index}.unitPrice`)) || 0;
                              const itemDiscount = Number(watch(`items.${index}.discountPercent`)) || 0;
                              const gross = qty * price;
                              const rowAmount = gross - gross * (itemDiscount / 100);
                              return (
                                <MobileItemCard
                                  key={field.id}
                                  index={index}
                                  amount={rowAmount.toFixed(2)}
                                  onRemove={() => removeItem(index)}
                                  removeDisabled={fields.length <= 1}
                                >
                                  <ProductCell index={index} methods={methods} options={productCodeOptions} products={products} priceListRates={priceListRates} label="Item No *" placeholder="Select product code" />
                                  <ProductCell index={index} methods={methods} options={productNameOptions} products={products} priceListRates={priceListRates} label="Description" placeholder="Select product name" />
                                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 1.5, rowGap: 1.5 }}>
                                    <FormTextField name={`items.${index}.hsnCode`} label="HSN/SAC" placeholder="4, 6 or 8 digits" digitsOnly maxLength={8} />
                                    <FormTextField name={`items.${index}.uom`} label="Unit" placeholder="Unit" />
                                    {/* Warehouse hidden entirely on a Claims/Services
                                    document — see isNonStockCategory above. */}
                                    {!isNonStockCategory && (
                                      <WarehouseCodeSelect
                                        name={`items.${index}.warehouse`}
                                        label={isDirectInvoice ? 'Warehouse *' : 'Warehouse'}
                                        placeholder={branch ? 'Select' : 'Select branch first'}
                                        options={branchWarehouseOptions}
                                        disabled={!branch}
                                      />
                                    )}
                                    <FormTextField name={`items.${index}.quantity`} label="Quantity *" type="number" />
                                    <FormTextField name={`items.${index}.unitPrice`} label="Rate (₹) *" type="number" />
                                    <FormTextField name={`items.${index}.discountPercent`} label="Discount (%)" type="number" />
                                    <FormSelect name={`items.${index}.taxCodeId`} label="Tax (%)" options={taxCodeOptions} popupFitContent onValueChange={(_v, option) => setValue(`items.${index}.taxPercent`, option ? option.rate : 0, { shouldValidate: true })} />
                                  </Box>
                                  {/* Available-stock hint only applies on the direct
                                  path — a challan-backed line moves no stock —
                                  and never on a Claims/Services document, which
                                  moves no stock regardless of the path. */}
                                  {isDirectInvoice && !isNonStockCategory && (
                                    <Box sx={{ mt: 0.5 }}>
                                      <AvailableStockCell index={index} methods={methods} fieldId={field.id} onErrorChange={handleStockErrorChange} products={products} />
                                    </Box>
                                  )}
                                  {/* Batch/Serial selection, same gating as the
                                  Available-stock hint above — only the direct
                                  path despatches goods of its own. */}
                                  {isDirectInvoice && !isNonStockCategory && (
                                    <Box sx={{ mt: 1 }}>
                                      <BatchSerialCell index={index} methods={methods} product={productsByCode[watch(`items.${index}.productCode`)]} onOpen={(mode) => setBatchDialog({ index, mode })} />
                                    </Box>
                                  )}
                                </MobileItemCard>
                              );
                            })}
                          </Box>
                        ) : (
                          <TableContainer ref={itemScrollRef} sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', cursor: 'grab', ...dragScrollbarSx }}>
                            <Table size="small" sx={[itemColumnsSx, { '& tbody .MuiFormHelperText-root:not(.Mui-error)': { display: 'none' } }]}>
                              <TableHead>
                                <TableRow>
                                  <TableCell width={40}>#</TableCell>
                                  <TableCell>Item No<span style={{ color: '#d32f2f' }}> *</span></TableCell>
                                  <TableCell>Description</TableCell>
                                  <TableCell>HSN/SAC</TableCell>
                                  <TableCell>Unit</TableCell>
                                  {!isNonStockCategory && (
                                    <TableCell>{isDirectInvoice ? 'Warehouse *' : 'Warehouse'}</TableCell>
                                  )}
                                  <TableCell>Quantity<span style={{ color: '#d32f2f' }}> *</span></TableCell>
                                  <TableCell>Rate (₹)<span style={{ color: '#d32f2f' }}> *</span></TableCell>
                                  <TableCell>Discount (%)</TableCell>
                                  <TableCell>Tax (%)</TableCell>
                                  {isDirectInvoice && !isNonStockCategory && (
                                    <TableCell>Batch / Serial</TableCell>
                                  )}
                                  <TableCell align="right">Amount (₹)</TableCell>
                                  <TableCell width={48} />
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {fields.map((field, index) => {
                                  const qty = Number(watch(`items.${index}.quantity`)) || 0;
                                  const price = Number(watch(`items.${index}.unitPrice`)) || 0;
                                  const itemDiscount = Number(watch(`items.${index}.discountPercent`)) || 0;
                                  const gross = qty * price;
                                  const rowAmount = gross - gross * (itemDiscount / 100);
                                  return (
                                    <TableRow key={field.id} sx={{ '& > td': { verticalAlign: 'middle' } }}>
                                      <TableCell>{index + 1}</TableCell>
                                      <TableCell>
                                        <ProductCell index={index} methods={methods} options={productCodeOptions} products={products} priceListRates={priceListRates} placeholder="Select product code" />
                                      </TableCell>
                                      <TableCell>
                                        <ProductCell index={index} methods={methods} options={productNameOptions} products={products} priceListRates={priceListRates} placeholder="Select product name" />
                                      </TableCell>
                                      <TableCell>
                                        <FormTextField name={`items.${index}.hsnCode`} label="" placeholder="HSN/SAC" digitsOnly maxLength={8} />
                                      </TableCell>
                                      <TableCell>
                                        <FormTextField name={`items.${index}.uom`} label="" placeholder="Unit" />
                                      </TableCell>
                                      {!isNonStockCategory && (
                                        <TableCell>
                                          <WarehouseCodeSelect
                                            name={`items.${index}.warehouse`}
                                            label=""
                                            placeholder={branch ? 'Select' : 'Select branch first'}
                                            options={branchWarehouseOptions}
                                            disabled={!branch}
                                            popupFitContent
                                            showNameBelow={false}
                                          />
                                        </TableCell>
                                      )}
                                      <TableCell>
                                        <FormTextField name={`items.${index}.quantity`} label="" type="number" />
                                        {isDirectInvoice && !isNonStockCategory && (
                                          <AvailableStockCell index={index} methods={methods} fieldId={field.id} onErrorChange={handleStockErrorChange} products={products} />
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        <FormTextField name={`items.${index}.unitPrice`} label="" type="number" />
                                      </TableCell>
                                      <TableCell>
                                        <FormTextField name={`items.${index}.discountPercent`} label="" type="number" />
                                      </TableCell>
                                      <TableCell>
                                        <FormSelect
                                          name={`items.${index}.taxCodeId`}
                                          label=""
                                          options={taxCodeOptions}
                                          disableClearable
                                          sx={{ minWidth: 96 }}
                                          popupFitContent
                                          onValueChange={(_v, option) => setValue(`items.${index}.taxPercent`, option ? option.rate : 0, { shouldValidate: true })}
                                        />
                                      </TableCell>
                                      {isDirectInvoice && !isNonStockCategory && (
                                        <TableCell>
                                          <BatchSerialCell index={index} methods={methods} product={productsByCode[watch(`items.${index}.productCode`)]} onOpen={(mode) => setBatchDialog({ index, mode })} />
                                        </TableCell>
                                      )}
                                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{rowAmount.toFixed(2)}</TableCell>
                                      <TableCell>
                                        <IconButton
                                          type="button"
                                          size="small"
                                          color="error"
                                          onClick={() => removeItem(index)}
                                          disabled={fields.length <= 1}
                                          aria-label="remove item"
                                        >
                                          <DeleteIcon fontSize="small" />
                                        </IconButton>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        )}
                        </>
                        )}

                        {tab === 1 && (
                          <Box>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                              <Typography variant="subtitle1" fontWeight={700}>E-Invoice (IRN)</Typography>
                              <Chip size="small" label={einvoiceStatus} color={statusChipColor(einvoiceStatus)} />
                            </Stack>

                            <FormGrid columns={2} singleColumnOnMobile rowSpacing={2.5} columnSpacing={FIELD_COLUMN_SPACING}>
                              <LabeledField label="IRN">
                                <TextField value={editingRow?.irn || ''} placeholder="Not generated" fullWidth size="small" helperText=" " InputProps={{ readOnly: true }} />
                              </LabeledField>
                              <LabeledField label="Ack No">
                                <TextField value={editingRow?.ackNo || ''} placeholder="—" fullWidth size="small" helperText=" " InputProps={{ readOnly: true }} />
                              </LabeledField>
                              <LabeledField label="Ack Date">
                                <TextField value={editingRow?.ackDate ? dayjs(editingRow.ackDate).format('DD/MM/YYYY HH:mm') : ''} placeholder="—" fullWidth size="small" helperText=" " InputProps={{ readOnly: true }} />
                              </LabeledField>
                              <LabeledField label="QR Code">
                                <TextField
                                  value={editingRow?.qrCode || ''}
                                  placeholder="—"
                                  fullWidth
                                  size="small"
                                  multiline
                                  maxRows={3}
                                  helperText=" "
                                  InputProps={{ readOnly: true }}
                                />
                              </LabeledField>
                            </FormGrid>

                            <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
                              <Button
                                type="button"
                                variant="contained"
                                size="small"
                                disabled={!canGenerateEDocs || readOnly || einvoiceStatus === 'Generated' || generatingEInvoice}
                                onClick={handleGenerateEInvoice}
                              >
                                {generatingEInvoice ? 'Generating…' : 'Generate IRN'}
                              </Button>
                              <Button
                                type="button"
                                variant="outlined"
                                color="error"
                                size="small"
                                // Not gated on editingRow?.irn: an invoice can
                                // be marked einvoiceStatus 'Generated' with no
                                // irn if it was generated before the backend
                                // started refusing to save that combination
                                // (see generateEInvoice's own guard in
                                // taxproGsp.service.js) -- gating on irn here
                                // would leave that invoice with no way to
                                // clear the stuck state, since cancelEInvoice
                                // handles a missing irn as a local reset
                                // rather than a real GSP cancellation in
                                // exactly this case.
                                disabled={readOnly || einvoiceStatus !== 'Generated' || cancellingEInvoice}
                                onClick={() => openCancelDialog('einvoice')}
                              >
                                Cancel IRN
                              </Button>
                            </Stack>
                            {!canGenerateEDocs && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                                Save the invoice before generating an e-invoice or e-way bill.
                              </Typography>
                            )}

                            <Divider sx={{ my: 3 }} />

                            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                              <Typography variant="subtitle1" fontWeight={700}>E-Way Bill</Typography>
                              <Chip size="small" label={ewayBillStatus} color={statusChipColor(ewayBillStatus)} />
                            </Stack>

                            <FormGrid columns={2} singleColumnOnMobile rowSpacing={2.5} columnSpacing={FIELD_COLUMN_SPACING}>
                              <LabeledField label="E-Way Bill No">
                                <TextField value={editingRow?.ewayBillNo || ''} placeholder="Not generated" fullWidth size="small" helperText=" " InputProps={{ readOnly: true }} />
                              </LabeledField>
                              <LabeledField label="E-Way Bill Date">
                                <TextField value={editingRow?.ewayBillDate ? dayjs(editingRow.ewayBillDate).format('DD/MM/YYYY HH:mm') : ''} placeholder="—" fullWidth size="small" helperText=" " InputProps={{ readOnly: true }} />
                              </LabeledField>
                              <LabeledField label="Valid Upto">
                                <TextField value={editingRow?.ewayBillValidUpto ? dayjs(editingRow.ewayBillValidUpto).format('DD/MM/YYYY HH:mm') : ''} placeholder="—" fullWidth size="small" helperText=" " InputProps={{ readOnly: true }} />
                              </LabeledField>
                              <LabeledField label="Transport Mode">
                                <FormSelect name="transportMode" label="" placeholder="Select transport mode" options={TRANSPORT_MODE_OPTIONS} />
                              </LabeledField>
                              <LabeledField label="Transporter Name">
                                <TextField
                                  value={ewbTransporterName}
                                  onChange={(e) => setEwbTransporterName(e.target.value)}
                                  placeholder="Transporter name"
                                  fullWidth
                                  size="small"
                                  helperText=" "
                                  disabled={ewayBillStatus === 'Generated'}
                                />
                              </LabeledField>
                              <LabeledField label="Transporter ID / GSTIN">
                                <TextField
                                  value={ewbTransporterGstin}
                                  onChange={(e) => setEwbTransporterGstin(e.target.value.toUpperCase())}
                                  placeholder="15-digit GSTIN"
                                  fullWidth
                                  size="small"
                                  helperText=" "
                                  disabled={ewayBillStatus === 'Generated'}
                                />
                              </LabeledField>
                              <LabeledField label="Vehicle No">
                                <TextField
                                  value={ewbVehicleNo}
                                  onChange={(e) => setEwbVehicleNo(e.target.value.toUpperCase())}
                                  placeholder="e.g. KA01AB1234"
                                  fullWidth
                                  size="small"
                                  helperText=" "
                                  disabled={ewayBillStatus === 'Generated'}
                                />
                              </LabeledField>
                              <LabeledField label="Distance (km)">
                                <TextField
                                  value={ewbDistanceKm}
                                  onChange={(e) => setEwbDistanceKm(e.target.value.replace(/[^0-9]/g, ''))}
                                  placeholder="0"
                                  fullWidth
                                  size="small"
                                  helperText=" "
                                  disabled={ewayBillStatus === 'Generated'}
                                />
                              </LabeledField>
                            </FormGrid>

                            <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
                              <Button
                                type="button"
                                variant="contained"
                                size="small"
                                disabled={!canGenerateEDocs || readOnly || ewayBillStatus === 'Generated' || generatingEWayBill}
                                onClick={handleGenerateEWayBill}
                              >
                                {generatingEWayBill ? 'Generating…' : 'Generate E-Way Bill'}
                              </Button>
                              <Button
                                type="button"
                                variant="outlined"
                                color="error"
                                size="small"
                                disabled={!editingRow?.ewayBillNo || readOnly || ewayBillStatus === 'Cancelled' || cancellingEWayBill}
                                onClick={() => openCancelDialog('eway-bill')}
                              >
                                Cancel E-Way Bill
                              </Button>
                            </Stack>

                            {edocError && (
                              <Alert severity="error" sx={{ mt: 2 }} onClose={() => setEdocError('')}>
                                {edocError}
                              </Alert>
                            )}

                            <Dialog open={Boolean(cancelDialogFor)} onClose={() => setCancelDialogFor(null)} maxWidth="xs" fullWidth>
                              <DialogTitle>{cancelDialogFor === 'einvoice' ? 'Cancel E-Invoice' : 'Cancel E-Way Bill'}</DialogTitle>
                              <DialogContent>
                                <TextField
                                  autoFocus
                                  fullWidth
                                  multiline
                                  minRows={2}
                                  label="Cancel Reason *"
                                  placeholder="Reason for cancellation"
                                  value={cancelReason}
                                  onChange={(e) => setCancelReason(e.target.value)}
                                  sx={{ mt: 1 }}
                                />
                              </DialogContent>
                              <DialogActions>
                                <Button onClick={() => setCancelDialogFor(null)}>Close</Button>
                                <Button
                                  variant="contained"
                                  color="error"
                                  disabled={!cancelReason.trim() || cancellingEInvoice || cancellingEWayBill}
                                  onClick={handleConfirmCancel}
                                >
                                  Confirm Cancel
                                </Button>
                              </DialogActions>
                            </Dialog>
                          </Box>
                        )}
                        </fieldset>
                      </CardContent>
                    </Card>

                  <Card variant="outlined">
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, width: '100%', display: 'block' }}>
                        <Grid container spacing={3}>
                          {/* Remarks removed from this form. Terms & Conditions given more
                              ROWS (10 instead of 6) so a real multi-line terms paragraph
                              doesn't scroll inside its own box — width stays the even 4/4/4
                              split the other two columns (and Sales Quotation/Sales Order's
                              own identical layout) use. */}
                          <Grid item xs={12} md={4} sx={{ display: 'flex' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Terms & Conditions</Typography>
                            <FormTextField name="termsConditions" label="" placeholder="Enter terms and conditions" multiline rows={8}
                              sx={{
                                flex: 1,
                                '& .MuiInputBase-root': { height: '100%', alignItems: 'flex-start', paddingTop: 1.5 },
                                '& .MuiInputBase-inputMultiline': { height: '100%', alignItems: 'flex-start', paddingTop: 1.5 },
                              }}
                            />
                            </Box>
                          </Grid>

                          <Grid item xs={12} md={4} sx={{ display: 'flex' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Attachments</Typography>
                            <Box
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
                              sx={{
                                flex: 1,
                                display: 'flex', flexDirection: 'column', justifyContent: 'center',
                                border: '1px dashed', borderColor: 'divider', borderRadius: 1.5,
                                p: 3, textAlign: 'center', color: 'text.secondary',
                              }}
                            >
                              <UploadFileIcon sx={{ mb: 1 }} />
                              <Typography variant="body2" sx={{ mb: 1 }}>Drag and drop files here</Typography>
                              <Typography variant="body2" sx={{ mb: 1 }}>or</Typography>
                              <Button component="label" variant="outlined" size="small" disabled={readOnly}>
                                Browse Files
                                <input type="file" hidden onChange={(e) => handleFile(e.target.files?.[0])} />
                              </Button>
                              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                                Supported formats: PDF, JPG, PNG (Max. 5MB)
                              </Typography>
                              {watch('attachmentName') && (
                                <Chip
                                  sx={{ mt: 1.5 }}
                                  size="small"
                                  label={watch('attachmentName')}
                                  onDelete={readOnly ? undefined : () => setValue('attachmentName', '')}
                                />
                              )}
                              </Box>
                            </Box>
                          </Grid>

                          <Grid item xs={12} md={4} sx={{ display: 'flex' }}>
                            <Box sx={{ width: '100%' }}>
                              <DocumentTotalsPanel totals={totals} interState={interState} discountField={null} showFreight />
                            </Box>
                          </Grid>

                          <Grid item xs={12} md={4}>
                            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Prepared By</Typography>
                            <FormTextField name="preparedBy" label="" disabled />
                          </Grid>

                          <Grid item xs={12} md={4}>
                            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Approved By</Typography>
                            <FormSelect name="approvedBy" label="" placeholder="Select employee" options={approvedByOptions} />
                          </Grid>
                        </Grid>
                      </fieldset>

                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1.5}
                        justifyContent={{ xs: 'stretch', sm: 'flex-end' }}
                        sx={{ mt: 3 }}
                      >
                        {/* Opens WhatsApp's click-to-chat, pre-addressed to
                          this customer's saved mobile number, with a message
                          naming this invoice — see WhatsAppShareButton.jsx
                          for why this isn't a fully automated send. */}
                        <WhatsAppShareButton
                          fullWidth={isMobile}
                          phone={printCustomerRecord?.phone}
                          customerName={allValues.customer}
                          docLabel="Sales Invoice"
                          docNo={allValues.invoiceNo}
                          onClick={() => handleSendInvoiceWhatsApp(editingRow)}
                          sending={sendingInvoiceWhatsApp}
                          disabled={creating || updating || !editingRow?.id}
                        />
                        {/* Copy To — the reverse of Copy From, pushing this
                          saved invoice forward into a new Sales Credit Memo.
                          See CopyToButton.jsx and the identical pattern on
                          DeliveryChallan.jsx. Gated (inside CopyToButton
                          itself) on editingRow actually being a saved
                          document — there's nothing to copy forward from an
                          unsaved draft. Always opens as a "Copy To" dropdown
                          menu, same shape as Copy From's own menu just below,
                          even though there's only one target today. */}
                        <CopyToButton
                          sourceType="salesInvoice"
                          sourceDoc={editingRow}
                          sourceLabel="Sales Invoice"
                          docNoField="invoiceNo"
                          targets={[
                            { key: 'salesCreditMemo', label: 'Sales Credit Memo', path: '/sales/credit-memo', description: 'Credit back against this invoice' },
                          ]}
                        />
                        {/* Copy From sits immediately left of Cancel and stays
                          disabled until a Customer is chosen — the dialogs it
                          leads to list that customer's orders and deliveries,
                          so with no customer there is nothing for them to
                          show. Hidden in view mode, where nothing is being
                          filled in. */}
                        {!readOnly && (
                          (challanValue || orderValue) ? (
                            <Button
                              fullWidth={isMobile}
                              type="button"
                              variant="outlined"
                              color="inherit"
                              startIcon={<CloseIcon />}
                              onClick={clearSource}
                              disabled={creating || updating}
                            >
                              Clear Copied {challanValue ? 'Challan' : 'Order'}
                            </Button>
                          ) : (
                            <Button
                              fullWidth={isMobile}
                              type="button"
                              variant="outlined"
                              startIcon={<ContentCopyOutlinedIcon />}
                              endIcon={<ArrowDropDownIcon />}
                              onClick={(e) => setCopyFromAnchor(e.currentTarget)}
                              disabled={!customerValue || creating || updating}
                            >
                              Copy From
                            </Button>
                          )
                        )}
                        <Button fullWidth={isMobile} type="button" variant="outlined" color="inherit" startIcon={<CloseIcon />} onClick={backToList} disabled={creating || updating}>
                          Cancel
                        </Button>
                        <Button fullWidth={isMobile} type="button" variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => startPrint(editingRow)}>
                          Print
                        </Button>
                        {!readOnly && (
                          <>
                            <FormSubmitButton
                              fullWidth={isMobile}
                              variant="outlined"
                              onClick={() => { pendingStatusRef.current = 'Draft'; }}
                              disabled={creating || updating}
                              loading={creating || updating}
                            >
                              Save as Draft
                            </FormSubmitButton>
                            <FormSubmitButton
                              fullWidth={isMobile}
                              onClick={() => { pendingStatusRef.current = 'Sent'; }}
                              disabled={creating || updating}
                              loading={creating || updating}
                            >
                              {editingRow ? 'Update Invoice' : 'Save & Send Invoice'}
                            </FormSubmitButton>
                          </>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>

                  {batchDialog && batchDialog.index < fields.length && (
                    <BatchSerialSelectionDialog
                      open
                      onClose={() => setBatchDialog(null)}
                      mode={batchDialog.mode}
                      readOnly={readOnly}
                      docNo={editingRow?.invoiceNo}
                      itemNumber={watch(`items.${batchDialog.index}.productCode`)}
                      itemDescription={watch(`items.${batchDialog.index}.productName`)}
                      warehouseCode={watch(`items.${batchDialog.index}.warehouse`) || watch('warehouse')}
                      warehouseName={(branchWarehouseOptions.find((w) => w.value === (watch(`items.${batchDialog.index}.warehouse`) || watch('warehouse'))) || {}).label}
                      totalNeeded={Number(watch(`items.${batchDialog.index}.quantity`)) || 0}
                      productCode={watch(`items.${batchDialog.index}.productCode`)}
                      value={watch(`items.${batchDialog.index}.${batchDialog.mode === 'Batch' ? 'batchAllocations' : 'serialAllocations'}`)}
                      onSave={(rows) => setValue(
                        `items.${batchDialog.index}.${batchDialog.mode === 'Batch' ? 'batchAllocations' : 'serialAllocations'}`,
                        rows,
                        { shouldValidate: true }
                      )}
                    />
                  )}

                  <JournalEntryViewDialog
                    open={journalViewOpen}
                    journalEntryId={editingRow?.journalEntryId}
                    onClose={() => setJournalViewOpen(false)}
                  />
                </>
              );
            }}
          </AppForm>
        </RouteMapContextMenu>
      ) : (
        <Card variant="outlined">
          <CardContent sx={{ p: 0 }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              alignItems={{ xs: 'stretch', md: 'center' }}
              justifyContent="space-between"
              flexWrap="wrap"
              gap={1.5}
              sx={{ px: { xs: 2, sm: 3 }, pt: 2.5, pb: 1.5 }}
            >
              <Typography variant="subtitle1" fontWeight={700}>Sales Invoice List</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap sx={{ width: { xs: '100%', md: 'auto' } }}>
                <TableSearchFilter table={table} placeholder="Search by invoice no., order no., customer..." showFilter={false} />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
                  <Button
                    size="small"
                    variant="outlined"
                    color="inherit"
                    startIcon={<FilterListIcon />}
                    onClick={() => setShowFilters((v) => !v)}
                    sx={{ width: { xs: '100%', sm: 'auto' }, whiteSpace: 'nowrap' }}
                  >
                    Filter
                  </Button>
                  <CanAdd>
                    {/* React.Children.only requires a single element child, so both
                        buttons are grouped under one Stack rather than passed as two
                        siblings directly inside <CanAdd> — that used to crash the page. */}
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
                      <Button
                        size="small"
                        variant="outlined"
                        color="inherit"
                        startIcon={<UploadFileIcon />}
                        onClick={() => setBulkImportOpen(true)}
                        sx={{ width: { xs: '100%', sm: 'auto' }, whiteSpace: 'nowrap' }}
                      >
                        Import from Excel
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<AddIcon />}
                        endIcon={<ArrowDropDownIcon />}
                        onClick={openCreate}
                        sx={{ width: { xs: '100%', sm: 'auto' }, whiteSpace: 'nowrap' }}
                      >
                        Create Invoice
                      </Button>
                    </Stack>
                  </CanAdd>
                </Stack>
              </Stack>
            </Stack>

            <Collapse in={showFilters} unmountOnExit>
              <Box sx={{ px: { xs: 2, sm: 3 }, pb: 2 }}>
                <FormGrid columns={5} singleColumnOnMobile>
                  <FilterAutocomplete
                    label="Customer"
                    allLabel="All Customers"
                    options={customerOptions}
                    value={customerFilter}
                    onChange={(v) => { setCustomerFilter(v); setPage(0); }}
                  />
                  <Autocomplete
                    size="small"
                    options={STATUS_FILTERS}
                    value={statusFilter}
                    onChange={(_e, v) => { setStatusFilter(v || 'All Status'); setPage(0); }}
                    disableClearable
                    renderInput={(params) => <TextField {...params} label="Status" InputLabelProps={{ shrink: true }} />}
                  />
                  <TextField
                    size="small"
                    fullWidth
                    label="Date Range"
                    value={dateRangeLabel}
                    onClick={(e) => setDateAnchor(e.currentTarget)}
                    InputProps={{
                      readOnly: true,
                      startAdornment: <InputAdornment position="start"><EventIcon fontSize="small" /></InputAdornment>,
                      endAdornment: (dateFrom || dateTo) ? (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); setDateFrom(null); setDateTo(null); setPage(0); }}>
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </InputAdornment>
                      ) : null,
                    }}
                    InputLabelProps={{ shrink: true }}
                    sx={{ cursor: 'pointer' }}
                  />
                  <Autocomplete
                    size="small"
                    options={PAYMENT_STATUS_FILTERS}
                    value={paymentStatusFilter}
                    onChange={(_e, v) => { setPaymentStatusFilter(v || 'All Payment Status'); setPage(0); }}
                    disableClearable
                    renderInput={(params) => <TextField {...params} label="Payment Status" InputLabelProps={{ shrink: true }} />}
                  />
                  <FilterAutocomplete
                    label="Sales Person"
                    allLabel="All Sales Persons"
                    options={salesPersonOptions}
                    value={salesPersonFilter}
                    onChange={(v) => { setSalesPersonFilter(v); setPage(0); }}
                  />
                </FormGrid>

                <Popover
                  open={!!dateAnchor}
                  anchorEl={dateAnchor}
                  onClose={() => setDateAnchor(null)}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                >
                  <Stack direction="row" spacing={2} sx={{ p: 2 }}>
                    <DatePicker label="From" value={dateFrom} onChange={(v) => { setDateFrom(v); setPage(0); }} slotProps={{ textField: { size: 'small' } }} />
                    <DatePicker label="To" value={dateTo} onChange={(v) => { setDateTo(v); setPage(0); }} slotProps={{ textField: { size: 'small' } }} />
                  </Stack>
                </Popover>
                <TableFilterPanel table={table} embedded open />
              </Box>
            </Collapse>

            {canDelete && checkedIds.length > 0 && (
              <Box sx={{ px: { xs: 2, sm: 3 }, pb: 1.5 }}>
                <Button variant="outlined" color="error" size="small" startIcon={<DeleteIcon />} onClick={removeSelected}>
                  Delete Selected ({checkedIds.length})
                </Button>
              </Box>
            )}

            {isMobile ? (
              <Box sx={{ px: 2, pb: 1 }}>
                {!isLoading && pagedRows.map((row) => (
                  <MobileRecordCard
                    key={row.id}
                    title={row.invoiceNo}
                    statusChip={<Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />}
                    fields={[
                      { label: 'Customer', value: row.customer || '—' },
                      { label: 'Order No.', value: row.orderNo || '—' },
                      { label: 'Invoice Date', value: row.invoiceDate ? dayjs(row.invoiceDate).format('DD/MM/YYYY') : '—' },
                      { label: 'Due Date', value: row.dueDate ? dayjs(row.dueDate).format('DD/MM/YYYY') : '—' },
                      { label: 'Amount', value: `₹${Number(row.amount).toFixed(2)}` },
                      { label: 'Payment Status', value: row.paymentStatus || '—' },
                    ]}
                    // Cancelled invoices are fully locked — no View/Edit/
                    // Delete/Cancel action once isCancelled is true, only
                    // the status chip above shows "Cancelled".
                    onEdit={row.isCancelled ? undefined : () => handleEdit(row)}
                    onDelete={row.isCancelled ? undefined : () => handleDelete(row)}
                    extraActions={row.isCancelled ? [] : [
                      { key: 'cancel', label: 'Cancel', icon: <CancelOutlinedIcon fontSize="small" />, color: 'warning', onClick: () => handleCancel(row) },
                    ]}
                  />
                ))}
                {!isLoading && filteredRows.length === 0 && (
                  <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />} title="No sales invoices found" message="Add your first sales invoice to get started" />
                )}
              </Box>
            ) : (
              <ScrollableTableContainer>
                <Table
                  size="small"
                  stickyHeader
                  sx={{
                    '& th, & td': {
                      height: SALES_INVOICE_LIST_TABLE_ROW_HEIGHT,
                      paddingTop: `${SALES_INVOICE_LIST_TABLE_CELL_PADDING_Y}px`,
                      paddingBottom: `${SALES_INVOICE_LIST_TABLE_CELL_PADDING_Y}px`,
                      boxSizing: 'border-box',
                    },
                  }}
                >
                  <TableHead>
                    <TableRow>
                      {canDelete && (
                        <SortableHeaderCell field="id" sort={table.sort} onSort={table.toggleSort} padding="checkbox">
                          <Checkbox
                            size="small"
                            checked={pagedRows.length > 0 && pagedRows.every((r) => checkedIds.includes(r.id))}
                            indeterminate={pagedRows.some((r) => checkedIds.includes(r.id)) && !pagedRows.every((r) => checkedIds.includes(r.id))}
                            onChange={(e) => {
                              const ids = pagedRows.map((r) => r.id);
                              setCheckedIds((prev) => e.target.checked
                                ? Array.from(new Set([...prev, ...ids]))
                                : prev.filter((c) => !ids.includes(c)));
                            }}
                          />
                        </SortableHeaderCell>
                      )}
                      <TableCell width={40}>#</TableCell>
                      <SortableHeaderCell field="invoiceNo" sort={table.sort} onSort={table.toggleSort}>Invoice No.</SortableHeaderCell>
                      <SortableHeaderCell field="invoiceDate" sort={table.sort} onSort={table.toggleSort}>Invoice Date</SortableHeaderCell>
                      <SortableHeaderCell field="customer" sort={table.sort} onSort={table.toggleSort}>Customer</SortableHeaderCell>
                      <SortableHeaderCell field="orderNo" sort={table.sort} onSort={table.toggleSort}>Order No.</SortableHeaderCell>
                      <SortableHeaderCell field="dueDate" sort={table.sort} onSort={table.toggleSort}>Due Date</SortableHeaderCell>
                      <SortableHeaderCell align="right" field="amount" sort={table.sort} onSort={table.toggleSort}>Amount (₹)</SortableHeaderCell>
                      <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                      <SortableHeaderCell field="paymentStatus" sort={table.sort} onSort={table.toggleSort}>Payment Status</SortableHeaderCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {!isLoading && pagedRows.map((row, i) => (
                      <TableRow key={row.id} hover>
                        {canDelete && (
                          <TableCell padding="checkbox">
                            <Checkbox
                              size="small"
                              checked={checkedIds.includes(row.id)}
                              onChange={() => setCheckedIds((prev) => prev.includes(row.id) ? prev.filter((c) => c !== row.id) : [...prev, row.id])}
                            />
                          </TableCell>
                        )}
                        <TableCell>{page * pageSize + i + 1}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.invoiceNo}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.invoiceDate ? dayjs(row.invoiceDate).format('DD/MM/YYYY') : '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.customer || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.orderNo || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.dueDate ? dayjs(row.dueDate).format('DD/MM/YYYY') : '—'}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{Number(row.amount).toFixed(2)}</TableCell>
                        <TableCell>
                          <Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={row.paymentStatus} color={PAYMENT_STATUS_COLORS[row.paymentStatus] || 'default'} variant="outlined" />
                        </TableCell>
                        <TableCell align="right">
                          {row.isCancelled ? (
                            // Fully locked once cancelled — no View/Print/
                            // Edit/Delete/Cancel, only the status chip above
                            // says "Cancelled".
                            <Typography variant="caption" color="text.secondary">Cancelled</Typography>
                          ) : (
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title="View">
                              <IconButton size="small" onClick={() => handleView(row)} aria-label="view">
                                <VisibilityOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <RouteMapButton flow="sales" type="invoice" docNo={row.invoiceNo} />
                            <Tooltip title="Print">
                              <IconButton size="small" onClick={() => handlePrint(row)} aria-label="print">
                                <PrintOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {/* Row-level equivalent of the form footer's own
                              WhatsAppShareButton — looked up by customer name
                              since the list row itself only carries the
                              customer's name/invoice No., not their phone. */}
                            <WhatsAppShareButton
                              iconOnly
                              phone={(customers || []).find((c) => c.customerName === row.customer)?.phone}
                              customerName={row.customer}
                              docLabel="Sales Invoice"
                              docNo={row.invoiceNo}
                              onClick={() => handleSendRowWhatsApp(row)}
                              sending={sendingInvoiceWhatsApp && whatsappRequestInvoiceNo === row.invoiceNo}
                            />
                            <CanCancel>
                              <Tooltip title="Cancel">
                                <IconButton size="small" color="warning" onClick={() => handleCancel(row)} aria-label="cancel">
                                  <CancelOutlinedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </CanCancel>
                            <IconButton
                              size="small"
                              onClick={(e) => { setRowMenuAnchor(e.currentTarget); setRowMenuTarget(row); }}
                              aria-label="more actions"
                            >
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!isLoading && filteredRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={11}>
                          <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />} title="No sales invoices found" message="Add your first sales invoice to get started" />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollableTableContainer>
            )}

            <Menu anchorEl={rowMenuAnchor} open={!!rowMenuAnchor} onClose={() => setRowMenuAnchor(null)}>
              <CanEdit>
                <MenuItem onClick={() => handleEdit(rowMenuTarget)}>
                  <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
                  <ListItemText>Edit</ListItemText>
                </MenuItem>
              </CanEdit>
              {isAdmin(currentUser) && rowMenuTarget?.isPrinted ? (
                <MenuItem onClick={() => handleResetPrinted(rowMenuTarget)}>
                  <ListItemIcon><PrintOutlinedIcon fontSize="small" /></ListItemIcon>
                  <ListItemText>Reset Print Status</ListItemText>
                </MenuItem>
              ) : null}
              <CanDelete>
                <MenuItem onClick={() => handleDelete(rowMenuTarget)}>
                  <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
                  <ListItemText>Delete</ListItemText>
                </MenuItem>
              </CanDelete>
            </Menu>

            <EntityListPagination total={table.total} page={page} onChange={setPage} pageSize={pageSize} onPageSizeChange={(v) => { setPageSize(v); setPage(0); }} />
          </CardContent>
        </Card>
      )}

      <BulkImportDialog
        open={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        resourceName="Sales Invoices"
        templateUrl="/sales/invoices/bulk-import/template"
        importUrl="/sales/invoices/bulk-import"
        onImported={refetchInvoices}
      />
    </Box>
  );
}

// Both the Item No and Description columns are selects over the same
// underlying items.{index}.productCode field — Item No lists codes,
// Description lists names, and picking either fills the rest of the row
// from the product master. Isolated so the per-row auto-fill effect only
// re-runs for the row whose product actually changed, not every row on every
// keystroke.
function ProductCell({ index, methods, options, products, priceListRates, label = '', placeholder = 'Select product', disabled = false, multiline = false, sx }) {
  const notify = useNotify();
  const { watch, setValue, trigger } = methods;
  const productCodeValue = watch(`items.${index}.productCode`);
  const allItems = watch('items') || [];
  const prevValue = useRef(productCodeValue);

  const otherSelectedCodes = useMemo(() => {
    const set = new Set();
    allItems.forEach((it, i) => {
      if (i !== index && it?.productCode) {
        set.add(String(it.productCode).trim().toUpperCase());
      }
    });
    return set;
  }, [allItems, index]);

  const optionsWithDisabledLabel = useMemo(() => {
    return options.map((opt) => ({
      ...opt,
      label: otherSelectedCodes.has(String(opt.value).trim().toUpperCase())
        ? `${opt.label} (Already selected)`
        : opt.label,
    }));
  }, [options, otherSelectedCodes]);

  useEffect(() => {
    if (productCodeValue !== prevValue.current) {
      if (productCodeValue) {
        const normalized = String(productCodeValue).trim().toUpperCase();

        if (otherSelectedCodes.has(normalized)) {
          const duplicateIdx = allItems.findIndex(
            (it, i) => i !== index && String(it?.productCode || '').trim().toUpperCase() === normalized
          );
          notify.error(`Item "${productCodeValue}" is already selected in row ${duplicateIdx + 1}. Please choose a different product.`);
          setValue(`items.${index}.productCode`, '', { shouldValidate: true });
          setValue(`items.${index}.productName`, '', { shouldValidate: true });
          setValue(`items.${index}.description`, '', { shouldValidate: true });
          setValue(`items.${index}.hsnCode`, '', { shouldValidate: true });
          setValue(`items.${index}.uom`, '', { shouldValidate: true });
          setValue(`items.${index}.unitPrice`, 0, { shouldValidate: true });
          prevValue.current = '';
          return;
        }
      }
      const found = (products || []).find((p) => p.productCode === productCodeValue);
      if (found) {
        setValue(`items.${index}.productName`, found.productName, { shouldValidate: true });
        setValue(`items.${index}.description`, found.productName, { shouldValidate: true });
        // found.hsnCode is copied verbatim from Product Master — a code saved
        // there in the dotted customs-tariff style (e.g. "4012.90.90") or with
        // stray spacing fails this line's own digits-only HSN/SAC validation the
        // instant it's copied in, even though "4012.90.90" and "40129090" are
        // the same code. Stripped here so the field lands clean, same rule as
        // stripHsnSeparators() in lib/validation/common.js.
        setValue(`items.${index}.hsnCode`, (found.hsnCode || '').replace(/[.\s-]/g, ''), { shouldValidate: true });
        setValue(`items.${index}.uom`, found.uom || '', { shouldValidate: true });
        const priceListRate = priceListRates?.get(found.productCode);
        setValue(`items.${index}.unitPrice`, priceListRate != null ? priceListRate : (found.unitPrice != null ? Number(found.unitPrice) : 0), { shouldValidate: true });
      }
      prevValue.current = productCodeValue;
      trigger('items');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productCodeValue, otherSelectedCodes]);

  return (
    <FormSelect
      name={`items.${index}.productCode`}
      label={label}
      placeholder={placeholder}
      options={optionsWithDisabledLabel}
      getOptionDisabled={(opt) => otherSelectedCodes.has(String(opt.value).trim().toUpperCase())}
      disabled={disabled}
      multiline={multiline}
      sx={sx}
      popupFitContent
    />
  );
}

// Live "Available: N" hint for this row's own selected Warehouse, and the
// component-state half of the quantity<=available-stock rule — re-fetched
// automatically (via useWarehouseStock/RTK Query) whenever this row's
// Warehouse or product changes, and re-compared whenever Quantity changes.
// No static zod rule can express this since it needs a live server value;
// instead this reports up to the parent's stockErrors map (keyed by the
// field's stable id so it survives row add/remove reordering), which gates
// the Save buttons. Mirrors StockIssue.jsx's AvailableStockCell exactly.
// Only ever mounted on the direct path (no delivery challan) — see the
// isDirectInvoice gate at both call sites — since a challan-backed invoice
// is finance-only and moves no stock. assertNoNegativeWarehouseStockFor on
// the server (see resources.js, gated the same way) is the real authority.
// Same button/dialog trigger as DeliveryChallan.jsx's/PurchaseGRN.jsx's own
// BatchSerialCell — shows Batch/Serial allocation progress for this line and
// opens BatchSerialSelectionDialog on click. Only ever mounted on the direct
// path (see the isDirectInvoice gate at both call sites), same as
// AvailableStockCell above.
function BatchSerialCell({ index, methods, product, onOpen }) {
  const { watch } = methods;
  const trackingMode = product?.manageItemBy;
  if (trackingMode !== 'Batch' && trackingMode !== 'Serial') {
    return <Typography variant="caption" color="text.secondary">—</Typography>;
  }
  const needed = Number(watch(`items.${index}.quantity`)) || 0;
  const batchAllocations = watch(`items.${index}.batchAllocations`) || [];
  const serialAllocations = watch(`items.${index}.serialAllocations`) || [];
  const allocated = trackingMode === 'Batch'
    ? batchAllocations.reduce((sum, b) => sum + (Number(b.quantity) || 0), 0)
    : serialAllocations.length;
  const complete = needed > 0 && Math.abs(allocated - needed) < 0.005;

  return (
    <Button
      type="button"
      size="small"
      variant="outlined"
      color={complete ? 'success' : 'warning'}
      startIcon={<Inventory2OutlinedIcon fontSize="small" />}
      onClick={() => onOpen(trackingMode)}
      sx={{ whiteSpace: 'nowrap' }}
    >
      {trackingMode}: {allocated}/{needed}
    </Button>
  );
}

function AvailableStockCell({ index, methods, fieldId, onErrorChange, products }) {
  const { watch } = methods;
  const productCode = watch(`items.${index}.productCode`);
  const lineWarehouse = watch(`items.${index}.warehouse`);
  const headerWarehouse = watch('warehouse');
  const warehouse = lineWarehouse || headerWarehouse;
  const quantity = Number(watch(`items.${index}.quantity`)) || 0;
  // A non-inventory product (Product Master's Inventory Item unchecked) is
  // never stock-tracked — no ledger posting, no quantity validation, on the
  // server (see attachInventoryItemFlag in routes/resources.js) — so its
  // line gets a neutral placeholder here instead of a live figure, and its
  // quantity never blocks Save regardless of what's on hand.
  const isNonInventory = (products || []).find((p) => p.productCode === productCode)?.inventoryItem === false;
  const { onHand, isLoading } = useWarehouseStock(isNonInventory ? null : productCode, warehouse);
  const exceeds = !isNonInventory && onHand != null && quantity > onHand;

  useEffect(() => {
    onErrorChange(fieldId, exceeds);
    // Clear this row's error if it unmounts (row removed, or the invoice
    // flips off the direct path) rather than leaving a stale entry behind.
    return () => onErrorChange(fieldId, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldId, exceeds]);

  if (!productCode || !warehouse) return null;
  if (isNonInventory) {
    return (
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', whiteSpace: 'nowrap', mt: 0.25 }}>
        Available: —
      </Typography>
    );
  }
  return (
    <Typography variant="caption" color={exceeds ? 'error' : 'text.secondary'} sx={{ display: 'block', whiteSpace: 'nowrap', mt: 0.25 }}>
      {isLoading ? 'Available: …' : exceeds ? `Available: ${onHand} — exceeds stock` : `Available: ${onHand}`}
    </Typography>
  );
}
