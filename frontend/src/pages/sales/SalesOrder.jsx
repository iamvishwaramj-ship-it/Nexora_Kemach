import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatPartnerAddress, cleanAddressText } from '../../lib/addressFormat';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import {
  Box, Typography, Button, Card, CardContent, Stack, TextField, InputAdornment, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton, Menu, MenuItem,
  ListItemIcon, ListItemText, Checkbox, Autocomplete, Popover, Grid, Tooltip,
  Collapse, CircularProgress,
} from '@mui/material';
import { useFieldArray } from 'react-hook-form';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import usePriceListRates from '../../hooks/usePriceListRates';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
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
import { salesOrderSchema, ORDER_STATUS_OPTIONS, ORDER_PAYMENT_STATUS_OPTIONS, ENQUIRY_SOURCE_OPTIONS } from '../../lib/validation/salesSchemas';
import { isNonStockSalesCategory } from '../../lib/validation/common';
import { buildDocument, round2, isInterState, computeFreightGross, computeItemDiscountTotal } from '../../lib/documentTotals';
import DocumentTotalsPanel from '../../components/form/DocumentTotalsPanel';
import { PAYMENT_TERMS_OPTIONS } from '../../lib/validation/partnerSchemas';
import { useCurrencyOptions } from '../../lib/currencyOptions';
import { salesOrderApi, salesQuotationApi, deliveryChallanApi, salesInvoiceApi, customerApi, supplierApi, productApi, salesEmployeeApi, taxCodeApi, houseBankApi } from '../../features/resources';
import { useBranchNameOptions } from '../../lib/useBranchOptions';
import { useWarehouseOptions, warehouseCodesForBranch } from '../../lib/useWarehouseOptions';
import { productOptionsFor, PRODUCT_USAGE } from '../../lib/productUsage';
import { buildTaxCodeOptions, taxTypeFamilyFor, pickDefaultTaxCode, withDefaultTaxCode } from '../../lib/taxCodeOptions';
import { itemTableSx } from '../../lib/columnWidth';
import { useGetCompanyDetailsQuery, usePeekDocumentNumberMutation } from '../../features/company/companyDetailsApi';
import { peekNextDocumentNumber } from '../../components/form/DocumentNoField';
import DocumentSeriesNoField from '../../components/form/DocumentSeriesNoField';
import SalesOrderPrintable, { printSalesOrder } from '../../components/print/SalesOrderPrintable';
import useServerListTable from '../../components/data-display/useServerListTable';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer, { dragScrollbarSx } from '../../components/data-display/ScrollableTableContainer';

import { CanAdd, CanEdit, CanDelete, CanCancel } from '../../components/common/PermissionGate';
import BulkImportDialog from '../../components/common/BulkImportDialog';
import ImportItemsDialog from '../../components/common/ImportItemsDialog';
import { canDelete } from '../../config/deleteConfig';
import { canDuplicate } from '../../config/duplicateConfig';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';
import RouteMapButton from '../../components/common/RouteMapButton';
import RouteMapContextMenu from '../../components/common/RouteMapContextMenu';
import CopyFromDocumentDialog from '../../components/common/CopyFromDocumentDialog';
import CopyToButton from '../../components/common/CopyToButton';
import { useDispatch, useSelector } from 'react-redux';
import { selectCurrentUser } from '../../store/authSlice';
import { clearCopyIntent } from '../../store/copyIntentSlice';
import SmartAddHistoryDialog from '../../components/common/SmartAddHistoryDialog';
import BoltIcon from '@mui/icons-material/Bolt';

// Columns for the "Find Sales Quotation" dialog opened by Copy From. A sales
// quotation names its party `customer`, which is what the dialog filters on.
const QUOTATION_COPY_COLUMNS = [
  { field: 'quotationNo', headerName: 'Quotation No', nowrap: true },
  { field: 'customer', headerName: 'Customer Name' },
  { field: 'quotationDate', headerName: 'Document Date', type: 'date' },
  { field: 'status', headerName: 'Status' },
];
// warehouse: '' — no header warehouse exists on an order to seed this from
// (SalesOrder never posts stock), so a new row starts blank until picked.
// See salesOrderItemSchema in lib/validation/salesSchemas.js.
const emptyItem = { productCode: '', productName: '', description: '', hsnCode: '', uom: '', quantity: 1, unitPrice: 0, discountPercent: 0, taxPercent: 18, taxCodeId: null, warehouse: '' };

// "Other Details" classification fields — fixed-option (CFL-style) selects,
// not free text. Reuses the exact same vocabulary AND same field set as
// Purchase Order's own "Other Details" section (see PurchaseOrder.jsx):
// Billing Type, Purchase Type, Type of Purchase, Payment Method, Vehicle
// Type, Transport Mode.
const BILLING_TYPE_OPTIONS = ['B2B', 'B2C'].map((v) => ({ label: v, value: v }));
const SALES_TYPE_OPTIONS = ['UPI', 'NEFT', 'CASH', 'CHECK', 'DEBIT/CREDIT CARD'].map((v) => ({ label: v, value: v }));
const TYPE_OF_PURCHASE_OPTIONS = [
  'Breakdown with Warranty', 'Stock Order', 'Machine Order', 'Non Warranty Order',
  'Branch Transfer', 'Services', 'Standard Priority Order', 'Sales', 'Admin',
].map((v) => ({ label: v, value: v }));
const SALES_CATEGORY_OPTIONS = ['Parts', 'Machine', 'Services', 'Claims'].map((v) => ({ label: v, value: v }));
const VEHICLE_TYPE_OPTIONS = ['Rented', 'Owned'].map((v) => ({ label: v, value: v }));
const TRANSPORT_MODE_OPTIONS = ['Road', 'Air', 'Rail', 'Ship'].map((v) => ({ label: v, value: v }));

// Best-effort reverse lookup for rows saved before taxCodeId existed (or a
// row whose Tax Code was since made Inactive/retired): picks the first
// active Tax Code with a matching rate so the field isn't just left blank.
// If more than one active code shares that rate, which one comes back here
// is genuinely a guess — see the schema.prisma comment on
// SalesOrderItem.taxCodeId; it can't be resolved retroactively for a line
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

// Bill To/Ship To are frozen, derived display fields — not user-editable
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
    orderNo: '', seriesId: '', branch: '', quotationNo: '', customer: '', supplier: '', contactPerson: '', phone: '', email: '', machineryCode: '', gstNo: '',
    // Delivery Date is required but no longer has a visible field on this
    // form — defaults to Order Date + 7 days, same idea as Sales
    // Quotation's Valid Till default, so the form still submits.
    orderDate: new Date(), deliveryDate: dayjs().add(7, 'day').toDate(), referenceNo: '', customerRefNo: '',
    currency: 'INR', paymentTerms: '', salesPerson: '', source: '', receiver: '', receiverPhone: '', billingAddress: '', shippingAddress: '', shipToDifferentCustomer: false, shipToCustomer: '', billToDifferentCustomer: false, billToCustomer: '', billToGstNo: '', billToGstType: '', billToPanNo: '', shipToGstNo: '', shipToGstType: '', shipToPanNo: '', deliveryAddress: '',
    termsConditions: '', preparedBy: preparedBy || '', approvedBy: '', attachmentName: '', remarks: '', discountPercent: 0, status: 'Draft', paymentStatus: 'Unpaid', invoiceNo: '',
    // "Other Details" classification fields — see the constants above.
    billingType: '', typeOfPurchase: '', salesType: '', salesCategory: 'Parts', vehicleType: '', transportMode: '', invoiceType: '',
    // Road Tax (manual entry on this document, unlike Sales Quotation's own
    // auto-computed 8.2%, gated by the roadTaxApplicable Yes/No checkbox)
    // and Freight Charges — see FreightChargesEditor. freightGrossAmount is
    // kept in sync live by that component.
    roadTax: 0,
    roadTaxApplicable: false,
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
// `grandTotal` and `discount` are kept in the returned shape because the
// totals panel below reads those names.
// `interState` must be passed through rather than defaulted: the server
// decides CGST/SGST vs IGST by comparing this document's Place of Supply
// against the company's registered state, and for a long time no page passed
// the flag at all — so an inter-state document displayed a CGST/SGST split
// while the record it saved held IGST.
//
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
// computeSalesOrderTotals.
function computeTotals(items, discountPercent, interState = false, extraCharges = {}) {
  const { totals } = buildDocument(items, discountPercent, {
    interState,
    roundOff: true,
  });
  const roadTax = extraCharges.roadTaxApplicable ? round2(Number(extraCharges.roadTax) || 0) : 0;
  const freightGrossAmount = computeFreightGross(extraCharges.freightNetAmount, extraCharges.freightTaxAmount);
  // totals.amount / totals.roundOff come out of the shared engine before it
  // knows about Road Tax, which is layered on afterward here. Adding a
  // fractional roadTax back onto an already whole-number-rounded amount can
  // reintroduce cents into the Grand Total, so we do a second rounding pass
  // here and fold its delta into the Round Off figure the totals panel shows,
  // so the displayed Round Off always reconciles with the Grand Total.
  const preRoundWithRoadTax = round2(totals.amount + roadTax);
  const amountWithRoadTax = Math.round(preRoundWithRoadTax);
  const additionalRoundOff = round2(amountWithRoadTax - preRoundWithRoadTax);
  const combinedRoundOff = round2((totals.roundOff || 0) + additionalRoundOff);
  return {
    ...totals,
    discount: computeItemDiscountTotal(items),
    roadTax,
    freightGrossAmount,
    roundOff: combinedRoundOff,
    grandTotal: round2(amountWithRoadTax + freightGrossAmount),
  };
}

