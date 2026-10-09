import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatPartnerAddress, cleanAddressText } from '../../lib/addressFormat';
import EmptyState from '../../components/data-display/EmptyState';
import usePriceListRates from '../../hooks/usePriceListRates';
import {
  Box, Typography, Button, Card, CardContent, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, Chip, IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Grid,
  CircularProgress, Tooltip,
} from '@mui/material';
import { useFieldArray } from 'react-hook-form';
import dayjs from 'dayjs';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import WarehouseCodeSelect from '../../components/form/WarehouseCodeSelect';
import PartyCodeSelect, { buildPartyCodeOptions } from '../../components/form/PartyCodeSelect';
import FormDatePicker from '../../components/form/FormDatePicker';
import DocumentSeriesNoField from '../../components/form/DocumentSeriesNoField';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import CompanyBadge from '../../components/common/CompanyBadge';
import { useWarehouseOptions, warehouseCodesForBranch } from '../../lib/useWarehouseOptions';
import { CanAdd, CanEdit, CanDelete, CanCancel } from '../../components/common/PermissionGate';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { applyServerErrors } from '../../lib/formErrors';
import { itemTableSx } from '../../lib/columnWidth';
import { salesCreditMemoSchema, SALES_CREDIT_MEMO_STATUS_OPTIONS } from '../../lib/validation/salesSchemas';
import { isNonStockSalesCategory } from '../../lib/validation/common';
import { buildDocument, round2, isInterState, computeFreightGross, computeItemDiscountTotal } from '../../lib/documentTotals';
import DocumentTotalsPanel from '../../components/form/DocumentTotalsPanel';
import { useGetCompanyDetailsQuery } from '../../features/company/companyDetailsApi';
import { buildTaxCodeOptions, taxTypeFamilyFor, pickDefaultTaxCode, withDefaultTaxCode } from '../../lib/taxCodeOptions';
import { productOptionsFor, PRODUCT_USAGE } from '../../lib/productUsage';
import { taxCodeApi } from '../../features/resources';
import { PAYMENT_TERMS_OPTIONS } from '../../lib/validation/partnerSchemas';
import { salesCreditMemoApi, salesInvoiceApi, deliveryChallanApi, customerApi, productApi, salesEmployeeApi, houseBankApi } from '../../features/resources';
import SalesCreditMemoPrintable, { printSalesCreditMemo } from '../../components/print/SalesCreditMemoPrintable';
import { useBranchNameOptions } from '../../lib/useBranchOptions';
import useServerListTable from '../../components/data-display/useServerListTable';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import MachineryCodeSelect from '../../components/form/MachineryCodeSelect';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import RouteMapButton from '../../components/common/RouteMapButton';
import RouteMapContextMenu from '../../components/common/RouteMapContextMenu';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import CopyFromDocumentDialog from '../../components/common/CopyFromDocumentDialog';
import JournalEntryViewDialog from '../../components/accounting/JournalEntryViewDialog';
import { useDispatch, useSelector } from 'react-redux';
import { selectCurrentUser } from '../../store/authSlice';
import { clearCopyIntent } from '../../store/copyIntentSlice';
import BulkImportDialog from '../../components/common/BulkImportDialog';
import ImportItemsDialog from '../../components/common/ImportItemsDialog';

// Columns for the "Find Sales Invoice" dialog opened by Copy From.
const INVOICE_COPY_COLUMNS = [
  { field: 'invoiceNo', headerName: 'Invoice No', nowrap: true },
  { field: 'customer', headerName: 'Customer Name' },
  { field: 'invoiceDate', headerName: 'Invoice Date', type: 'date' },
  { field: 'remarks', headerName: 'Comments', type: 'optional' },
];

const PAGE_SIZE = 10;

const emptyItem = {
  productCode: '', productName: '', description: '', hsnCode: '', uom: '',
  invoicedQuantity: 0, quantity: 1, unitPrice: 0,
  discountPercent: 0, taxPercent: 0, taxCodeId: null,
  batchAllocations: [], serialAllocations: [],
  // Which warehouse this line restocks into — defaults to the header's own
  // (required) Warehouse when a row is added.
  warehouse: '',
};

// Best-effort reverse lookup for rows saved before taxCodeId existed (or a
// row whose Tax Code was since made Inactive/retired): picks the first
// active Tax Code with a matching rate so the field isn't just left blank.
// If more than one active code shares that rate, which one comes back here
// is genuinely a guess — see the schema.prisma comment on
// SalesCreditMemoItem.taxCodeId; it can't be resolved retroactively for a
// line the app never recorded a Tax Code against in the first place.
function buildTaxCodeIdByRate(taxCodes) {
  const map = new Map();
  for (const t of (taxCodes || [])) {
    if (t.status !== 'Active') continue;
    const rate = t.taxRate == null ? 0 : Number(t.taxRate);
    if (!map.has(rate)) map.set(rate, t.id);
  }
  return map;
}

/**
 * Batch/Serial allocation is no longer collected on this form -- the
 * "Batch/Serial Restock" column (and its dialog) that used to require
 * selecting specific batches/serials to cover a line's quantity has been
 * removed, and the matching server-side completeness check now runs with
 * `optional: true` (see assertBatchSerialRestockAllocation in
 * utils/businessRules.js) so a save is never blocked by it. What's left
 * here is only the still-meaningful integrity check: the same serial
 * number never appears twice across this credit memo's lines (batch
 * numbers are allowed to repeat -- this document has no batchScope
 * uniqueness rule of its own, matching the server side).
 */
function validateBatchSerialAllocation(items) {
  const seenSerialNos = new Map();
  for (let i = 0; i < (items || []).length; i++) {
    const item = items[i];
    for (const s of item.serialAllocations || []) {
      const no = (s.serialNo || '').trim();
      if (!no) continue;
      if (seenSerialNos.has(no)) return `Serial number "${no}" is used on more than one line.`;
      seenSerialNos.set(no, i);
    }
  }
  return null;
}

// Built fresh per "Add" click rather than held in a module constant, so the
// dates are today's whenever the form opens instead of whenever the JS module
// first loaded — the same reason the other transaction pages do this.
// Bill To/Ship To are frozen, derived display fields — not user-editable
// free text. Formatting mirrors SalesInvoice.jsx's own
// formatBusinessPartnerAddress, reused verbatim here so a Business Partner
// address reads identically across every sales document.
function formatBusinessPartnerAddress(addr) {
  // Address Name, Street, Street No, Building/Floor/Room, Block, Country,
  // State, City, Zip Code -- see lib/addressFormat.js (no double commas).
  return formatPartnerAddress(addr);
}

// Picks the customer's default (or first) address of the given type
// ('Billing' or 'Shipping') off their Business Partner record's addresses
// array — customerApi rows already carry `.addresses` (see resources.js'
// makeLegacyPartnerApi), same as every other sales document.
function customerAddressFor(customerRecord, addressType) {
  const list = (customerRecord?.addresses || []).filter((a) => a.addressType === addressType);
  const chosen = list.find((a) => a.isDefault) || list[0];
  return formatBusinessPartnerAddress(chosen) || '';
}

// GST No. field — same "customer's own Business Partner default (or first)
// Billing address" lookup used above, just returning the GST number itself.
function customerGstNo(customerRecord) {
  const list = (customerRecord?.addresses || []).filter((a) => a.addressType === 'Billing');
  const chosen = list.find((a) => a.isDefault) || list[0];
  return (chosen?.gstNumber || '').trim();
}

// GSTIN format check -- same regex as SalesInvoice.jsx/SalesReturn.jsx's own
// copy (itself lib/validation/common.js' gstin(), reused verbatim there
// too), so "valid GST number" means the same thing here as everywhere else
// GST numbers are captured or classified.
const GSTIN_FORMAT_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z][A-Z0-9]$/;

// Billing Type is frozen/derived, not hand-picked -- same rule as
// SalesInvoice.jsx/SalesReturn.jsx's own deriveBillingType: B2B when the
// customer's own Business Partner default (or first) Billing address
// carries a non-empty, valid-format GST number, B2C otherwise.
//
// Display-only for now: SalesCreditMemo has no billing_type column in the
// database (unlike SalesInvoice/SalesOrder/... which all do), so this
// value is shown on the form but deliberately stripped out of the payload
// before it reaches the backend (see handleSubmit) -- sending it would
// make every save fail with a Prisma "Unknown argument" error. Once a
// migration adds that column, dropping the strip in handleSubmit is the
// only other change needed to make it persist.
function deriveBillingType(customerRecord) {
  const list = (customerRecord?.addresses || []).filter((a) => a.addressType === 'Billing');
  const chosen = list.find((a) => a.isDefault) || list[0];
  const gst = (chosen?.gstNumber || '').trim().toUpperCase();
  return GSTIN_FORMAT_REGEX.test(gst) ? 'B2B' : 'B2C';
}

const BILLING_TYPE_OPTIONS = ['B2B', 'B2C'].map((v) => ({ label: v, value: v }));

const SALES_CATEGORY_OPTIONS = ['Parts', 'Machine', 'Services', 'Claims'].map((v) => ({ label: v, value: v }));
const SALES_TYPE_OPTIONS = ['UPI', 'NEFT', 'CASH', 'CHECK', 'DEBIT/CREDIT CARD'].map((v) => ({ label: v, value: v }));

