import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatPartnerAddress, cleanAddressText, formatBranchAddress as formatBranchAddressText } from '../../lib/addressFormat';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import EmptyState from '../../components/data-display/EmptyState';
import usePriceListRates from '../../hooks/usePriceListRates';
import {
  Box, Typography, Button, Card, CardContent, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, Chip, IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Grid,
  CircularProgress, Tooltip,
} from '@mui/material';
import { useFieldArray } from 'react-hook-form';
import dayjs from 'dayjs';
import AssignmentReturnOutlinedIcon from '@mui/icons-material/AssignmentReturnOutlined';
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
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import WarehouseCodeSelect from '../../components/form/WarehouseCodeSelect';
import PartyCodeSelect, { buildPartyCodeOptions } from '../../components/form/PartyCodeSelect';
import MachineryCodeSelect from '../../components/form/MachineryCodeSelect';
import FormDatePicker from '../../components/form/FormDatePicker';
import DocumentSeriesNoField from '../../components/form/DocumentSeriesNoField';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import CompanyBadge from '../../components/common/CompanyBadge';
import BulkImportDialog from '../../components/common/BulkImportDialog';
import ImportItemsDialog from '../../components/common/ImportItemsDialog';
import BatchSerialRestockDialog from '../../components/common/BatchSerialRestockDialog';
import { useWarehouseOptions, warehouseLabel, warehouseCodesForBranch } from '../../lib/useWarehouseOptions';
import { CanAdd, CanEdit, CanDelete, CanCancel } from '../../components/common/PermissionGate';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { applyServerErrors } from '../../lib/formErrors';
import { itemTableSx } from '../../lib/columnWidth';
import { salesReturnSchema, SALES_RETURN_STATUS_OPTIONS } from '../../lib/validation/salesSchemas';
import { isNonStockSalesCategory } from '../../lib/validation/common';
import { buildDocument, normaliseLine, round2, isInterState, computeFreightGross, computeItemDiscountTotal } from '../../lib/documentTotals';
import DocumentTotalsPanel from '../../components/form/DocumentTotalsPanel';
import { useGetCompanyDetailsQuery } from '../../features/company/companyDetailsApi';
import { buildTaxCodeOptions, taxTypeFamilyFor, pickDefaultTaxCode, withDefaultTaxCode } from '../../lib/taxCodeOptions';
import { productOptionsFor, PRODUCT_USAGE } from '../../lib/productUsage';
import { taxCodeApi } from '../../features/resources';
import { PAYMENT_TERMS_OPTIONS } from '../../lib/validation/partnerSchemas';
import { salesReturnApi, deliveryChallanApi, salesInvoiceApi, salesOrderApi, customerApi, productApi, houseBankApi, salesEmployeeApi } from '../../features/resources';
import { useBranchNameOptions } from '../../lib/useBranchOptions';
import useServerListTable from '../../components/data-display/useServerListTable';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import RouteMapButton from '../../components/common/RouteMapButton';
import RouteMapContextMenu from '../../components/common/RouteMapContextMenu';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import CopyFromDocumentDialog from '../../components/common/CopyFromDocumentDialog';
import JournalEntryViewDialog from '../../components/accounting/JournalEntryViewDialog';
import SalesReturnPrintable, { printSalesReturn } from '../../components/print/SalesReturnPrintable';
import CopyToButton from '../../components/common/CopyToButton';
import { useDispatch, useSelector } from 'react-redux';
import { selectCurrentUser } from '../../store/authSlice';
import { clearCopyIntent } from '../../store/copyIntentSlice';

// Columns for the "Find Sales Delivery" dialog opened by Copy From.
const CHALLAN_COPY_COLUMNS = [
  { field: 'challanNo', headerName: 'Delivery No', nowrap: true },
  { field: 'customer', headerName: 'Customer Name' },
  { field: 'deliveryDate', headerName: 'Delivery Date', type: 'date' },
  { field: 'remarks', headerName: 'Comments', type: 'optional' },
];

const PAGE_SIZE = 10;