function rowToFormValues(row, taxCodes) {
  const taxCodeIdByRate = buildTaxCodeIdByRate(taxCodes);
  return {
    customerState: row.customerState || '',
    orderNo: row.orderNo, seriesId: '', branch: row.branch || '', quotationNo: row.quotationNo || '', customer: row.customer || '', supplier: row.supplier || '', contactPerson: row.contactPerson || '',
    machineryCode: row.machineryCode || '', gstNo: row.gstNo || '',
    phone: row.phone || '', email: row.email || '',
    orderDate: row.orderDate, deliveryDate: row.deliveryDate, referenceNo: row.referenceNo || '', customerRefNo: row.customerRefNo || row.referenceNo || '',
    currency: row.currency || 'INR', paymentTerms: row.paymentTerms || '', salesPerson: row.salesPerson || '',
    source: row.source || '',
    receiver: row.receiver || '', receiverPhone: row.receiverPhone || '',
    billingAddress: cleanAddressText(row.billingAddress), shippingAddress: cleanAddressText(row.shippingAddress || row.deliveryAddress), shipToDifferentCustomer: !!row.shipToDifferentCustomer, shipToCustomer: row.shipToCustomer || '', billToDifferentCustomer: false, billToCustomer: '', billToGstNo: row.billToGstNo || '', billToGstType: row.billToGstType || '', billToPanNo: row.billToPanNo || '', shipToGstNo: row.shipToGstNo || '', shipToGstType: row.shipToGstType || '', shipToPanNo: row.shipToPanNo || '', deliveryAddress: cleanAddressText(row.deliveryAddress || row.shippingAddress),
    termsConditions: row.termsConditions || '', preparedBy: row.preparedBy || '', approvedBy: row.approvedBy || '', attachmentName: row.attachmentName || '', remarks: row.remarks || '',
    discountPercent: row.discountPercent != null ? Number(row.discountPercent) : 0,
    status: row.status || 'Draft', paymentStatus: row.paymentStatus || 'Unpaid', invoiceNo: row.invoiceNo || '',
    billingType: row.billingType || '', typeOfPurchase: row.typeOfPurchase || '',
    salesType: row.salesType || '', salesCategory: row.salesCategory || 'Parts', vehicleType: row.vehicleType || '', transportMode: row.transportMode || '', invoiceType: row.invoiceType || '',
    machineSerialNo: row.machineSerialNo || '', engineNo: row.engineNo || '', hypothecation: row.hypothecation || '',
    roadTax: row.roadTax != null ? Number(row.roadTax) : 0,
    roadTaxApplicable: !!row.roadTaxApplicable,
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
      // No header warehouse to fall back to on this document — see emptyItem.
      warehouse: i.warehouse || '',
    })),
  };
}

const PAGE_SIZE = 10;
const STATUS_FILTERS = ['All Status', ...ORDER_STATUS_OPTIONS];
const PAYMENT_STATUS_FILTERS = ['All', ...ORDER_PAYMENT_STATUS_OPTIONS];

const STATUS_COLORS = { Draft: 'default', Confirmed: 'success', Pending: 'warning', Shipped: 'info', Delivered: 'success', Cancelled: 'error' };
const PAYMENT_STATUS_COLORS = { Unpaid: 'error', 'Partially Paid': 'warning', Paid: 'success' };

