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
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import EventIcon from '@mui/icons-material/Event';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import BoltIcon from '@mui/icons-material/Bolt';
import usePriceListRates from '../../hooks/usePriceListRates';
import { useCurrencyOptions } from '../../lib/currencyOptions';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import BatchSerialSelectionDialog from '../../components/common/BatchSerialSelectionDialog';
import BulkImportDialog from '../../components/common/BulkImportDialog';
import ImportItemsDialog from '../../components/common/ImportItemsDialog';
import SmartAddHistoryDialog from '../../components/common/SmartAddHistoryDialog';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import WarehouseCodeSelect from '../../components/form/WarehouseCodeSelect';
import PartyCodeSelect, { buildPartyCodeOptions } from '../../components/form/PartyCodeSelect';
import SalesShipTo from '../../components/form/SalesShipTo';
import { applySalesPartyAddresses } from '../../lib/salesPartyAddress';
import MachineryCodeSelect from '../../components/form/MachineryCodeSelect';
import FormDatePicker from '../../components/form/FormDatePicker';
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
import { deliveryChallanSchema, CHALLAN_STATUS_OPTIONS } from '../../lib/validation/salesSchemas';
import { isNonStockSalesCategory } from '../../lib/validation/common';
import { buildDocument, round2, isInterState } from '../../lib/documentTotals';
import DocumentTotalsPanel from '../../components/form/DocumentTotalsPanel';
import { deliveryChallanApi, salesQuotationApi, salesOrderApi, salesInvoiceApi, customerApi, supplierApi, productApi, salesEmployeeApi, taxCodeApi, houseBankApi } from '../../features/resources';
import { useBranchNameOptions } from '../../lib/useBranchOptions';
import { productOptionsFor, PRODUCT_USAGE } from '../../lib/productUsage';
import { useWarehouseOptions, warehouseCodesForBranch } from '../../lib/useWarehouseOptions';
import { useWarehouseStock } from '../../lib/useWarehouseStock';
import { buildTaxCodeOptions, taxTypeFamilyFor, pickDefaultTaxCode, withDefaultTaxCode } from '../../lib/taxCodeOptions';
import { itemTableSx } from '../../lib/columnWidth';
import { useGetCompanyDetailsQuery } from '../../features/company/companyDetailsApi';
import DocumentSeriesNoField from '../../components/form/DocumentSeriesNoField';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
import DeliveryChallanPrintable, { printDeliveryChallan } from '../../components/print/DeliveryChallanPrintable';
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
import JournalEntryViewDialog from '../../components/accounting/JournalEntryViewDialog';
import CopyToButton from '../../components/common/CopyToButton';
import { useDispatch, useSelector } from 'react-redux';
import { selectCurrentUser } from '../../store/authSlice';
import { clearCopyIntent } from '../../store/copyIntentSlice';

// Columns for the "Find Sales Order" dialog opened by Copy From.
//
// "Due Date" reads off the order's `deliveryDate`: a sales order has no `dueDate`
// of its own — the date it is due is the date it promised delivery, which is
// exactly what this column is asking about.
const SALES_ORDER_COPY_COLUMNS = [
  { field: 'orderNo', headerName: 'Order No', nowrap: true },
  { field: 'customer', headerName: 'Customer Name' },
  { field: 'deliveryDate', headerName: 'Due Date', type: 'date' },
  { field: 'remarks', headerName: 'Comments', type: 'optional' },
];
const emptyItem = {
  productCode: '', productName: '', description: '', hsnCode: '', uom: '', quantity: 1, unitPrice: 0, discountPercent: 0, taxPercent: 0, taxCodeId: null,
  // Populated via the "Batches Number - Selection" / "Serial Numbers -
  // Selection" dialog — see BatchSerialSelectionDialog and the Batch/Serial
  // column below. Empty unless the selected product's Manage Item By is
  // Batch or Serial.
  batchAllocations: [], serialAllocations: [],
  // Which warehouse this line ships out of — defaults to the header's own
  // (required) From Warehouse when a row is added. Mandatory: every challan
  // that posts moves stock.
  warehouse: '',
};

// "Other Details" classification fields — fixed-option (CFL-style) selects,
// not free text. Billing Type/Purchase Type/Type of Purchase/Type of
// Sales/Transport Mode reuse the exact same vocabulary as Purchase Order's
// own "Other Details" section (see PurchaseOrder.jsx).
const BILLING_TYPE_OPTIONS = ['B2B', 'B2C'].map((v) => ({ label: v, value: v }));
const SALES_TYPE_OPTIONS = ['UPI', 'NEFT', 'CASH', 'CHECK', 'DEBIT/CREDIT CARD'].map((v) => ({ label: v, value: v }));
const TYPE_OF_PURCHASE_OPTIONS = [
  'Breakdown with Warranty', 'Stock Order', 'Machine Order', 'Non Warranty Order',
  'Branch Transfer', 'Services', 'Standard Priority Order', 'Sales', 'Admin',
].map((v) => ({ label: v, value: v }));
const TRANSPORT_MODE_OPTIONS = ['Road', 'Air', 'Rail', 'Ship'].map((v) => ({ label: v, value: v }));
// Sales Type (Parts / Machine) — separate from the existing `salesType`
// Payment Method field below; named `salesCategory` to avoid any collision
// with it. When Machine is selected, three extra machine-identification
// fields appear (Machine Serial No., Engine No., Hypothecation).
const SALES_CATEGORY_OPTIONS = ['Parts', 'Machine', 'Services', 'Claims'].map((v) => ({ label: v, value: v }));
// Type of DC — required CFL-style classification of what this despatch is
// actually for (a warranty/goodwill replacement, an FOC handout, an
// attachment despatch, or a claims-related movement), separate from Sales
// Category above (which is about what kind of goods are moving, not why).
const TYPE_OF_DC_OPTIONS = ['Warranty', 'Good will Warranty', 'FOC', 'Goodwill FOC', 'attachments', 'Claims'].map((v) => ({ label: v, value: v }));

// Best-effort reverse lookup for rows saved before taxCodeId existed (or a
// row whose Tax Code was since made Inactive/retired): picks the first
// active Tax Code with a matching rate so the field isn't just left blank.
// If more than one active code shares that rate, which one comes back here
// is genuinely a guess — see the schema.prisma comment on
// DeliveryChallanItem.taxCodeId; it can't be resolved retroactively for a
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
 * Blocks the challan save when a Batch/Serial-tracked line's quantity isn't
 * fully covered by its selected batches/serials — the client-side half of
 * the same rule the server enforces in assertBatchSerialIssueAllocation
 * (utils/businessRules.js). Mirrors PurchaseGRN.jsx's
 * validateBatchSerialAllocation, but checks batchAllocations/
 * serialAllocations (numbers SELECTED from existing stock) rather than
 * batches/serials (numbers CREATED on a receipt) — a despatch draws down
 * stock, it doesn't add to it, so the same batch/serial number legitimately
 * appears on more than one document over its life and is not flagged as a
 * duplicate against an EARLIER document the way a GRN's own new numbers are.
 *
 * What IS checked, same (Item, Warehouse, Batch) scoping PurchaseGRN.jsx/
 * StockReceipt.jsx now use: the same (batchNo, warehouse, productCode)
 * selected twice on THIS document. Each line's own allocated-vs-quantity
 * check below only looks at that one line, so two lines independently
 * drawing from the same physical lot would each look fine on their own
 * while together over-issuing it — this is what catches that before save.
 * Different warehouses sharing a batch number is fine, same as the receive
 * side, since a batch can legitimately have stock in more than one
 * warehouse — and, since ProductBatch is now unique per (batchNo,
 * warehouse, productCode) rather than just (batchNo, warehouse) (see the
 * schema comment on ProductBatch), two DIFFERENT products sharing the same
 * batch number and warehouse are two different physical lots, not the
 * "same batch" this guard is protecting against, so productCode has to be
 * part of the key too or this would wrongly block that legitimate case.
 */
function validateBatchSerialAllocation(items, productsByCode) {
  const seenBatchKeys = new Map();
  const seenSerialNos = new Map();

  for (let i = 0; i < (items || []).length; i++) {
    const item = items[i];
    const trackingMode = productsByCode[item.productCode]?.manageItemBy;
    const label = item.productCode || `Row ${i + 1}`;
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

    if (trackingMode !== 'Batch' && trackingMode !== 'Serial') continue;
    const qty = Number(item.quantity) || 0;

    if (trackingMode === 'Batch') {
      const allocated = (item.batchAllocations || []).reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
      if (Math.abs(allocated - qty) > 0.005) {
        return `${label}: select ${qty} from batches via "Batches Number - Selection" — currently ${allocated}.`;
      }
    } else {
      const count = (item.serialAllocations || []).length;
      if (count !== qty) {
        return `${label}: select ${qty} serial number(s) via "Serial Numbers - Selection" — currently ${count}.`;
      }
    }
  }
  return null;
}