function getEmptyValues(preparedBy, defaultTaxCode) {
  const today = new Date();
  return {
    customerState: '',
    salesCategory: 'Parts', salesPerson: '', salesType: '',
    creditNo: '', seriesId: '', status: 'Open', invoiceNo: '', customer: '', customerName: '',
    contactPerson: '', customerRefNo: '', branch: '', warehouse: '', gstNo: '',
    billingAddress: '', shippingAddress: '', billingType: '',
    reason: '', narration: '',
    documentDate: today, postingDate: today, dueDate: null,
    paymentTerms: '', comments: '',
    placeOfSupply: '', discountPercent: 0,
    termsConditions: '', preparedBy: preparedBy || '', approvedBy: '', attachmentName: '',
    // Road Tax (manual entry) and Freight Charges — see FreightChargesEditor.
    // freightGrossAmount is kept in sync live by that component.
    roadTax: 0,
    freightTransportId: null, freightName: '', freightRemarks: '', freightTaxCodeId: null,
    freightTaxAmount: 0, freightNetAmount: 0, freightGrossAmount: 0,
    items: [withDefaultTaxCode({ ...emptyItem }, defaultTaxCode)],
  };
}

// DocumentTotalsPanel reads `discount` and `grandTotal`, which the shared
// engine does not return — every other document derives them in a
// wrapper exactly like this one. Passing buildDocument's raw totals straight
// to the panel is what made it crash on totals.grandTotal.toFixed().
// Freight Charges is intentionally NOT folded into Taxable Amount here.
// Freight Charges already carries its own tax (freightNetAmount/
// freightTaxAmount, entered via FreightChargesEditor), so folding its net
// into the taxable base and running it through the same per-line GST ratio
// as the goods double-taxes it: once implicitly via the inflated ratio, and
// again explicitly when freightTaxAmount used to get added to grandTotal
// below. Taxable Amount and CGST/SGST now derive from the goods-only
// amount; Freight Charges' Net + Tax (freightGrossAmount) is added to Grand
// Total as a single already-taxed lump sum instead. Must stay in lockstep
// with the backend mirror in backend/src/routes/resources.js's
// computeSalesCreditMemoTotals.
function computeMemoTotals(items, discountPercent, interState, extraCharges = {}) {
  const { totals } = buildDocument(items, discountPercent, {
    quantityField: 'quantity',
    interState,
    roundOff: true,
  });
  const roadTax = round2(Number(extraCharges.roadTax) || 0);
  const freightGrossAmount = computeFreightGross(extraCharges.freightNetAmount, extraCharges.freightTaxAmount);
  return {
    ...totals,
    discount: computeItemDiscountTotal(items),
    roadTax,
    freightGrossAmount,
    grandTotal: round2(totals.amount + roadTax + freightGrossAmount),
  };
}