// `returnQuantity`, not `quantity`.
//
// That name is fixed by everything downstream: the zod schema
// (salesReturnItemSchema), the totals engine call below, the server's
// toSalesReturnItem, and the [sales_return_items].[return_quantity] column.
// This form was the one place that spelled it `quantity`, which meant the
// field the user typed into was not the field anything else read — see the
// note on the Return Qty input.
const emptyItem = {
  productCode: '', productName: '', description: '', hsnCode: '', uom: '',
  deliveredQuantity: 0, returnQuantity: 1, unitPrice: 0,
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
// SalesReturnItem.taxCodeId; it can't be resolved retroactively for a line
// the app never recorded a Tax Code against in the first place.
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
 * Blocks the return save when a Batch/Serial-tracked line's return quantity
 * isn't fully covered by its selected batches/serials — the client-side half
 * of the same rule the server enforces in assertBatchSerialRestockAllocation
 * (utils/businessRules.js). Unlike the issue-side check, this is about
 * putting stock BACK, not drawing it down, but the "selected must equal
 * needed" shape is identical.
 */
function validateBatchSerialAllocation(items, productsByCode) {
  for (let i = 0; i < (items || []).length; i++) {
    const item = items[i];
    const trackingMode = productsByCode[item.productCode]?.manageItemBy;
    if (trackingMode !== 'Batch' && trackingMode !== 'Serial') continue;
    const label = item.productCode || `Row ${i + 1}`;
    const qty = Number(item.returnQuantity) || 0;

    if (trackingMode === 'Batch') {
      const allocated = (item.batchAllocations || []).reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
      if (Math.abs(allocated - qty) > 0.005) {
        return `${label}: select ${qty} from batches via "Batches - Restock" — currently ${allocated}.`;
      }
    } else {
      const count = (item.serialAllocations || []).length;
      if (count !== qty) {
        return `${label}: select ${qty} serial number(s) via "Serial Numbers - Restock" — currently ${count}.`;
      }
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

// Ship To is NOT the customer's address on a return - the customer is the
// one shipping goods back TO the company, so "Ship To" is the receiving
// Branch's own address. Same field composition as
// formatBusinessPartnerAddress, just reading Branch's own address columns
// instead of a Business Partner address row.
function formatBranchAddress(branchRecord) {
  return formatBranchAddressText(branchRecord);
}

// Looks the Branch row up by name (documents store the branch's name as a
// plain string, not an id - see useBranchNameOptions/branchLabel) and
// formats its address for Ship To.
function branchAddressFor(branches, branchName) {
  const found = (branches || []).find((b) => String(b.branchName).trim() === branchName);
  return formatBranchAddress(found) || '';
}

// GST No. field — same "customer's own Business Partner default (or first)
// Billing address" lookup used above, just returning the GST number itself.
function customerGstNo(customerRecord) {
  const list = (customerRecord?.addresses || []).filter((a) => a.addressType === 'Billing');
  const chosen = list.find((a) => a.isDefault) || list[0];
  return (chosen?.gstNumber || '').trim();
}

// GSTIN format check -- same regex as SalesInvoice.jsx's own copy (itself
// lib/validation/common.js' gstin(), reused verbatim there too), so "valid
// GST number" means the same thing on this document as it does everywhere
// else GST numbers are captured or classified.
const GSTIN_FORMAT_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z][A-Z0-9]$/;

// Billing Type is frozen/derived, not hand-picked -- same rule as
// SalesInvoice.jsx's deriveBillingType: B2B when the customer's own
// Business Partner default (or first) Billing address carries a
// non-empty, valid-format GST number, B2C otherwise.
//
// Display-only for now: SalesReturn has no billing_type column in the
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
    returnNo: '', seriesId: '', status: 'Open', challanNo: '', customer: '', customerName: '',
    salesCategory: 'Parts', salesPerson: '', salesType: '',
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
// computeSalesReturnTotals.
function computeReturnTotals(items, discountPercent, interState, extraCharges = {}) {
  const { totals } = buildDocument(items, discountPercent, {
    quantityField: 'returnQuantity',
    interState,
    roundOff: true,
  });
  const roadTax = round2(Number(extraCharges.roadTax) || 0);
  const freightGrossAmount = computeFreightGross(extraCharges.freightNetAmount, extraCharges.freightTaxAmount);
  return {
    ...totals,
    discount: computeItemDiscountTotal(items, { quantityField: 'returnQuantity' }),
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
    billingType: row.billingType || deriveBillingType(savedCustomerRecord),
    machineSerialNo: row.machineSerialNo || '', engineNo: row.engineNo || '', hypothecation: row.hypothecation || '',
    documentDate: toDate(row.documentDate),
    postingDate: toDate(row.postingDate),
    dueDate: toDate(row.dueDate),
    items: (row.items?.length ? row.items : [{ ...emptyItem }]).map((i) => ({
      productCode: i.productCode || '',
      productName: i.productName || '',
      description: i.description || '',
      hsnCode: i.hsnCode || '',
      uom: i.uom || '',
      deliveredQuantity: Number(i.deliveredQuantity) || 0,
      returnQuantity: Number(i.returnQuantity) || 0,
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
      // return's own warehouse rather than a blank.
      warehouse: i.warehouse || row.warehouse || '',
    })),
  };
}

/**
 * Sales Return — goods coming back from a customer, raised against a
 * Delivery Challan.
 *
 * Totals, including the CGST/SGST vs IGST split, are computed by the shared
 * document engine and recomputed identically on the server, so the panel can
 * never disagree with what gets stored. The memo posts no stock movement and no receivables adjustment:
 * it records the value of what is coming back only.
 */
const SALES_RETURN_LIST_TABLE_ROW_HEIGHT = 0;
const SALES_RETURN_LIST_TABLE_CELL_PADDING_Y = 6;
export default function SalesReturn({ openDocNo } = {}) {
  const currentUser = useSelector(selectCurrentUser);
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();

  // Phase 6 of the data-loading performance work (pure data-access, no
  // business-logic change) — the list below now fetches ONE page at a time
  // via salesReturnApi.useListPaged (see useServerListTable further down and
  // the paginatedFindMany-based /sales/returns route in
  // backend/src/routes/resources.js), instead of the whole returns table.
  // `returnsForHistory` stays on `.useList()` (itself now capped server-side
  // rather than unbounded — see paginatedFindMany's `maxPageSize`): it feeds
  // returnedByChallanProductOther and the openDocNo lookup below, both of
  // which need to see records across the whole set, not one page.
  const { data: returnsForHistory } = salesReturnApi.useList();
  const [create, { isLoading: creating }] = salesReturnApi.useCreate();
  const [update, { isLoading: updating }] = salesReturnApi.useUpdate();
  const [remove] = salesReturnApi.useDelete();
  const [cancelReturn] = salesReturnApi.useCancel();
  const { data: challans } = deliveryChallanApi.useList();
  // Needed to know which challans have already been invoiced — see
  // copyableChallans below.
  const { data: invoices } = salesInvoiceApi.useList();
  // The Delivery Challan itself carries no Payment Terms — that lives one
  // level further up, on the Sales Order it was despatched against. Needed
  // to pull it in transitively when a challan is picked (see the challanNo
  // pull-in effect below).
  const { data: salesOrders } = salesOrderApi.useList();
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
  // Bank block on the printed Credit Note — same "first Active house bank"
  // source SalesQuotation.jsx/DeliveryChallan.jsx use for their own print.
  const { data: houseBanks } = houseBankApi.useList();
  const printHouseBank = useMemo(
    // Prefer the house bank flagged as the default (HouseBank.isDefault);
    // only fall back to "first Active" when no default is set.
    () => (houseBanks || []).find((b) => b.isDefault === true) || (houseBanks || []).find((b) => b.status === 'Active') || null,
    [houseBanks]
  );
  // Keyed by Tax Code id, not by rate — this document has no Place of
  // Supply/taxType filter, so a GST code and an IGST code sharing a rate
  // (e.g. both 18%) are both real, distinct options; keying by rate would
  // collapse them into one and leave no way to tell which was picked (see
  // the schema.prisma comment on SalesReturnItem.taxCodeId, and
  // buildTaxCodeOptions in taxCodeOptions.js).
  const taxCodeOptions = useMemo(() => buildTaxCodeOptions(taxCodes), [taxCodes]);
  // Tax (%) shows the tax code's own NAME in the closed field, which runs
  // well past the bare rate the row stores — so the item table sizes that
  // column from the rendered label it finds here, not from the raw number.
  const taxCodeById = useMemo(() => new Map(taxCodeOptions.map((o) => [o.value, o])), [taxCodeOptions]);
  // Looked up per row to decide whether the Batch/Serial column applies —
  // Product Master's Manage Item By select is what makes a line ask for it.
  const productsByCode = useMemo(
    () => Object.fromEntries((products || []).map((p) => [p.productCode, p])),
    [products]
  );

  const [view, setView] = useState('list');
  const [editingRow, setEditingRow] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  // Journal Entry view popup — opened from the header's "View Journal Entry"
  // icon (rendered only once editingRow.journalEntryId exists, i.e. this
  // return already has a linked entry). Same pattern as Purchase GRN.
  const [journalViewOpen, setJournalViewOpen] = useState(false);
  // Copy From ("Find Sales Delivery") dialog. Held at page level rather than
  // inside AppForm's render prop so remounting the form on formKey change
  // can't leave a dialog orphaned open over a freshly reset form.
  const [copyFromOpen, setCopyFromOpen] = useState(false);
  const [rowMenuAnchor, setRowMenuAnchor] = useState(null);
  const [rowMenuTarget, setRowMenuTarget] = useState(null);
  // { index, mode } for the item row whose "Batches - Restock" /
  // "Serial Numbers - Restock" dialog is open; null when closed.
  const [batchDialog, setBatchDialog] = useState(null);
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

  // Only challans that have NOT been invoiced can be returned against.
  //
  // Once an invoice exists the goods have been billed, and taking them back by
  // return would leave the invoice standing against stock that has gone —
  // a Sales Credit Memo is the instrument from then on. The backend refuses
  // these outright (assertReturnAllowed in utils/routeMap.js); filtering here
  // means the user never picks an option that is going to be rejected.
  //
  // A cancelled or draft invoice does not lock the challan: neither has been
  // issued, so there is nothing yet to credit instead.
  const invoicedChallanNos = useMemo(() => new Set(
    (invoices || [])
      .filter((i) => !['Draft', 'Cancelled'].includes(i.status))
      .map((i) => i.deliveryChallanNo)
      .filter(Boolean)
  ), [invoices]);

  // Per (challanNo, productCode), how much has already been returned by
  // OTHER sales returns (i.e. not the one currently being edited). Used to
  // cap what THIS return can still take — two returns against the same
  // challan line must share its quantity, not each get the full amount.
  const returnedByChallanProductOther = useMemo(() => {
    const totals = new Map();
    (returnsForHistory || [])
      .filter((r) => r.status !== 'Cancelled' && r.challanNo && r.returnNo !== editingRow?.returnNo)
      .forEach((r) => {
        (r.items || []).forEach((item) => {
          if (!item.productCode) return;
          const key = `${r.challanNo}::${item.productCode}`;
          totals.set(key, (totals.get(key) || 0) + (Number(item.returnQuantity) || 0));
        });
      });
    return totals;
  }, [returnsForHistory, editingRow]);

  // What the Copy From dialog is allowed to offer — an already-invoiced challan
  // is excluded for the reason given above (the credit belongs on the invoice,
  // so the backend would reject it anyway).
  //
  // This used to build the options for a challan dropdown; it is now the record
  // list handed to the dialog. The "the challan already on the record being
  // edited stays selectable" case the dropdown needed is gone with it — the
  // field is read-only now, so an existing return's own link is simply
  // displayed and never has to survive a filter to keep showing.
  const copyableChallans = useMemo(
    () => (challans || []).filter((c) => c.status !== 'Closed' && !invoicedChallanNos.has(c.challanNo)),
    [challans, invoicedChallanNos]
  );
  const customerOptions = useMemo(
    () => buildPartyCodeOptions(customers, 'customerCode', 'customerName'),
    [customers]
  );
  const { options: branchOptions, branches } = useBranchNameOptions({ currentValue: editingRow?.branch });

  // Column definitions drive the global search, the sort icons and the
  // per-column filter popover — see useServerListTable.js. `server: true`
  // pushes that column's sort/filter to the /sales/returns route (see its
  // SALES_RETURN_FILTER_SPEC/SALES_RETURN_SORT_FIELDS in
  // backend/src/routes/resources.js) instead of applying it only to
  // whatever page happens to already be loaded. `totalItems` is a real
  // stored column on SalesReturn (not computed), so it's safe to filter
  // server-side too.
  const tableColumns = useMemo(() => ([
    { field: 'returnNo', headerName: 'Return No.', filter: 'text', server: true },
    { field: 'challanNo', headerName: 'Challan No.', filter: 'text', server: true },
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

  const table = useServerListTable(salesReturnApi.useListPaged, {
    columns: tableColumns,
    initialPageSize: PAGE_SIZE,
  });
  const { page, setPage, pageSize, setPageSize } = table;
  const rows = table.rows;
  const visibleRows = rows;
  const pagedRows = rows;
  const isLoading = table.isLoading;
  const refetchReturns = table.refetch;

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

  const [printRequestReturnNo, setPrintRequestReturnNo] = useState(null);

  const handlePrint = (row) => {
    setRowMenuAnchor(null);
    handleView(row);
    setPrintRequestReturnNo(row.returnNo);
  };

  useEffect(() => {
    if (!printRequestReturnNo) return;
    if (!editingRow || editingRow.returnNo !== printRequestReturnNo) return;
    setPrintRequestReturnNo(null);
    const returnToListAfterPrint = () => {
      window.removeEventListener('afterprint', returnToListAfterPrint);
      backToList();
    };
    window.addEventListener('afterprint', returnToListAfterPrint);
    printSalesReturn();
  }, [printRequestReturnNo, editingRow]);

  // Opened from the Route Map's document preview popup: jump straight into
  // this record's own read-only View, exactly as clicking it in the list
  // would, instead of requiring the user to find and click the row.
  useEffect(() => {
    if (!openDocNo) return;
    if (editingRow && editingRow.returnNo === openDocNo) return;
    const match = (returnsForHistory || []).find((r) => r.returnNo === openDocNo);
    if (match) handleView(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDocNo, returnsForHistory]);

  // "Copy To > Sales Return" lands the browser on this page's route, but
  // that alone used to leave the user on the LIST view — the intent-
  // consuming effect that actually applies the source document's data lives
  // inside AppForm's render prop below, which only mounts once `view` is
  // 'form', so nothing happened until the user clicked "+ Add New"
  // themselves first. Mirrors the openDocNo effect just above: notice a
  // pending intent addressed to this page on arrival and open the create
  // form immediately, so the user lands straight on a pre-filled return.
  const pendingCopyIntentForAutoOpen = useSelector((s) => s.copyIntent.pending);
  useEffect(() => {
    if (!pendingCopyIntentForAutoOpen || pendingCopyIntentForAutoOpen.targetKey !== 'salesReturn') return;
    if (view === 'form') return;
    openCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCopyIntentForAutoOpen]);

  const handleDelete = async (row) => {
    setRowMenuAnchor(null);
    const ok = await confirmDialog({
      title: 'Delete sales return',
      message: `Are you sure you want to delete "${row.returnNo}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Sales return deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  // Cancel — a soft alternative to Delete: the return stays in the list
  // (status becomes "Cancelled") and View/Edit/Delete/Cancel get blocked for
  // it below, once isCancelled is true. Nothing downstream is ever raised
  // against a Sales Return, so unlike Purchase Order/Sales Invoice there is
  // no dependent-document guard to trip — see the matching comment on
  // PATCH /sales/returns/:id/cancel.
  const handleCancel = async (row) => {
    setRowMenuAnchor(null);
    const ok = await confirmDialog({
      title: 'Cancel sales return',
      message: `Are you sure you want to cancel "${row.returnNo}"? This cannot be undone.`,
      confirmLabel: 'Cancel Return',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await cancelReturn(row.id).unwrap();
      notify.success('Sales return cancelled');
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
    const allocationError = validateBatchSerialAllocation(values.items, productsByCode);
    if (allocationError) {
      notify.error(allocationError);
      return;
    }
    const payload = { ...values, status: pendingStatusRef.current || values.status };
    // Billing Type is a display-only classification on this document --
    // see deriveBillingType's comment. There is no billing_type column on
    // sales_returns yet, so it is dropped here rather than sent through:
    // every other field on this payload is spread straight into a Prisma
    // create/update, which would throw "Unknown argument `billingType`"
    // on every single save otherwise.
    delete payload.billingType;
    // Sales Person / Payment Method (salesType) have no columns on sales_returns
    // either -- same "Unknown argument" 500 if sent. Display-only for now.
    delete payload.salesPerson;
    delete payload.salesType;
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...payload }).unwrap();
        notify.success('Sales return updated');
      } else {
        await create(payload).unwrap();
        notify.success('Sales return created');
      }
      backToList();
    } catch (err) {
      notify.error(applyServerErrors(err, methods.setError));
    }
  };

  if (openDocNo && (!editingRow || editingRow.returnNo !== openDocNo)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box>

      {view === 'form' ? (
        <RouteMapContextMenu flow="sales" type="return" docNo={editingRow?.returnNo}>
          <AppForm
            key={formKey}
            readOnly={readOnly}
            schema={salesReturnSchema}
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
                  returnQuantity: raw.quantity,
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
                { header: 'Delivered Qty', get: (i) => i?.deliveredQuantity, field: 'text' },
                { header: 'Return Qty', get: (i) => i?.returnQuantity, field: 'text' },
                { header: 'Unit Price', get: (i) => i?.unitPrice, field: 'text' },
                { header: 'Disc %', get: (i) => i?.discountPercent, field: 'text' },
                { header: 'Tax %', get: (i) => taxCodeById.get(i?.taxCodeId)?.label ?? i?.taxPercent, field: 'select' },
                null,
                { header: 'Amount', get: (i) => ((Number(i?.returnQuantity) || 0) * (Number(i?.unitPrice) || 0)).toFixed(2), field: 'plain', min: 110 },
                null,
              ]);
              const challanNo = watch('challanNo');
              const branch = watch('branch');

              // Bill To/Ship To are frozen fields now — always the selected
              // customer's own Business Partner Billing/Shipping address,
              // never hand-typed. Same convention as SalesInvoice.jsx's own
              // customer-change effect.
              const customerValue = watch('customer');
              // MachineryCodeSelect needs the selected Customer's Business
              // Partner id (Machineries are scoped per partner, not global —
              // see the "Machineries" tab on BusinessPartner.jsx), resolved the
              // same way the customer-change effect below looks the customer
              // row up.
              const machineryBusinessPartnerId = (customers || []).find((c) => c.customerName === customerValue)?.id || null;
              const prevCustomerRef = useRef(editingRow ? editingRow.customer : null);
              useEffect(() => {
                if (customerValue !== prevCustomerRef.current) {
                  const found = (customers || []).find((c) => c.customerName === customerValue || c.customerCode === customerValue);
                  if (found) {
                    setValue('billingAddress', customerAddressFor(found, 'Billing'), { shouldValidate: true });
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
              // with what that challan despatched.
              //
              // This used to run as an effect watching the Challan No. dropdown,
              // guarded by a ref so it fired only on a real change. It is a plain
              // function now, called only from the dialog's Choose button: an
              // effect keyed on a form value also fires when that value is
              // restored on edit or reset, which is what the ref bookkeeping
              // existed to detect. An explicit call has no such ambiguity.
              //
              // The customer is still set from the challan, unlike the sibling
              // sales pages: this form keeps customerName and contactPerson
              // alongside it, so the pull has real work to do here, and the value
              // it writes is the customer the dialog was already filtered by.
              const applyChallan = (challan) => {
                if (!challan) return;
                setValue('challanNo', challan.challanNo || '', { shouldValidate: true });
                setValue('customer', challan.customer || '');
                setValue('customerName', challan.customer || '');
                // Also sync the customer-effect's own "previous value" ref so
                // it doesn't re-fire on the next render and clobber the
                // Bill To/Ship To values set from the challan's own customer
                // just below (same class of bug fixed on Sales Invoice's
                // Delivery Challan pull-in).
                prevCustomerRef.current = challan.customer || '';
                setValue('branch', challan.branch || '');
                setValue('contactPerson', challan.contactPerson || '');
                setValue('termsConditions', challan.termsConditions || '');
                setValue('customerRefNo', challan.customerRefNo || '');
                // Carried on the challan but previously left behind on
                // Copy To (the return schema has no Receiver/Other Details
                // block, so this is all there is to bring across).
                setValue('approvedBy', challan.approvedBy || '', { shouldValidate: true });
                // Bill To/Ship To are frozen/derived — re-derive from the
                // challan's own customer's Business Partner record rather
                // than any stored strings.
                {
                  const challanCustomerRecord = (customers || []).find((c) => c.customerName === challan.customer);
                  setValue('billingAddress', customerAddressFor(challanCustomerRecord, 'Billing'), { shouldValidate: true });
                  setValue('gstNo', customerGstNo(challanCustomerRecord), { shouldValidate: true });
                  setValue('billingType', deriveBillingType(challanCustomerRecord), { shouldValidate: true });
                }
                // The Delivery Challan itself carries no Payment Terms — that
                // lives one level further up, on the Sales Order it was
                // despatched against. Reached transitively via the challan's
                // own orderNo.
                const sourceOrder = (salesOrders || []).find((o) => o.orderNo === challan.orderNo);
                if (sourceOrder) {
                  setValue('paymentTerms', sourceOrder.paymentTerms || '');
                }
                // replace(), never setValue('items', ...) — the field array has to
                // remount so each row's inputs pick up the new values.
                //
                // deliveredQuantity on each line is NOT the raw challan quantity —
                // it is what is still left to return after every OTHER sales
                // return against this challan is subtracted
                // (returnedByChallanProductOther, below). Two separate returns
                // against the same 10-unit challan line must not each be allowed
                // up to 10; the second one only has what the first didn't take.
                // A line with nothing left is dropped rather than pulled in at
                // zero, matching the same rule used in Sales Invoice's challan
                // pull-in.
                // `line` is captured BEFORE the filter: base_line names the
                // position of the line on the SOURCE document, so it has to be
                // numbered against the challan's own lines, not against
                // whichever of them survive the remaining-quantity filter.
                const remaining = (challan.items || [])
                  .map((i, n) => {
                    // A delivery challan line stores what went out under
                    // `quantity` — DeliveryChallanItem has no `deliveredQuantity`
                    // column. Reading that name gave undefined on every line, so
                    // both the cap and the pre-filled return quantity came
                    // through as 0. (The purchase side reads
                    // GoodsReceivedNoteItem.receivedQuantity, which does exist,
                    // which is why only this page was affected.)
                    const delivered = Number(i.quantity) || 0;
                    const alreadyReturned = returnedByChallanProductOther.get(`${challan.challanNo}::${i.productCode}`) || 0;
                    return { item: i, line: n + 1, qty: round2(delivered - alreadyReturned) };
                  })
                  .filter(({ qty }) => qty > 0.005);
                const mappedItems = remaining.length
                  ? remaining.map(({ item: i, line, qty }) => ({
                      productCode: i.productCode || '',
                      productName: i.productName || '',
                      description: i.description || '',
                      hsnCode: i.hsnCode || '',
                      uom: i.uom || '',
                      deliveredQuantity: qty,
                      returnQuantity: qty,
                      unitPrice: (i.unitPrice != null ? Number(i.unitPrice) : null) ?? priceListRates?.get(i.productCode) ?? 0,
                      discountPercent: Number(i.discountPercent) || 0,
                      taxPercent: Number(i.taxPercent) || 0,
                      taxCodeId: i.taxCodeId != null ? Number(i.taxCodeId) : null,
                      // Where the goods physically go back to, so the
                      // return's own restock default points at the same
                      // place the challan line said they left from; falls
                      // back to whatever this return's header has.
                      warehouse: i.warehouse || '',
                      // Copy From: a return is raised against the challan.
                      baseType: 'Delivery Challan',
                      baseEntry: challan.id ?? null,
                      baseNo: challan.challanNo || null,
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
                // own default instead of the challan's). Reasserting the
                // challan's own values a moment later — after that cell's
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

              // Undo a Copy From: drop the link and the lines that came across
              // with it, rather than leaving a stale despatch's figures sitting
              // in a return that no longer claims to reference it.
              //
              // The customer is deliberately NOT cleared. It is the user's own
              // selection — it is what made Copy From available in the first
              // place, and clearing it would close the dialog off and force a
              // re-pick just to try a different delivery from the same customer.
              const clearChallan = () => {
                setValue('challanNo', '', { shouldValidate: true });
                setValue('contactPerson', '');
                setValue('termsConditions', '');
                setValue('paymentTerms', '');
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

              // Ship To on a return is the receiving Branch's own address,
              // never the customer's - the customer is shipping goods back
              // to us. Kept as its own effect (rather than folded into the
              // warehouse-clearing effect above) since it has nothing to do
              // with warehouse validity and should just track Branch directly.
              useEffect(() => {
                setValue('shippingAddress', branchAddressFor(branches, branch), { shouldValidate: true });
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [branch, branches]);

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
              const totals = computeReturnTotals(itemsForTotals, discountPercent, interState, { roadTax: roadTaxWatched, freightNetAmount, freightTaxAmount });
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

              // The printed Credit Note — see the "Based On ..." note on
              // remarksLine() in SalesReturnPrintable.jsx for why the linked
              // invoice is looked up here rather than left to the challan
              // number alone.
              const allValues = watch();
              const printCustomerRecord = (customers || []).find((c) => c.customerName === allValues.customer);
              const printInvoiceRecord = (invoices || []).find(
                (i) => i.deliveryChallanNo === allValues.challanNo && !['Draft', 'Cancelled'].includes(i.status)
              );
              // The return's own Branch resolved against Branch Master — see
              // SalesOrderPrintable.jsx's branchRecord prop.
              const printBranchRecord = (branches || []).find((b) => (b.branchName || '').trim() === (allValues.branch || '').trim());
              // items: itemsForTotals so each line carries its resolved
              // taxType -- SalesReturnPrintable's own local recompute reads
              // item.taxType to detect a TCS-typed line, and the raw watched
              // item only ever has taxCodeId.
              const printOrder = { ...allValues, items: itemsForTotals, status: editingRow?.status || 'Open' };
              // See SalesInvoice.jsx's identical approverSignatureUrl comment.
              const approverSignatureUrl = (salesEmployees || []).find((s) => s.employeeName === allValues.approvedBy)?.signatureUrl || null;

              // Consume a pending "Copy To" intent addressed to this page —
              // see copyIntentSlice.js.
              useEffect(() => {
                if (!pendingCopyIntent || pendingCopyIntent.targetKey !== 'salesReturn') return;
                if (pendingCopyIntent.sourceType === 'deliveryChallan') applyChallan(pendingCopyIntent.sourceDoc);
                dispatch(clearCopyIntent());
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [pendingCopyIntent]);

              return (
                <>
                  <CopyFromDocumentDialog
                    open={copyFromOpen}
                    onClose={() => setCopyFromOpen(false)}
                    onChoose={applyChallan}
                    documents={copyableChallans}
                    party={watch('customer')}
                    partyField="customer"
                    partyLabel="customer"
                    title="Find Sales Delivery"
                    columns={CHALLAN_COPY_COLUMNS}
                    emptyMessage="No uninvoiced deliveries found for"
                  />
                  <SalesReturnPrintable
                    order={printOrder}
                    company={company}
                    customerRecord={printCustomerRecord}
                    invoiceRecord={printInvoiceRecord}
                    branchRecord={printBranchRecord}
                    houseBank={printHouseBank}
                    approverSignatureUrl={approverSignatureUrl}
                  />
                  <Card variant="outlined" sx={{ mb: 2 }}>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                        {readOnly ? 'View Sales Return' : editingRow ? 'Edit Sales Return' : 'Add Sales Return'}
                      </Typography>

                      {/* Header laid out as the 8 left|right pairs requested:
                      Sales Return Type|Return No, Branch|Document Date,
                      Customer|Contact No, Customer Name|GST No,
                      Sales Person|Payment Method, Machine Serial No|Engine No,
                      Ship From|Ship To, Billing Type|Reason. FormGrid fills
                      left-to-right/top-to-bottom in child order, so the
                      pairing above is exactly this list's order -- a hidden
                      (display:none) field drops out of grid layout entirely,
                      so the still-mounted-but-hidden fields below don't
                      disturb it. */}
                      <FormGrid columns={2} singleColumnOnMobile rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                        <LabeledField label="Sales Return Type *">
                          <FormSelect name="salesCategory" label="" placeholder="Select sales return type" options={SALES_CATEGORY_OPTIONS} />
                        </LabeledField>
                        <LabeledField label="Return No. *">
                          <DocumentSeriesNoField documentCode="SRT" seriesFieldName="seriesId" numberFieldName="returnNo" isCreate={!editingRow} />
                        </LabeledField>

                        <LabeledField label="Branch *">
                          <FormSelect name="branch" label="" placeholder="Select branch" options={branchOptions} />
                        </LabeledField>
                        <LabeledField label="Return Date *">
                          <FormDatePicker name="documentDate" label="" triggerFields={['postingDate', 'dueDate']} />
                        </LabeledField>

                        <LabeledField label="Customer *">
                          {/* showNameBelow off — this label-left layout packs
                          rows with zero vertical gap (FIELD_ROW_SPACING), so
                          PartyCodeSelect's own "name echoed below" caption had
                          no room of its own and visually ran into the very next
                          row below it. Redundant here anyway: the Name field
                          right beside it already shows the customer's name. */}
                          <PartyCodeSelect name="customer" label="" placeholder="Select customer" options={customerOptions} showNameBelow={false} />
                        </LabeledField>
                        <LabeledField label="Contact No">
                          <FormTextField name="contactPerson" label="" placeholder="Auto-filled from customer" disabled />
                        </LabeledField>

                        <LabeledField label=" Customer Name">
                          <FormTextField name="customerName" label="" placeholder="Customer name" />
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

                        <LabeledField label="Sales Person *">
                          <FormSelect name="salesPerson" label="" placeholder="Select sales person" options={preparedByOptions} />
                        </LabeledField>
                        <LabeledField label="Payment Method *">
                          <FormSelect name="salesType" label="" placeholder="Select payment method" options={SALES_TYPE_OPTIONS} />
                        </LabeledField>

                        <LabeledField label={!['Machine', 'Claims'].includes(watch('salesCategory')) ? 'Machine Serial No. *' : 'Machine Serial No.'}>
                          <MachineryCodeSelect name="machineSerialNo" label="" placeholder="Select machine serial no." businessPartnerId={machineryBusinessPartnerId} creatable={watch('salesCategory') === 'Machine'} showNameBelow={false} />
                        </LabeledField>
                        <LabeledField label="Engine No.">
                          <FormTextField name="engineNo" label="" placeholder="Enter engine no." />
                        </LabeledField>

                        {/* Bill To/Ship To are frozen, derived display fields —
                        not user-editable free text. Always the selected
                        customer's own Business Partner Billing/Shipping
                        address (see customerAddressFor above and the
                        customer-change effect below), same convention as
                        every other sales document. */}
                        <LabeledField label="Ship From">
                          <FormTextField name="billingAddress" label="" placeholder="Auto-filled from customer" multiline rows={3} disabled />
                        </LabeledField>
                        <LabeledField label="Ship To">
                          <FormTextField name="shippingAddress" label="" placeholder="Auto-filled from branch" multiline rows={3} disabled />
                        </LabeledField>

                        {/* Billing Type -- display-only, see deriveBillingType's
                        comment: no DB column on this document yet, so it's
                        shown here but stripped out of the save payload. */}
                        <LabeledField label="Billing Type">
                          <FormSelect name="billingType" label="" placeholder="Select billing type" options={BILLING_TYPE_OPTIONS} disabled />
                        </LabeledField>
                        <LabeledField label="Reason">
                          <FormTextField name="reason" label="" placeholder="Reason for the return" />
                        </LabeledField>

                        {/* Filled only by Copy From — never typed. A return's
                          challan reference has to be a despatch that actually
                          exists (the lines carry baseEntry/baseNo back to it,
                          and the remaining-quantity cap is computed from it),
                          so a free-text box could only ever produce a dangling
                          link. Left blank for a return with no despatch behind
                          it, which is now a valid return rather than a schema
                          error. */}

                        {/* Everything below here is hidden per request --
                        kept mounted (not removed) so each field's
                        defaultValue/schema wiring and any date-cascade
                        effects (triggerFields) keep working; they still
                        submit whatever value they hold, they're just not
                        shown on the form any more. */}
                        <LabeledField label="Customer PO No.">
                          <FormTextField name="customerRefNo" label="" placeholder="Enter customer PO no." />
                        </LabeledField>
                        <Box sx={{ display: 'none' }}>
                          <LabeledField label="Payment Terms">
                            <FormSelect
                              name="paymentTerms"
                              label=""
                              placeholder="Select payment terms"
                              options={PAYMENT_TERMS_OPTIONS}
                            />
                          </LabeledField>
                        </Box>
                        <Box sx={{ display: 'none' }}>
                          <LabeledField label="Posting Date">
                            <FormDatePicker name="postingDate" label="" minDate={documentDateMinDate} triggerFields={['documentDate']} />
                          </LabeledField>
                        </Box>
                        <Box sx={{ display: 'none' }}>
                          <LabeledField label="Due Date">
                            <FormDatePicker name="dueDate" label="" minDate={documentDateMinDate} triggerFields={['documentDate']} />
                          </LabeledField>
                        </Box>
                        <Box sx={{ display: 'none' }}>
                          <LabeledField label="Narration">
                            <FormTextField name="narration" label="" placeholder="Enter narration" />
                          </LabeledField>
                        </Box>
                        <Box sx={{ display: 'none' }}>
                          <LabeledField label="Comments">
                            <FormTextField name="comments" label="" placeholder="Enter comments" />
                          </LabeledField>
                        </Box>
                        <Box sx={{ display: 'none' }}>
                          <LabeledField label="Status *">
                            <FormSelect
                              name="status"
                              label=""
                              options={SALES_RETURN_STATUS_OPTIONS.map((v) => ({ label: v, value: v }))}
                            />
                          </LabeledField>
                        </Box>
                        <Box sx={{ display: 'none' }}>
                          <LabeledField label="Hypothecation">
                            <FormTextField name="hypothecation" label="" placeholder="Enter hypothecation" />
                          </LabeledField>
                        </Box>
                      </FormGrid>

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
                        <Typography variant="subtitle1" fontWeight={700}>Items</Typography>
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
                              <TableCell>UOM</TableCell>
                              {!isNonStockCategory && (
                                <TableCell>Warehouse<span style={{ color: '#d32f2f' }}> *</span></TableCell>
                              )}
                              <TableCell align="right">Delivered Qty</TableCell>
                              <TableCell align="right">Return Qty<span style={{ color: '#d32f2f' }}> *</span></TableCell>
                              <TableCell align="right">Unit Price<span style={{ color: '#d32f2f' }}> *</span></TableCell>
                              <TableCell align="right">Disc %</TableCell>
                              <TableCell align="right">Tax %</TableCell>
                              <TableCell>Batch/Serial Restock</TableCell>
                              <TableCell align="right">Amount</TableCell>
                              {!readOnly && <TableCell align="right">Action</TableCell>}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {fields.map((field, index) => {
                              // Through the shared engine rather than an inline
                              // `qty * price * (1 - disc/100)`: normaliseLine
                              // rounds the gross and the discount the same way
                              // the header totals and the server do, so the row
                              // amounts sum exactly to the subtotal shown below
                              // instead of drifting by a paisa on some lines.
                              const lineAmount = normaliseLine(
                                {
                                  returnQuantity: watch(`items.${index}.returnQuantity`),
                                  unitPrice: watch(`items.${index}.unitPrice`),
                                  discountPercent: watch(`items.${index}.discountPercent`),
                                },
                                { quantityField: 'returnQuantity' }
                              ).amount;
                              return (
                                <TableRow key={field.id}>
                                  <TableCell>{index + 1}</TableCell>
                                  <TableCell>
                                    <ProductCell index={index} methods={methods} options={productCodeOptions} products={products} priceListRates={priceListRates} placeholder="Select product code" />
                                  </TableCell>
                                  <TableCell>
                                    <ProductCell index={index} methods={methods} options={productNameOptions} products={products} priceListRates={priceListRates} placeholder="Select product name" />
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
                                    <FormTextField name={`items.${index}.deliveredQuantity`} label="" type="number" disabled />
                                  </TableCell>
                                  <TableCell sx={{ minWidth: 120 }}>
                                    {/* returnQuantity — the name the schema, the
                                      totals engine and the server all use. It
                                      was `quantity` here, so nothing that
                                      mattered ever saw what was typed. */}
                                    <FormTextField name={`items.${index}.returnQuantity`} label="" type="number" />
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
                                  <TableCell sx={{ minWidth: 140 }}>
                                    <BatchSerialCell index={index} methods={methods} product={productsByCode[watch(`items.${index}.productCode`)]} quantityField="returnQuantity" onOpen={(mode) => setBatchDialog({ index, mode })} />
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

                  {batchDialog && batchDialog.index < fields.length && (
                    <BatchSerialRestockDialog
                      open
                      onClose={() => setBatchDialog(null)}
                      mode={batchDialog.mode}
                      readOnly={readOnly}
                      docNo={editingRow?.returnNo}
                      itemNumber={watch(`items.${batchDialog.index}.productCode`)}
                      itemDescription={watch(`items.${batchDialog.index}.productName`)}
                      warehouseCode={watch('warehouse')}
                      warehouseName={warehouseLabel((warehouses || []).find((w) => w.whsCode === watch('warehouse')))}
                      totalNeeded={Number(watch(`items.${batchDialog.index}.returnQuantity`)) || 0}
                      productCode={watch(`items.${batchDialog.index}.productCode`)}
                      value={watch(`items.${batchDialog.index}.${batchDialog.mode === 'Batch' ? 'batchAllocations' : 'serialAllocations'}`)}
                      onSave={(rows) => setValue(
                        `items.${batchDialog.index}.${batchDialog.mode === 'Batch' ? 'batchAllocations' : 'serialAllocations'}`,
                        rows,
                        { shouldValidate: true }
                      )}
                    />
                  )}

                  {/* Terms, attachments and the money panel — the same footer the
                    other sales documents carry, so a return reads and prints
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
                        <CopyToButton
                          sourceType="salesReturn"
                          sourceDoc={editingRow}
                          sourceLabel="Sales Return"
                          docNoField="returnNo"
                          targets={[
                            { key: 'salesInvoice', label: 'Sales Invoice', path: '/sales/invoice' },
                          ]}
                        />
                        {/* Copy From sits immediately left of Cancel and stays
                          disabled until a Customer is chosen — the dialog it
                          opens lists that customer's deliveries, so with no
                          customer there is nothing for it to show. Hidden in
                          view mode, where nothing is being filled in. */}
                        {!readOnly && (
                          challanNo ? (
                            <Button
                              fullWidth={isMobile}
                              type="button"
                              variant="outlined"
                              color="inherit"
                              startIcon={<CloseIcon />}
                              onClick={clearChallan}
                              disabled={creating || updating}
                            >
                              Clear Copied Challan
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
                        <Button fullWidth={isMobile} type="button" variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => window.print()}>
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
                          {editingRow ? 'Update Return' : 'Save Return'}
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
                    templateUrl="/sales/returns/items-import/template"
                    importUrl="/sales/returns/items-import"
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
              <Typography variant="subtitle1" fontWeight={700}>Sales Return List</Typography>
              <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="center">
                <TableSearchFilter table={table} placeholder="Search by return no., challan, customer..." />
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
                      Add Return
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
                    title={row.returnNo}
                    statusChip={<Chip size="small" label={row.status} variant="outlined" />}
                    fields={[
                      { label: 'Challan No.', value: row.challanNo },
                      { label: 'Customer', value: row.customer },
                      { label: 'Amount', value: money(row.amount) },
                    ]}
                    onView={() => handleView(row)}
                    // Cancelled returns are fully locked — no Edit/Delete/
                    // Cancel action once isCancelled is true, only the
                    // status chip above shows "Cancelled".
                    onEdit={row.isCancelled ? undefined : () => handleEdit(row)}
                    onDelete={row.isCancelled ? undefined : () => handleDelete(row)}
                    extraActions={row.isCancelled ? [] : [
                      { key: 'cancel', label: 'Cancel', icon: <CancelOutlinedIcon fontSize="small" />, color: 'warning', onClick: () => handleCancel(row) },
                    ]}
                  />
                ))}
                {!isLoading && visibleRows.length === 0 && (
                  <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No returns yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first return to get started'} />
                )}
              </Box>
            ) : (
              <ScrollableTableContainer>
                <Table
                  size="small"
                  stickyHeader
                  sx={{
                    '& th, & td': {
                      height: SALES_RETURN_LIST_TABLE_ROW_HEIGHT,
                      paddingTop: `${SALES_RETURN_LIST_TABLE_CELL_PADDING_Y}px`,
                      paddingBottom: `${SALES_RETURN_LIST_TABLE_CELL_PADDING_Y}px`,
                      boxSizing: 'border-box',
                    },
                  }}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell width={48}>#</TableCell>
                      <SortableHeaderCell field="returnNo" sort={table.sort} onSort={table.toggleSort}>Return No.</SortableHeaderCell>
                      <SortableHeaderCell field="challanNo" sort={table.sort} onSort={table.toggleSort}>Challan No.</SortableHeaderCell>
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
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.returnNo}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.challanNo || '—'}</TableCell>
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
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <IconButton size="small" onClick={() => handleView(row)} aria-label="view">
                              <VisibilityOutlinedIcon fontSize="small" />
                            </IconButton>
                            <Tooltip title="Print">
                              <IconButton size="small" onClick={() => handlePrint(row)} aria-label="print">
                                <PrintOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <RouteMapButton flow="sales" type="return" docNo={row.returnNo} />
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
                          </Stack>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!isLoading && visibleRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9}>
                          <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No returns yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first return to get started'} />
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
        resourceName="Sales Returns"
        templateUrl="/sales/returns/bulk-import/template"
        importUrl="/sales/returns/bulk-import"
        onImported={refetchReturns}
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
// deliveredQuantity:
// on a return that figure is what the source Delivery Challan recorded, not
// anything the product master knows, and the Return Qty validation is
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

// Shows nothing for a None-tracked (or unrecognised) product — the column
// only means something once Product Master's Manage Item By is Batch or
// Serial for the row's selected product. Otherwise a button that opens the
// matching "... - Restock" dialog, labelled with how much of the line is
// selected so far. Mirrors PurchaseReturn.jsx's BatchSerialCell.
function BatchSerialCell({ index, methods, product, quantityField = 'quantity', onOpen }) {
  const { watch } = methods;
  const trackingMode = product?.manageItemBy;
  if (trackingMode !== 'Batch' && trackingMode !== 'Serial') {
    return <Typography variant="caption" color="text.secondary">—</Typography>;
  }
  const needed = Number(watch(`items.${index}.${quantityField}`)) || 0;
  const batchAllocations = watch(`items.${index}.batchAllocations`) || [];
  const serialAllocations = watch(`items.${index}.serialAllocations`) || [];
  const selected = trackingMode === 'Batch'
    ? batchAllocations.reduce((sum, b) => sum + (Number(b.quantity) || 0), 0)
    : serialAllocations.length;
  const complete = needed > 0 && Math.abs(selected - needed) < 0.005;

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
      {trackingMode}: {selected}/{needed}
    </Button>
  );
}