// Billing Address/Shipping Address are frozen, derived display fields now —
// not user-editable free text. Formatting mirrors PurchaseOrder.jsx's own
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
  // Delivery Date is required but no longer has a visible field to set it
  // from (see the Customer & Document Details FormGrid below) -- same
  // situation as, and same fix as, Sales Order's own Delivery Date. It now
  // defaults to Challan Date + 7 days rather than null, so a brand-new
  // challan created without Copy From doesn't start out unable to pass
  // validation with no way to fix it.
  const today = new Date();
  return {
    customerState: '',
    challanNo: '', seriesId: '', branch: '', customer: '', supplier: '', contactPerson: '', orderNo: '', customerRefNo: '', gstNo: '',
    challanDate: today, deliveryDate: dayjs(today).add(7, 'day').toDate(), fromWarehouse: '', salesPerson: '', machineryCode: '', currency: 'INR',
    receiver: '', receiverPhone: '',
    billingAddress: '', shippingAddress: '', shipToDifferentCustomer: false, shipToCustomer: '', billToDifferentCustomer: false, billToCustomer: '', billToGstNo: '', billToGstType: '', billToPanNo: '', shipToGstNo: '', shipToGstType: '', shipToPanNo: '', termsConditions: '', preparedBy: preparedBy || '', approvedBy: '', attachmentName: '', remarks: '', status: 'Pending',
    // "Other Details" classification fields — see the constants above.
    billingType: '', typeOfPurchase: '', salesType: '', transportMode: '', invoiceType: '',
    salesCategory: 'Parts', machineSerialNo: '', engineNo: '', typeOfDc: '', bobLinkNo: '', hypothecation: '',
    roadTax: 0, roadTaxApplicable: false,
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
function computeTotals(items, discountPercent, interState = false, extraCharges = {}) {
  const { totals } = buildDocument(items, discountPercent, {
    interState,
    roundOff: true,
  });
  // No visible Road Tax field on this document -- see
  // deliveryChallanSchema's own comment on the roadTax/roadTaxApplicable
  // fields. Only ever nonzero here as a Copy From/To carry-through, folded
  // in the same way as Sales Order's own computeTotals so the two documents'
  // Grand Totals keep agreeing.
  const roadTax = extraCharges.roadTaxApplicable ? round2(Number(extraCharges.roadTax) || 0) : 0;
  const preRoundWithRoadTax = round2(totals.amount + roadTax);
  const amountWithRoadTax = Math.round(preRoundWithRoadTax);
  const additionalRoundOff = round2(amountWithRoadTax - preRoundWithRoadTax);
  const combinedRoundOff = round2((totals.roundOff || 0) + additionalRoundOff);
  return {
    ...totals,
    discount: round2(totals.subtotal - totals.taxableAmount),
    roadTax,
    roundOff: combinedRoundOff,
    grandTotal: amountWithRoadTax,
  };
}

function rowToFormValues(row, taxCodes) {
  const taxCodeIdByRate = buildTaxCodeIdByRate(taxCodes);
  return {
    customerState: row.customerState || '',
    challanNo: row.challanNo, seriesId: '', branch: row.branch || '', customer: row.customer || '', supplier: row.supplier || '', contactPerson: row.contactPerson || '',
    machineryCode: row.machineryCode || '', gstNo: row.gstNo || '',
    orderNo: row.orderNo || '', customerRefNo: row.customerRefNo || '', challanDate: row.challanDate, deliveryDate: row.deliveryDate,
    fromWarehouse: row.fromWarehouse || '', salesPerson: row.salesPerson || '', currency: row.currency || 'INR',
    receiver: row.receiver || '', receiverPhone: row.receiverPhone || '',
    billingAddress: cleanAddressText(row.billingAddress), shippingAddress: cleanAddressText(row.shippingAddress), shipToDifferentCustomer: !!row.shipToDifferentCustomer, shipToCustomer: row.shipToCustomer || '', billToDifferentCustomer: false, billToCustomer: '', billToGstNo: row.billToGstNo || '', billToGstType: row.billToGstType || '', billToPanNo: row.billToPanNo || '', shipToGstNo: row.shipToGstNo || '', shipToGstType: row.shipToGstType || '', shipToPanNo: row.shipToPanNo || '',
    termsConditions: row.termsConditions || '', preparedBy: row.preparedBy || '', approvedBy: row.approvedBy || '', attachmentName: row.attachmentName || '', remarks: row.remarks || '', status: row.status || 'Pending',
    billingType: row.billingType || '', typeOfPurchase: row.typeOfPurchase || '',
    salesType: row.salesType || '', transportMode: row.transportMode || '', invoiceType: row.invoiceType || '',
    salesCategory: row.salesCategory || 'Parts', machineSerialNo: row.machineSerialNo || '', engineNo: row.engineNo || '', typeOfDc: row.typeOfDc || '', bobLinkNo: row.bobLinkNo || '', hypothecation: row.hypothecation || '',
    roadTax: row.roadTax != null ? Number(row.roadTax) : 0, roadTaxApplicable: !!row.roadTaxApplicable,
    items: (row.items && row.items.length ? row.items : [{ ...emptyItem }]).map((i) => ({
      productCode: i.productCode || '', productName: i.productName || '', description: i.description || '',
      hsnCode: i.hsnCode || '', uom: i.uom || '',
      quantity: i.quantity != null ? Number(i.quantity) : 1,
      unitPrice: i.unitPrice != null ? Number(i.unitPrice) : 0,
      discountPercent: i.discountPercent != null ? Number(i.discountPercent) : 0,
      taxPercent: i.taxPercent != null ? Number(i.taxPercent) : 0,
      taxCodeId: i.taxCodeId != null
        ? Number(i.taxCodeId)
        : (taxCodeIdByRate.get(i.taxPercent != null ? Number(i.taxPercent) : 0) ?? null),
      batchAllocations: (i.batchAllocations || []).map((b) => ({ batchNo: b.batchNo, quantity: Number(b.quantity) || 0 })),
      serialAllocations: (i.serialAllocations || []).map((s) => ({ serialNo: s.serialNo })),
      // Line-first, header-fallback — same convention as GRN's
      // toGrnItemData: a row saved before this field existed still shows the
      // challan's own From Warehouse rather than a blank.
      warehouse: i.warehouse || row.fromWarehouse || '',
    })),
  };
}

const PAGE_SIZE = 10;
const STATUS_FILTERS = ['All Status', ...CHALLAN_STATUS_OPTIONS];

// Pending (saved as draft, nothing despatched, no stock posted) grey, Open
// (despatched, not yet fully invoiced) blue, Closed (fully invoiced) green,
// Cancelled red. Only Pending vs Open is chosen by the user — via which save
// button they press; Open -> Closed is the server's, see
// recomputeDeliveryChallanStatus in backend utils/documentFlow.js.
const STATUS_COLORS = { Pending: 'default', Open: 'info', Closed: 'success', Cancelled: 'error' };

const DELIVERY_CHALLAN_LIST_TABLE_ROW_HEIGHT = 0;
const DELIVERY_CHALLAN_LIST_TABLE_CELL_PADDING_Y = 6;
export default function DeliveryChallan({ openDocNo } = {}) {
  const currentUser = useSelector(selectCurrentUser);
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const itemScrollRef = useDragScroll();
  // Phase 6 of the data-loading performance work (pure data-access, no
  // business-logic change) — this list now fetches ONE page at a time via
  // deliveryChallanApi.useListPaged (see useServerListTable below and the
  // paginatedFindMany-based /sales/delivery-challans route in
  // backend/src/routes/resources.js), instead of the whole challan table.
  // `challans`/`isLoading`/`refetchChallans` are gone; the loaded page lives
  // in `table.rows`, refetch is `refetchChallans` below.
  //
  // challansForHistory/quotations/salesOrders/invoices below stay on
  // `.useList()` — they feed cross-document lookups (Copy From,
  // allSalesDocuments) that need to see records across the whole set, not
  // one page — but that call is itself now capped server-side (see
  // paginatedFindMany's `maxPageSize`) instead of genuinely unbounded.
  const { data: challansForHistory } = deliveryChallanApi.useList();
  const { data: quotations } = salesQuotationApi.useList();
  const { data: salesOrders } = salesOrderApi.useList();
  const { data: invoices } = salesInvoiceApi.useList();
  const allSalesDocuments = useMemo(
    () => [
      ...(quotations || []),
      ...(salesOrders || []),
      ...(challansForHistory || []),
      ...(invoices || []),
    ],
    [quotations, salesOrders, challansForHistory, invoices]
  );
  const { data: customers } = customerApi.useList();
  // Supplier (Business Partner / Vendor) chosen so their logo can be printed
  // alongside the KEMACH logo — see SalesQuotation.jsx's own Supplier field.
  const { data: suppliers } = supplierApi.useList();
  const { data: products } = productApi.useList({ view: 'picker' });
  const { data: salesEmployees } = salesEmployeeApi.useList();
  const { rates: priceListRates } = usePriceListRates('CLP');
  // A Sales Order already fully fulfilled comes back from
  // recomputeSalesOrder (utils/documentFlow.js) as 'Closed' and has nothing
  // left to despatch — same terminal status Purchase Order uses (see
  // copyablePurchaseOrders in PurchaseGRN.jsx). This Copy From dialog was
  // passing the raw, unfiltered `salesOrders` list straight through, so a
  // closed order still showed up here as pickable.
  const copyableSalesOrders = useMemo(
    () => (salesOrders || []).filter((o) => o.status !== 'Closed' && o.status !== 'Cancelled'),
    [salesOrders]
  );
  const { data: taxCodes } = taxCodeApi.useList();
  // A brand-new item row's Tax (%) CFL defaults to this Tax Code instead of
  // showing empty — see pickDefaultTaxCode's own doc comment.
  const defaultTaxCode = useMemo(() => pickDefaultTaxCode(taxCodes), [taxCodes]);
  // Keyed by Tax Code id, not by rate — this document has no Place of
  // Supply/taxType filter, so a GST code and an IGST code sharing a rate
  // (e.g. both 18%) are both real, distinct options; keying by rate would
  // collapse them into one and leave no way to tell which was picked (see
  // the schema.prisma comment on DeliveryChallanItem.taxCodeId, and
  // buildTaxCodeOptions in taxCodeOptions.js).
  const taxCodeOptions = useMemo(() => buildTaxCodeOptions(taxCodes), [taxCodes]);
  // Tax (%) shows the tax code's own NAME in the closed field, which runs
  // well past the bare rate the row stores — so the item table sizes that
  // column from the rendered label it finds here, not from the raw number.
  const taxCodeById = useMemo(() => new Map(taxCodeOptions.map((o) => [o.value, o])), [taxCodeOptions]);
  // ProductCell's auto-fill effect below sets taxPercent from the product
  // master's own default tax RATE, which (same ambiguity as everywhere else
  // in this file) can't say which Tax Code that rate came from on its own —
  // so it looks the id up here too, keeping the Tax (%) select in sync with
  // the rate it just set instead of going blank.
  const taxCodeIdByRate = useMemo(() => {
    const map = new Map();
    for (const o of taxCodeOptions) if (!map.has(o.rate)) map.set(o.rate, o.value);
    return map;
  }, [taxCodeOptions]);
  const { data: company } = useGetCompanyDetailsQuery();
  // The printed challan's "Company's Bank Details" block — the first Active
  // house bank, same source SalesInvoice.jsx's and SalesQuotation.jsx's own
  // prints use, so the details are maintained in the House Bank master
  // rather than hardcoded into the print template.
  const { data: houseBanks } = houseBankApi.useList();
  const printHouseBank = useMemo(
    // Prefer the house bank flagged as the default (HouseBank.isDefault);
    // only fall back to "first Active" when no default is set.
    () => (houseBanks || []).find((b) => b.isDefault === true) || (houseBanks || []).find((b) => b.status === 'Active') || null,
    [houseBanks]
  );
  const [create, { isLoading: creating }] = deliveryChallanApi.useCreate();
  const [update, { isLoading: updating }] = deliveryChallanApi.useUpdate();
  const [remove] = deliveryChallanApi.useDelete();
  const [cancelChallan] = deliveryChallanApi.useCancel();

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
  // Looked up per row to decide whether the Batch/Serial column applies —
  // Product Master's Manage Item By select is what makes a line ask for it.
  const productsByCode = useMemo(
    () => Object.fromEntries((products || []).map((p) => [p.productCode, p])),
    [products]
  );
  const salesPersonOptions = (salesEmployees || []).map((s) => ({ label: s.employeeName, value: s.employeeName }));
  // Prepared By lists every Sales Employee; Approved By is scoped to the
  // ones flagged with approval authorization on the Sales Employee master.
  const approvedByOptions = (salesEmployees || []).filter((s) => s.approvalAuthorization === true).map((s) => ({ label: s.employeeName, value: s.employeeName }));
  // Sales orders are no longer offered as a dropdown on the form — they are
  // picked through the Copy From dialog, which scopes the list to the selected
  // customer. The raw `salesOrders` list is what that dialog takes.
  // View toggles between the challan list and the full-page Create/Edit
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

  // Warehouses come from the Warehouse Master, like every other warehouse
  // dropdown in the app now — see lib/useWarehouseOptions.js. This list used to
  // be the literal string 'Main Warehouse' plus every BRANCH name, which are
  // not warehouses at all, so a warehouse picked here could never be filtered
  // for in a stock report.
  //
  // The record's stored value is passed in because documents saved under that
  // old list hold values no warehouse matches. Without it the select would
  // render blank on those documents and the next save would rewrite a posted
  // movement's warehouse to null.
  const { options: allWarehouseOptions, warehouses } = useWarehouseOptions({ currentValue: editingRow?.fromWarehouse });
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  // Journal Entry view popup — opened from the header's "View Journal Entry"
  // icon (rendered only once editingRow.journalEntryId exists, i.e. this
  // challan already has a linked entry). Same pattern as Purchase GRN.
  const [journalViewOpen, setJournalViewOpen] = useState(false);
  // Copy From ("Find Sales Order") dialog. Held at page level rather than
  // inside AppForm's render prop so remounting the form on formKey change
  // can't leave a dialog orphaned open over a freshly reset form.
  const [copyFromOpen, setCopyFromOpen] = useState(false);
  const [dateAnchor, setDateAnchor] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [checkedIds, setCheckedIds] = useState([]);
  const [rowMenuAnchor, setRowMenuAnchor] = useState(null);
  const [rowMenuTarget, setRowMenuTarget] = useState(null);
  const pendingStatusRef = useRef('Pending');
  // { index, mode } for the item row whose "Batches Number - Selection" /
  // "Serial Numbers - Selection" dialog is open; null when closed.
  const [batchDialog, setBatchDialog] = useState(null);

  // Column definitions drive the global search, the sort icons and the
  // per-column filter popover — see useServerListTable.js. `server: true`
  // pushes that column's sort/filter to the /sales/delivery-challans route
  // (see its DELIVERY_CHALLAN_FILTER_SPEC/DELIVERY_CHALLAN_SORT_FIELDS in
  // backend/src/routes/resources.js) instead of applying it only to
  // whatever page happens to already be loaded. The Customer/Status/
  // Warehouse/Sales Person/Date Autocomplete row below (the page's own
  // bespoke filter UI) writes into this SAME `table.filters` state via
  // `table.setFilter` — one filter engine, two widgets.
  const tableColumns = useMemo(() => ([
    { field: 'id', headerName: 'Select', filter: false, searchable: false },
    { field: 'challanNo', headerName: 'Challan No.', filter: 'text', server: true },
    { field: 'orderNo', headerName: 'Order No.', filter: 'text', server: true },
    { field: 'customer', headerName: 'Customer', filter: 'text', server: true },
    { field: 'challanDate', headerName: 'Challan Date', filter: 'dateRange', server: true, sortValue: (row) => (row.challanDate ? new Date(row.challanDate).getTime() : null) },
    { field: 'deliveryDate', headerName: 'Delivery Date', filter: 'dateRange', server: true, sortValue: (row) => (row.deliveryDate ? new Date(row.deliveryDate).getTime() : null) },
    { field: 'fromWarehouse', headerName: 'From Warehouse', filter: 'text', server: true },
    { field: 'amount', headerName: 'Amount (₹)', filter: 'numberRange', server: true, sortValue: (row) => (row.amount == null || row.amount === '' ? null : Number(row.amount)) },
    { field: 'status', headerName: 'Status', filter: 'select', server: true },
    // Not a rendered column (`filter: false` keeps it out of the generic
    // filter panel) — exists only so the Sales Person Autocomplete below has
    // a `server: true` slot to write into via table.setFilter.
    { field: 'salesPerson', headerName: 'Sales Person', filter: false, server: true },
  ]), []);
  const table = useServerListTable(deliveryChallanApi.useListPaged, {
    columns: tableColumns,
    initialPageSize: PAGE_SIZE,
  });
  const { page, setPage, pageSize, setPageSize } = table;
  const rows = table.rows;
  const filteredRows = rows;
  const pagedRows = rows;
  const isLoading = table.isLoading;
  const refetchChallans = table.refetch;

  const customerFilter = table.filters.customer ? { value: table.filters.customer } : null;
  const setCustomerFilter = (v) => table.setFilter('customer', v?.value || '');
  const statusFilter = table.filters.status || 'All Status';
  const setStatusFilter = (v) => table.setFilter('status', v === 'All Status' ? '' : v);
  const warehouseFilter = table.filters.fromWarehouse ? { value: table.filters.fromWarehouse } : null;
  const setWarehouseFilter = (v) => table.setFilter('fromWarehouse', v?.value || '');
  const salesPersonFilter = table.filters.salesPerson ? { value: table.filters.salesPerson } : null;
  const setSalesPersonFilter = (v) => table.setFilter('salesPerson', v?.value || '');
  const challanDateFilter = table.filters.challanDate || {};
  const dateFrom = challanDateFilter.from ? dayjs(challanDateFilter.from) : null;
  const dateTo = challanDateFilter.to ? dayjs(challanDateFilter.to) : null;
  const setDateFrom = (v) => table.setFilter('challanDate', { ...challanDateFilter, from: v ? v.format('YYYY-MM-DD') : '' });
  const setDateTo = (v) => table.setFilter('challanDate', { ...challanDateFilter, to: v ? v.format('YYYY-MM-DD') : '' });

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
    if (editingRow && editingRow.challanNo === openDocNo) return;
    const match = rows.find((r) => r.challanNo === openDocNo);
    if (match) handleView(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDocNo, rows]);

  // "Copy To > Delivery Challan" lands the browser on this page's route, but
  // that alone used to leave the user on the LIST view — the intent-
  // consuming effect that actually applies the source document's data lives
  // inside AppForm's render prop below, which only mounts once `view` is
  // 'form', so nothing happened until the user clicked "+ Add New"
  // themselves first. Mirrors the openDocNo effect just above: notice a
  // pending intent addressed to this page on arrival and open the create
  // form immediately, so the user lands straight on a pre-filled challan.
  const pendingCopyIntentForAutoOpen = useSelector((s) => s.copyIntent.pending);
  useEffect(() => {
    if (!pendingCopyIntentForAutoOpen || pendingCopyIntentForAutoOpen.targetKey !== 'deliveryChallan') return;
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

  const [printRequestChallanNo, setPrintRequestChallanNo] = useState(null);

  const handlePrint = (row) => {
    setRowMenuAnchor(null);
    handleView(row);
    setPrintRequestChallanNo(row.challanNo);
  };

  useEffect(() => {
    if (!printRequestChallanNo) return;
    if (!editingRow || editingRow.challanNo !== printRequestChallanNo) return;
    setPrintRequestChallanNo(null);
    const returnToListAfterPrint = () => {
      window.removeEventListener('afterprint', returnToListAfterPrint);
      backToList();
    };
    window.addEventListener('afterprint', returnToListAfterPrint);
    printDeliveryChallan();
  }, [printRequestChallanNo, editingRow]);

  const handleDelete = async (row) => {
    setRowMenuAnchor(null);
    const ok = await confirmDialog({
      title: 'Delete challan',
      message: `Are you sure you want to delete "${row.challanNo}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Challan deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  // Cancel — a soft alternative to Delete: the challan stays in the list
  // (status becomes "Cancelled") but is dropped from every Copy From / "pick
  // a source document" picker downstream (see copyableChallans in
  // SalesInvoice.jsx / SalesReturn.jsx) and View/Edit/Print get blocked for
  // it below, once isCancelled is true. Only allowed while no live
  // (non-cancelled) Sales Invoice still references it — the backend
  // enforces this and returns a clear message if not, same as Purchase
  // Order's identical Cancel action.
  const handleCancel = async (row) => {
    setRowMenuAnchor(null);
    const ok = await confirmDialog({
      title: 'Cancel delivery challan',
      message: `Are you sure you want to cancel "${row.challanNo}"? This cannot be undone.`,
      confirmLabel: 'Cancel Challan',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await cancelChallan(row.id).unwrap();
      notify.success('Delivery challan cancelled');
    } catch (err) {
      notify.error(err?.data?.message || 'Cancel failed');
    }
  };

  const removeSelected = async () => {
    const ok = await confirmDialog({
      title: 'Delete selected challans',
      message: `Delete ${checkedIds.length} selected challan${checkedIds.length > 1 ? 's' : ''}? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await Promise.all(checkedIds.map((id) => remove(id).unwrap()));
      notify.success('Selected challans deleted');
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
    // check, not the only line of defence.
    const allocationError = validateBatchSerialAllocation(values.items, productsByCode);
    if (allocationError) {
      notify.error(allocationError);
      return;
    }
    const payload = { ...values, status: pendingStatusRef.current };
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...payload }).unwrap();
        notify.success('Challan updated');
      } else {
        await create(payload).unwrap();
        notify.success('Challan saved');
      }
      backToList();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  const dateRangeLabel = dateFrom && dateTo
    ? `${dateFrom.format('DD/MM/YYYY')} - ${dateTo.format('DD/MM/YYYY')}`
    : 'Select date range';

  if (openDocNo && (!editingRow || editingRow.challanNo !== openDocNo)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box>
      <EntityHeaderCard
        icon={<LocalShippingOutlinedIcon />}
        title="Delivery Challan"
        subtitle={view === 'form' ? 'Create a new delivery challan.' : 'Manage and track all delivery challans.'}
        rightContent={<CompanyBadge />}
      />

      {view === 'form' ? (
        <RouteMapContextMenu flow="sales" type="challan" docNo={editingRow?.challanNo}>
          <AppForm
            key={formKey}
            schema={deliveryChallanSchema}
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
              // BOB Link No. is only shown (and only required -- see
              // deliveryChallanSchema) next to Type of DC when that's set to
              // "Warranty". Clearing it the moment Type of DC changes away
              // from Warranty stops a value typed in, then hidden by
              // switching the classification, from silently riding along to
              // Save as leftover data on a non-Warranty despatch.
              const typeOfDcValue = watch('typeOfDc');
              const prevTypeOfDcRef = useRef(typeOfDcValue);
              useEffect(() => {
                const prevTypeOfDc = prevTypeOfDcRef.current;
                prevTypeOfDcRef.current = typeOfDcValue;
                if (prevTypeOfDc === typeOfDcValue) return;
                if (typeOfDcValue !== 'Warranty') setValue('bobLinkNo', '');
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [typeOfDcValue]);
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
                  taxCodeId: taxMatch ? taxMatch.id : null,
                  taxPercent: taxMatch ? (Number(taxMatch.taxRate) || 0) : 0,
                  warehouse: raw.warehouse || (watch('fromWarehouse') || ''),
                };
              };
              const handleItemsImported = (rawItems) => {
                append(rawItems.map(resolveImportedItem));
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
                  taxCodeId: item.taxCodeId || null,
                  taxPercent: Number(item.taxPercent) || 0,
                  warehouse: item.warehouse || watch('fromWarehouse') || '',
                }));

                if (isFirstItemEmpty) {
                  replaceItems(mappedItems);
                } else {
                  mappedItems.forEach((item) => append(item));
                }
                setSmartAddOpen(false);
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
              const challanDateValue = watch('challanDate');
              const challanDateForMin = challanDateValue ? dayjs(challanDateValue) : null;
              const today = dayjs();
              const deliveryDateMinDate = challanDateForMin && challanDateForMin.isAfter(today, 'day') ? challanDateForMin : today;

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
                { header: 'Tax %', get: (i) => taxCodeById.get(i?.taxCodeId)?.label ?? i?.taxPercent, field: 'select' },
                null,
                { header: 'Amount (₹)', get: (i) => ((Number(i?.quantity) || 0) * (Number(i?.unitPrice) || 0)).toFixed(2), field: 'plain', min: 110 },
                null,
              ]);
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
              const roadTaxWatched = watch('roadTax');
              const roadTaxApplicable = watch('roadTaxApplicable');
              const totals = computeTotals(itemsForTotals, 0, interState, { roadTax: roadTaxWatched, roadTaxApplicable });
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

              const branch = watch('branch');

              // Once Branch is picked, the Warehouse dropdown is scoped to
              // that branch's warehouses only — see useWarehouseOptions.js.
              // Lines can each carry their own warehouse, distinct from the
              // header's From Warehouse — every one of them must survive
              // edit/view even when it isn't in the currently-selected
              // branch's list — see useWarehouseOptions.js.
              const { options: branchWarehouseOptions } = useWarehouseOptions({
                currentValue: [editingRow?.fromWarehouse, ...watchedItems.map((i) => i.warehouse)],
                branch,
              });

              const allValues = watch();
              const printCustomerRecord = (customers || []).find((c) => c.customerName === allValues.customer);
              // The chosen Supplier's own Business Partner row — carries
              // logoUrl/logoVisible for DeliveryChallanPrintable's
              // supplier-logo block.
              const printSupplierRecord = (suppliers || []).find((s) => s.supplierName === allValues.supplier);
              const printSalesOrderRecord = (salesOrders || []).find((o) => o.orderNo === allValues.orderNo);
              // The challan's own Branch resolved against Branch Master — see
              // SalesOrderPrintable.jsx's branchRecord prop.
              const printBranchRecord = (branches || []).find((b) => (b.branchName || '').trim() === (allValues.branch || '').trim());
              // items: itemsForTotals so each line carries its resolved
              // taxType -- DeliveryChallanPrintable's own local recompute
              // reads item.taxType to detect a TCS-typed line, and the raw
              // watched item only ever has taxCodeId.
              const printOrder = { ...allValues, items: itemsForTotals, status: editingRow?.status || 'Pending' };
              // See SalesInvoice.jsx's identical approverSignatureUrl comment.
              const approverSignatureUrl = (salesEmployees || []).find((s) => s.employeeName === allValues.approvedBy)?.signatureUrl || null;

              const customerValue = watch('customer');
              const supplierValue = watch('supplier');
              // Newly added field -- see the DeliveryChallan Prisma model
              // comment on `currency`. Same hardcoded-list hook every other
              // sales document uses (see lib/currencyOptions.js).
              const currencyOptions = useCurrencyOptions();
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
                    setValue('contactPerson', found.salesPerson || '', { shouldValidate: true });
                    // Billing Address/Shipping Address are frozen fields now —
                    // always the selected customer's own Business Partner
                    // Billing/Shipping address, never hand-typed.
                    // Bill To follows the customer (SalesShipTo's SalesBillTo keeps the picked Billing address).
                    if (!watch('billToDifferentCustomer')) setValue('billingAddress', customerAddressFor(found, 'Billing'), { shouldValidate: true });
                    // Ship To keeps the address picked under "Ship to a different customer"
                    // (see SalesShipTo) instead of snapping back to this customer's own.
                    if (!watch('shipToDifferentCustomer')) setValue('shippingAddress', customerAddressFor(found, 'Shipping'), { shouldValidate: true });
                    setValue('billingType', deriveBillingType(found), { shouldValidate: true });
                    setValue('gstNo', customerGstNo(found), { shouldValidate: true });
                  }
                  prevCustomer.current = customerValue;
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [customerValue]);

              // Copy From pulls in every field that exists on the chosen order —
              // contact person, addresses, sales person, delivery date, terms &
              // conditions, remarks, and item lines — so the challan doesn't
              // have to be re-keyed from scratch.
              //
              // Those header fields used to render `disabled`, on the grounds
              // that they aren't challan-specific data. That also made a challan
              // with no order behind it impossible to enter: with Customer
              // itself locked, there was no way to fill the form at all. They are
              // editable now.
              //
              // The customer is not copied back either — the dialog was already
              // filtered by it, so it can only hold the value it already has.
              //
              // The item columns used to render `disabled` too, but a delivery
              // does not always match its order exactly — a substituted
              // product, a corrected HSN/unit/rate, or a challan raised
              // against no order at all ("Add Item" produced a row that could
              // never be filled in). They are editable now; the order lookup
              // still pre-fills them, it just no longer forbids a correction.
              //
              // Challan No./Date, From Warehouse, and each item's Batch/Serial
              // No. aren't part of a sales order and were already editable.
              // Also syncs the customer-effect's own "previous value" ref so
              // it doesn't re-fire and clobber the values just set here from
              // the order's snapshot (same class of bug fixed on Purchase
              // Order's Reference/Contact Person).
              //
              // This used to run as an effect watching the Sales Order No.
              // dropdown. It is a plain function now, called only from the
              // dialog's Choose button: an effect keyed on a form value also
              // fires when that value is restored on edit or reset, which is why
              // it needed the prevOrderNo bookkeeping to tell "user picked an
              // order" apart from "form loaded". An explicit call has no such
              // ambiguity.
              //         const applyOrder = (found) => {
              //           if (found) {
              //             setValue('orderNo', found.orderNo || '', { shouldValidate: true });
              //             setValue('branch', found.branch || '', { shouldValidate: true });
              //             prevCustomer.current = found.customer || '';
              //             setValue('contactPerson', found.contactPerson || '', { shouldValidate: true });
              //             setValue('salesPerson', found.salesPerson || '', { shouldValidate: true });
              //             setValue('billingAddress', found.billingAddress || '', { shouldValidate: true });
              //             setValue('shippingAddress', found.shippingAddress || '', { shouldValidate: true });
              //             setValue('deliveryDate', found.deliveryDate || null, { shouldValidate: true });
              //             setValue('termsConditions', found.termsConditions || '', { shouldValidate: true });
              //             setValue('remarks', found.remarks || '', { shouldValidate: true });
              //             if (found.items && found.items.length) {
              //               const fromWhs = watch('fromWarehouse') || '';
              //               const openItems = found.items
              //               .map((i,n) => {
              //                 const totalQty = i.quantity != null ? Number(i.quantity) : 0;
              //                 const delivered = i.deliveredQuantity != null ? Number(i.deliveredQuantity) : 0;
              //                 const remaining = Math.max(0, round2(totalQty - delivered));
              //                 return { item: i, line: n+1, qty: delivered > 0 ? remaining : totalQty };
              //               })
              //               .filter(({ qty }) => qty > 0.005);
              //               // replaceItems(), not setValue('items', ...) — replace()
              //               // is useFieldArray's own API and gives every row a fresh
              //               // field id, which remounts each ProductCell instead of
              //               // reusing the old one. That matters because ProductCell
              //               // has its own auto-fill effect keyed off productCode
              //               // changing; reused (not remounted) cells saw productCode
              //               // change from '' to the order's value, treated it as a
              //               // user picking a product, and overwrote the tax rate and
              //               // unit price we just set here with the *product master's*
              //               // defaults — so a line saved at 18% on the order silently
              //               // came in as whatever the product's own default tax rate
              //               // was (e.g. 12%) on the challan.
              //         //       replaceItems(found.items.map((i, n) => ({
              //         //         productCode: i.productCode || '', productName: i.productName || '', description: i.description || '',
              //         //         hsnCode: i.hsnCode || '', uom: i.uom || '',
              //         //         quantity: i.quantity != null ? Number(i.quantity) : 1,
              //         //         unitPrice: i.unitPrice != null ? Number(i.unitPrice) : 0,
              //         //         taxPercent: i.taxPercent != null ? Number(i.taxPercent) : 0,
              //         //         taxCodeId: i.taxCodeId != null ? Number(i.taxCodeId) : null,
              //         //         batchNo: '',
              //         //         batchAllocations: [], serialAllocations: [],
              //         //         // Sales orders don't carry a warehouse of their own —
              //         //         // fall back to this challan's own From Warehouse,
              //         //         // exactly as a freshly Added row would.
              //         //         warehouse: i.warehouse || '',
              //         //         // Copy From: this line came from the order's line n.
              //         //         baseType: 'Sales Order',
              //         //         baseEntry: found.id ?? null,
              //         //         baseNo: found.orderNo || null,
              //         //         baseLine: n + 1,
              //         //       })));
              //         //     }
              //         //   }
              //         // };
              //         replaceItems(
              //   openItems.length
              //     ? openItems.map(({ item: i, line, qty }) => ({
              //         productCode: i.productCode || '',
              //         productName: i.productName || '',
              //         description: i.description || '',
              //         hsnCode: i.hsnCode || '',
              //         uom: i.uom || '',
              //         quantity: qty,
              //         unitPrice: i.unitPrice != null ? Number(i.unitPrice) : 0,
              //         taxPercent: i.taxPercent != null ? Number(i.taxPercent) : 0,
              //         taxCodeId: i.taxCodeId != null ? Number(i.taxCodeId) : null,
              //         batchNo: '',
              //         batchAllocations: [],
              //         serialAllocations: [],
              //         warehouse: i.warehouse || fromWhs,
              //         baseType: 'Sales Order',
              //         baseEntry: found.id ?? null,
              //         baseNo: found.orderNo || null,
              //         baseLine: line,
              //       }))
              //     : [{ ...emptyItem, warehouse: fromWhs }]
              // );
              //             }
              //           }

              const applyOrder = (found) => {
                if (found) {
                  setValue('orderNo', found.orderNo || '', { shouldValidate: true });
                  setValue('branch', found.branch || '', { shouldValidate: true });
                  // Via this page's own Copy From dialog the customer is
                  // already fixed (the dialog was filtered by it), so
                  // this is a no-op there. But applyOrder is also called
                  // from the Copy To intent effect below, landing on a
                  // brand new challan with no customer picked at all —
                  // there, leaving this out meant Customer never came
                  // across from Copy To.
                  setValue('customer', found.customer || '', { shouldValidate: true });
                  prevCustomer.current = found.customer || '';
                  // A second, unrelated party field — the Business
                  // Partner (Vendor) picked purely so its logo prints
                  // alongside the KEMACH logo. Distinct from Customer
                  // above; missed entirely in the first pass at this fix.
                  setValue('supplier', found.supplier || '', { shouldValidate: true });
                  setValue('contactPerson', found.contactPerson || '', { shouldValidate: true });
                  setValue('salesPerson', found.salesPerson || '', { shouldValidate: true });
                  // Billing Address/Shipping Address are frozen/derived —
                  // re-derive from the order's own customer's Business
                  // Partner record rather than copying the order's
                  // (now-legacy) stored strings.
                  {
                    const orderCustomerRecord = (customers || []).find((c) => c.customerName === found.customer);
                    applySalesPartyAddresses(setValue, found, orderCustomerRecord, customerAddressFor);
                    setValue('billingType', deriveBillingType(orderCustomerRecord), { shouldValidate: true });
                    setValue('gstNo', customerGstNo(orderCustomerRecord), { shouldValidate: true });
                  }
                  // found.deliveryDate should always be set (Sales Order
                  // requires it too), but falling back to Challan Date +
                  // 7 days rather than null keeps this document savable
                  // even on the rare row that somehow has none, now that
                  // Delivery Date has no visible field to fix it from.
                  setValue('deliveryDate', found.deliveryDate || dayjs(watch('challanDate') || new Date()).add(7, 'day').toDate(), { shouldValidate: true });
                  setValue('termsConditions', found.termsConditions || '', { shouldValidate: true });
                  setValue('remarks', found.remarks || '', { shouldValidate: true });
                  setValue('customerRefNo', found.customerRefNo || found.referenceNo || '', { shouldValidate: true });
                  // Carried on the order but previously left behind on
                  // Copy To — see the matching fix on SalesOrder.jsx's
                  // own applyQuotation.
                  setValue('receiver', found.receiver || '', { shouldValidate: true });
                  setValue('receiverPhone', found.receiverPhone || '', { shouldValidate: true });
                  setValue('preparedBy', found.preparedBy || '', { shouldValidate: true });
                  setValue('approvedBy', found.approvedBy || '', { shouldValidate: true });
                  setValue('typeOfPurchase', found.typeOfPurchase || '', { shouldValidate: true });
                  setValue('salesType', found.salesType || '', { shouldValidate: true });
                  setValue('transportMode', found.transportMode || '', { shouldValidate: true });
                  setValue('invoiceType', found.invoiceType || '', { shouldValidate: true });
                  // Machine Serial No./Engine No./Hypothecation and the
                  // Sales Type they depend on were missed when this Copy
                  // From/To mapping was originally written -- they didn't
                  // exist yet. salesCategory MUST be set before (or in
                  // the same tick as) machineSerialNo: MachineryCodeSelect's
                  // creatable/read-only behaviour reads watch('salesCategory')
                  // live, so setting it after would leave a copied
                  // Machine serial sitting in a field still locked to
                  // strict Parts mode for one render.
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
                  // No visible Road Tax field on this document -- the
                  // order's own manually-entered amount (gated by the
                  // same toggle) is copied straight across so this
                  // challan's Grand Total still agrees with the order's.
                  setValue('roadTaxApplicable', !!found.roadTaxApplicable, { shouldValidate: true });
                  setValue('roadTax', found.roadTaxApplicable ? (found.roadTax != null ? Number(found.roadTax) : 0) : 0, { shouldValidate: true });
                  if (found.items && found.items.length) {
                    const fromWhs = watch('fromWarehouse') || '';
                    const openItems = found.items
                      .map((i, n) => {
                        const totalQty = i.quantity != null ? Number(i.quantity) : 0;
                        const delivered = i.deliveredQuantity != null ? Number(i.deliveredQuantity) : 0;
                        const remaining = Math.max(0, round2(totalQty - delivered));
                        return { item: i, line: n + 1, qty: delivered > 0 ? remaining : totalQty };
                      })
                      .filter(({ qty }) => qty > 0.005);

                    const mappedItems = openItems.length
                      ? openItems.map(({ item: i, line, qty }) => ({
                        productCode: i.productCode || '',
                        productName: i.productName || '',
                        description: i.description || '',
                        hsnCode: i.hsnCode || '',
                        uom: i.uom || '',
                        quantity: qty,
                        unitPrice: (i.unitPrice != null ? Number(i.unitPrice) : null) ?? priceListRates?.get(i.productCode) ?? 0,
                        // No visible Discount % column on this
                        // document -- carried through anyway so a line
                        // copied from a discounted order still prices
                        // out to the same amount (see
                        // deliveryChallanItemSchema's own comment).
                        discountPercent: i.discountPercent != null ? Number(i.discountPercent) : 0,
                        taxPercent: i.taxPercent != null ? Number(i.taxPercent) : 0,
                        taxCodeId: i.taxCodeId != null ? Number(i.taxCodeId) : null,
                        batchAllocations: [],
                        serialAllocations: [],
                        warehouse: i.warehouse || fromWhs,
                        baseType: 'Sales Order',
                        baseEntry: found.id ?? null,
                        baseNo: found.orderNo || null,
                        baseLine: line,
                      }))
                      : [{ ...emptyItem, warehouse: fromWhs }];
                    replaceItems(mappedItems);
                    // Belt-and-braces: each row's own Product Code cell
                    // (ProductCell) has its own master-lookup effect that
                    // re-fills Description/HSN/Unit/Rate from the Product
                    // Master the instant it notices a productCode change.
                    // replaceItems() giving every row a fresh field id is
                    // meant to stop that effect from treating this as a
                    // "change" in the first place, but that guard has been
                    // observed losing the race in practice (reported: Rate
                    // landing at the Product Master's own default instead
                    // of the order's). Reasserting the order's own values a
                    // moment later — after that cell's effect has had every
                    // chance to run and lose — guarantees the copied
                    // figures win regardless of exactly how that race goes.
                    if (openItems.length) {
                      setTimeout(() => {
                        mappedItems.forEach((item, idx) => {
                          setValue(`items.${idx}.unitPrice`, item.unitPrice, { shouldValidate: true });
                          setValue(`items.${idx}.hsnCode`, item.hsnCode, { shouldValidate: true });
                          setValue(`items.${idx}.uom`, item.uom, { shouldValidate: true });
                          setValue(`items.${idx}.productName`, item.productName, { shouldValidate: true });
                          setValue(`items.${idx}.taxPercent`, item.taxPercent, { shouldValidate: true });
                          setValue(`items.${idx}.discountPercent`, item.discountPercent, { shouldValidate: true });
                          // ProductCell's own effect also resets
                          // taxCodeId off the Product Master's default
                          // rate the instant it sees productCode change
                          // (see the comment on that effect) -- it's the
                          // one field the reassert above was missing, so
                          // a TCS-typed tax code silently lost its TCS
                          // flag to whatever plain GST/IGST code happens
                          // to share its rate, and TCS quietly dropped
                          // out of the copied total.
                          setValue(`items.${idx}.taxCodeId`, item.taxCodeId, { shouldValidate: true });
                        });
                      }, 60);
                    }
                  }
                }
              };

              // "Copy To > Delivery Challan" from a Sales Quotation — not
              // reachable from this page's own Copy From button (which
              // only ever offers Sales Order), only from the intent-
              // consuming effect below. Billing/delivery direct off the
              // quotation, so there is no despatched-quantity arithmetic
              // to do — every quotation line comes across in full, same
              // as a freshly Added row.
              const applyQuotation = (found) => {
                if (found) {
                  setValue('branch', found.branch || '', { shouldValidate: true });
                  // Only reachable via Copy To — see the matching note
                  // on applyOrder above.
                  setValue('customer', found.customer || '', { shouldValidate: true });
                  prevCustomer.current = found.customer || '';
                  // A second, unrelated party field — the Business
                  // Partner (Vendor) picked purely so its logo prints
                  // alongside the KEMACH logo. Distinct from Customer
                  // above; missed entirely in the first pass at this fix.
                  setValue('supplier', found.supplier || '', { shouldValidate: true });
                  setValue('contactPerson', found.contactPerson || '', { shouldValidate: true });
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
                  // Carried on the quotation but previously left behind
                  // on Copy To — see the matching fix on SalesOrder.jsx's
                  // own applyQuotation.
                  setValue('receiver', found.receiver || '', { shouldValidate: true });
                  setValue('receiverPhone', found.receiverPhone || '', { shouldValidate: true });
                  setValue('preparedBy', found.preparedBy || '', { shouldValidate: true });
                  setValue('approvedBy', found.approvedBy || '', { shouldValidate: true });
                  setValue('typeOfPurchase', found.typeOfPurchase || '', { shouldValidate: true });
                  setValue('salesType', found.salesType || '', { shouldValidate: true });
                  setValue('transportMode', found.transportMode || '', { shouldValidate: true });
                  setValue('invoiceType', found.invoiceType || '', { shouldValidate: true });
                  // Machine Serial No./Engine No./Hypothecation and the
                  // Sales Type they depend on were missed when this Copy
                  // From/To mapping was originally written -- they didn't
                  // exist yet. salesCategory MUST be set before (or in
                  // the same tick as) machineSerialNo: MachineryCodeSelect's
                  // creatable/read-only behaviour reads watch('salesCategory')
                  // live, so setting it after would leave a copied
                  // Machine serial sitting in a field still locked to
                  // strict Parts mode for one render.
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
                  // No visible Road Tax field on this document, and the
                  // quotation's own Road Tax is a Yes/No toggle only --
                  // its 8.2% amount is computed on the fly from the
                  // quotation's own items/discount and never stored (see
                  // the matching fix on SalesOrder.jsx's own
                  // applyQuotation). Recompute that same figure here off
                  // the quotation's own items, resolving each line's
                  // taxType from taxCodeId first -- buildDocument reads
                  // taxType straight off the item and does not derive it
                  // itself, so a TCS-typed quotation line would otherwise
                  // be invisible to the 8.2% base amount.
                  setValue('roadTaxApplicable', !!found.roadTaxApplicable, { shouldValidate: true });
                  if (found.roadTaxApplicable && found.items && found.items.length) {
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
                  // "Copy To > Delivery Challan" from a Sales Quotation — not
                  // reachable from this page's own Copy From button (which
                  // only ever offers Sales Order), only from the intent-
                  // consuming effect below. Billing/delivery direct off the
                  // quotation, so there is no despatched-quantity arithmetic
                  // to do — every quotation line comes across in full, same
                  // as a freshly Added row.
                  if (found.items && found.items.length) {
                    const fromWhs = watch('fromWarehouse') || '';
                    const mappedItems = found.items.map((i, n) => ({
                      productCode: i.productCode || '',
                      productName: i.productName || '',
                      description: i.description || '',
                      hsnCode: i.hsnCode || '',
                      uom: i.uom || '',
                      quantity: i.quantity != null ? Number(i.quantity) : 1,
                      unitPrice: (i.unitPrice != null ? Number(i.unitPrice) : null) ?? priceListRates?.get(i.productCode) ?? 0,
                      // No visible Discount % column on this document --
                      // carried through anyway so a line copied from a
                      // discounted quotation still prices out to the same
                      // amount (see deliveryChallanItemSchema's own
                      // comment).
                      discountPercent: i.discountPercent != null ? Number(i.discountPercent) : 0,
                      taxPercent: i.taxPercent != null ? Number(i.taxPercent) : 0,
                      taxCodeId: i.taxCodeId != null ? Number(i.taxCodeId) : null,
                      batchAllocations: [],
                      serialAllocations: [],
                      warehouse: i.warehouse || fromWhs,
                      baseType: 'Sales Quotation',
                      baseEntry: found.id ?? null,
                      baseNo: found.quotationNo || null,
                      baseLine: n + 1,
                    }));
                    replaceItems(mappedItems);
                    // Belt-and-braces reassert — see the matching comment
                    // on applyOrder above.
                    setTimeout(() => {
                      mappedItems.forEach((item, idx) => {
                        setValue(`items.${idx}.unitPrice`, item.unitPrice, { shouldValidate: true });
                        setValue(`items.${idx}.hsnCode`, item.hsnCode, { shouldValidate: true });
                        setValue(`items.${idx}.uom`, item.uom, { shouldValidate: true });
                        setValue(`items.${idx}.productName`, item.productName, { shouldValidate: true });
                        setValue(`items.${idx}.taxPercent`, item.taxPercent, { shouldValidate: true });
                        setValue(`items.${idx}.discountPercent`, item.discountPercent, { shouldValidate: true });
                        // See the matching comment on applyOrder's own
                        // reassert above -- ProductCell's effect resets
                        // taxCodeId off the Product Master's default rate
                        // too, which silently drops a TCS-typed code's
                        // TCS flag if left unreasserted.
                        setValue(`items.${idx}.taxCodeId`, item.taxCodeId, { shouldValidate: true });
                      });
                    }, 60);
                  }
                }
              };

              // Undo a Copy From: drop the link and the values that came across
              // with it, rather than leaving a stale order's figures sitting in a
              // challan that no longer claims to reference it.
              //
              // The customer is deliberately NOT cleared. It is the user's own
              // selection — it is what made Copy From available in the first
              // place, and clearing it would close the dialog off and force a
              // re-pick just to try a different order from the same customer.
              // Contact Person and the addresses stay too: they belong to the
              // customer, not the order.
              const orderNoValue = watch('orderNo');
              const clearOrder = () => {
                setValue('orderNo', '', { shouldValidate: true });
                setValue('salesPerson', '', { shouldValidate: true });
                // Delivery Date has no visible field to re-set it from once
                // Copy From is undone (see getEmptyValues' own comment) --
                // null would leave the document permanently unable to pass
                // validation with no way to fix it, so this falls back to
                // the same Challan Date + 7 days default a brand-new
                // challan starts with, rather than null.
                setValue('deliveryDate', dayjs(watch('challanDate') || new Date()).add(7, 'day').toDate(), { shouldValidate: true });
                setValue('termsConditions', '', { shouldValidate: true });
                setValue('remarks', '', { shouldValidate: true });
                setValue('customerRefNo', '', { shouldValidate: true });
                replaceItems([{ ...emptyItem, warehouse: watch('fromWarehouse') || '' }]);
              };

              // Switching Branch invalidates a Warehouse choice that doesn't
              // belong to the new branch. Skipped on the very first render so
              // loading an existing record for edit/view doesn't wipe a value
              // it just loaded.
              const prevBranchRef = useRef(branch);
              useEffect(() => {
                if (prevBranchRef.current === branch) return;
                prevBranchRef.current = branch;
                const allowed = warehouseCodesForBranch(warehouses, branch);
                if (watch('fromWarehouse') && !allowed.has(watch('fromWarehouse'))) setValue('fromWarehouse', '');
                // Same invalidation, per row — a line's own Warehouse has no
                // more meaning under the new branch than the header's did.
                (watch('items') || []).forEach((it, idx) => {
                  if (it.warehouse && !allowed.has(it.warehouse)) setValue(`items.${idx}.warehouse`, '');
                });
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [branch]);

              const headerWarehouse = watch('fromWarehouse');
              const prevHeaderWarehouseRef = useRef(headerWarehouse);
              useEffect(() => {
                if (prevHeaderWarehouseRef.current === headerWarehouse) return;
                const oldWh = prevHeaderWarehouseRef.current;
                prevHeaderWarehouseRef.current = headerWarehouse;
                if (!headerWarehouse) return;
                (watch('items') || []).forEach((it, idx) => {
                  if (!it.warehouse || it.warehouse === oldWh) setValue(`items.${idx}.warehouse`, headerWarehouse, { shouldValidate: true });
                });
              }, [headerWarehouse])

              // Tracks, per row (keyed by field.id so it survives index
              // shifts from add/remove), whether that line's Quantity
              // exceeds live available stock in its own selected Warehouse —
              // computed by AvailableStockCell below via useWarehouseStock.
              // No static zod rule can express this (it needs a live server
              // fetch), so it is component state that gates the Save
              // buttons, mirroring StockIssue.jsx's identical idiom. A
              // challan that posts always moves stock (unlike SalesInvoice,
              // which is conditional on deliveryChallanNo), so this check
              // applies to every line unconditionally.
              const [stockErrors, setStockErrors] = useState({});
              const handleStockErrorChange = React.useCallback((fieldId, hasError) => {
                setStockErrors((prev) => {
                  if (!!prev[fieldId] === hasError) return prev;
                  const next = { ...prev, [fieldId]: hasError };
                  if (!hasError) delete next[fieldId];
                  return next;
                });
              }, []);
              const hasStockError = Object.keys(stockErrors).length > 0;

              const handleFile = (file) => {
                if (file) setValue('attachmentName', file.name, { shouldValidate: true });
              };

              // Consume a pending "Copy To" intent addressed to this page —
              // see copyIntentSlice.js.
              useEffect(() => {
                if (!pendingCopyIntent || pendingCopyIntent.targetKey !== 'deliveryChallan') return;
                if (pendingCopyIntent.sourceType === 'salesOrder') applyOrder(pendingCopyIntent.sourceDoc);
                else if (pendingCopyIntent.sourceType === 'salesQuotation') applyQuotation(pendingCopyIntent.sourceDoc);
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
                    onChoose={applyOrder}
                    documents={copyableSalesOrders}
                    party={customerValue}
                    partyField="customer"
                    partyLabel="customer"
                    title="Find Sales Order"
                    columns={SALES_ORDER_COPY_COLUMNS}
                    emptyMessage="No sales orders found for"
                  />
                  <DeliveryChallanPrintable
                    order={printOrder}
                    company={company}
                    customerRecord={printCustomerRecord}
                    supplierRecord={printSupplierRecord}
                    salesOrderRecord={printSalesOrderRecord}
                    branchRecord={printBranchRecord}
                    houseBank={printHouseBank}
                    approverSignatureUrl={approverSignatureUrl}
                  />
                  <Card variant="outlined" sx={{ mb: 2 }}>
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                        <Typography variant="subtitle1" fontWeight={700}>
                          {readOnly ? 'Customer & Document Details (View Only)' : 'Customer & Document Details'}
                        </Typography>
                        <Button type="button" variant="outlined" color="inherit" startIcon={<ArrowBackIcon />} onClick={backToList}>
                          Back to List
                        </Button>
                      </Stack>

                      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, width: '100%', display: 'block' }}>
                        {/* Left column: Branch, Customer, Contact Person,
                Bill To, Sales Person. Right column: Challan
                No., Challan Date, Delivery Date, Ship To.
                Listed left-item, right-item per row so the 2-column
                grid lays out the two stacks rather than flowing
                row-major top to bottom — same convention as Purchase
                Order's "Supplier & Document Details". Sales Order
                No. (Copy From-only) is no longer shown on this card
                — it still exists on the record and still submits
                with the form, just with no visible input. */}
                        {/* Laid out as the 10 left|right pairs requested:
                Sales Type|Challan No, Branch|Challan Date, Customer
                Code|Contact No, Customer Name|GST No, Currency|Sales
                Person, Supplier Code|Supplier Name, Receiver|Receiver
                Phone No, Bill To|Ship To, Machine No|Engine No,
                Hypothecation. Currency was added specifically for
                this -- this document never had one before (see the
                DeliveryChallan Prisma model's own comment on it) --
                so it now matches Sales Quotation/Order's layout
                exactly. Delivery Date isn't on the sheet at all and
                wasn't flagged for removal, so it's kept, on its own,
                after Hypothecation. Customer Reference No. is
                hidden per the sheet's explicit "remove" note (kept
                mounted, not removed, so its defaultValue/schema
                wiring stays intact -- it still submits whatever
                value it holds, it's just not shown). FormGrid fills
                left-to-right/top-to-bottom in child order, so the
                pairing above is exactly this list's order; a hidden
                (display:none) field drops out of grid layout
                entirely, so it doesn't disturb that. The Machine
                fields are folded into this same grid rather than
                their own dedicated one -- nothing here actually
                conditionally shows/hides them despite the removed
                comment's claim, so sharing one grid is safe. */}
                        <FormGrid columns={2} singleColumnOnMobile rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                          <LabeledField label="Sales Type *">
                            <FormSelect name="salesCategory" label="" placeholder="Select sales type" options={SALES_CATEGORY_OPTIONS} />
                          </LabeledField>
                          <LabeledField label="Challan No. *">
                            <DocumentSeriesNoField documentCode="DC" seriesFieldName="seriesId" numberFieldName="challanNo" isCreate={!editingRow} />
                          </LabeledField>
                          <LabeledField label="Type of DC *">
                            <FormSelect name="typeOfDc" label="" placeholder="Select type of DC" options={TYPE_OF_DC_OPTIONS} />
                          </LabeledField>
                          <LabeledField label="Delivery Date *">
                            <FormDatePicker name="deliveryDate" label="" minDate={deliveryDateMinDate} triggerFields={['challanDate']} />
                          </LabeledField>

                          <LabeledField label="Branch *">
                            <FormSelect name="branch" label="" placeholder="Select branch" options={branchOptions} />
                          </LabeledField>
                          <LabeledField label="Challan Date *">
                            <FormDatePicker name="challanDate" label="" triggerFields={['deliveryDate']} />
                          </LabeledField>

                          {/* Customer drives this form now: it is picked first, it
                  enables Copy From, and it scopes the order list that
                  dialog shows. It used to be disabled and filled only
                  by the order dropdown, which made a challan without
                  an order impossible to enter. The fields below it are
                  auto-filled but left editable for the same reason —
                  a delivery often goes to a different contact or
                  address than the order recorded. */}
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
                            <FormTextField name="contactPerson" label="" placeholder="Auto-filled from order/customer" disabled />
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
                  fields of matching height, same convention as
                  Sales Quotation/Order. */}
                          <LabeledField label="Currency *">
                            <FormSelect name="currency" label="" options={currencyOptions} />
                          </LabeledField>
                          <LabeledField label="Sales Person *">
                            <FormSelect name="salesPerson" label="" placeholder="Select sales person" options={salesPersonOptions} />
                          </LabeledField>

                          {/* Supplier — a Business Partner (Vendor), separate from
                  the Customer above, chosen purely so their logo can be
                  printed next to the KEMACH logo when the partner's own
                  Logo Visibility is Yes (see
                  DeliveryChallanPrintable.jsx). Paired with a read-only
                  Supplier Name echo, same Code-field/Name-echo pattern
                  as Customer/Customer Name above. */}
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


                          {typeOfDcValue === 'Warranty' && (
                            <LabeledField label="BOB Link No. *">
                              <FormTextField name="bobLinkNo" label="" placeholder="Enter BOB link no." />
                            </LabeledField>
                          )}



                          {/* Hidden per request -- kept mounted (not removed)
                  so its defaultValue/schema wiring and the
                  challanDate/deliveryDate triggerFields cascade both
                  stay intact; it still submits whatever value it
                  holds, it's just not shown. */}
                          <Box sx={{ display: 'none' }}>

                          </Box>
                        </FormGrid>
                      </fieldset>

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

                  <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, width: '100%', display: 'block' }}>
                    <Card variant="outlined" sx={{ mb: 2 }}>
                      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                          <Typography variant="subtitle1" fontWeight={700}>Item Details</Typography>
                          <Stack direction="row" spacing={1.5}>
                            <Button type="button" variant="outlined" color="inherit" size="small" startIcon={<UploadFileIcon />} onClick={() => setItemsImportOpen(true)}>
                              Import from Excel
                            </Button>
                            <Button type="button" variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => append(withDefaultTaxCode({ ...emptyItem, warehouse: watch('fromWarehouse') || '' }, liveDefaultTaxCode))}>
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

                        {isMobile ? (
                          <Box>
                            {fields.map((field, index) => {
                              const qty = Number(watch(`items.${index}.quantity`)) || 0;
                              const price = Number(watch(`items.${index}.unitPrice`)) || 0;
                              const rowAmount = qty * price;
                              return (
                                <MobileItemCard
                                  key={field.id}
                                  index={index}
                                  amount={rowAmount.toFixed(2)}
                                  onRemove={() => removeItem(index)}
                                  removeDisabled={fields.length <= 1}
                                >
                                  <ProductCell index={index} methods={methods} options={productCodeOptions} products={products} taxCodeIdByRate={taxCodeIdByRate} priceListRates={priceListRates} label="Item No *" placeholder="Select product code" />
                                  <ProductCell index={index} methods={methods} options={productNameOptions} products={products} taxCodeIdByRate={taxCodeIdByRate} priceListRates={priceListRates} label="Description" placeholder="Select product name" />
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
                                  </Box>
                                  {/* No available-stock hint at all on a
                                  Claims/Services document — it moves no stock. */}
                                  {!isNonStockCategory && (
                                    <Box sx={{ mt: 0.5 }}>
                                      <AvailableStockCell index={index} methods={methods} fieldId={field.id} onErrorChange={handleStockErrorChange} products={products} />
                                    </Box>
                                  )}
                                  <Box sx={{ mt: 1.5 }}>
                                    <BatchSerialCell index={index} methods={methods} product={productsByCode[watch(`items.${index}.productCode`)]} onOpen={(mode) => setBatchDialog({ index, mode })} />
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
                                  <TableCell>Tax %</TableCell>
                                  <TableCell>Batch/Serial Selection</TableCell>
                                  <TableCell align="right">Amount (₹)</TableCell>
                                  <TableCell width={48} />
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {fields.map((field, index) => {
                                  const qty = Number(watch(`items.${index}.quantity`)) || 0;
                                  const price = Number(watch(`items.${index}.unitPrice`)) || 0;
                                  const rowAmount = qty * price;
                                  return (
                                    <TableRow key={field.id} sx={{ '& > td': { verticalAlign: 'middle' } }}>
                                      <TableCell>{index + 1}</TableCell>
                                      <TableCell>
                                        <ProductCell index={index} methods={methods} options={productCodeOptions} products={products} taxCodeIdByRate={taxCodeIdByRate} priceListRates={priceListRates} placeholder="Select product code" />
                                      </TableCell>
                                      <TableCell>
                                        <ProductCell index={index} methods={methods} options={productNameOptions} products={products} taxCodeIdByRate={taxCodeIdByRate} priceListRates={priceListRates} placeholder="Select product name" />
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
                                        {!isNonStockCategory && (
                                          <AvailableStockCell index={index} methods={methods} fieldId={field.id} onErrorChange={handleStockErrorChange} products={products} />
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        <FormTextField name={`items.${index}.unitPrice`} label="" type="number" />
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
                                      <TableCell>
                                        <BatchSerialCell index={index} methods={methods} product={productsByCode[watch(`items.${index}.productCode`)]} onOpen={(mode) => setBatchDialog({ index, mode })} />
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
                          {/* Remarks removed from this form. */}
                          <Grid item xs={12} md={4} sx={{ display: 'flex' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Terms & Conditions</Typography>
                              <FormTextField name="termsConditions" label="" placeholder="Enter terms and conditions" multiline rows={6} disabled
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
                              <DocumentTotalsPanel totals={totals} interState={interState} discountField={null} />
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
                          sourceType="deliveryChallan"
                          sourceDoc={editingRow}
                          sourceLabel="Delivery Challan"
                          docNoField="challanNo"
                          targets={[
                            { key: 'salesReturn', label: 'Sales Return', path: '/sales/return' },
                            { key: 'salesInvoice', label: 'Sales Invoice', path: '/sales/invoice' },
                            { key: 'salesCreditMemo', label: 'Sales Credit Memo', path: '/sales/credit-memo' },
                          ]}
                        />
                        {/* Copy From sits immediately left of Cancel and stays
                  disabled until a Customer is chosen — the dialog it
                  opens lists that customer's sales orders, so with no
                  customer there is nothing for it to show. Hidden in
                  view mode, where nothing is being filled in. */}
                        {!readOnly && (
                          orderNoValue ? (
                            <Button
                              fullWidth={isMobile}
                              type="button"
                              variant="outlined"
                              color="inherit"
                              startIcon={<CloseIcon />}
                              onClick={clearOrder}
                              disabled={creating || updating}
                            >
                              Clear Copied Order
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
                        <Button fullWidth={isMobile} type="button" variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => printDeliveryChallan()}>
                          Print
                        </Button>
                        {!readOnly && (
                          <>
                            <FormSubmitButton
                              fullWidth={isMobile}
                              variant="outlined"
                              onClick={() => { pendingStatusRef.current = 'Pending'; }}
                              disabled={creating || updating || hasStockError}
                              loading={creating || updating}
                            >
                              Save as Draft
                            </FormSubmitButton>
                            <FormSubmitButton
                              fullWidth={isMobile}
                              startIcon={<PrintOutlinedIcon />}
                              onClick={() => { pendingStatusRef.current = 'Open'; }}
                              disabled={creating || updating || hasStockError}
                              loading={creating || updating}
                            >
                              {editingRow ? 'Update Challan' : 'Save & Print'}
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
                      docNo={editingRow?.challanNo}
                      itemNumber={watch(`items.${batchDialog.index}.productCode`)}
                      itemDescription={watch(`items.${batchDialog.index}.productName`)}
                      warehouseCode={watch(`items.${batchDialog.index}.warehouse`) || watch('fromWarehouse')}
                      warehouseName={(allWarehouseOptions.find((w) => w.value === (watch(`items.${batchDialog.index}.warehouse`) || watch('fromWarehouse'))) || {}).label}
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
                  <ImportItemsDialog
                    open={itemsImportOpen}
                    onClose={() => setItemsImportOpen(false)}
                    resourceName="Items"
                    templateUrl="/sales/delivery-challans/items-import/template"
                    importUrl="/sales/delivery-challans/items-import"
                    onImported={handleItemsImported}
                  />
                  <SmartAddHistoryDialog
                    open={smartAddOpen}
                    onClose={() => setSmartAddOpen(false)}
                    onImport={handleSmartAddImport}
                    customer={watch('customer')}
                    documents={allSalesDocuments}
                    products={products || []}
                    defaultWarehouse={watch('fromWarehouse') || ''}
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
              <Typography variant="subtitle1" fontWeight={700}>Delivery Challan List</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap sx={{ width: { xs: '100%', sm: 'auto' } }}>
                <TableSearchFilter table={table} placeholder="Search by challan no., order no., customer..." showFilter={false} />
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
                        Create Challan
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
                    label="From Warehouse"
                    allLabel="All Warehouses"
                    options={allWarehouseOptions}
                    value={warehouseFilter}
                    onChange={(v) => { setWarehouseFilter(v); setPage(0); }}
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
                    title={row.challanNo}
                    statusChip={<Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />}
                    fields={[
                      { label: 'Customer', value: row.customer || '—' },
                      { label: 'Order No.', value: row.orderNo || '—' },
                      { label: 'Challan Date', value: row.challanDate ? dayjs(row.challanDate).format('DD/MM/YYYY') : '—' },
                      { label: 'Delivery Date', value: row.deliveryDate ? dayjs(row.deliveryDate).format('DD/MM/YYYY') : '—' },
                      { label: 'Amount', value: `₹${Number(row.amount).toFixed(2)}` },
                    ]}
                    // Cancelled challans are fully locked — no Edit/Delete/
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
                  <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />} title="No delivery challans found" message="Add your first delivery challan to get started" />
                )}
              </Box>
            ) : (
              <ScrollableTableContainer>
                <Table
                  size="small"
                  stickyHeader
                  sx={{
                    '& th, & td': {
                      height: DELIVERY_CHALLAN_LIST_TABLE_ROW_HEIGHT,
                      paddingTop: `${DELIVERY_CHALLAN_LIST_TABLE_CELL_PADDING_Y}px`,
                      paddingBottom: `${DELIVERY_CHALLAN_LIST_TABLE_CELL_PADDING_Y}px`,
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
                      <SortableHeaderCell field="challanNo" sort={table.sort} onSort={table.toggleSort}>Challan No.</SortableHeaderCell>
                      <SortableHeaderCell field="orderNo" sort={table.sort} onSort={table.toggleSort}>Order No.</SortableHeaderCell>
                      <SortableHeaderCell field="customer" sort={table.sort} onSort={table.toggleSort}>Customer</SortableHeaderCell>
                      <SortableHeaderCell field="challanDate" sort={table.sort} onSort={table.toggleSort}>Challan Date</SortableHeaderCell>
                      <SortableHeaderCell field="deliveryDate" sort={table.sort} onSort={table.toggleSort}>Delivery Date</SortableHeaderCell>
                      <SortableHeaderCell field="fromWarehouse" sort={table.sort} onSort={table.toggleSort}>From Warehouse</SortableHeaderCell>
                      <SortableHeaderCell align="right" field="amount" sort={table.sort} onSort={table.toggleSort}>Amount (₹)</SortableHeaderCell>
                      <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
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
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.challanNo}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.orderNo || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.customer || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.challanDate ? dayjs(row.challanDate).format('DD/MM/YYYY') : '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.deliveryDate ? dayjs(row.deliveryDate).format('DD/MM/YYYY') : '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.fromWarehouse || '—'}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{Number(row.amount).toFixed(2)}</TableCell>
                        <TableCell>
                          <Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />
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
                            <RouteMapButton flow="sales" type="challan" docNo={row.challanNo} />
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
                        <TableCell colSpan={11}>
                          <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />} title="No delivery challans found" message="Add your first delivery challan to get started" />
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
        resourceName="Delivery Challans"
        templateUrl="/sales/delivery-challans/bulk-import/template"
        importUrl="/sales/delivery-challans/bulk-import"
        onImported={refetchChallans}
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
function ProductCell({ index, methods, options, products, taxCodeIdByRate, priceListRates, label = '', placeholder = 'Select product', disabled = false, multiline = false, sx }) {
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
          setValue(`items.${index}.taxPercent`, 0, { shouldValidate: true });
          setValue(`items.${index}.taxCodeId`, null, { shouldValidate: true });
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
        const productTaxRate = found.taxRate != null ? Number(found.taxRate) : 0;
        setValue(`items.${index}.taxPercent`, productTaxRate, { shouldValidate: true });
        // Keep the Tax (%) select (bound to taxCodeId, not the raw rate — see
        // taxCodeOptions.js) in sync with the rate just set above, instead of
        // going blank because nothing here ever touched taxCodeId.
        setValue(`items.${index}.taxCodeId`, taxCodeIdByRate?.get(productTaxRate) ?? null, { shouldValidate: true });
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

// Shows nothing for a None-tracked (or unrecognised) product — the column
// only means something once Product Master's Manage Item By is Batch or
// Serial for the row's selected product. Otherwise a button that opens the
// matching "... - Selection" dialog, labelled with how much of the line is
// selected so far so an incomplete line is visible without opening it.
function BatchSerialCell({ index, methods, product, onOpen }) {
  const { watch } = methods;
  const trackingMode = product?.manageItemBy;
  if (trackingMode !== 'Batch' && trackingMode !== 'Serial') {
    return <Typography variant="caption" color="text.secondary">—</Typography>;
  }
  const needed = Number(watch(`items.${index}.quantity`)) || 0;
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

// Live "Available: N" hint for this row's own selected Warehouse, and the
// component-state half of the quantity<=available-stock rule — re-fetched
// automatically (via useWarehouseStock/RTK Query) whenever this row's
// Warehouse or product changes, and re-compared whenever Quantity changes.
// No static zod rule can express this since it needs a live server value;
// instead this reports up to the parent's stockErrors map (keyed by the
// field's stable id so it survives row add/remove reordering), which gates
// the Save buttons. Mirrors StockIssue.jsx's AvailableStockCell exactly.
// A challan always posts stock when saved (challanLines in stockTable.js,
// direction 'out') — assertNoNegativeWarehouseStockFor on the server (see
// resources.js) is the actual authority; this is the early client-side hint.
function AvailableStockCell({ index, methods, fieldId, onErrorChange, products }) {
  const { watch } = methods;
  const productCode = watch(`items.${index}.productCode`);
  const lineWarehouse = watch(`items.${index}.warehouse`);
  const headerWarehouse = watch('fromWarehouse');
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
    // Clear this row's error if it unmounts (row removed) rather than
    // leaving a stale entry behind forever.
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