const SALES_ORDER_LIST_TABLE_ROW_HEIGHT = 0;
const SALES_ORDER_LIST_TABLE_CELL_PADDING_Y = 6;
export default function SalesOrder({ openDocNo } = {}) {
  const currentUser = useSelector(selectCurrentUser);
  // Every currency dropdown reads live from Currency Master instead of a
  // hardcoded list — see lib/currencyOptions.js.
  const currencyOptions = useCurrencyOptions();
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const itemScrollRef = useDragScroll();
  // Phase 6 of the data-loading performance work (pure data-access, no
  // business-logic change) — this list now fetches ONE page at a time via
  // salesOrderApi.useListPaged (see useServerListTable below and the
  // paginatedFindMany-based /sales/orders route in
  // backend/src/routes/resources.js), instead of the whole order table
  // (which, on live data, was tens of thousands of rows with full item
  // includes on every mount). `orders`/`isLoading`/`refetchOrders` are gone;
  // the loaded page lives in `table.rows`, refetch is `refetchOrders` below.
  //
  // ordersForHistory/quotations/challans/invoices below stay on `.useList()`
  // — they feed cross-document lookups (Smart Add History, Copy From) that
  // need to see records across the whole set, not one page — but that call
  // is itself now capped server-side (see paginatedFindMany's
  // `maxPageSize`) instead of genuinely unbounded.
  const { data: ordersForHistory } = salesOrderApi.useList();
  const { data: quotations } = salesQuotationApi.useList();
  const { data: challans } = deliveryChallanApi.useList();
  const { data: invoices } = salesInvoiceApi.useList();
  const allSalesDocuments = useMemo(
    () => [
      ...(quotations || []),
      ...(ordersForHistory || []),
      ...(challans || []),
      ...(invoices || []),
    ],
    [quotations, ordersForHistory, challans, invoices]
  );
  // A Quotation already marked Closed has nothing left to copy forward, so
  // it's dropped from the Copy From dialog's pickable list.
  const copyableQuotations = useMemo(
    () => (quotations || []).filter((q) => q.status !== 'Closed' && q.status !== 'Cancelled'),
    [quotations]
  );
  const { data: customers } = customerApi.useList();
  // Supplier (Business Partner / Vendor) chosen so their logo can be printed
  // alongside the KEMACH logo — see SalesQuotation.jsx's own Supplier field.
  const { data: suppliers } = supplierApi.useList();
  const { data: products } = productApi.useList({ view: 'picker' });
  const { rates: priceListRates } = usePriceListRates('CLP');
  const { data: salesEmployees } = salesEmployeeApi.useList();
  const { data: taxCodes } = taxCodeApi.useList();
  // A brand-new item row's Tax (%) CFL defaults to this Tax Code instead of
  // showing empty — see pickDefaultTaxCode's own doc comment.
  const defaultTaxCode = useMemo(() => pickDefaultTaxCode(taxCodes), [taxCodes]);
  // Without this, SalesOrderPrintable's houseBank prop is always undefined
  // and the Bank Name/Branch/A/c No/IFSC/Type fields print blank — same fix
  // already applied on SalesQuotation.jsx/SalesInvoice.jsx.
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
  // the schema.prisma comment on SalesOrderItem.taxCodeId, and
  // buildTaxCodeOptions in taxCodeOptions.js).
  const taxCodeOptions = useMemo(() => buildTaxCodeOptions(taxCodes), [taxCodes]);
  // Tax (%) shows the tax code's own NAME in the closed field, which runs
  // well past the bare rate the row stores — so the item table sizes that
  // column from the rendered label it finds here, not from the raw number.
  const taxCodeById = useMemo(() => new Map(taxCodeOptions.map((o) => [o.value, o])), [taxCodeOptions]);
  const { data: company } = useGetCompanyDetailsQuery();
  const [create, { isLoading: creating }] = salesOrderApi.useCreate();
  const [update, { isLoading: updating }] = salesOrderApi.useUpdate();
  const [remove] = salesOrderApi.useDelete();
  const [cancelOrder] = salesOrderApi.useCancel();
  const [peekDocumentNumber] = usePeekDocumentNumberMutation();

  const customerOptions = (customers || []).map((c) => ({ label: c.customerName, value: c.customerName }));
  // Create/edit form's Customer field only (the shared PartyCodeSelect) —
  // shows Code/Name, value stays the customer name. The list-view filter
  // keeps using customerOptions (names) unchanged.
  // Memoized so typing in the form doesn't rebuild a fresh options array
  // (and fresh option objects) on every keystroke, which was racing
  // Autocomplete's own filtered/highlighted state and intermittently
  // showing stale/unrelated rows while typing quickly.
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
  const salesPersonOptions = (salesEmployees || []).map((s) => ({ label: s.employeeName, value: s.employeeName }));
  // Prepared By lists every Sales Employee; Approved By is scoped to the
  // ones flagged with approval authorization on the Sales Employee master.
  const approvedByOptions = (salesEmployees || []).filter((s) => s.approvalAuthorization === true).map((s) => ({ label: s.employeeName, value: s.employeeName }));
  // Quotations are no longer offered as a dropdown on the form — they are
  // picked through the Copy From dialog, which scopes the list to the selected
  // customer. The raw `quotations` list is what that dialog takes.
  const sourceOptions = ENQUIRY_SOURCE_OPTIONS.map((s) => ({ label: s, value: s }));

  // View toggles between the order list and the full-page Create/Edit
  // form — same page, no dialog/popup, per the standard CRUD page template.
  const [view, setView] = useState('list');
  const [editingRow, setEditingRow] = useState(null);
  const { options: branchOptions, branches } = useBranchNameOptions({ currentValue: editingRow?.branch });

  // selectableProducts/productCodeOptions/productNameOptions used to live
  // here, computed from editingRow?.items — a static snapshot that only
  // reflected the record's lines as of page load. That went stale the moment
  // Copy From replaced the items array with a different document's lines, so
  // it's now computed live inside AppForm's render prop instead, keyed off
  // watchedItems (the form's actual current rows).
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  // Copy From ("Find Sales Quotation") dialog. Held at page level rather than
  // inside AppForm's render prop so remounting the form on formKey change
  // can't leave a dialog orphaned open over a freshly reset form.
  const [copyFromOpen, setCopyFromOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [dateAnchor, setDateAnchor] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [checkedIds, setCheckedIds] = useState([]);
  const [rowMenuAnchor, setRowMenuAnchor] = useState(null);
  const [rowMenuTarget, setRowMenuTarget] = useState(null);
  const pendingStatusRef = useRef(null);

  // Column definitions drive the global search, the sort icons and the
  // per-column filter popover — see useServerListTable.js. `server: true`
  // pushes that column's sort/filter to the /sales/orders route (see its
  // SALES_ORDER_FILTER_SPEC/SALES_ORDER_SORT_FIELDS in
  // backend/src/routes/resources.js) instead of applying it only to
  // whatever page happens to already be loaded. The Customer/Status/Sales
  // Person/Payment Status Autocomplete row below (the page's own bespoke
  // filter UI) writes into this SAME `table.filters` state via
  // `table.setFilter` — one filter engine, two widgets, so neither can
  // silently disagree with the other about what "filtered" means.
  const tableColumns = useMemo(() => ([
    { field: 'id', headerName: 'Select', filter: false, searchable: false },
    { field: 'orderNo', headerName: 'Order No.', filter: 'text', server: true },
    { field: 'orderDate', headerName: 'Order Date', filter: 'dateRange', server: true, sortValue: (row) => (row.orderDate ? new Date(row.orderDate).getTime() : null) },
    { field: 'customer', headerName: 'Customer', filter: 'text', server: true },
    { field: 'deliveryDate', headerName: 'Delivery Date', filter: 'dateRange', server: true, sortValue: (row) => (row.deliveryDate ? new Date(row.deliveryDate).getTime() : null) },
    { field: 'amount', headerName: 'Amount (₹)', filter: 'numberRange', server: true, sortValue: (row) => (row.amount == null || row.amount === '' ? null : Number(row.amount)) },
    { field: 'status', headerName: 'Status', filter: 'select', server: true },
    { field: 'paymentStatus', headerName: 'Payment Status', filter: 'select', server: true },
    // Not a rendered column (`filter: false` keeps it out of the generic
    // filter panel) — exists only so the Sales Person Autocomplete below has
    // a `server: true` slot to write into via table.setFilter, the same way
    // it does for Customer/Status/Payment Status above.
    { field: 'salesPerson', headerName: 'Sales Person', filter: false, server: true },
  ]), []);
  const table = useServerListTable(salesOrderApi.useListPaged, {
    columns: tableColumns,
    initialPageSize: PAGE_SIZE,
  });
  const { page, setPage, pageSize, setPageSize } = table;
  const rows = table.rows;
  const filteredRows = rows;
  const pagedRows = rows;
  const isLoading = table.isLoading;
  const refetchOrders = table.refetch;

  const customerFilter = table.filters.customer ? { value: table.filters.customer } : null;
  const setCustomerFilter = (v) => table.setFilter('customer', v?.value || '');
  const statusFilter = table.filters.status || 'All Status';
  const setStatusFilter = (v) => table.setFilter('status', v === 'All Status' ? '' : v);
  const salesPersonFilter = table.filters.salesPerson ? { value: table.filters.salesPerson } : null;
  const setSalesPersonFilter = (v) => table.setFilter('salesPerson', v?.value || '');
  const paymentStatusFilter = table.filters.paymentStatus || 'All';
  const setPaymentStatusFilter = (v) => table.setFilter('paymentStatus', v === 'All' ? '' : v);
  const orderDateFilter = table.filters.orderDate || {};
  const dateFrom = orderDateFilter.from ? dayjs(orderDateFilter.from) : null;
  const dateTo = orderDateFilter.to ? dayjs(orderDateFilter.to) : null;
  const setDateFrom = (v) => table.setFilter('orderDate', { ...orderDateFilter, from: v ? v.format('YYYY-MM-DD') : '' });
  const setDateTo = (v) => table.setFilter('orderDate', { ...orderDateFilter, to: v ? v.format('YYYY-MM-DD') : '' });

  // checkedIds used to be pruned here against every loaded order so a row
  // deleted out from under a checked box (elsewhere, or by another
  // tab/user) couldn't leave "Delete Selected (N)" counting an id that no
  // longer exists. Only ONE page of orders is loaded at a time now (see the
  // Phase 6 comment above), so that same prune can no longer tell "gone"
  // apart from "just not on this page" — pruning against the loaded page
  // would wipe out a selection made on a page the user has since navigated
  // away from. Left unpruned; removeSelected already deletes one id at a
  // time and reports per-row failures, so a stale id here surfaces as a
  // normal "not found" error on that one row instead of a crash.

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
    setCopyFromOpen(false);
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
    if (editingRow && editingRow.orderNo === openDocNo) return;
    const match = rows.find((r) => r.orderNo === openDocNo);
    if (match) handleView(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDocNo, rows]);

  // "Copy To > Sales Order" from a Sales Quotation lands the browser on this
  // page's route, but that alone used to leave the user staring at the LIST
  // view — the intent-consuming effect that actually applies the quotation's
  // data lives inside AppForm's render prop below, which only mounts once
  // `view` is 'form', so nothing happened until the user clicked "+ Add New"
  // themselves first. This mirrors the openDocNo effect just above: notice a
  // pending intent addressed to this page on arrival and open the create
  // form immediately, so the user lands straight on a pre-filled order.
  const pendingCopyIntentForAutoOpen = useSelector((s) => s.copyIntent.pending);
  useEffect(() => {
    if (!pendingCopyIntentForAutoOpen || pendingCopyIntentForAutoOpen.targetKey !== 'salesOrder') return;
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

  // See SalesQuotation.jsx's identical fix for the full reasoning: a fixed
  // setTimeout(..., 300) risked firing window.print() before editingRow
  // actually became THIS row, printing whatever document was previously on
  // screen instead. printRequestOrderNo + the effect below wait for
  // editingRow to actually match the row that was clicked.
  const [printRequestOrderNo, setPrintRequestOrderNo] = useState(null);

  const handlePrint = (row) => {
    setRowMenuAnchor(null);
    handleView(row);
    setPrintRequestOrderNo(row.orderNo);
  };

  useEffect(() => {
    if (!printRequestOrderNo) return;
    if (!editingRow || editingRow.orderNo !== printRequestOrderNo) return;
    setPrintRequestOrderNo(null);
    printSalesOrder();
  }, [printRequestOrderNo, editingRow]);

  const handleDuplicate = async (row) => {
    const orderNo = await peekNextDocumentNumber(peekDocumentNumber, 'SO', notify);
    const payload = { ...rowToFormValues(row, taxCodes), orderNo, status: 'Draft', paymentStatus: 'Unpaid' };
    try {
      await create(payload).unwrap();
      notify.success('Order duplicated as a new draft');
    } catch (err) {
      notify.error(err?.data?.message || 'Duplicate failed');
    }
  };

  const handleDelete = async (row) => {
    setRowMenuAnchor(null);
    const ok = await confirmDialog({
      title: 'Delete order',
      message: `Are you sure you want to delete "${row.orderNo}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Order deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  // Cancel — a soft alternative to Delete: the order stays in the list
  // (status becomes "Cancelled") and is dropped from the Delivery Challan /
  // Invoice Copy From pickers; View/Edit/Delete/Cancel get blocked for it
  // below once isCancelled is true. A Sales Order is a non-posting document,
  // so there is no journal entry or stock to reverse — the backend (PATCH
  // /sales/orders/:id/cancel) just refuses while a live challan or invoice
  // still references it, and reopens the source quotation otherwise.
  const handleCancel = async (row) => {
    setRowMenuAnchor(null);
    const ok = await confirmDialog({
      title: 'Cancel sales order',
      message: `Are you sure you want to cancel "${row.orderNo}"? This cannot be undone — the order will be locked and hidden from Delivery Challan/Invoice creation.`,
      confirmLabel: 'Cancel Order',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await cancelOrder(row.id).unwrap();
      notify.success('Sales order cancelled');
    } catch (err) {
      notify.error(err?.data?.message || 'Cancel failed');
    }
  };

  const removeSelected = async () => {
    const ids = checkedIds;
    const ok = await confirmDialog({
      title: 'Delete selected orders',
      message: `Delete ${ids.length} selected order${ids.length > 1 ? 's' : ''}? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;

    // One at a time, not Promise.all. Two orders raised from the same Sales
    // Quotation each go through recomputeSalesQuotationStatus on delete,
    // which reads then updates that ONE quotation row — firing every
    // selected order's delete at once let those transactions race and the
    // database resolve it as a deadlock, which is what surfaced as some
    // requests in a multi-select coming back 200 and others 500 seemingly
    // at random. Serializing removes the race instead of just retrying
    // around it; see errorHandler.js's P2034/deadlock handling for the
    // remaining case where two deletes from two different users still
    // collide.
    const failed = [];
    for (const id of ids) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await remove(id).unwrap();
      } catch (err) {
        failed.push({ id, message: err?.data?.message || 'Delete failed' });
      }
    }

    // Only drop the ones that actually went — a failed id stays checked so
    // the user can see what didn't delete and retry just those, instead of
    // losing the selection and having to hunt them down again.
    const failedIds = new Set(failed.map((f) => f.id));
    setCheckedIds((prev) => prev.filter((id) => failedIds.has(id)));

    const succeededCount = ids.length - failed.length;
    if (failed.length === 0) {
      notify.success(`${succeededCount} selected order${succeededCount > 1 ? 's' : ''} deleted`);
    } else if (succeededCount === 0) {
      notify.error(`Could not delete the selected order${ids.length > 1 ? 's' : ''}: ${failed[0].message}`);
    } else {
      notify.error(`${succeededCount} of ${ids.length} deleted. ${failed.length} failed and ${failed.length > 1 ? 'remain' : 'remains'} selected: ${failed[0].message}`);
    }
  };

  const handleSubmit = async (values, formMethods) => {
    // "Save as Draft" is a shortcut that forces Draft. The main Save/Update
    // button does NOT force a status — it used to always set 'Confirmed',
    // which silently downgraded an already Partially Delivered / Closed
    // order back to Confirmed on every edit, even one that only changed an
    // unrelated field (status here is mostly system-derived — see
    // recomputeSalesOrder). Falling back to values.status just keeps
    // whatever the record's current status already is.
    const payload = {
      ...values,
      status: pendingStatusRef.current || values.status,
      deliveryAddress: values.shippingAddress || values.deliveryAddress || '',
    };
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...payload }).unwrap();
        notify.success('Order updated');
      } else {
        await create(payload).unwrap();
        notify.success('Order saved');
      }
      backToList();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  const dateRangeLabel = dateFrom && dateTo
    ? `${dateFrom.format('DD/MM/YYYY')} - ${dateTo.format('DD/MM/YYYY')}`
    : 'Select date range';

  if (openDocNo && (!editingRow || editingRow.orderNo !== openDocNo)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box>
      <EntityHeaderCard
        icon={<ShoppingCartOutlinedIcon />}
        title="Sales Order"
        subtitle={view === 'form' ? 'Create a new sales order.' : 'Manage and track all sales orders.'}
        rightContent={<CompanyBadge />}
      />

      {view === 'form' ? (
        <RouteMapContextMenu flow="sales" type="order" docNo={editingRow?.orderNo}>
          <AppForm
            key={formKey}
            schema={salesOrderSchema}
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
              // A Sales Quotation's own "Copy To > Sales Order" button writes a
              // pending intent here; the effect right before this render-prop's
              // return() below notices it and runs applyQuotation (the exact
              // same function this page's own "Copy From" already uses).
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
                  warehouse: raw.warehouse || (''),
                };
              };
              const handleItemsImported = (rawItems) => {
                append(rawItems.map(resolveImportedItem));
              };

              const handleSmartAddImport = (selectedItems) => {
                const currentItems = watch('items') || [];
                const isFirstItemEmpty = currentItems.length === 1 && !currentItems[0].productCode && !currentItems[0].productName;
                
                const mappedItems = selectedItems.map((item)=>({
                  ...emptyItem,
                  productCode: item.productCode || '',
                  productName: item.productName || '',
                  description: item.description || item.productName || '',
                  hsnCode: item.hsnCode || '',
                  uom: item.uom || '',
                  quantity: Number(item.quantity) || 1,
                  unitPrice: Number(item.unitPrice) || 0,
                  discountPercent: Number(item.discountPercent) || 0,
                  taxCodeId: item.taxCodeId || null,
                  taxPercent: Number(item.taxPercent) || 18
                }));

                if(isFirstItemEmpty) {
                  replaceItems(mappedItems);
                } else {
                  mappedItems.forEach((item) => append(item));
                }
                setSmartAddOpen(false);
              };
              const watchedItems = watch('items') || [];
              const [smartAddOpen, setSmartAddOpen] = useState(false);
              const smartAddEnabled = useSelector((s) => s.theme.smartAddEnabled);

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
              const orderDateValue = watch('orderDate');
              const orderDateForMin = orderDateValue ? dayjs(orderDateValue) : null;
              const today = dayjs();
              const deliveryDateMinDate = orderDateForMin && orderDateForMin.isAfter(today, 'day') ? orderDateForMin : today;

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
                // Dropped entirely on a Claims/Services document — see
                // isNonStockCategory above — since nothing on that document
                // ever moves stock.
                ...(isNonStockCategory ? [] : [
                  { header: 'Warehouse *', get: (i) => i?.warehouse, field: 'select' },
                ]),
                { header: 'Quantity *', get: (i) => i?.quantity, field: 'text' },
                { header: 'Rate (₹) *', get: (i) => i?.unitPrice, field: 'text' },
                { header: 'Discount (%)', get: (i) => i?.discountPercent, field: 'text' },
                { header: 'Tax (%)', get: (i) => taxCodeById.get(i?.taxCodeId)?.label ?? i?.taxPercent, field: 'select' },
                { header: 'Amount (₹)', get: (i) => ((Number(i?.quantity) || 0) * (Number(i?.unitPrice) || 0)).toFixed(2), field: 'plain', min: 110 },
                null,
              ]);
              const branch = watch('branch');
              // Once Branch is picked, the Warehouse dropdown is scoped to
              // that branch's warehouses only — see useWarehouseOptions.js.
              const { warehouses } = useWarehouseOptions({});
              // Every line can carry a different warehouse, and on edit/view
              // a saved value that isn't in the currently-selected branch's
              // list (a different branch, a since-deactivated warehouse, ...)
              // must still show, not render blank — see useWarehouseOptions.js.
              const { options: branchWarehouseOptions } = useWarehouseOptions({
                branch,
                currentValue: watchedItems.map((i) => i.warehouse),
              });

              // Switching Branch invalidates a Warehouse choice that doesn't
              // belong to the new branch. Skipped on the very first render so
              // loading an existing record for edit/view, or a Copy From that
              // sets branch, doesn't wipe a value it just loaded. No header
              // Warehouse exists on this document, so only the per-row
              // values need this.
              const prevOrderBranchRef = useRef(branch);
              useEffect(() => {
                if (prevOrderBranchRef.current === branch) return;
                prevOrderBranchRef.current = branch;
                const allowed = warehouseCodesForBranch(warehouses, branch);
                (watch('items') || []).forEach((it, idx) => {
                  if (it.warehouse && !allowed.has(it.warehouse)) setValue(`items.${idx}.warehouse`, '');
                });
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [branch]);

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
              // it baked in, saving a total below the one the user approved.
              const discountPercent = watch('discountPercent');
              // Inter-state supplies are taxed wholly as IGST. The server works
              // this out by comparing Place of Supply against the company's
              // registered state; passing the same flag here is what stops the
              // panel showing a CGST/SGST split for a record saved as IGST.
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
              // taxType (from each line's own taxCodeId) drives the TCS
              // carve-out in documentTotals.js's computeTotals -- see
              // buildTaxCodeOptions/taxCodeById above, which now carries
              // taxType alongside label/value/rate.
              const itemsForTotals = watchedItems.map((it) => ({ ...it, taxType: taxCodeById.get(it.taxCodeId)?.taxType || '' }));
              const freightNetAmount = watch('freightNetAmount');
              const freightTaxAmount = watch('freightTaxAmount');
              const roadTaxWatched = watch('roadTax');
              const roadTaxApplicable = watch('roadTaxApplicable');
              const totals = computeTotals(itemsForTotals, discountPercent, interState, { roadTax: roadTaxWatched, roadTaxApplicable, freightNetAmount, freightTaxAmount });
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

              const allValues = watch();
              const printCustomerRecord = (customers || []).find((c) => c.customerName === allValues.customer);
              // The chosen Supplier's own Business Partner row — carries
              // logoUrl/logoVisible for SalesOrderPrintable's supplier-logo
              // block.
              const printSupplierRecord = (suppliers || []).find((s) => s.supplierName === allValues.supplier);
              const printSalesEmployeeRecord = (salesEmployees || []).find((s) => s.employeeName === allValues.salesPerson);
              const printQuotationRecord = (quotations || []).find((q) => q.quotationNo === allValues.quotationNo);
              // The order's own Branch (a name, like Supplier/Customer above)
              // resolved against Branch Master so the printable can show that
              // branch's own address in the header instead of head office's —
              // see SalesOrderPrintable.jsx's branchRecord prop.
              const printBranchRecord = (branches || []).find((b) => (b.branchName || '').trim() === (allValues.branch || '').trim());
              // items: itemsForTotals so each line carries its resolved
              // taxType -- SalesOrderPrintable's own local recompute reads
              // item.taxType to detect a TCS-typed line, and the raw watched
              // item only ever has taxCodeId.
              const printOrder = { ...allValues, items: itemsForTotals, status: editingRow?.status || 'Draft' };
              // See SalesInvoice.jsx's identical approverSignatureUrl comment.
              const approverSignatureUrl = (salesEmployees || []).find((s) => s.employeeName === allValues.approvedBy)?.signatureUrl || null;

              const customerValue = watch('customer');
              const supplierValue = watch('supplier');
              // MachineryCodeSelect needs the selected Customer's Business
              // Partner id (Machineries are scoped per partner, not global —
              // see the "Machineries" tab on BusinessPartner.jsx), but this
              // form only stores the customer's NAME (see PartyCodeSelect's
              // own convention). Resolved the same way the contact/phone/
              // email auto-fill effect below looks the customer row up.
              const machineryBusinessPartnerId = (customers || []).find((c) => c.customerName === customerValue)?.id || null;
              const prevCustomer = useRef(editingRow ? editingRow.customer : null);
              useEffect(() => {
                if (customerValue !== prevCustomer.current) {
                  const found = (customers || []).find((c) => c.customerName === customerValue);
                  // A Machinery picked for the PREVIOUS customer is almost
                  // certainly not one of the new customer's own machineries
                  // (Machineries are scoped per Business Partner) — cleared
                  // on every actual customer change, not just when a new
                  // customer resolves, so switching to "no customer" also
                  // drops it rather than leaving a now-orphaned code behind.
                  setValue('machineryCode', '', { shouldValidate: true });
                  if (found) {
                    setValue('contactPerson', found.salesPerson || '', { shouldValidate: true });
                    setValue('phone', found.phone || '', { shouldValidate: true });
                    setValue('email', found.email || '', { shouldValidate: true });
                    // Bill To/Ship To are frozen fields now — always the
                    // selected customer's own Business Partner Billing/
                    // Shipping address, never hand-typed.
                    // Bill To follows the customer (SalesShipTo's SalesBillTo keeps the picked Billing address).
                    if (!watch('billToDifferentCustomer')) setValue('billingAddress', customerAddressFor(found, 'Billing'), { shouldValidate: true });
                    // Ship To keeps the address picked under "Ship to a different customer"
                    // (see SalesShipTo) instead of snapping back to this customer's own.
                    if (!watch('shipToDifferentCustomer')) setValue('shippingAddress', customerAddressFor(found, 'Shipping'), { shouldValidate: true });
                    setValue('billingType', deriveBillingType(found), { shouldValidate: true });
                    setValue('paymentTerms', found.paymentTerms || '', { shouldValidate: true });
                    setValue('gstNo', customerGstNo(found), { shouldValidate: true });
                  }
                  prevCustomer.current = customerValue;
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [customerValue]);

              // Copy From pulls every field that exists on a
              // quotation across onto the order — contact info,
              // currency, billing/shipping address, reference no., terms &
              // conditions, discount, and items. Order No./Date, Delivery
              // Date, Payment Terms, and Sales Person are the only header
              // fields the user actually fills in themselves, since none of
              // those exist on a quotation.
              //
              // The item columns (product, HSN, unit, quantity, rate,
              // discount, tax) used to render `disabled`, on the grounds that
              // they mirror the quotation. In practice an order is not always
              // identical to the quotation it was raised from — the customer
              // negotiates a different rate, swaps a product, or the order has
              // no quotation behind it at all ("Add Item" produced a row that
              // could never be filled in). They are editable now; the
              // quotation lookup still pre-fills them, it just no longer
              // forbids a correction.
              //
              // This used to run as an effect watching the Quotation No.
              // dropdown. It is a plain function now, called only from the
              // dialog's Choose button: an effect keyed on a form value also
              // fires when that value is restored on edit or reset, which is why
              // it needed the prevQuotation bookkeeping to tell "user picked a
              // quotation" apart from "form loaded". An explicit call has no such
              // ambiguity.
              const applyQuotation = (found) => {
                if (found) {
                  setValue('quotationNo', found.quotationNo || '', { shouldValidate: true });
                  setValue('branch', found.branch || '', { shouldValidate: true });
                  // Via this page's own Copy From dialog, the customer is
                  // already fixed — the dialog was filtered by it, so this is
                  // a no-op there. But applyQuotation is also called from the
                  // Copy To intent effect below, landing on a brand new order
                  // with no customer picked at all — there, leaving this out
                  // meant Customer never came across from Copy To. Setting it
                  // explicitly covers both paths.
                  //
                  // The customer-effect's "previous value" ref is synced in
                  // the same breath, so that effect doesn't think a new
                  // customer was just picked and re-fire on the next render:
                  // it looks up Contact/Phone/Email/Billing/Shipping fresh
                  // from Customer Master, which would clobber the values just
                  // set from the quotation's snapshot below (same class of
                  // bug fixed on Purchase Order's Reference/Contact Person).
                  setValue('customer', found.customer || '', { shouldValidate: true });
                  prevCustomer.current = found.customer || '';
                  setValue('contactPerson', found.contactPerson || '', { shouldValidate: true });
                  setValue('phone', found.phone || '', { shouldValidate: true });
                  setValue('email', found.email || '', { shouldValidate: true });
                  setValue('currency', found.currency || 'INR', { shouldValidate: true });
                  // A second, unrelated party field — the Business Partner
                  // (Vendor) picked purely so its logo prints next to the
                  // KEMACH logo (see salesOrderSchema's own comment on this
                  // field). Distinct from Customer above; missed entirely in
                  // the first pass at this fix.
                  setValue('supplier', found.supplier || '', { shouldValidate: true });
                  setValue('referenceNo', found.referenceNo || found.customerRefNo || '', { shouldValidate: true });
                  setValue('customerRefNo', found.customerRefNo || found.referenceNo || '', { shouldValidate: true });
                  // Bill To/Ship To are frozen/derived — re-derive from the
                  // quotation's own customer's Business Partner record
                  // rather than copying the quotation's stored strings.
                  {
                    const quotationCustomerRecord = (customers || []).find((c) => c.customerName === found.customer);
                    applySalesPartyAddresses(setValue, found, quotationCustomerRecord, customerAddressFor);
                    setValue('billingType', deriveBillingType(quotationCustomerRecord), { shouldValidate: true });
                    setValue('gstNo', customerGstNo(quotationCustomerRecord), { shouldValidate: true });
                  }
                  setValue('termsConditions', found.termsConditions || '', { shouldValidate: true });
                  setValue('discountPercent', found.discountPercent != null ? Number(found.discountPercent) : 0, { shouldValidate: true });
                  setValue('remarks', found.notes || '', { shouldValidate: true });
                  // These carried on the quotation but were never copied
                  // across to the order it becomes — every one of them had
                  // to be retyped by hand even though the quotation already
                  // had the answer.
                  setValue('salesPerson', found.salesPerson || '', { shouldValidate: true });
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
                  // The quotation's own Road Tax is a Yes/No toggle only --
                  // its 8.2% amount is computed on the fly from the
                  // quotation's own items/discount and never stored, so
                  // there is no found.roadTax to copy. Recompute that same
                  // 8.2% figure here, off the quotation's own items and
                  // discount, and seed the order's manual Road Tax amount
                  // with it -- the user still owns the field afterwards and
                  // can adjust it, but it no longer starts back at zero.
                  setValue('roadTaxApplicable', !!found.roadTaxApplicable, { shouldValidate: true });
                  if (found.roadTaxApplicable && found.items && found.items.length) {
                    // buildDocument/normaliseLine read each line's taxType
                    // straight off the item -- it doesn't derive it from
                    // taxCodeId itself (see itemsForTotals above, which does
                    // that resolution for this page's own live totals). The
                    // quotation's raw items only carry taxCodeId, so without
                    // resolving taxType here too, a TCS-typed line would be
                    // invisible to hasTcs and undercount the copied Road Tax.
                    const quotationItemsForTotals = found.items.map((i) => ({
                      ...i,
                      taxType: taxCodeById.get(i.taxCodeId)?.taxType || '',
                    }));
                    const { totals: quotationTotals } = buildDocument(
                      quotationItemsForTotals,
                      found.discountPercent != null ? Number(found.discountPercent) : 0,
                      { interState, roundOff: true }
                    );
                    setValue('roadTax', round2(quotationTotals.amount * 0.082), { shouldValidate: true });
                  } else {
                    setValue('roadTax', 0, { shouldValidate: true });
                  }
                  if (found.items && found.items.length) {
                    // replaceItems(), not setValue('items', ...) — see the
                    // same fix on Delivery Challan's quotation/order-fetch
                    // effect. replace() (useFieldArray's own API) gives every
                    // row a fresh field id, remounting each ProductCell
                    // instead of reusing the old one — reused cells saw
                    // productCode change from '' to the quotation's value,
                    // read that as a user picking a product, and overwrote
                    // the tax rate/unit price just set here with the
                    // *product master's* defaults instead of the quotation's.
                    const mappedItems = found.items.map((i, n) => ({
                      productCode: i.productCode || '', productName: i.productName || '', description: i.description || '',
                      hsnCode: i.hsnCode || '', uom: i.uom || '',
                      quantity: i.quantity != null ? Number(i.quantity) : 1,
                      unitPrice: (i.unitPrice != null ? Number(i.unitPrice) : null) ?? priceListRates?.get(i.productCode) ?? 0,
                      discountPercent: i.discountPercent != null ? Number(i.discountPercent) : 0,
                      taxPercent: i.taxPercent != null ? Number(i.taxPercent) : 18,
                      taxCodeId: i.taxCodeId != null ? Number(i.taxCodeId) : null,
                      // Quotation lines carry their own warehouse now — pull
                      // it across the same way every other field here does.
                      warehouse: i.warehouse || '',
                      // Copy From: this line came from the quotation's line n.
                      baseType: 'Sales Quotation',
                      baseEntry: found.id ?? null,
                      baseNo: found.quotationNo || null,
                      baseLine: n + 1,
                    }));
                    replaceItems(mappedItems);
                    // Belt-and-braces: each row's own Product Code cell has
                    // its own master-lookup effect (see ProductCell below)
                    // that re-fills Description/HSN/Unit/Rate from the
                    // Product Master the instant it notices a productCode.
                    // replaceItems() giving every row a fresh field id is
                    // meant to stop that effect from ever seeing this as a
                    // "change" in the first place — but that guard runs
                    // exactly once, right as each cell mounts, and any
                    // reordering of effects/renders around a bulk 10+ field
                    // copy has been enough to occasionally lose that race in
                    // practice (reported: Rate landing at the Product
                    // Master's own default instead of the quotation's).
                    // Reasserting the quotation's own values a moment later —
                    // after that cell's effect has had every chance to run
                    // and lose — guarantees the copied figures win regardless
                    // of exactly how that race goes.
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
              };

              // Undo a Copy From: drop the link and the values that came across
              // with it, rather than leaving a stale quotation's figures sitting
              // in an order that no longer claims to reference it.
              //
              // The customer is deliberately NOT cleared. It is the user's own
              // selection — it is what made Copy From available in the first
              // place, and clearing it would close the dialog off and force a
              // re-pick just to try a different quotation from the same customer.
              // Contact Person / Phone / Email / addresses stay too: they belong
              // to the customer, not the quotation.
              const quotationValue = watch('quotationNo');
              const clearQuotation = () => {
                setValue('quotationNo', '', { shouldValidate: true });
                setValue('currency', 'INR', { shouldValidate: true });
                setValue('referenceNo', '', { shouldValidate: true });
                setValue('termsConditions', '', { shouldValidate: true });
                setValue('discountPercent', 0, { shouldValidate: true });
                setValue('remarks', '', { shouldValidate: true });
                replaceItems([{ ...emptyItem }]);
              };

              const handleFile = (file) => {
                if (file) setValue('attachmentName', file.name, { shouldValidate: true });
              };

              // Consume a pending "Copy To" intent addressed to this page —
              // see copyIntentSlice.js. Runs once per intent (cleared
              // immediately after), on whichever mount picks it up: a fresh
              // tab just opened by CopyToButton's navigate(), or this tab
              // already sitting open in the background.
              useEffect(() => {
                if (!pendingCopyIntent || pendingCopyIntent.targetKey !== 'salesOrder') return;
                if (pendingCopyIntent.sourceType === 'salesQuotation') applyQuotation(pendingCopyIntent.sourceDoc);
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
                  <CopyFromDocumentDialog
                    open={copyFromOpen}
                    onClose={() => setCopyFromOpen(false)}
                    onChoose={applyQuotation}
                    documents={copyableQuotations}
                    party={customerValue}
                    partyField="customer"
                    partyLabel="customer"
                    title="Find Sales Quotation"
                    columns={QUOTATION_COPY_COLUMNS}
                    emptyMessage="No quotations found for"
                  />
                  <SalesOrderPrintable
                    order={printOrder}
                    company={company}
                    customerRecord={printCustomerRecord}
                    supplierRecord={printSupplierRecord}
                    salesEmployeeRecord={printSalesEmployeeRecord}
                    quotationRecord={printQuotationRecord}
                    branchRecord={printBranchRecord}
                    houseBank={printHouseBank}
                    approverSignatureUrl={approverSignatureUrl}
                  />
                  <Card variant="outlined" sx={{ mb: 2 }}>
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                        <Typography variant="subtitle1" fontWeight={700}>
                          {readOnly ? 'Customer & Order Details (View Only)' : 'Customer & Order Details'}
                        </Typography>
                        <Button type="button" variant="outlined" color="inherit" startIcon={<ArrowBackIcon />} onClick={backToList}>
                          Back to List
                        </Button>
                      </Stack>

                      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, width: '100%', display: 'block' }}>
                        {/* Left column: Branch, Customer, Currency, Bill To,
                        Sales Person. Right column: Order No., Order
                        Date, Ship To. Listed left-item, right-item
                        per row so the 2-column grid lays out the two stacks
                        rather than flowing row-major top to bottom — same
                        convention as Purchase Order's "Supplier & Document Details".

                        Quotation No., Contact, Email, Reference No., Payment
                        Terms and Source are no longer shown on this card —
                        they still exist on the record (auto-filled from the
                        quotation/customer, or set by Copy From) and still
                        submit with the form, just with no visible input.
                        Delivery Date is required, so — with no field here to
                        set it from — it now defaults to Order Date + 7 days
                        (see getEmptyValues) instead of being left blank. */}
                        {/* Laid out as the 10 left|right pairs requested:
                        Sales Type|Order No, Branch|Order Date, Customer
                        Code|Contact No, Customer Name|GST No, Currency|Sales
                        Person, Supplier Code|Supplier Name, Receiver|Receiver
                        Phone No, Bill To|Ship To, Machine No|Engine No,
                        Hypothecation (alone). Customer Reference No. is
                        hidden per the same request (kept mounted, not
                        removed, so its defaultValue/schema wiring stays
                        intact -- it still submits whatever value it holds,
                        it's just not shown). FormGrid fills
                        left-to-right/top-to-bottom in child order, so the
                        pairing above is exactly this list's order; a hidden
                        (display:none) field drops out of grid layout
                        entirely, so it doesn't disturb that. The Machine
                        fields are folded into this same grid rather than
                        their own -- nothing here conditionally shows/hides
                        them, only their VALUES get cleared when Sales Type
                        leaves "Machine" -- so sharing one grid is safe. */}
                        <FormGrid columns={2} singleColumnOnMobile rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                          <LabeledField label="Sales Type *">
                            <FormSelect name="salesCategory" label="" placeholder="Select sales type" options={SALES_CATEGORY_OPTIONS} />
                          </LabeledField>
                          <LabeledField label="Order No. *">
                            <DocumentSeriesNoField documentCode="SO" seriesFieldName="seriesId" numberFieldName="orderNo" isCreate={!editingRow} />
                          </LabeledField>

                          <LabeledField label="Branch *">
                            <FormSelect name="branch" label="" placeholder="Select branch" options={branchOptions} />
                          </LabeledField>
                          <LabeledField label="Order Date *">
                            <FormDatePicker name="orderDate" label="" triggerFields={['deliveryDate']} />
                          </LabeledField>

                          {/* Customer drives this form now: it is picked first, it
                          enables Copy From, and it scopes the quotation list
                          that dialog shows. It used to be disabled and filled
                          only by the quotation dropdown, which made an order
                          without a quotation impossible to enter.

                          The fields below it are auto-filled from the
                          quotation or Customer Master but left editable for
                          the same reason: an order is often placed against a
                          different contact, reference or currency than the
                          master holds. */}
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
                            <FormTextField name="phone" label="" placeholder="Auto-filled from customer" digitsOnly maxLength={10} disabled />
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

                          {/* Currency paired with Sales Person here — both
                          short selects — rather than with a multiline
                          address box, so every row in this grid pairs
                          fields of matching height. */}
                          <LabeledField label="Currency *">
                            <FormSelect name="currency" label="" options={currencyOptions} />
                          </LabeledField>
                          <LabeledField label="Sales Person *">
                            <FormSelect name="salesPerson" label="" placeholder="Select sales person" options={salesPersonOptions} />
                          </LabeledField>

                          {/* Supplier — a Business Partner (Vendor), separate from
                          the Customer above, chosen purely so their logo can be
                          printed next to the KEMACH logo when the partner's own
                          Logo Visibility is Yes (see SalesOrderPrintable.jsx).
                          Paired with a read-only Supplier Name echo, same
                          Code-field/Name-echo pattern as Customer/Customer Name
                          above, keeping both in the same line. */}
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

                          <LabeledField label={watch('salesCategory') === 'Parts' || watch('salesCategory') === 'Services' ? 'Machine No. *' : 'Machine No.'}>
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
                          {/* Vehicle Type hidden per request — the field/value
                          is left in the schema and default-values plumbing
                          untouched, just not rendered here. */}
                        </FormGrid>
                      </fieldset>
                    </CardContent>
                  </Card>

                  <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, width: '100%', display: 'block' }}>
                    <Card variant="outlined" sx={{ mb: 2 }}>
                      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                          <Typography variant="subtitle1" fontWeight={700}>Item Details</Typography>
                          <Stack direction="row" spacing={1.5}>
                            <Button type="button" variant="outlined" color="inherit" size="small" startIcon={<UploadFileIcon />} onClick={() => setItemsImportOpen(true)}>
                              Import from Excel
                            </Button>
                            <Button type="button" variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => append(withDefaultTaxCode({ ...emptyItem, warehouse: '' }, liveDefaultTaxCode))}>
                              Add Item
                            </Button>
                            {smartAddEnabled && (
                              <Button type="button" variant="outlined" color="primary" size="small" startIcon={<BoltIcon />} onClick={() => {
                                if(!watch('customer')) {
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

                        {isMobile ? (
                          <Box>
                            {fields.map((field, index) => {
                              const qty = Number(watch(`items.${index}.quantity`)) || 0;
                              const price = Number(watch(`items.${index}.unitPrice`)) || 0;
                              const disc = Number(watch(`items.${index}.discountPercent`)) || 0;
                              const gross = qty * price;
                              const rowAmount = gross - gross * (disc / 100);
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
                                        label="Warehouse *"
                                        placeholder={branch ? 'Select' : 'Select branch first'}
                                        options={branchWarehouseOptions}
                                        disabled={!branch}
                                      />
                                    )}
                                    <FormTextField name={`items.${index}.quantity`} label="Quantity *" type="number" />
                                    <FormTextField name={`items.${index}.unitPrice`} label="Rate (₹) *" type="number" />
                                    <FormTextField name={`items.${index}.discountPercent`} label="Discount (%)" type="number" />
                                    <FormSelect
                                      name={`items.${index}.taxCodeId`}
                                      label="Tax (%)"
                                      options={taxCodeOptionsForRow}
                                      popupFitContent
                                      onValueChange={(_v, option) => setValue(`items.${index}.taxPercent`, option ? option.rate : 0, { shouldValidate: true })}
                                    />
                                  </Box>
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
                                    <TableCell>Warehouse<span style={{ color: '#d32f2f' }}> *</span></TableCell>
                                  )}
                                  <TableCell>Quantity<span style={{ color: '#d32f2f' }}> *</span></TableCell>
                                  <TableCell>Rate (₹)<span style={{ color: '#d32f2f' }}> *</span></TableCell>
                                  <TableCell>Discount (%)</TableCell>
                                  <TableCell>Tax (%)</TableCell>
                                  <TableCell align="right">Amount (₹)</TableCell>
                                  <TableCell width={48} />
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {fields.map((field, index) => {
                                  const qty = Number(watch(`items.${index}.quantity`)) || 0;
                                  const price = Number(watch(`items.${index}.unitPrice`)) || 0;
                                  const disc = Number(watch(`items.${index}.discountPercent`)) || 0;
                                  const gross = qty * price;
                                  const rowAmount = gross - gross * (disc / 100);
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
                                          options={taxCodeOptionsForRow}
                                          disableClearable
                                          sx={{ minWidth: 96 }}
                                          popupFitContent
                                          onValueChange={(_v, option) => setValue(`items.${index}.taxPercent`, option ? option.rate : 0, { shouldValidate: true })}
                                        />
                                      </TableCell>
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
                      </CardContent>
                    </Card>
                  </fieldset>

                  <Card variant="outlined">
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, width: '100%', display: 'block' }}>
                        <Grid container spacing={3}>
                          {/* Order Remarks removed from this form. */}
                          <Grid item xs={12} md={4} sx={{ display: 'flex' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Terms & Conditions</Typography>
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
                              <DocumentTotalsPanel totals={totals} interState={interState} discountField={null} showFreight roadTaxField="roadTax" roadTaxCheckboxField="roadTaxApplicable" roadTaxChecked={roadTaxApplicable} />
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
                        <CopyToButton
                          sourceType="salesOrder"
                          sourceDoc={editingRow}
                          sourceLabel="Sales Order"
                          docNoField="orderNo"
                          targets={[
                            { key: 'deliveryChallan', label: 'Delivery Challan', path: '/sales/delivery-challan' },
                            { key: 'salesInvoice', label: 'Sales Invoice', path: '/sales/invoice' },
                          ]}
                        />
                        {/* Copy From sits immediately left of Cancel and stays
                          disabled until a Customer is chosen — the dialog it
                          opens lists that customer's quotations, so with no
                          customer there is nothing for it to show. Hidden in
                          view mode, where nothing is being filled in. */}
                        {!readOnly && (
                          quotationValue ? (
                            <Button
                              fullWidth={isMobile}
                              type="button"
                              variant="outlined"
                              color="inherit"
                              startIcon={<CloseIcon />}
                              onClick={clearQuotation}
                              disabled={creating || updating}
                            >
                              Clear Copied Quotation
                            </Button>
                          ) : (
                            <Button
                              fullWidth={isMobile}
                              type="button"
                              variant="outlined"
                              startIcon={<ContentCopyOutlinedIcon />}
                              onClick={() => setCopyFromOpen(true)}
                              disabled={!customerValue || creating || updating}
                            >
                              Copy From
                            </Button>
                          )
                        )}
                        <Button fullWidth={isMobile} type="button" variant="outlined" color="inherit" startIcon={<CloseIcon />} onClick={backToList} disabled={creating || updating}>
                          Cancel
                        </Button>
                        <Button fullWidth={isMobile} type="button" variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => printSalesOrder()}>
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
                              // Forcing 'Confirmed' only makes sense on a brand
                              // new order — that is what "Save & Send" means.
                              // On an edit it must NOT force anything: an order
                              // already Partially Delivered or Closed (set by
                              // recomputeSalesOrder from GRNs/challans/invoices
                              // raised against it) would otherwise get silently
                              // downgraded back to Confirmed by any unrelated
                              // edit and save.
                              onClick={() => { pendingStatusRef.current = editingRow ? null : 'Confirmed'; }}
                              disabled={creating || updating}
                              loading={creating || updating}
                            >
                              {editingRow ? 'Update Order' : 'Save & Send Order'}
                            </FormSubmitButton>
                          </>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                  <ImportItemsDialog
                    open={itemsImportOpen}
                    onClose={() => setItemsImportOpen(false)}
                    resourceName="Items"
                    templateUrl="/sales/orders/items-import/template"
                    importUrl="/sales/orders/items-import"
                    onImported={handleItemsImported}
                  />
                  <SmartAddHistoryDialog
                    open={smartAddOpen}
                    onClose={() => setSmartAddOpen(false)}
                    onImport={handleSmartAddImport}
                    customer={watch('customer')}
                    documents={allSalesDocuments}
                    products={products || []}
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
              direction={{ xs: 'column', sm: 'row' }}
              alignItems={{ xs: 'stretch', sm: 'center' }}
              justifyContent="space-between"
              flexWrap="wrap"
              gap={1.5}
              sx={{ px: { xs: 2, sm: 3 }, pt: 2.5, pb: 1.5 }}
            >
              <Typography variant="subtitle1" fontWeight={700}>Sales Order List</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap sx={{ width: { xs: '100%', sm: 'auto' } }}>
                <TableSearchFilter table={table} placeholder="Search by order no., customer, ref no..." showFilter={false} />
                <Stack direction="row" spacing={1.5}>
                  <Button size="small" variant="outlined" color="inherit" startIcon={<FilterListIcon />} onClick={() => setShowFilters((v) => !v)} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                    Filter
                  </Button>
                  <CanAdd>
                    {/* React.Children.only needs one child — group both buttons in a Stack. */}
                    <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                      <Button
                        size="small"
                        variant="outlined"
                        color="inherit"
                        startIcon={<UploadFileIcon />}
                        onClick={() => setBulkImportOpen(true)}
                        sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                      >
                        Import from Excel
                      </Button>
                      <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                        Create Order
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
                  <FilterAutocomplete
                    label="Sales Person"
                    allLabel="All Sales Persons"
                    options={salesPersonOptions}
                    value={salesPersonFilter}
                    onChange={(v) => { setSalesPersonFilter(v); setPage(0); }}
                  />
                  <Autocomplete
                    size="small"
                    options={PAYMENT_STATUS_FILTERS}
                    value={paymentStatusFilter}
                    onChange={(_e, v) => { setPaymentStatusFilter(v || 'All'); setPage(0); }}
                    disableClearable
                    renderInput={(params) => <TextField {...params} label="Payment Status" InputLabelProps={{ shrink: true }} />}
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
                    title={row.orderNo}
                    statusChip={<Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />}
                    fields={[
                      { label: 'Customer', value: row.customer || '—' },
                      { label: 'Order Date', value: row.orderDate ? dayjs(row.orderDate).format('DD/MM/YYYY') : '—' },
                      { label: 'Delivery Date', value: row.deliveryDate ? dayjs(row.deliveryDate).format('DD/MM/YYYY') : '—' },
                      { label: 'Amount', value: `₹${Number(row.amount).toFixed(2)}` },
                      { label: 'Payment Status', value: row.paymentStatus || '—' },
                    ]}
                    // Cancelled orders are fully locked — no Edit/Delete/
                    // Cancel action once isCancelled is true, only the
                    // status chip above shows "Cancelled".
                    onEdit={row.isCancelled ? undefined : () => handleEdit(row)}
                    onDelete={row.isCancelled ? undefined : () => handleDelete(row)}
                    extraActions={row.isCancelled ? [] : [
                      { key: 'cancel', label: 'Cancel', icon: <CancelOutlinedIcon fontSize="small" />, color: 'warning', onClick: () => handleCancel(row) },
                    ]}
                  />
                ))}
                {!isLoading && filteredRows.length === 0 && (
                  <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />} title="No orders found" message="Add your first order to get started" />
                )}
              </Box>
            ) : (
              <ScrollableTableContainer>
                <Table
                  size="small"
                  stickyHeader
                  sx={{
                    '& th, & td': {
                      height: SALES_ORDER_LIST_TABLE_ROW_HEIGHT,
                      paddingTop: `${SALES_ORDER_LIST_TABLE_CELL_PADDING_Y}px`,
                      paddingBottom: `${SALES_ORDER_LIST_TABLE_CELL_PADDING_Y}px`,
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
                      <SortableHeaderCell field="orderNo" sort={table.sort} onSort={table.toggleSort}>Order No.</SortableHeaderCell>
                      <SortableHeaderCell field="orderDate" sort={table.sort} onSort={table.toggleSort}>Order Date</SortableHeaderCell>
                      <SortableHeaderCell field="customer" sort={table.sort} onSort={table.toggleSort}>Customer</SortableHeaderCell>
                      <SortableHeaderCell field="deliveryDate" sort={table.sort} onSort={table.toggleSort}>Delivery Date</SortableHeaderCell>
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
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.orderNo}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.orderDate ? dayjs(row.orderDate).format('DD/MM/YYYY') : '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.customer || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.deliveryDate ? dayjs(row.deliveryDate).format('DD/MM/YYYY') : '—'}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{Number(row.amount).toFixed(2)}</TableCell>
                        <TableCell>
                          <Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={row.paymentStatus} color={PAYMENT_STATUS_COLORS[row.paymentStatus] || 'default'} variant="outlined" />
                        </TableCell>
                        <TableCell align="right">
                          {row.isCancelled ? (
                            // Fully locked once cancelled — no View/Edit/
                            // Duplicate/Print/Delete/Cancel, only the status
                            // chip above says "Cancelled".
                            <Typography variant="caption" color="text.secondary">Cancelled</Typography>
                          ) : (
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title="View">
                              <IconButton size="small" onClick={() => handleView(row)} aria-label="view">
                                <VisibilityOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <RouteMapButton flow="sales" type="order" docNo={row.orderNo} />
                            {canDuplicate && (
                              <Tooltip title="Duplicate">
                                <IconButton size="small" onClick={() => handleDuplicate(row)} aria-label="duplicate">
                                  <ContentCopyOutlinedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Print">
                              <IconButton size="small" onClick={() => handlePrint(row)} aria-label="print">
                                <PrintOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
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
                        <TableCell colSpan={10}>
                          <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />} title="No orders found" message="Add your first order to get started" />
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

            <EntityListPagination total={table.total} page={page} onChange={setPage} pageSize={pageSize} onPageSizeChange={(v) => { setPageSize(v); setPage(0); }} />
          </CardContent>
        </Card>
      )}

      <BulkImportDialog
        open={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        resourceName="Sales Orders"
        templateUrl="/sales/orders/bulk-import/template"
        importUrl="/sales/orders/bulk-import"
        onImported={refetchOrders}
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