const money = (v) => (Number(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function rowToFormValues(row, taxCodes, customers = []) {
  const toDate = (v) => (v ? new Date(v) : null);
  const taxCodeIdByRate = buildTaxCodeIdByRate(taxCodes);
  // billingType has no saved value to fall back on (no DB column -- see
  // deriveBillingType's own comment), so View/Edit re-derives it from the
  // document's own customer the same way the customer-change effect does,
  // rather than showing blank until the customer field is touched again.
  const savedCustomerRecord = (customers || []).find(
    (c) => c.customerName === row.customer || c.customerCode === row.customer
  );
  return {
    ...getEmptyValues(),
    ...row,
    customerState: row.customerState || '',
    billingAddress: cleanAddressText(row.billingAddress), shippingAddress: cleanAddressText(row.shippingAddress),
    salesCategory: row.salesCategory || 'Parts',
    salesPerson: row.salesPerson || '', salesType: row.salesType || '',
    machineSerialNo: row.machineSerialNo || '', engineNo: row.engineNo || '', hypothecation: row.hypothecation || '',
    billingType: row.billingType || deriveBillingType(savedCustomerRecord),
    documentDate: toDate(row.documentDate),
    postingDate: toDate(row.postingDate),
    dueDate: toDate(row.dueDate),
    items: (row.items?.length ? row.items : [{ ...emptyItem }]).map((i) => ({
      productCode: i.productCode || '',
      productName: i.productName || '',
      description: i.description || '',
      hsnCode: i.hsnCode || '',
      uom: i.uom || '',
      invoicedQuantity: Number(i.invoicedQuantity) || 0,
      quantity: Number(i.quantity) || 0,
      unitPrice: Number(i.unitPrice) || 0,
      discountPercent: Number(i.discountPercent) || 0,
      taxPercent: Number(i.taxPercent) || 0,
      taxCodeId: i.taxCodeId != null
        ? Number(i.taxCodeId)
        : (taxCodeIdByRate.get(Number(i.taxPercent) || 0) ?? null),
      batchAllocations: (i.batchAllocations || []).map((b) => ({ batchNo: b.batchNo, quantity: Number(b.quantity) || 0 })),
      serialAllocations: (i.serialAllocations || []).map((s) => ({ serialNo: s.serialNo })),
      // Line-first, header-fallback — same convention as GRN's
      // toGrnItemData: a row saved before this field existed still shows the
      // memo's own warehouse rather than a blank.
      warehouse: i.warehouse || row.warehouse || '',
    })),
  };
}

/**
 * Sales Credit Memo — a credit issued to a customer, raised against a
 * Sales Invoice.
 *
 * Totals, including the CGST/SGST vs IGST split, are computed by the shared
 * document engine and recomputed identically on the server, so the panel can
 * never disagree with what gets stored. The memo posts no receivables adjustment:
 * it records the credit's value only.
 */
const SALES_CREDIT_MEMO_LIST_TABLE_ROW_HEIGHT = 0;
const SALES_CREDIT_MEMO_LIST_TABLE_CELL_PADDING_Y = 6;
export default function SalesCreditMemo({ openDocNo } = {}) {
  const currentUser = useSelector(selectCurrentUser);
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();

  // Phase 6 of the data-loading performance work (pure data-access, no
  // business-logic change) — the list below now fetches ONE page at a time
  // via salesCreditMemoApi.useListPaged (see useServerListTable further
  // down and the paginatedFindMany-based /sales/credit-memos route in
  // backend/src/routes/resources.js), instead of the whole credit-memo
  // table on every mount.
  //
  // creditMemosForRules stays on `.useList()` — creditedByInvoiceProductOther
  // (how much of an invoice line every OTHER credit memo has already taken)
  // and the openDocNo deep-link lookup below both need to see the whole set,
  // not one page — but that call is itself now capped server-side (see
  // paginatedFindMany's `maxPageSize`) instead of genuinely unbounded.
  const { data: creditMemosForRules } = salesCreditMemoApi.useList();
  const [create, { isLoading: creating }] = salesCreditMemoApi.useCreate();
  const [update, { isLoading: updating }] = salesCreditMemoApi.useUpdate();
  const [remove] = salesCreditMemoApi.useDelete();
  const [cancelCreditMemo] = salesCreditMemoApi.useCancel();
  const { data: invoices } = salesInvoiceApi.useList();
  // The Sales Invoice itself carries no Contact Person — that lives one
  // level further up, on the Delivery Challan it was raised from. Needed to
  // pull it in transitively when an invoice is picked (see the invoiceNo
  // pull-in effect below).
  const { data: deliveryChallans } = deliveryChallanApi.useList();
  const { data: customers } = customerApi.useList();
  const { data: taxCodes } = taxCodeApi.useList();
  // A brand-new item row's Tax (%) CFL defaults to this Tax Code instead of
  // showing empty — see pickDefaultTaxCode's own doc comment.
  const defaultTaxCode = useMemo(() => pickDefaultTaxCode(taxCodes), [taxCodes]);
  const { data: products } = productApi.useList({ view: 'picker' });
  const { rates: priceListRates } = usePriceListRates('CLP');
  const { data: company } = useGetCompanyDetailsQuery();
  // Sales Employee master — backs the Prepared By / Approved By dropdowns
  // in the Terms and Conditions card, same convention SalesOrder.jsx and
  // Purchase Order's Other Details card use for their own employee fields.
  const { data: salesEmployees } = salesEmployeeApi.useList();
  const preparedByOptions = useMemo(
    () => (salesEmployees || []).map((s) => ({ label: s.employeeName, value: s.employeeName })),
    [salesEmployees]
  );
  const approvedByOptions = useMemo(
    () => (salesEmployees || []).filter((s) => s.approvalAuthorization === true).map((s) => ({ label: s.employeeName, value: s.employeeName })),
    [salesEmployees]
  );
  // The printed credit memo's "Company's Bank Details" block -- same
  // "preferred default, else first Active" lookup SalesInvoice.jsx's own
  // printHouseBank uses, so the details are maintained in the House Bank
  // master rather than hardcoded into the print template.
  const { data: houseBanks } = houseBankApi.useList();
  const printHouseBank = useMemo(
    () => (houseBanks || []).find((b) => b.isDefault === true) || (houseBanks || []).find((b) => b.status === 'Active') || null,
    [houseBanks]
  );
  // Keyed by Tax Code id, not by rate — this document has no Place of
  // Supply/taxType filter, so a GST code and an IGST code sharing a rate
  // (e.g. both 18%) are both real, distinct options; keying by rate would
  // collapse them into one and leave no way to tell which was picked (see
  // the schema.prisma comment on SalesCreditMemoItem.taxCodeId, and
  // buildTaxCodeOptions in taxCodeOptions.js).
  const taxCodeOptions = useMemo(() => buildTaxCodeOptions(taxCodes), [taxCodes]);
  // Tax (%) shows the tax code's own NAME in the closed field, which runs
  // well past the bare rate the row stores — so the item table sizes that
  // column from the rendered label it finds here, not from the raw number.
  const taxCodeById = useMemo(() => new Map(taxCodeOptions.map((o) => [o.value, o])), [taxCodeOptions]);
  const [view, setView] = useState('list');
  const [editingRow, setEditingRow] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  // Journal Entry view popup — opened from the header's "View Journal Entry"
  // icon (rendered only once editingRow.journalEntryId exists, i.e. this
  // credit memo already has a linked entry). Same pattern as Purchase GRN.
  const [journalViewOpen, setJournalViewOpen] = useState(false);
  // Copy From ("Find Sales Invoice") dialog. Held at page level rather than
  // inside AppForm's render prop so remounting the form on formKey change
  // can't leave a dialog orphaned open over a freshly reset form.
  const [copyFromOpen, setCopyFromOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [rowMenuAnchor, setRowMenuAnchor] = useState(null);
  const [rowMenuTarget, setRowMenuTarget] = useState(null);
  // Which of the two save buttons was pressed. A ref, not state: the click
  // handler has to record it before submit reads it, and setting state there
  // would re-render in the middle of the click.
  const pendingStatusRef = useRef(null);

  // selectableProducts/productCodeOptions/productNameOptions used to live
  // here, computed from editingRow?.items — a static snapshot that only
  // reflected the record's lines as of page load. That went stale the moment
  // Copy From replaced the items array with a different document's lines, so
  // it's now computed live inside AppForm's render prop instead, keyed off
  // watchedItems (the form's actual current rows).

  const { warehouses } = useWarehouseOptions({ currentValue: editingRow?.warehouse });

  // A credit memo reverses billed value, so a cancelled invoice is not a valid
  // target — there is nothing left to credit. The backend refuses these
  // (assertCreditMemoAllowed in utils/routeMap.js); excluding them here means
  // the user is never offered one that will be rejected on save.
  //
  // The invoice already on the record being edited stays selectable regardless,
  // so opening an existing credit memo cannot blank its link.
  // Per (invoiceNo, productCode), how much has already been credited by
  // OTHER sales credit memos (i.e. not the one currently being edited). Used
  // to cap what THIS memo can still take — two memos against the same
  // invoice line must share its billed quantity, not each get the full
  // amount.
  const creditedByInvoiceProductOther = useMemo(() => {
    const totals = new Map();
    (creditMemosForRules || [])
      .filter((r) => r.status !== 'Cancelled' && r.invoiceNo && r.creditNo !== editingRow?.creditNo)
      .forEach((r) => {
        (r.items || []).forEach((item) => {
          if (!item.productCode) return;
          const key = `${r.invoiceNo}::${item.productCode}`;
          totals.set(key, (totals.get(key) || 0) + (Number(item.quantity) || 0));
        });
      });
    return totals;
  }, [creditMemosForRules, editingRow]);

  // What the Copy From dialog is allowed to offer. A cancelled invoice was
  // never issued, so there is nothing on it to credit back.
  //
  // This used to build the options for an invoice dropdown; it is now the
  // record list handed to the dialog. The "the invoice already on the record
  // being edited stays selectable" case the dropdown needed is gone with it —
  // the field is read-only now, so an existing memo's own link is simply
  // displayed and never has to survive a filter to keep showing.
  const copyableInvoices = useMemo(
    () => (invoices || []).filter((i) => i.status !== 'Cancelled'),
    [invoices]
  );
  const customerOptions = useMemo(
    () => buildPartyCodeOptions(customers, 'customerCode', 'customerName'),
    [customers]
  );
  const { options: branchOptions, branches } = useBranchNameOptions({ currentValue: editingRow?.branch });

  // Column definitions drive the global search, the sort icons and the
  // per-column filter popover — see useServerListTable.js. `server: true`
  // pushes that column's sort/filter to the /sales/credit-memos route (see
  // SALES_CREDIT_MEMO_FILTER_SPEC/SALES_CREDIT_MEMO_SORT_FIELDS in
  // backend/src/routes/resources.js) instead of applying it only to
  // whatever page happens to already be loaded. totalItems is a real stored
  // column (not computed), so it's safe to filter/sort server-side too.
  const tableColumns = useMemo(() => ([
    { field: 'creditNo', headerName: 'Credit No', filter: 'text', server: true },
    { field: 'invoiceNo', headerName: 'Invoice No.', filter: 'text', server: true },
    { field: 'customer', headerName: 'Customer', filter: 'select', server: true },
    {
      field: 'documentDate',
      headerName: 'Document Date',
      filter: 'dateRange',
      server: true,
      sortValue: (r) => (r.documentDate ? new Date(r.documentDate).getTime() : null),
      searchValue: (r) => (r.documentDate ? dayjs(r.documentDate).format('DD MMM YYYY') : ''),
    },
    { field: 'totalItems', headerName: 'Items', filter: 'numberRange', server: true },
    { field: 'amount', headerName: 'Amount', filter: 'numberRange', server: true, sortValue: (r) => Number(r.amount) || 0 },
    { field: 'status', headerName: 'Status', filter: 'select', server: true },
  ]), []);

  const table = useServerListTable(salesCreditMemoApi.useListPaged, {
    columns: tableColumns,
    initialPageSize: PAGE_SIZE,
  });
  const { page, setPage, pageSize, setPageSize } = table;
  const isLoading = table.isLoading;
  const refetchCreditMemos = table.refetch;
  const visibleRows = table.rows;
  const pagedRows = table.rows;

  const backToList = () => { setView('list'); setEditingRow(null); setReadOnly(false); setCopyFromOpen(false); };

  const openCreate = () => {
    setEditingRow(null); setReadOnly(false); setFormKey((k) => k + 1); setView('form');
  };
  const handleEdit = (row) => {
    setEditingRow(row); setReadOnly(false); setFormKey((k) => k + 1);
    setView('form'); setRowMenuAnchor(null);
  };
  const handleView = (row) => {
    setEditingRow(row); setReadOnly(true); setFormKey((k) => k + 1);
    setView('form'); setRowMenuAnchor(null);
  };

  // Opened from the Route Map's document preview popup: jump straight into
  // this record's own read-only View, exactly as clicking it in the list
  // would, instead of requiring the user to find and click the row.
  useEffect(() => {
    if (!openDocNo) return;
    if (editingRow && editingRow.creditNo === openDocNo) return;
    const match = (creditMemosForRules || []).find((r) => r.creditNo === openDocNo);
    if (match) handleView(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDocNo, creditMemosForRules]);

  // "Copy To > Sales Credit Memo" lands the browser on this page's route,
  // but that alone used to leave the user on the LIST view — the intent-
  // consuming effect that actually applies the source document's data lives
  // inside AppForm's render prop below, which only mounts once `view` is
  // 'form', so nothing happened until the user clicked "+ Add New"
  // themselves first. Mirrors the openDocNo effect just above: notice a
  // pending intent addressed to this page on arrival and open the create
  // form immediately, so the user lands straight on a pre-filled memo.
  const pendingCopyIntentForAutoOpen = useSelector((s) => s.copyIntent.pending);
  useEffect(() => {
    if (!pendingCopyIntentForAutoOpen || pendingCopyIntentForAutoOpen.targetKey !== 'salesCreditMemo') return;
    if (view === 'form') return;
    openCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCopyIntentForAutoOpen]);

  const handleDelete = async (row) => {
    setRowMenuAnchor(null);
    const ok = await confirmDialog({
      title: 'Delete sales credit memo',
      message: `Are you sure you want to delete "${row.creditNo}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Sales credit memo deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  // Cancel — a soft alternative to Delete: the credit memo stays in the
  // list (status becomes "Cancelled") and View/Edit/Delete/Cancel get
  // blocked for it below, once isCancelled is true. Nothing settles against
  // or is raised downstream of a Sales Credit Memo, so unlike Sales Invoice
  // there is no settlement/dependent-document guard to trip — see the
  // matching comment on PATCH /sales/credit-memos/:id/cancel.
  const handleCancel = async (row) => {
    setRowMenuAnchor(null);
    const ok = await confirmDialog({
      title: 'Cancel sales credit memo',
      message: `Are you sure you want to cancel "${row.creditNo}"? This cannot be undone.`,
      confirmLabel: 'Cancel Credit Memo',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await cancelCreditMemo(row.id).unwrap();
      notify.success('Sales credit memo cancelled');
    } catch (err) {
      notify.error(err?.data?.message || 'Cancel failed');
    }
  };

  const handleSubmit = async (values, methods) => {
    // "Save as Draft" is a shortcut that forces Draft regardless of what the
    // Status field shows. The main Save/Update button does NOT force a
    // status — it used to always set 'Open', silently discarding any other
    // value picked in the Status dropdown (Closed, Cancelled, ...): the
    // record would save, but always as Open, so editing to e.g. Cancelled
    // appeared to "not save" because the list kept showing Open.
    const allocationError = validateBatchSerialAllocation(values.items);
    if (allocationError) {
      notify.error(allocationError);
      return;
    }
    const payload = { ...values, status: pendingStatusRef.current || values.status };
    // Billing Type is a display-only classification on this document --
    // see deriveBillingType's comment. There is no billing_type column on
    // sales_credit_memos yet, so it is dropped here rather than sent
    // through: every other field on this payload is spread straight into
    // a Prisma create/update, which would throw "Unknown argument
    // `billingType`" on every single save otherwise.
    delete payload.billingType;
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...payload }).unwrap();
        notify.success('Sales credit memo updated');
      } else {
        await create(payload).unwrap();
        notify.success('Sales credit memo created');
      }
      backToList();
    } catch (err) {
      notify.error(applyServerErrors(err, methods.setError));
    }
  };

  if (openDocNo && (!editingRow || editingRow.creditNo !== openDocNo)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box>

      {view === 'form' ? (
        <RouteMapContextMenu flow="sales" type="creditMemo" docNo={editingRow?.creditNo}>
          <AppForm
            key={formKey}
            readOnly={readOnly}
            schema={salesCreditMemoSchema}
            defaultValues={editingRow ? rowToFormValues(editingRow, taxCodes, customers) : getEmptyValues(currentUser?.name || currentUser?.email, defaultTaxCode)}
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
              // anything.
              const isNonStockCategory = isNonStockSalesCategory(salesCategoryValue);
              const prevNonStockCategoryRef = useRef(isNonStockCategory);
              useEffect(() => {
                if (prevNonStockCategoryRef.current === isNonStockCategory) return;
                prevNonStockCategoryRef.current = isNonStockCategory;
                if (!isNonStockCategory) return;
                (methods.getValues('items') || []).forEach((_it, idx) => {
                  setValue(`items.${idx}.warehouse`, '');
                });
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [isNonStockCategory]);
              const { fields, append, remove: removeItem, replace: replaceItems } = useFieldArray({ control, name: 'items' });
              // "Copy To" hand-off — see copyIntentSlice.js and CopyToButton.jsx.
              const dispatch = useDispatch();
              const pendingCopyIntent = useSelector((s) => s.copyIntent.pending);

              const [itemsImportOpen, setItemsImportOpen] = useState(false);
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
                  discountPercent: raw.discountPercent ?? 0,
                  taxCodeId: taxMatch ? taxMatch.id : null,
                  taxPercent: taxMatch ? (Number(taxMatch.taxRate) || 0) : 0,
                  warehouse: raw.warehouse || (watch('warehouse') || ''),
                };
              };
              const handleItemsImported = (rawItems) => {
                append(rawItems.map(resolveImportedItem));
              };
              const watchedItems = watch('items') || [];

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
              const documentDateValue = watch('documentDate');
              const documentDateMinDate = documentDateValue ? dayjs(documentDateValue) : undefined;

              // Every column of this item table is sized to show its values IN FULL —
              // no ellipsis, no wrapping, no hover, however long the text is. The
              // spec below is positional: it mirrors the header row top to bottom,
              // and `null` leaves a column (the # counter, the action column) at
              // whatever width it already has. See itemTableSx in lib/columnWidth.js.
              // Claims/Services documents move no stock, so the item grid hides
              // its Warehouse column entirely (header, cells and width spec).
              const itemColumnsSx = itemTableSx(watchedItems, [
                null,
                { header: 'Item No', get: (i) => i?.productCode, field: 'select' },
                { header: 'Description', get: (i) => i?.productName, field: 'select' },
                { header: 'UOM', get: (i) => i?.uom, field: 'text' },
                // Dropped entirely on a Claims/Services document — see
                // isNonStockCategory above — since nothing on that document
                // ever moves stock.
                ...(isNonStockCategory ? [] : [
                  { header: 'Warehouse *', get: (i) => i?.warehouse, field: 'select' },
                ]),
                { header: 'Invoiced Qty', get: (i) => i?.invoicedQuantity, field: 'text' },
                { header: 'Qty', get: (i) => i?.quantity, field: 'text' },
                { header: 'Unit Price', get: (i) => i?.unitPrice, field: 'text' },
                { header: 'Disc %', get: (i) => i?.discountPercent, field: 'text' },
                { header: 'Tax %', get: (i) => taxCodeById.get(i?.taxCodeId)?.label ?? i?.taxPercent, field: 'select' },
                null,
                { header: 'Amount', get: (i) => ((Number(i?.quantity) || 0) * (Number(i?.unitPrice) || 0)).toFixed(2), field: 'plain', min: 110 },
                null,
              ]);
              const invoiceNo = watch('invoiceNo');
              const branch = watch('branch');

              // Bill To/Ship To are frozen fields now — always the selected
              // customer's own Business Partner Billing/Shipping address,
              // never hand-typed. Same convention as SalesInvoice.jsx's own
              // customer-change effect.
              const customerValue = watch('customer');
              const prevCustomerRef = useRef(editingRow ? editingRow.customer : null);
              useEffect(() => {
                if (customerValue !== prevCustomerRef.current) {
                  const found = (customers || []).find((c) => c.customerName === customerValue || c.customerCode === customerValue);
                  if (found) {
                    // Customer Name and Contact Person are auto-filled straight
                    // off the selected Business Partner record here -- this
                    // effect previously only wrote Bill To/Ship To, GST No and
                    // Billing Type, silently leaving these two blank whenever a
                    // customer was picked directly on this form (Copy From
                    // Invoice/Delivery Challan already set them from the source
                    // document, which is why that path looked fine). Contact
                    // Person is the partner's own named contact (BusinessPartner
                    // .contactPerson), not a phone number -- same field Copy
                    // From Invoice/Delivery Challan already writes into below.
                    setValue('customerName', found.customerName || '', { shouldValidate: true });
                    setValue('contactPerson', found.contactPerson || '', { shouldValidate: true });
                    setValue('billingAddress', customerAddressFor(found, 'Billing'), { shouldValidate: true });
                    setValue('shippingAddress', customerAddressFor(found, 'Shipping'), { shouldValidate: true });
                    setValue('gstNo', customerGstNo(found), { shouldValidate: true });
                    setValue('billingType', deriveBillingType(found), { shouldValidate: true });
                  }
                  prevCustomerRef.current = customerValue;
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [customerValue]);

              // Once Branch is picked (directly, or via Copy From), the
              // Warehouse dropdown is scoped to that branch's warehouses only —
              // see useWarehouseOptions.js.
              // Lines can each carry their own warehouse, distinct from the
              // header's — every one of them must survive edit/view even when
              // it isn't in the currently-selected branch's list — see
              // useWarehouseOptions.js.
              const { options: branchWarehouseOptions } = useWarehouseOptions({
                currentValue: [editingRow?.warehouse, ...watchedItems.map((i) => i.warehouse)],
                branch,
              });

              // Copy From pulls the customer block across and replaces the lines
              // with what the invoice billed.
              //
              // This used to run as an effect watching the Invoice No. dropdown,
              // guarded by a ref so it fired only on a real change. It is a plain
              // function now, called only from the dialog's Choose button: an
              // effect keyed on a form value also fires when that value is
              // restored on edit or reset, which is what the ref bookkeeping
              // existed to detect. An explicit call has no such ambiguity.
              //
              // The customer is still set from the invoice, unlike the sibling
              // sales pages: this form keeps customerName and contactPerson
              // alongside it, so the pull has real work to do here, and the value
              // it writes is the customer the dialog was already filtered by.
              const applyInvoice = (invoice) => {
                if (!invoice) return;
                setValue('invoiceNo', invoice.invoiceNo || '', { shouldValidate: true });
                setValue('customer', invoice.customer || '');
                setValue('customerName', invoice.customer || '');
                // Also sync the customer-effect's own "previous value" ref so
                // it doesn't re-fire on the next render and clobber the
                // Bill To/Ship To values set from the invoice's own customer
                // just below (same class of bug fixed on Sales Invoice's
                // Delivery Challan pull-in).
                prevCustomerRef.current = invoice.customer || '';
                setValue('branch', invoice.branch || '');
                setValue('paymentTerms', invoice.paymentTerms || '');
                setValue('termsConditions', invoice.termsConditions || '');
                setValue('customerRefNo', invoice.customerRefNo || '');
                // The invoice's own header fields that have a same-named
                // field on this form -- Sales Type, Sales Person, Payment
                // Method, Machine Serial No., Engine No., Hypothecation.
                // None of these were carried across, so on Copy To they came
                // up blank (or kept the form's defaults -- e.g. Sales Type
                // stayed on its default instead of the invoice's) and had to
                // be re-keyed against the wrong-looking values.
                // Sales Type change is watched by an effect above that blanks
                // Machine No./Engine No./Hypothecation when the category
                // flips, which would wipe the machine fields copied just
                // below. Syncing its "previous value" ref first makes it see
                // this as the starting value rather than a user switch.
                const copiedCategory = invoice.salesCategory || 'Parts';
                prevSalesCategoryRef.current = copiedCategory;
                setValue('salesCategory', copiedCategory, { shouldValidate: true });
                setValue('salesPerson', invoice.salesPerson || '', { shouldValidate: true });
                setValue('salesType', invoice.salesType || '', { shouldValidate: true });
                setValue('machineSerialNo', invoice.machineSerialNo || '', { shouldValidate: true });
                setValue('engineNo', invoice.engineNo || '');
                setValue('hypothecation', invoice.hypothecation || '');
                // Carried on the invoice but previously left behind on
                // Copy To (the credit memo schema has no Receiver/Other
                // Details block, so this is all there is to bring across).
                setValue('approvedBy', invoice.approvedBy || '', { shouldValidate: true });
                // Bill To/Ship To are frozen/derived — re-derive from the
                // invoice's own customer's Business Partner record rather
                // than any stored strings.
                {
                  const invoiceCustomerRecord = (customers || []).find((c) => c.customerName === invoice.customer);
                  setValue('billingAddress', customerAddressFor(invoiceCustomerRecord, 'Billing'), { shouldValidate: true });
                  setValue('shippingAddress', customerAddressFor(invoiceCustomerRecord, 'Shipping'), { shouldValidate: true });
                  setValue('gstNo', customerGstNo(invoiceCustomerRecord), { shouldValidate: true });
                  setValue('billingType', deriveBillingType(invoiceCustomerRecord), { shouldValidate: true });
                }
                // Header-level discount was never carried across — each
                // line's own discountPercent copies fine below, but the
                // invoice's overall discountPercent was left at whatever
                // this form already had, silently dropping it from the
                // totals.
                setValue('discountPercent', invoice.discountPercent != null ? Number(invoice.discountPercent) : 0, { shouldValidate: true });
                // The Sales Invoice itself carries no Contact Person — that
                // lives one level further up, on the Delivery Challan it was
                // raised from. Reached transitively via the invoice's own
                // deliveryChallanNo.
                // The invoice now carries its own Contact Person (shown as
                // "Contact No" on the invoice form), so that wins; the source
                // challan is only a fallback for older invoices without one.
                const sourceChallan = (deliveryChallans || []).find((c) => c.challanNo === invoice.deliveryChallanNo);
                setValue('contactPerson', invoice.contactPerson || sourceChallan?.contactPerson || '');
                // replace(), never setValue('items', ...) — the field array has to
                // remount so each row's inputs pick up the new values.
                //
                // A sales invoice line stores its billed amount under
                // `quantity` — SalesInvoiceItem has no `invoicedQuantity`
                // column. Reading that name gave undefined on every line, so
                // both the cap and the pre-filled credit quantity came through
                // as 0 (and the zod refine below silently skipped its check,
                // since `!invoicedQuantity` is true when it's 0) — meaning a
                // credit memo could be raised for any quantity with no cap at
                // all. invoicedQuantity here is also reduced by whatever OTHER
                // (non-cancelled) credit memos against the same invoice line
                // have already taken, so two memos against one line share its
                // billed quantity rather than each getting the full amount. A
                // line with nothing left is dropped rather than pulled in at
                // zero.
                // `line` is captured BEFORE the filter: base_line names the
                // position of the line on the SOURCE document, so it has to be
                // numbered against the invoice's own lines, not against
                // whichever of them survive the remaining-quantity filter.
                const remaining = (invoice.items || [])
                  .map((i, n) => {
                    const billed = Number(i.quantity) || 0;
                    const alreadyCredited = creditedByInvoiceProductOther.get(`${invoice.invoiceNo}::${i.productCode}`) || 0;
                    return { item: i, line: n + 1, qty: round2(billed - alreadyCredited) };
                  })
                  .filter(({ qty }) => qty > 0.005);
                const mappedItems = remaining.length
                  ? remaining.map(({ item: i, line, qty }) => ({
                      productCode: i.productCode || '',
                      productName: i.productName || '',
                      description: i.description || '',
                      hsnCode: i.hsnCode || '',
                      uom: i.uom || '',
                      invoicedQuantity: qty,
                      quantity: qty,
                      unitPrice: (i.unitPrice != null ? Number(i.unitPrice) : null) ?? priceListRates?.get(i.productCode) ?? 0,
                      discountPercent: Number(i.discountPercent) || 0,
                      taxPercent: Number(i.taxPercent) || 0,
                      taxCodeId: i.taxCodeId != null ? Number(i.taxCodeId) : null,
                      // Where the goods physically go back to, so the memo's
                      // own restock default points at the same place the
                      // invoice line (or its header) said they left from;
                      // falls back to whatever this memo's header has.
                      warehouse: i.warehouse || '',
                      // Copy From: a credit memo is raised against the invoice.
                      baseType: 'Sales Invoice',
                      baseEntry: invoice.id ?? null,
                      baseNo: invoice.invoiceNo || null,
                      baseLine: line,
                    }))
                  : [{ ...emptyItem }];
                replaceItems(mappedItems);
                // Belt-and-braces: each row's own Product Code cell
                // (ProductCell) has its own master-lookup effect that
                // re-fills Description/HSN/Unit/Rate from the Product Master
                // the instant it notices a productCode change. replaceItems()
                // giving every row a fresh field id is meant to stop that
                // effect from treating this as a "change" in the first place,
                // but that guard has been observed losing the race in
                // practice (reported: Rate landing at the Product Master's
                // own default instead of the invoice's). Reasserting the
                // invoice's own values a moment later — after that cell's
                // effect has had every chance to run and lose — guarantees
                // the copied figures win regardless of exactly how that race
                // goes.
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
              };

              // "Copy To > Sales Credit Memo" from a Delivery Challan — not
              // reachable from this page's own Copy From dialog (Sales Invoice
              // only), only from the intent-consuming effect below. There is no
              // invoicedQuantity to cap against here (nothing was billed yet),
              // so each challan line's own quantity becomes both the cap
              // (invoicedQuantity) and the pre-filled credit quantity — the
              // user can still reduce it for a partial credit.
              const applyChallan = (challan) => {
                if (!challan) return;
                setValue('invoiceNo', '', { shouldValidate: true });
                setValue('customer', challan.customer || '');
                setValue('customerName', challan.customer || '');
                prevCustomerRef.current = challan.customer || '';
                setValue('branch', challan.branch || '');
                setValue('termsConditions', challan.termsConditions || '');
                setValue('customerRefNo', challan.customerRefNo || '');
                setValue('contactPerson', challan.contactPerson || '');
                // Carried on the challan but previously left behind on
                // Copy To (the credit memo schema has no Receiver/Other
                // Details block, so this is all there is to bring across).
                setValue('approvedBy', challan.approvedBy || '', { shouldValidate: true });
                {
                  const challanCustomerRecord = (customers || []).find((c) => c.customerName === challan.customer);
                  setValue('billingAddress', customerAddressFor(challanCustomerRecord, 'Billing'), { shouldValidate: true });
                  setValue('shippingAddress', customerAddressFor(challanCustomerRecord, 'Shipping'), { shouldValidate: true });
                  setValue('gstNo', customerGstNo(challanCustomerRecord), { shouldValidate: true });
                  setValue('billingType', deriveBillingType(challanCustomerRecord), { shouldValidate: true });
                }
                setValue('discountPercent', 0, { shouldValidate: true });
                const items = (challan.items || []).filter((i) => (Number(i.quantity) || 0) > 0.005);
                const mappedItems = items.length
                  ? items.map((i, n) => ({
                      productCode: i.productCode || '',
                      productName: i.productName || '',
                      description: i.description || '',
                      hsnCode: i.hsnCode || '',
                      uom: i.uom || '',
                      invoicedQuantity: Number(i.quantity) || 0,
                      quantity: Number(i.quantity) || 0,
                      unitPrice: (i.unitPrice != null ? Number(i.unitPrice) : null) ?? priceListRates?.get(i.productCode) ?? 0,
                      discountPercent: 0,
                      taxPercent: Number(i.taxPercent) || 0,
                      taxCodeId: i.taxCodeId != null ? Number(i.taxCodeId) : null,
                      warehouse: i.warehouse || '',
                      baseType: 'Delivery Challan',
                      baseEntry: challan.id ?? null,
                      baseNo: challan.challanNo || null,
                      baseLine: n + 1,
                    }))
                  : [{ ...emptyItem }];
                replaceItems(mappedItems);
                // Belt-and-braces reassert — see the matching comment on
                // applyInvoice above.
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

              // Undo a Copy From: drop the link and the lines that came across
              // with it, rather than leaving a stale invoice's figures sitting in
              // a memo that no longer claims to reference it.
              //
              // The customer is deliberately NOT cleared. It is the user's own
              // selection — it is what made Copy From available in the first
              // place, and clearing it would close the dialog off and force a
              // re-pick just to try a different invoice from the same customer.
              const clearInvoice = () => {
                setValue('invoiceNo', '', { shouldValidate: true });
                setValue('paymentTerms', '');
                setValue('termsConditions', '');
                setValue('contactPerson', '');
                setValue('discountPercent', 0, { shouldValidate: true });
                replaceItems([{ ...emptyItem, warehouse: watch('warehouse') || '' }]);
              };

              // Switching Branch invalidates a Warehouse choice that doesn't
              // belong to the new branch. Skipped on the very first render so
              // loading an existing record for edit/view, or a Copy From that
              // sets branch and leaves warehouse untouched, doesn't wipe a value
              // it just loaded.
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

              // Totals come from the shared document engine, given the same
              // inputs the server uses, so what the panel shows is what gets
              // saved. interState must be passed through explicitly — defaulting
              // it would show a CGST/SGST split on a document stored as IGST.
              const handleFile = (file) => {
                if (file) setValue('attachmentName', file.name, { shouldValidate: true });
              };

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
              const discountPercent = watch('discountPercent');
              // taxType (from each line's own taxCodeId) drives the TCS
              // carve-out in documentTotals.js's computeTotals -- see
              // buildTaxCodeOptions/taxCodeById above, which now carries
              // taxType alongside label/value/rate.
              const itemsForTotals = watchedItems.map((it) => ({ ...it, taxType: taxCodeById.get(it.taxCodeId)?.taxType || '' }));
              const freightNetAmount = watch('freightNetAmount');
              const freightTaxAmount = watch('freightTaxAmount');
              const roadTaxWatched = watch('roadTax');
              const totals = computeMemoTotals(itemsForTotals, discountPercent, interState, { roadTax: roadTaxWatched, freightNetAmount, freightTaxAmount });
              // Kerala customer State -> GST family (GST, GST+TCS) only;
              // any other state -> IGST family (IGST, IGST+TCS) only. See
              // taxTypeFamilyFor in lib/taxCodeOptions.js.
              const taxCodeOptionsForRow = useMemo(
                () => buildTaxCodeOptions(taxCodes, { taxType: taxTypeFamilyFor(interState) }),
                [taxCodes, interState]
              );
              // Default Tax Code for a row added via "Add Item" once Place
              // of Supply is known — GST@18% intra-state, IGST@18%
              // inter-state, following the same family the dropdown itself
              // is filtered to. The plain top-level defaultTaxCode (GST@18%)
              // is still what seeds getEmptyValues' very first row.
              const liveDefaultTaxCode = useMemo(
                () => pickDefaultTaxCode(taxCodes, { taxType: taxTypeFamilyFor(interState) }),
                [taxCodes, interState]
              );

              // Snapshot of every current form field — printCustomerRecord/
              // printBranchRecord/printOrder/approverSignatureUrl below all
              // read off this single watch() call rather than each
              // re-watching their own field, so they can never disagree
              // about which render's values they're looking at. Same
              // convention as SalesInvoice.jsx's own allValues.
              const allValues = watch();
              const printCustomerRecord = (customers || []).find((c) => {
                const target = (allValues.customer || '').trim().toLowerCase();
                if (!target) return false;
                return (
                  (c.customerName || '').trim().toLowerCase() === target ||
                  (c.customerCode || '').trim().toLowerCase() === target
                );
              });
              // The credit memo's own Branch resolved against Branch Master
              // — see SalesInvoicePrintable's own branchRecord prop.
              const printBranchRecord = (branches || []).find((b) => (b.branchName || '').trim() === (allValues.branch || '').trim());
              // items: itemsForTotals so each line carries its resolved
              // taxType — SalesCreditMemoPrintable's own local recompute
              // reads item.taxType to detect a TCS-typed line, and the raw
              // watched item only ever has taxCodeId.
              const printOrder = { ...allValues, items: itemsForTotals };
              // Signature shown on the printable is the approver's own
              // uploaded signature (SalesEmployee.signatureUrl), not the
              // default stamp — blank when the approver has none on file.
              const approverSignatureUrl = (salesEmployees || []).find((s) => s.employeeName === allValues.approvedBy)?.signatureUrl || null;

              // MachineryCodeSelect needs the selected Customer's Business
              // Partner id, same pattern as SalesQuotation.jsx.
              const machineryBusinessPartnerId = (customers || []).find((c) => c.customerName === watch('customer'))?.id || null;

              // Consume a pending "Copy To" intent addressed to this page —
              // see copyIntentSlice.js and CopyToButton.jsx.
              useEffect(() => {
                if (!pendingCopyIntent || pendingCopyIntent.targetKey !== 'salesCreditMemo') return;
                if (pendingCopyIntent.sourceType === 'deliveryChallan') applyChallan(pendingCopyIntent.sourceDoc);
                // Sales Invoice's own "Copy To" button (see CopyToButton on
                // SalesInvoice.jsx) hands off the full saved invoice the same
                // shape applyInvoice already expects from the Copy From
                // dialog's Choose button — reuse it as-is rather than a
                // second near-identical function.
                else if (pendingCopyIntent.sourceType === 'salesInvoice') applyInvoice(pendingCopyIntent.sourceDoc);
                dispatch(clearCopyIntent());
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [pendingCopyIntent]);

              return (
                <>
                  <CopyFromDocumentDialog
                    open={copyFromOpen}
                    onClose={() => setCopyFromOpen(false)}
                    onChoose={applyInvoice}
                    documents={copyableInvoices}
                    party={watch('customer')}
                    partyField="customer"
                    partyLabel="customer"
                    title="Find Sales Invoice"
                    columns={INVOICE_COPY_COLUMNS}
                    emptyMessage="No sales invoices found for"
                  />
                  <SalesCreditMemoPrintable
                    order={printOrder}
                    company={company}
                    customerRecord={printCustomerRecord}
                    branchRecord={printBranchRecord}
                    houseBank={printHouseBank}
                    approverSignatureUrl={approverSignatureUrl}
                  />
                  <Card variant="outlined" sx={{ mb: 2 }}>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                        {readOnly ? 'View Sales Credit Memo' : editingRow ? 'Edit Sales Credit Memo' : 'Add Sales Credit Memo'}
                      </Typography>

                      <FormGrid columns={2} singleColumnOnMobile rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                        <LabeledField label="Sales Type *">
                          <FormSelect name="salesCategory" label="" placeholder="Select sales type" options={SALES_CATEGORY_OPTIONS} />
                        </LabeledField>
                        <LabeledField label="Credit Memo No *">
                          <DocumentSeriesNoField documentCode="SCM" seriesFieldName="seriesId" numberFieldName="creditNo" isCreate={!editingRow} />
                        </LabeledField>

                        <LabeledField label="Branch *">
                          <FormSelect name="branch" label="" placeholder="Select branch" options={branchOptions} />
                        </LabeledField>

                        {/* Filled only by Copy From — never typed. A memo's
                          invoice reference has to be an invoice that actually
                          exists (the lines carry baseEntry/baseNo back to it,
                          and the remaining-quantity cap is computed from it),
                          so a free-text box could only ever produce a dangling
                          link. Left blank for a credit with no invoice behind
                          it, which is now a valid memo rather than a schema
                          error. */}
                        <LabeledField label="Invoice No.">
                          <FormTextField
                            name="invoiceNo"
                            label=""
                            placeholder="Use Copy From to select an invoice"
                            InputProps={{ readOnly: true }}
                          />
                        </LabeledField>

                        <LabeledField label="Customer *">
                          {/* showNameBelow off — this label-left layout packs
                          rows with zero vertical gap (FIELD_ROW_SPACING), so
                          PartyCodeSelect's own "name echoed below" caption had
                          no room of its own and visually ran into the very next
                          row below it. Redundant here anyway: the Customer Name
                          field further down already shows the customer's name. */}
                          <PartyCodeSelect name="customer" label="" placeholder="Select customer" options={customerOptions} showNameBelow={false} />
                        </LabeledField>
                        <LabeledField label="Document Date *">
                          <FormDatePicker name="documentDate" label="" triggerFields={['postingDate', 'dueDate']} />
                        </LabeledField>

                        <LabeledField label="Customer Name">
                          <FormTextField name="customerName" label="" placeholder="Customer name" />
                        </LabeledField>
                        <LabeledField label="Contact Person">
                          <FormTextField name="contactPerson" label="" placeholder="Auto-filled from customer" disabled />
                        </LabeledField>

                        <LabeledField label="Sales Person *">
                          <FormSelect name="salesPerson" label="" placeholder="Select sales person" options={preparedByOptions} />
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

                        <LabeledField label={!['Machine', 'Claims'].includes(watch('salesCategory')) ? 'Machine Serial No. *' : 'Machine Serial No.'}>
                          <MachineryCodeSelect name="machineSerialNo" label="" placeholder="Select machine serial no." businessPartnerId={machineryBusinessPartnerId} creatable={watch('salesCategory') === 'Machine'} showNameBelow={false} />
                        </LabeledField>
                        <LabeledField label="Payment Method *">
                          <FormSelect name="salesType" label="" placeholder="Select payment method" options={SALES_TYPE_OPTIONS} />
                        </LabeledField>

                        {/* Bill To/Ship To are frozen, derived display fields —
                        not user-editable free text. Always the selected
                        customer's own Business Partner Billing/Shipping
                        address (see customerAddressFor above and the
                        customer-change effect below), same convention as
                        every other sales document. Labelled "Ship From" here
                        to match the layout used on Sales Return — same
                        billingAddress field underneath, just the display
                        label. */}
                        <LabeledField label="Ship From">
                          <FormTextField name="billingAddress" label="" placeholder="Auto-filled from customer" multiline rows={3} disabled />
                        </LabeledField>
                                                <LabeledField label="Ship To">
                          <FormTextField name="shippingAddress" label="" placeholder="Auto-filled from customer" multiline rows={3} disabled />
                        </LabeledField>
                        <LabeledField label="Engine No.">
                          <FormTextField name="engineNo" label="" placeholder="Enter engine no." />
                        </LabeledField>

                        {/* Billing Type -- display-only, see deriveBillingType's
                        comment: no DB column on this document yet, so it's
                        shown here but stripped out of the save payload. */}
                        <LabeledField label="Billing Type">
                          <FormSelect name="billingType" label="" placeholder="Select billing type" options={BILLING_TYPE_OPTIONS} disabled />
                        </LabeledField>
                        <LabeledField label="Customer PO No.">
                          <FormTextField name="customerRefNo" label="" placeholder="Enter customer PO no." />
                        </LabeledField>

                      </FormGrid>

                      {/* Fields below are kept mounted (still registered with
                      the form and still saved/loaded with whatever value they
                      already carry) but hidden from view, per request: the
                      header above now only surfaces the fields it lists. To
                      bring one back, remove it from this Box rather than
                      re-adding it from scratch elsewhere. */}
                      <Box sx={{ display: 'none' }}>
                        <FormGrid columns={2} singleColumnOnMobile rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                          <LabeledField label="Hypothecation">
                            <FormTextField name="hypothecation" label="" placeholder="Enter hypothecation" />
                          </LabeledField>
                          <LabeledField label="Payment Terms">
                            <FormSelect
                              name="paymentTerms"
                              label=""
                              placeholder="Select payment terms"
                              options={PAYMENT_TERMS_OPTIONS}
                            />
                          </LabeledField>
                          <LabeledField label="Posting Date">
                            <FormDatePicker name="postingDate" label="" minDate={documentDateMinDate} triggerFields={['documentDate']} />
                          </LabeledField>
                          <LabeledField label="Due Date">
                            <FormDatePicker name="dueDate" label="" minDate={documentDateMinDate} triggerFields={['documentDate']} />
                          </LabeledField>
                          <LabeledField label="Reason">
                            <FormTextField name="reason" label="" placeholder="Reason for the credit" />
                          </LabeledField>
                          <LabeledField label="Narration">
                            <FormTextField name="narration" label="" placeholder="Enter narration" />
                          </LabeledField>
                          <LabeledField label="Comments">
                            <FormTextField name="comments" label="" placeholder="Enter comments" />
                          </LabeledField>
                          <LabeledField label="Status *">
                            <FormSelect
                              name="status"
                              label=""
                              options={SALES_CREDIT_MEMO_STATUS_OPTIONS.map((v) => ({ label: v, value: v }))}
                            />
                          </LabeledField>
                        </FormGrid>
                      </Box>

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
                    <CardContent>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                        <Typography variant="subtitle1" fontWeight={700}>Item Details</Typography>
                        {!readOnly && (
                          <Stack direction="row" spacing={1.5}>
                            <Button type="button" variant="outlined" color="inherit" size="small" startIcon={<UploadFileIcon />} onClick={() => setItemsImportOpen(true)}>
                              Import from Excel
                            </Button>
                          <Button size="small" startIcon={<AddIcon />} onClick={() => append(withDefaultTaxCode({ ...emptyItem, warehouse: watch('warehouse') || '' }, liveDefaultTaxCode))}>
                              Add Row
                            </Button>
                          </Stack>
                        )}
                      </Stack>

                      <ScrollableTableContainer>
                        <Table size="small" sx={itemColumnsSx}>
                          <TableHead>
                            <TableRow>
                              <TableCell width={48}>#</TableCell>
                              <TableCell>Item No<span style={{ color: '#d32f2f' }}> *</span></TableCell>
                              <TableCell>Description</TableCell>
                              <TableCell>HSN Code</TableCell>
                              <TableCell>UOM</TableCell>
                              {!isNonStockCategory && (
                                <TableCell>Warehouse<span style={{ color: '#d32f2f' }}> *</span></TableCell>
                              )}
                              <TableCell align="right">Invoiced Qty</TableCell>
                              <TableCell align="right">Qty<span style={{ color: '#d32f2f' }}> *</span></TableCell>
                              <TableCell align="right">Unit Price<span style={{ color: '#d32f2f' }}> *</span></TableCell>
                              <TableCell align="right">Disc %</TableCell>
                              <TableCell align="right">Tax %</TableCell>
                              <TableCell align="right">Amount</TableCell>
                              {!readOnly && <TableCell align="right">Action</TableCell>}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {fields.map((field, index) => {
                              const qty = Number(watch(`items.${index}.quantity`)) || 0;
                              const price = Number(watch(`items.${index}.unitPrice`)) || 0;
                              const disc = Number(watch(`items.${index}.discountPercent`)) || 0;
                              const lineAmount = qty * price * (1 - disc / 100);
                              return (
                                <TableRow key={field.id}>
                                  <TableCell>{index + 1}</TableCell>
                                  <TableCell>
                                    <ProductCell index={index} methods={methods} options={productCodeOptions} products={products} priceListRates={priceListRates} placeholder="Select product code" />
                                  </TableCell>
                                  <TableCell>
                                    <ProductCell index={index} methods={methods} options={productNameOptions} products={products} priceListRates={priceListRates} placeholder="Select product name" />
                                  </TableCell>
                                  <TableCell sx={{ minWidth: 110 }}>
                                    <FormTextField name={`items.${index}.hsnCode`} label="" placeholder="HSN Code" digitsOnly maxLength={8} />
                                  </TableCell>
                                  <TableCell sx={{ minWidth: 100 }}>
                                    <FormTextField name={`items.${index}.uom`} label="" placeholder="UOM" />
                                  </TableCell>
                                  {!isNonStockCategory && (
                                    <TableCell sx={{ minWidth: 160 }}>
                                      <WarehouseCodeSelect name={`items.${index}.warehouse`} label="" placeholder={branch ? 'Select' : 'Select branch first'} options={branchWarehouseOptions} disabled={!branch} popupFitContent showNameBelow={false} />
                                    </TableCell>
                                  )}
                                  <TableCell sx={{ minWidth: 120 }}>
                                    <FormTextField name={`items.${index}.invoicedQuantity`} label="" type="number" disabled />
                                  </TableCell>
                                  <TableCell sx={{ minWidth: 120 }}>
                                    <FormTextField name={`items.${index}.quantity`} label="" type="number" />
                                  </TableCell>
                                  <TableCell sx={{ minWidth: 130 }}>
                                    <FormTextField name={`items.${index}.unitPrice`} label="" type="number" />
                                  </TableCell>
                                  <TableCell sx={{ minWidth: 100 }}>
                                    <FormTextField name={`items.${index}.discountPercent`} label="" type="number" />
                                  </TableCell>
                                  <TableCell sx={{ minWidth: 110 }}>
                                    <FormSelect
                                      name={`items.${index}.taxCodeId`}
                                      label=""
                                      options={taxCodeOptionsForRow}
                                      disableClearable
                                      sx={{ minWidth: 96 }}
                                      popupFitContent
                                      onValueChange={(_v, option) => setValue(`items.${index}.taxPercent`, option ? option.rate : 0, { shouldValidate: true })}
                                    />
                                  </TableCell>
                                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                    {money(lineAmount)}
                                  </TableCell>
                                  {!readOnly && (
                                    <TableCell align="right">
                                      <IconButton
                                        size="small"
                                        color="error"
                                        aria-label="remove row"
                                        disabled={fields.length === 1}
                                        onClick={() => removeItem(index)}
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </TableCell>
                                  )}
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </ScrollableTableContainer>

                    </CardContent>
                  </Card>

                  {/* Terms, attachments and the money panel — the same footer the
                    other sales documents carry, so a credit memo reads and prints
                    consistently beside them. */}
                  <Card variant="outlined" sx={{ mb: 2 }}>
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                      <Grid container spacing={3}>
                        <Grid item xs={12} md={4} sx={{ display: 'flex' }}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Terms &amp; Conditions</Typography>
                            <FormTextField name="termsConditions" label="" placeholder="Enter terms and conditions" multiline rows={6}
                              sx={{
                                flex: 1,
                                '& .MuiInputBase-root': { height: '100%', alignItems: 'flex-start' },
                                '& .MuiInputBase-inputMultiline': { height: '100% !important', overflowY: 'auto' },
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
                            <DocumentTotalsPanel totals={totals} interState={interState} subtotalLabel="Subtotal" showRoundOff={false} discountField={null} showFreight />
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

                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1.5}
                        justifyContent={{ xs: 'stretch', sm: 'flex-end' }}
                        sx={{ mt: 3 }}
                      >
                        {/* Copy From sits immediately left of Cancel and stays
                          disabled until a Customer is chosen — the dialog it
                          opens lists that customer's invoices, so with no
                          customer there is nothing for it to show. Hidden in
                          view mode, where nothing is being filled in. */}
                        {!readOnly && (
                          invoiceNo ? (
                            <Button
                              fullWidth={isMobile}
                              type="button"
                              variant="outlined"
                              color="inherit"
                              startIcon={<CloseIcon />}
                              onClick={clearInvoice}
                              disabled={creating || updating}
                            >
                              Clear Copied Invoice
                            </Button>
                          ) : (
                            <Button
                              fullWidth={isMobile}
                              type="button"
                              variant="outlined"
                              startIcon={<ContentCopyOutlinedIcon />}
                              onClick={() => setCopyFromOpen(true)}
                              disabled={!watch('customer') || creating || updating}
                            >
                              Copy From
                            </Button>
                          )
                        )}
                        <Button fullWidth={isMobile} type="button" variant="outlined" color={readOnly ? 'error' : 'inherit'} startIcon={<CloseIcon />} onClick={backToList} disabled={creating || updating}>
                          {readOnly ? 'Close' : 'Cancel'}
                        </Button>
                        <Button fullWidth={isMobile} type="button" variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => printSalesCreditMemo()}>
                          Print
                        </Button>
                        {/* pendingStatusRef, not setValue: the click has to record
                          which button was pressed before submit reads it, and a
                          setValue here would re-render mid-click. */}
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
                          onClick={() => { pendingStatusRef.current = null; }}
                          disabled={creating || updating}
                          loading={creating || updating}
                        >
                          {editingRow ? 'Update Credit Memo' : 'Save Credit Memo'}
                        </FormSubmitButton>
                      </Stack>
                    </CardContent>
                  </Card>

                  <JournalEntryViewDialog
                    open={journalViewOpen}
                    journalEntryId={editingRow?.journalEntryId}
                    onClose={() => setJournalViewOpen(false)}
                  />
                  <ImportItemsDialog
                    open={itemsImportOpen}
                    onClose={() => setItemsImportOpen(false)}
                    resourceName="Items"
                    templateUrl="/sales/credit-memos/items-import/template"
                    importUrl="/sales/credit-memos/items-import"
                    onImported={handleItemsImported}
                  />
                </>
              );
            }}
          </AppForm>
        </RouteMapContextMenu>
      ) : (
        <Card variant="outlined">
          <CardContent sx={{ p: 0 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
              <Typography variant="subtitle1" fontWeight={700}>Sales Credit Memo List</Typography>
              <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="center">
                <TableSearchFilter table={table} placeholder="Search by credit no., invoice, customer..." />
                <CanAdd>
                  {/* React.Children.only needs one child — group both buttons in a Stack. */}
                  <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                    <Button
                      variant="outlined"
                      color="inherit"
                      startIcon={<UploadFileIcon />}
                      onClick={() => setBulkImportOpen(true)}
                      sx={{ whiteSpace: 'nowrap' }}
                    >
                      Import from Excel
                    </Button>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ whiteSpace: 'nowrap' }}>
                      Add Credit Memo
                    </Button>
                  </Stack>
                </CanAdd>
              </Stack>
            </Stack>

            <TableFilterPanel table={table} />

            {isMobile ? (
              <Box sx={{ px: 2, pb: 1 }}>
                {!isLoading && pagedRows.map((row) => (
                  <MobileRecordCard
                    key={row.id}
                    title={row.creditNo}
                    statusChip={<Chip size="small" label={row.status} variant="outlined" />}
                    fields={[
                      { label: 'Invoice No.', value: row.invoiceNo },
                      { label: 'Customer', value: row.customer },
                      { label: 'Amount', value: money(row.amount) },
                    ]}
                    onView={() => handleView(row)}
                    // Cancelled credit memos are fully locked — no Edit/
                    // Delete/Cancel action once isCancelled is true, only
                    // the status chip above shows "Cancelled".
                    onEdit={row.isCancelled ? undefined : () => handleEdit(row)}
                    onDelete={row.isCancelled ? undefined : () => handleDelete(row)}
                    extraActions={row.isCancelled ? [] : [
                      { key: 'cancel', label: 'Cancel', icon: <CancelOutlinedIcon fontSize="small" />, color: 'warning', onClick: () => handleCancel(row) },
                    ]}
                  />
                ))}
                {!isLoading && visibleRows.length === 0 && (
                  <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No credit memos yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first credit memo to get started'} />
                )}
              </Box>
            ) : (
              <ScrollableTableContainer>
                <Table
                  size="small"
                  stickyHeader
                  sx={{
                    '& th, & td': {
                      height: SALES_CREDIT_MEMO_LIST_TABLE_ROW_HEIGHT,
                      paddingTop: `${SALES_CREDIT_MEMO_LIST_TABLE_CELL_PADDING_Y}px`,
                      paddingBottom: `${SALES_CREDIT_MEMO_LIST_TABLE_CELL_PADDING_Y}px`,
                      boxSizing: 'border-box',
                    },
                  }}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell width={48}>#</TableCell>
                      <SortableHeaderCell field="creditNo" sort={table.sort} onSort={table.toggleSort}>Credit No</SortableHeaderCell>
                      <SortableHeaderCell field="invoiceNo" sort={table.sort} onSort={table.toggleSort}>Invoice No.</SortableHeaderCell>
                      <SortableHeaderCell field="customer" sort={table.sort} onSort={table.toggleSort}>Customer</SortableHeaderCell>
                      <SortableHeaderCell field="documentDate" sort={table.sort} onSort={table.toggleSort}>Document Date</SortableHeaderCell>
                      <SortableHeaderCell field="totalItems" sort={table.sort} onSort={table.toggleSort}>Items</SortableHeaderCell>
                      <SortableHeaderCell align="right" field="amount" sort={table.sort} onSort={table.toggleSort}>Amount</SortableHeaderCell>
                      <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {!isLoading && pagedRows.map((row, i) => (
                      <TableRow key={row.id} hover>
                        <TableCell>{page * pageSize + i + 1}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.creditNo}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.invoiceNo || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.customer || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {row.documentDate ? dayjs(row.documentDate).format('DD MMM YYYY') : '—'}
                        </TableCell>
                        <TableCell>{row.totalItems}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{money(row.amount)}</TableCell>
                        <TableCell>
                          <Chip size="small" label={row.status} variant="outlined" />
                        </TableCell>
                        <TableCell align="right">
                          {row.isCancelled ? (
                            // Fully locked once cancelled — no Edit/Delete/
                            // Cancel, only the status chip above says
                            // "Cancelled".
                            <Typography variant="caption" color="text.secondary">Cancelled</Typography>
                          ) : (
                          <>
                          <IconButton size="small" onClick={() => handleView(row)} aria-label="view">
                            <VisibilityOutlinedIcon fontSize="small" />
                          </IconButton>
                          <RouteMapButton flow="sales" type="creditMemo" docNo={row.creditNo} />
                          <CanCancel>
                            <Tooltip title="Cancel">
                              <IconButton size="small" color="warning" onClick={() => handleCancel(row)} aria-label="cancel">
                                <CancelOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </CanCancel>
                          <IconButton
                            size="small"
                            aria-label="more actions"
                            onClick={(e) => { setRowMenuAnchor(e.currentTarget); setRowMenuTarget(row); }}
                          >
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                          </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!isLoading && visibleRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9}>
                          <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No credit memos yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first credit memo to get started'} />
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
              <CanDelete>
                <MenuItem onClick={() => handleDelete(rowMenuTarget)}>
                  <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
                  <ListItemText>Delete</ListItemText>
                </MenuItem>
              </CanDelete>
            </Menu>

            <EntityListPagination
              total={table.total}
              page={page}
              onChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={(v) => { setPageSize(v); setPage(0); }}
            />
          </CardContent>
        </Card>
      )}

      <BulkImportDialog
        open={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        resourceName="Sales Credit Memos"
        templateUrl="/sales/credit-memos/bulk-import/template"
        importUrl="/sales/credit-memos/bulk-import"
        onImported={refetchCreditMemos}
      />
    </Box>
  );
}

// Item No / Description picker for one item row. Both columns render
// this and both WRITE items.N.productCode — they differ only in whether the
// options are labelled by code or by name — so picking in either updates both,
// exactly as on Sales Order/Invoice/Delivery Challan.
//
// Choosing a product fills the line's own descriptive fields from Product
// Master, priced at Product Master's own Unit Price (unitPrice) — the same
// figure Product Master's Price List selection autofills there; costPrice is
// what the purchase side uses instead. It deliberately does NOT touch
// invoicedQuantity:
// on a credit memo that figure is what the source Sales Invoice recorded, not
// anything the product master knows, and the Qty validation is
// checked against it.
function ProductCell({ index, methods, options, products, priceListRates, label = '', placeholder = 'Select product' }) {
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
          setValue(`items.${index}.batchAllocations`, [], { shouldValidate: true });
          setValue(`items.${index}.serialAllocations`, [], { shouldValidate: true });
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
        // A different product invalidates whatever batches/serials were picked
        // for the old one — they belong to that product's stock, not this one's.
        setValue(`items.${index}.batchAllocations`, [], { shouldValidate: true });
        setValue(`items.${index}.serialAllocations`, [], { shouldValidate: true });
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
      popupFitContent
    />
  );
}

