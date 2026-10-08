import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatPartnerAddress, cleanAddressText } from '../../lib/addressFormat';
import usePriceListRates from '../../hooks/usePriceListRates';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import {
  Box, Typography, Button, Card, CardContent, Stack, TextField, InputAdornment, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton, Menu, MenuItem,
  ListItemIcon, ListItemText, Checkbox, Autocomplete, Popover, Grid, Tooltip,
  Collapse, CircularProgress,
} from '@mui/material';
import { useFieldArray } from 'react-hook-form';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import EventIcon from '@mui/icons-material/Event';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import AppForm, { FormGrid } from '../../components/form/AppForm';
import BatchSerialSetupDialog from '../../components/common/BatchSerialSetupDialog';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import WarehouseCodeSelect from '../../components/form/WarehouseCodeSelect';
import PartyCodeSelect, { buildPartyCodeOptions } from '../../components/form/PartyCodeSelect';
import { FormCheckbox } from '../../components/form/FormCheckbox';
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
import { goodsReceivedNoteSchema, GRN_STATUS_OPTIONS } from '../../lib/validation/purchaseSchemas';
import { buildDocument, round2, num, isInterState, computeFreightGross, computeItemDiscountTotal } from '../../lib/documentTotals';
import DocumentTotalsPanel from '../../components/form/DocumentTotalsPanel';
import { goodsReceivedNoteApi, purchaseOrderApi, supplierApi, customerApi, productApi, taxCodeApi, salesEmployeeApi } from '../../features/resources';
import { useBranchNameOptions } from '../../lib/useBranchOptions';
import { productOptionsFor, PRODUCT_USAGE } from '../../lib/productUsage';
import { useWarehouseOptions, warehouseCodesForBranch } from '../../lib/useWarehouseOptions';
import { buildTaxCodeOptions, taxTypeFamilyFor, buildTaxCodeIdByRate, pickDefaultTaxCode, withDefaultTaxCode } from '../../lib/taxCodeOptions';
import { itemTableSx } from '../../lib/columnWidth';
import { useGetCompanyDetailsQuery } from '../../features/company/companyDetailsApi';
import { getStateOptions } from '../../lib/constants/locations';
import { branchAddressLines } from '../../lib/branchAddress';
import DocumentSeriesNoField from '../../components/form/DocumentSeriesNoField';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
import PurchaseOtherDetailsCard from '../../components/common/PurchaseOtherDetailsCard';
import PurchaseGRNPrintable, { printPurchaseGRN } from '../../components/print/PurchaseGRNPrintable';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer, { dragScrollbarSx } from '../../components/data-display/ScrollableTableContainer';

import { CanAdd, CanEdit, CanDelete, CanCancel } from '../../components/common/PermissionGate';
import { canDelete } from '../../config/deleteConfig';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import BulkImportDialog from '../../components/common/BulkImportDialog';
import ImportItemsDialog from '../../components/common/ImportItemsDialog';
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
// Columns for the "Find Purchase Order" dialog opened by Copy From.
const PO_COPY_COLUMNS = [
  { field: 'poNo', headerName: 'Order No', nowrap: true },
  { field: 'supplier', headerName: 'Vendor Name' },
  { field: 'poDate', headerName: 'Order Date', type: 'date' },
  { field: 'remarks', headerName: 'Comments', type: 'optional' },
];

const PLACE_OF_SUPPLY_OPTIONS = getStateOptions('India');

// Ship From is a free-text box auto-filled from the selected supplier's own
// Business Partner record — its Addresses tab, default Billing address —
// same pattern as Purchase Order's own shipFrom (see PurchaseOrder.jsx and
// supplierShipFrom/lastAutoShipFromRef below). `suppliers` rows here already
// carry `.addresses` because supplierApi is a thin alias over GET
// /business-partners (see features/resources.js), which includes addresses
// on every row.
function formatBusinessPartnerAddress(addr) {
  // Address Name, Street, Street No, Building/Floor/Room, Block, Country,
  // State, City, Zip Code -- see lib/addressFormat.js (no double commas).
  return formatPartnerAddress(addr);
}

const emptyItem = {
  productCode: '', productName: '', description: '', hsnCode: '', uom: '',
  // Which warehouse this line receives into — independently picked per row,
  // same as Stock Transfer's per-line fromWarehouse/toWarehouse.
  warehouse: '',
  // poQuantity is hidden from this form's UI (per request) but kept on the
  // data model — still written by Copy From, purely a reference figure.
  poQuantity: 0, receivedQuantity: 1, unitPrice: 0,
  taxPercent: 0, taxCodeId: null,
  // Populated via the "Batches - Setup" / "Serial Numbers - Setup" dialog —
  // see BatchSerialSetupDialog and the Batch/Serial column below. Empty
  // unless the selected product's Manage Item By is Batch or Serial.
  batches: [], serials: [],
  // Machine Serial No / Machine Model — shown (and only ever meaningful)
  // when the HEADER's Purchase Type is 'Machine', unlike Batch/Serial above
  // which is gated on each line's own product. See isMachinePurchase below.
  machineSerialNo: '', machineModel: '', machineEngineNo: '',
};

/**
 * Blocks the GRN save when a Batch/Serial-tracked line's received quantity
 * isn't fully accounted for — the client-side half of the same rule the
 * server enforces in assertBatchSerialAllocation (utils/businessRules.js).
 * Runs here too so the user sees the problem immediately, on the row that
 * has it, instead of waiting on a round trip to be told the same thing.
 */
function validateBatchSerialAllocation(items, productsByCode) {
  // Serial numbers are unique system-wide (see the ProductSerial schema
  // comment), so any reuse across two lines of this GRN is flagged here.
  //
  // Batch numbers, on a Purchase GRN, are unique PER GRN, not per item or
  // per warehouse — see assertUniqueBatchesAndSerials's doc comment
  // (batchScope: 'grn') in utils/businessRules.js, which this mirrors. The
  // same batch number is free to repeat across as many lines of THIS GRN
  // as needed (any item, any warehouse), so there is nothing to flag
  // within the document here. Reuse of that batch number against a number
  // already saved on a DIFFERENT GRN is caught server-side
  // (assertUniqueBatchesAndSerials in utils/businessRules.js), since this
  // form has no visibility into what already exists in the database.
  const seenSerialNos = new Map();

  for (let i = 0; i < (items || []).length; i++) {
    const item = items[i];
    const trackingMode = productsByCode[item.productCode]?.manageItemBy;
    const label = item.productCode || `Row ${i + 1}`;

    for (const s of item.serials || []) {
      const no = (s.serialNo || '').trim();
      if (!no) continue;
      if (seenSerialNos.has(no)) return `Serial number "${no}" is used on more than one line.`;
      seenSerialNos.set(no, i);
    }

    if (trackingMode !== 'Batch' && trackingMode !== 'Serial') continue;
    const qty = Number(item.receivedQuantity) || 0;

    if (trackingMode === 'Batch') {
      const allocated = (item.batches || []).reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
      if (Math.abs(allocated - qty) > 0.005) {
        return `${label}: allocate ${qty} to batches via "Batches - Setup" — currently ${allocated}.`;
      }
    } else {
      const count = (item.serials || []).length;
      if (count !== qty) {
        return `${label}: assign ${qty} serial number(s) via "Serial Numbers - Setup" — currently ${count}.`;
      }
    }
  }
  return null;
}

function getEmptyValues(preparedBy, defaultTaxCode) {
  return {
    grnNo: '', seriesId: '', branch: '', supplier: '', receivedDate: new Date(),
    // PO No./PO Date stay in the form's data shape (hidden, not removed —
    // Copy From still writes them) even though neither has a visible field
    // any more. Challan Date/Delivery Date/Received By/Notes are gone
    // outright — no longer collected at all.
    poNo: '', poDate: null, deliveryChallanNo: '', vendorRefNo: '',
    placeOfSupply: '', shipFrom: '', supplierState: '', shipTo: '',
    shipToDifferentCustomer: false, shipToCustomer: '',
    termsConditions: '', attachmentName: '', status: 'Open',
    // "Other Details" card — see PurchaseOtherDetailsCard.jsx. Same field
    // set/CFL behaviour as Purchase Order's own Other Details card.
    billingType: '', purchaseType: '', typeOfPurchase: '', salesType: '',
    purchaseEmployee: '', transportMode: '',
    preparedBy: preparedBy || '', approvedBy: '',
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
function computeTotals(items, discountPercent, interState = false, extraCharges = {}) {
  const { totals } = buildDocument(items, discountPercent, {
    quantityField: 'receivedQuantity',
    interState,
    roundOff: true,
    freightAmount: extraCharges.freightNetAmount,
  });
  // Road Tax Amount has been removed from this document's UI/print and no
  // longer feeds the grand total. Freight Charges mirrors the Sales
  // documents' Freight Charges feature exactly (see FreightChargesEditor.jsx)
  // and is folded into grandTotal here so the panel and the saved record
  // can't disagree.
  const freightGrossAmount = computeFreightGross(extraCharges.freightNetAmount, extraCharges.freightTaxAmount);
  return {
    ...totals,
    totalItems: (items || []).length,
    discount: computeItemDiscountTotal(items, { quantityField: 'receivedQuantity' }),
    freightGrossAmount,
    grandTotal: round2(totals.amount + num(extraCharges.freightTaxAmount)),
  };
}

function rowToFormValues(row, taxCodes) {
  const taxCodeIdByRate = buildTaxCodeIdByRate(taxCodes);
  return {
    grnNo: row.grnNo, seriesId: '', branch: row.branch || '', supplier: row.supplier || '', receivedDate: row.receivedDate,
    poNo: row.poNo || '', poDate: row.poDate || null, deliveryChallanNo: row.deliveryChallanNo || '',
    vendorRefNo: row.vendorRefNo || '', placeOfSupply: row.placeOfSupply || '',
    shipFrom: cleanAddressText(row.shipFrom), supplierState: row.supplierState || '', shipTo: cleanAddressText(row.shipTo),
    shipToDifferentCustomer: !!row.shipToDifferentCustomer, shipToCustomer: row.shipToCustomer || '',
    termsConditions: row.termsConditions || '', attachmentName: row.attachmentName || '',
    status: row.status || 'Open',
    billingType: row.billingType || '', purchaseType: row.purchaseType || '',
    typeOfPurchase: row.typeOfPurchase || '', salesType: row.salesType || '',
    purchaseEmployee: row.purchaseEmployee || '', transportMode: row.transportMode || '',
    preparedBy: row.preparedBy || '', approvedBy: row.approvedBy || '',
    freightTransportId: row.freightTransportId != null ? Number(row.freightTransportId) : null,
    freightName: row.freightName || '', freightRemarks: row.freightRemarks || '',
    freightTaxCodeId: row.freightTaxCodeId != null ? Number(row.freightTaxCodeId) : null,
    freightTaxAmount: row.freightTaxAmount != null ? Number(row.freightTaxAmount) : 0,
    freightNetAmount: row.freightNetAmount != null ? Number(row.freightNetAmount) : 0,
    freightGrossAmount: row.freightGrossAmount != null ? Number(row.freightGrossAmount) : 0,
    items: (row.items && row.items.length ? row.items : [{ ...emptyItem }]).map((i) => ({
      productCode: i.productCode || '', productName: i.productName || '', description: i.description || '',
      hsnCode: i.hsnCode || '', uom: i.uom || '',
      // No header warehouse to fall back to any more — each line owns its
      // own (see the Item Details card).
      warehouse: i.warehouse || '',
      poQuantity: i.poQuantity != null ? Number(i.poQuantity) : 0,
      receivedQuantity: i.receivedQuantity != null ? Number(i.receivedQuantity) : 1,
      unitPrice: i.unitPrice != null ? Number(i.unitPrice) : 0,
      taxPercent: i.taxPercent != null ? Number(i.taxPercent) : 0,
      taxCodeId: i.taxCodeId != null
        ? Number(i.taxCodeId)
        : (taxCodeIdByRate.get(i.taxPercent != null ? Number(i.taxPercent) : 0) ?? null),
      // Coerced like receivedQuantity/unitPrice above — the API returns a
      // saved batch line's quantity as a string, and productBatchLineSchema
      // wants a number. Left uncoerced, a batch-tracked GRN loaded permanently
      // invalid and the Save button (gated on live schema validation in
      // AppForm.jsx's FormSubmitButton) never enabled. Same fix as
      // StockReceipt.jsx; the schema now preprocesses this too.
      // Only `quantity` needs it — every other field on a batch row is a
      // string or a date, and dates are preprocessed by optionalDate().
      batches: (i.batches || []).map((b) => ({
        ...b,
        quantity: b.quantity != null ? Number(b.quantity) : 0,
      })),
      // No coercion for serials: productSerialLineSchema has no numeric fields.
      serials: i.serials || [],
      // Only ever meaningful (and only ever shown) when the HEADER's
      // Purchase Type is 'Machine' — see isMachinePurchase. Reload as ''
      // like every other free-text line field, whatever the header's
      // current Purchase Type happens to be on open.
      machineSerialNo: i.machineSerialNo || '', machineModel: i.machineModel || '', machineEngineNo: i.machineEngineNo || '',
    })),
  };
}

const PAGE_SIZE = 10;
const STATUS_FILTERS = ['All Status', ...GRN_STATUS_OPTIONS];

// Draft (saved but nothing received, no stock posted) grey, Open (received,
// not yet fully invoiced) blue, Closed (fully invoiced) green, Cancelled red.
// Only Draft vs Open is chosen by the user — via which save button they
// press; Open -> Closed is the server's, see recomputeGrnStatus in backend
// utils/documentFlow.js.
const STATUS_COLORS = {
  Draft: 'default', Open: 'info', Closed: 'success', Cancelled: 'error',
};

const GRN_LIST_TABLE_ROW_HEIGHT = 0;
const GRN_LIST_TABLE_CELL_PADDING_Y = 6;
export default function PurchaseGRN({ openDocNo } = {}) {
  const currentUser = useSelector(selectCurrentUser);
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const itemScrollRef = useDragScroll();
  // Both of these lists are HEADERS ONLY now, and bounded server-side (see
  // GET /purchase/grn and GET /purchase/orders). Between them they were what
  // made this page take minutes to open on live data: neither route had a
  // `take`, so the page pulled every GRN ever received — with each one's
  // items, and each item's batches AND serials, which grow with units
  // received rather than with documents — plus every purchase order ever
  // raised with all of its lines. Anything needing a document's actual lines
  // now fetches that one document by id (see openDocument and the Copy From
  // handler below).
  const { data: grns, isLoading, refetch: refetchGrns } = goodsReceivedNoteApi.useList();
  const { data: purchaseOrders } = purchaseOrderApi.useList({ includeItems: 'false' });
  const [fetchGrnById] = goodsReceivedNoteApi.useLazyGet();
  const [fetchPurchaseOrderById] = purchaseOrderApi.useLazyGet();
  const [openingDoc, setOpeningDoc] = useState(false);
  // A Purchase Order already marked Closed has nothing left to receive, so
  // it's dropped from the Copy From dialog's pickable list. A Cancelled one
  // (PurchaseOrder.jsx's Cancel action) is dropped the same way — it was
  // never actually placed, so there is nothing to raise a GRN against.
  const copyablePurchaseOrders = useMemo(
    () => (purchaseOrders || []).filter((po) => po.status !== 'Closed' && po.status !== 'Cancelled'),
    [purchaseOrders]
  );
  const { data: suppliers } = supplierApi.useList();
  // "Ship to a different customer" — the Customer CFL revealed by that
  // checkbox on the Supplier & Document Details card. Same source (and same
  // pre-resolved `shippingAddress` string per row) as Purchase Invoice's own
  // shipToCustomers — see the comment there (features/resources.js's
  // toLegacyPartnerShape).
  const { data: shipToCustomers, isLoading: shipToCustomersLoading } = customerApi.useList();
  const { data: products } = productApi.useList({ view: 'picker' });
  const { data: taxCodes } = taxCodeApi.useList();
  // A brand-new item row's Tax (%) CFL defaults to this Tax Code instead of
  // showing empty — see pickDefaultTaxCode's own doc comment.
  const defaultTaxCode = useMemo(() => pickDefaultTaxCode(taxCodes), [taxCodes]);
  const { rates: priceListRates } = usePriceListRates('DLP');
  const { data: salesEmployees } = salesEmployeeApi.useList();
  // Tax % is now a Tax Code CFL: every active Tax Code master entry gets
  // its own option (never collapsed by rate — see buildTaxCodeOptions),
  // keyed by taxCodeId (not the rate), so two Tax Codes that happen to
  // share a rate both still show up in the dropdown.
  const taxCodeOptions = useMemo(() => buildTaxCodeOptions(taxCodes), [taxCodes]);
  const taxCodeById = useMemo(() => new Map(taxCodeOptions.map((o) => [o.value, o])), [taxCodeOptions]);
  // ProductCell's auto-fill effect below sets taxPercent from the product
  // master's own default tax RATE, which can't say which Tax Code that rate
  // came from on its own — so it looks the id up here too, keeping the
  // Tax % select in sync with the rate it just set instead of going blank.
  const productTaxCodeIdByRate = useMemo(() => {
    const map = new Map();
    for (const o of taxCodeOptions) if (!map.has(o.rate)) map.set(o.rate, o.value);
    return map;
  }, [taxCodeOptions]);
  const { data: company } = useGetCompanyDetailsQuery();
  const [create, { isLoading: creating }] = goodsReceivedNoteApi.useCreate();
  const [update, { isLoading: updating }] = goodsReceivedNoteApi.useUpdate();
  const [remove] = goodsReceivedNoteApi.useDelete();
  const [cancelGrn] = goodsReceivedNoteApi.useCancel();

  // Memoized so this array keeps a stable identity across renders that don't
  // touch the supplier list (e.g. typing in an unrelated field, changing the
  // list page/filters) — it used to be rebuilt on every render of this
  // component, which also meant every consumer holding onto it (FormSelect's
  // options, the filter Autocomplete) saw a "new" array each time even when
  // the underlying suppliers hadn't changed.
  const supplierOptions = useMemo(
    () => (suppliers || []).map((s) => ({ label: s.supplierName, value: s.supplierName })),
    [suppliers]
  );
  // Prepared By lists every Sales Employee; Approved By is scoped to the
  // ones flagged with approval authorization on the Sales Employee master.
  const approvedByOptions = (salesEmployees || []).filter((s) => s.approvalAuthorization === true).map((s) => ({ label: s.employeeName, value: s.employeeName }));
  // Create/edit form's Supplier field only (the shared PartyCodeSelect) —
  // shows Code/Name, value stays the supplier name. The list-view filter
  // above keeps using supplierOptions (names) unchanged.
  const supplierFieldOptions = useMemo(
    () => buildPartyCodeOptions(suppliers, 'supplierCode', 'supplierName'),
    [suppliers]
  );
  // "Ship to a different customer" Customer CFL — same buildPartyCodeOptions
  // helper as the Supplier CFL above, showing Customer Code/Name, value
  // stays the customer name (matching shipToCustomer's shape). Mirrors
  // Purchase Invoice's identical shipToCustomerFieldOptions.
  const shipToCustomerFieldOptions = useMemo(
    () => buildPartyCodeOptions(shipToCustomers, 'customerCode', 'customerName'),
    [shipToCustomers]
  );
  // Looked up per row to decide whether the Batch/Serial column applies —
  // Product Master's Manage Item By select is what makes a line ask for it.
  const productsByCode = useMemo(
    () => Object.fromEntries((products || []).map((p) => [p.productCode, p])),
    [products]
  );
  // Purchase orders are no longer offered as a dropdown on the form — they
  // are picked through the Copy From dialog, which scopes the list to the
  // selected supplier. That dialog takes the raw `purchaseOrders` list.
  // View toggles between the GRN list and the full-page Create/Edit form —
  // same page, no dialog/popup, per the standard CRUD page template.
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
  //
  // No list-view Warehouse filter exists on this page, so only the raw
  // `warehouses` array is needed here — it feeds the branch-scoped options
  // computed inside the form below, and the branch-change clear effect.
  const { warehouses } = useWarehouseOptions({ currentValue: editingRow?.warehouse });
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  // Copy From ("Find Purchase Order") dialog. Held at page level rather than
  // inside AppForm's render prop so remounting the form on formKey change
  // can't leave a dialog orphaned open over a freshly reset form.
  const [copyFromOpen, setCopyFromOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [poFilter, setPoFilter] = useState('');
  const [refFilter, setRefFilter] = useState('');
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [dateAnchor, setDateAnchor] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [checkedIds, setCheckedIds] = useState([]);
  const [rowMenuAnchor, setRowMenuAnchor] = useState(null);
  const [rowMenuTarget, setRowMenuTarget] = useState(null);
  // { index, mode } for the item row whose "Batches - Setup" / "Serial
  // Numbers - Setup" dialog is open; null when closed.
  const [batchDialog, setBatchDialog] = useState(null);
  // Journal Entry view popup — opened from the header's "View Journal Entry"
  // icon (rendered only once editingRow.journalEntryId exists, i.e. this GRN
  // already has a linked entry). See attachJournalEntryRefs in
  // routes/resources.js for how that id is resolved server-side.
  const [journalViewOpen, setJournalViewOpen] = useState(false);

  const rows = grns || [];

  const baseTableRows = useMemo(() => {
    const q = '';
    const po = poFilter.trim().toLowerCase();
    const ref = refFilter.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesSearch = !q || [r.grnNo, r.supplier, r.poNo].some((v) => String(v || '').toLowerCase().includes(q));
      const matchesSupplier = !supplierFilter || r.supplier === supplierFilter.value;
      const matchesStatus = statusFilter === 'All Status' || r.status === statusFilter;
      const matchesPo = !po || String(r.poNo || '').toLowerCase().includes(po);
      const matchesRef = !ref || String(r.deliveryChallanNo || '').toLowerCase().includes(ref);
      const gd = r.receivedDate ? dayjs(r.receivedDate) : null;
      const matchesFrom = !dateFrom || (gd && !gd.isBefore(dateFrom, 'day'));
      const matchesTo = !dateTo || (gd && !gd.isAfter(dateTo, 'day'));
      return matchesSearch && matchesSupplier && matchesStatus && matchesPo && matchesRef && matchesFrom && matchesTo;
    });
  }, [rows, supplierFilter, statusFilter, poFilter, refFilter, dateFrom, dateTo]);

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'id', headerName: 'Select', filter: false, searchable: false },
    { field: 'grnNo', headerName: 'GRN No.', filter: 'text' },
    { field: 'supplier', headerName: 'Supplier', filter: 'text' },
    { field: 'poNo', headerName: 'PO No.', filter: 'text' },
    { field: 'receivedDate', headerName: 'GRN Date', filter: 'dateRange', sortValue: (row) => (row.receivedDate ? new Date(row.receivedDate).getTime() : null) },
    // searchValue reads the stored totalItems column only. It used to also
    // join row.items.length, now undefined on a header-only list row — an
    // unguarded .length that would throw on every render of this table
    // rather than merely showing the wrong number.
    { field: 'totalItems', headerName: 'Total Items', filter: 'text', searchValue: (row) => String(row.totalItems ?? '') },
    { field: 'amount', headerName: 'Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.amount == null || row.amount === '' ? null : Number(row.amount)) },
    { field: 'status', headerName: 'Status', filter: 'select' },
    { field: 'deliveryChallanNo', headerName: 'Delivery No.', filter: 'text' },
  ]), []);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const filteredRows = table.rows;

  const pagedRows = useMemo(
    () => filteredRows.slice(page * pageSize, page * pageSize + pageSize),
    [filteredRows, page, pageSize]
  );

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

  // The list row is a header — no items, and so no batches or serials. Both
  // View and Edit fetch the whole document by id before opening the form.
  // This is a correctness requirement, not just a completeness one: saving
  // an edit replaces the GRN's lines, so a form opened on a header-only row
  // would wipe every line and every batch/serial allocation the moment it
  // was saved. A failed fetch therefore aborts rather than opening a form
  // that could do that. Returns whether the document opened, so handlePrint
  // below doesn't try to print an empty sheet.
  const openDocument = async (row, readOnlyMode) => {
    setOpeningDoc(true);
    let full;
    try {
      full = await fetchGrnById(row.id).unwrap();
    } catch (err) {
      notify.error(err?.data?.message || `Couldn't load GRN "${row.grnNo}". Please try again.`);
      return false;
    } finally {
      setOpeningDoc(false);
    }
    setEditingRow(full);
    setReadOnly(readOnlyMode);
    setFormKey((k) => k + 1);
    setView('form');
    return true;
  };

  const handleView = (row) => { openDocument(row, true); };

  // Opened from the Route Map's document preview popup: jump straight into
  // this record's own read-only View, exactly as clicking it in the list
  // would, instead of requiring the user to find and click the row.
  useEffect(() => {
    if (!openDocNo) return;
    if (editingRow && editingRow.grnNo === openDocNo) return;
    const match = rows.find((r) => r.grnNo === openDocNo);
    if (match) handleView(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDocNo, rows]);

  // "Copy To > Purchase GRN" lands the browser on this page's route, but
  // that alone used to leave the user on the LIST view — the intent-
  // consuming effect that actually applies the source document's data lives
  // inside AppForm's render prop below, which only mounts once `view` is
  // 'form', so nothing happened until the user clicked "+ Add New"
  // themselves first. Mirrors the openDocNo effect just above: notice a
  // pending intent addressed to this page on arrival and open the create
  // form immediately, so the user lands straight on a pre-filled GRN.
  const pendingCopyIntentForAutoOpen = useSelector((s) => s.copyIntent.pending);
  useEffect(() => {
    if (!pendingCopyIntentForAutoOpen || pendingCopyIntentForAutoOpen.targetKey !== 'purchaseGRN') return;
    if (view === 'form') return;
    openCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCopyIntentForAutoOpen]);

  const handleEdit = (row) => {
    setRowMenuAnchor(null);
    openDocument(row, false);
  };

  // Awaits the open rather than racing it: the document's lines now arrive
  // over the network, so the old fixed delay after a synchronous setState
  // would print a half-empty sheet on a slow connection. The 300ms below is
  // still for the render/@page work, which is what it was always for.
  const handlePrint = async (row) => {
    setRowMenuAnchor(null);
    const opened = await openDocument(row, true);
    if (!opened) return;
    // printPurchaseGRN() installs the GRN sheet's own @page rule and
    // print-scoping classes for the duration of the job (see
    // PurchaseGRNPrintable.jsx), which is what keeps the output portrait
    // and the ruled frame filling the sheet.
    setTimeout(() => printPurchaseGRN(), 300);
  };

  const handleDelete = async (row) => {
    setRowMenuAnchor(null);
    const ok = await confirmDialog({
      title: 'Delete GRN',
      message: `Are you sure you want to delete "${row.grnNo}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('GRN deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  // Cancel — a soft alternative to Delete, same feature as PurchaseOrder.jsx's
  // own Cancel action: the GRN stays in the list (status becomes
  // "Cancelled") but is dropped from every Copy From / "pick a source
  // document" picker downstream (see copyableGrns in PurchaseInvoice.jsx /
  // PurchaseReturn.jsx) and View/Edit/Print get blocked below, once
  // isCancelled is true. The backend reverses whatever stock/G/L this GRN
  // already posted and refuses the request (with a clear message) while a
  // Purchase Invoice still references it.
  const handleCancel = async (row) => {
    setRowMenuAnchor(null);
    const ok = await confirmDialog({
      title: 'Cancel GRN',
      message: `Are you sure you want to cancel "${row.grnNo}"? This cannot be undone — the GRN will be locked and hidden from Invoice/Return creation.`,
      confirmLabel: 'Cancel GRN',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await cancelGrn(row.id).unwrap();
      notify.success('GRN cancelled');
    } catch (err) {
      notify.error(err?.data?.message || 'Cancel failed');
    }
  };

  const removeSelected = async () => {
    const ok = await confirmDialog({
      title: 'Delete selected GRNs',
      message: `Delete ${checkedIds.length} selected GRN${checkedIds.length > 1 ? 's' : ''}? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await Promise.all(checkedIds.map((id) => remove(id).unwrap()));
      notify.success('Selected GRNs deleted');
      setCheckedIds([]);
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, status, setError) => {
    // A Batch/Serial-tracked line whose received quantity isn't fully
    // covered by its batches/serials cannot be saved — see
    // validateBatchSerialAllocation above. The server enforces the same
    // rule (assertBatchSerialAllocation) so this is a fast local check, not
    // the only line of defence.
    const allocationError = validateBatchSerialAllocation(values.items, productsByCode);
    if (allocationError) {
      notify.error(allocationError);
      return;
    }
    const payload = { ...values, status };
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...payload }).unwrap();
        notify.success('GRN updated');
      } else {
        await create(payload).unwrap();
        notify.success('GRN saved');
      }
      backToList();
    } catch (err) {
      notify.error(applyServerErrors(err, setError));
    }
  };

  const dateRangeLabel = dateFrom && dateTo
    ? `${dateFrom.format('DD/MM/YYYY')} - ${dateTo.format('DD/MM/YYYY')}`
    : 'Select date range';

  // `openingDoc` reuses the deep-link spinner below: opening a row is a
  // network round trip now that the list carries headers only, and without
  // this the click would sit doing nothing visible for as long as the fetch
  // takes — the one place this change could otherwise feel SLOWER than the
  // old preload-everything behaviour.
  if (openingDoc || (openDocNo && (!editingRow || editingRow.grnNo !== openDocNo))) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box>
      <EntityHeaderCard
        icon={<ReceiptLongOutlinedIcon />}
        title="Purchase GRN"
        subtitle={view === 'form' ? 'Create a new goods receipt note.' : 'Manage and track all goods receipt notes.'}
        rightContent={<CompanyBadge />}
      />

      {view === 'form' ? (
        <RouteMapContextMenu flow="purchase" type="grn" docNo={editingRow?.grnNo}>
          <AppForm
            key={formKey}
            schema={goodsReceivedNoteSchema}
            defaultValues={editingRow ? rowToFormValues(editingRow, taxCodes) : getEmptyValues(currentUser?.name || currentUser?.email, defaultTaxCode)}
            onSubmit={() => { }}
          >
            {(methods) => {
              const { control, watch, setValue, handleSubmit: rhfHandleSubmit } = methods;
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
                  receivedQuantity: raw.quantity,
                  unitPrice: raw.unitPrice,
                  taxCodeId: taxMatch ? taxMatch.id : null,
                  taxPercent: taxMatch ? (Number(taxMatch.taxRate) || 0) : 0,
                  warehouse: raw.warehouse || (''),
                };
              };
              const handleItemsImported = (rawItems) => {
                append(rawItems.map(resolveImportedItem));
              };
              const watchedItems = watch('items') || [];

              // Shadows the outer-scope selectableProducts/productCodeOptions/
              // productNameOptions (computed from editingRow?.items, a static
              // snapshot) with a live version keyed off the form's actual
              // current lines -- editingRow?.items only reflects what the
              // record looked like when the page loaded, so a product Copy
              // From (applyOrder below) just brought in from a Purchase
              // Order wasn't in that static list if it isn't purchase-
              // flagged or has since gone Inactive, and its Item No /
              // Description Select rendered blank even though the row's
              // other fields copied across fine.
              // Recomputing this from the FULL product master on every render
              // (productOptionsFor filters/maps the whole list) is wasted work
              // whenever the render was triggered by something that isn't a
              // product-code change on any line — typing in Vendor Reference No.,
              // the header Branch, etc. all re-run this render-prop function,
              // but none of them change which product codes are on the form.
              // Keyed on the joined codes (a cheap string, not the products
              // list itself) so it only recomputes when a line's product
              // actually changes, not on every keystroke elsewhere in the form.
              // Output is identical to calling productOptionsFor directly —
              // this only skips redundant re-invocations of the same inputs.
              const itemProductCodesKey = watchedItems.map((i) => i.productCode || '').join('');
              const selectableProducts = useMemo(
                () => productOptionsFor(products, PRODUCT_USAGE.PURCHASE, watchedItems.map((i) => i.productCode)),
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

              // Every column of this item table is sized to show its values IN FULL —
              // no ellipsis, no wrapping, no hover, however long the text is. The
              // spec below is positional: it mirrors the header row top to bottom,
              // and `null` leaves a column (the # counter, the action column) at
              // whatever width it already has. See itemTableSx in lib/columnWidth.js.
              //
              // itemTableSx measures every value of every column on a <canvas> to
              // size the table, which is real work at n items x ~10 measured
              // columns. Like selectableProducts above, this render-prop function
              // re-runs on every keystroke anywhere in the form, not just in the
              // item rows, so without memoizing this it re-measures the whole
              // table even while the user is typing into Vendor Reference No.
              // itemColumnsKey is a cheap plain-property join of exactly the
              // fields the columns below actually read (plus taxCodeById,
              // which changes only when the tax code master does) — when none of
              // those have changed since the last render, the expensive canvas
              // measurement is skipped and the previous (identical) sx is reused.
              // Machine Serial No / Machine Model — shown only when the
              // HEADER's Purchase Type is 'Machine' (see
              // PURCHASE_TYPE_OPTIONS in purchaseOtherDetailsOptions.js).
              // Unlike Batch/Serial above (gated per-line on each row's own
              // product), this is a single header-level switch that shows
              // or hides two whole columns for every row at once — read
              // once here rather than per line.
              const isMachinePurchase = watch('purchaseType') === 'Machine';
              const itemColumnsKey = watchedItems
                .map((i) => [
                  i?.productCode, i?.productName, i?.hsnCode, i?.uom, i?.warehouse,
                  i?.receivedQuantity, i?.unitPrice, i?.taxPercent, i?.taxCodeId,
                  i?.machineSerialNo, i?.machineModel, i?.machineEngineNo,
                ].join(''))
                .join('') + isMachinePurchase;
              const itemColumnsSx = useMemo(() => itemTableSx(watchedItems, [
                null,
                { header: 'Item No', get: (i) => i?.productCode, field: 'select' },
                { header: 'Description', get: (i) => i?.productName, field: 'select' },
                { header: 'HSN/SAC', get: (i) => i?.hsnCode, field: 'text' },
                { header: 'Unit', get: (i) => i?.uom, field: 'text' },
                { header: 'Warehouse *', get: (i) => i?.warehouse, field: 'select' },
                { header: 'Received Quantity *', get: (i) => i?.receivedQuantity, field: 'text' },
                { header: 'Unit Price (₹)', get: (i) => i?.unitPrice, field: 'text' },
                { header: 'Tax %', get: (i) => taxCodeById.get(i?.taxCodeId)?.label ?? i?.taxPercent, field: 'select' },
                // Positionally matches the two conditional <TableCell>s added
                // to the JSX below — present in this descriptor array only
                // when isMachinePurchase, exactly like the JSX, so the measured
                // widths always line up 1:1 with what's actually rendered. A
                // `null` here (rather than omitting the spread) would still
                // reserve a blank cell's worth of width for a column the table
                // isn't drawing.
                ...(isMachinePurchase ? [
                  { header: 'Machine Serial No', get: (i) => i?.machineSerialNo, field: 'text' },
                  { header: 'Machine Model', get: (i) => i?.machineModel, field: 'text' },
                  { header: 'Machine Engine No.', get: (i) => i?.machineEngineNo, field: 'text' },
                ] : []),
                null,
                { header: 'Amount (₹)', get: (i) => ((Number(i?.receivedQuantity) || 0) * (Number(i?.unitPrice) || 0)).toFixed(2), field: 'plain', min: 110 },
                null,
              ]),
                // eslint-disable-next-line react-hooks/exhaustive-deps
                [itemColumnsKey, taxCodeById, isMachinePurchase]);
              // Machine Serial No / Machine Model are only ever meaningful
              // while Purchase Type is 'Machine' — if the user picks
              // 'Machine', types into these columns, then switches Purchase
              // Type to something else, the columns disappear but the
              // now-invisible values would otherwise linger in form state
              // and silently resurface (or get saved) if the user flips
              // back. Cleared only on an actual change AWAY from 'Machine'
              // (never on first render/load, and never while just typing —
              // same prevRef guard shape as prevInterStateRef above), so an
              // existing record loaded with Purchase Type already something
              // other than 'Machine' is left alone rather than having its
              // (already-blank) fields rewritten on mount.
              const prevPurchaseTypeRef = useRef(watch('purchaseType'));
              useEffect(() => {
                const currentPurchaseType = watch('purchaseType');
                if (prevPurchaseTypeRef.current === currentPurchaseType) return;
                const wasMachine = prevPurchaseTypeRef.current === 'Machine';
                prevPurchaseTypeRef.current = currentPurchaseType;
                if (!wasMachine || currentPurchaseType === 'Machine') return;
                watchedItems.forEach((_item, idx) => {
                  setValue(`items.${idx}.machineSerialNo`, '', { shouldValidate: true });
                  setValue(`items.${idx}.machineModel`, '', { shouldValidate: true });
                  setValue(`items.${idx}.machineEngineNo`, '', { shouldValidate: true });
                });
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [isMachinePurchase]);
              // Inter-state supplies are taxed wholly as IGST. The server works
              // this out by comparing State — supplierState, auto-filled from
              // the selected SUPPLIER's own Business Partner Billing address
              // (see the supplierState effect below), NOT Place of Supply
              // (which is required here but stays on the form for
              // printing/saving only) — against the company's registered
              // state; passing the same flag here is what stops the panel
              // showing a CGST/SGST split for a record saved as IGST. A
              // purchase's GST/IGST split depends on where the supplier is
              // registered, not which branch received the goods.
              const interState = isInterState(watch('supplierState'), company?.state);
              // taxType (from each line's own taxCodeId) drives the TCS
              // carve-out in documentTotals.js's computeTotals -- see
              // buildTaxCodeOptions/taxCodeById above, which now carries
              // taxType alongside label/value/rate.
              const itemsForTotals = watchedItems.map((it) => ({ ...it, taxType: taxCodeById.get(it.taxCodeId)?.taxType || '' }));
              const freightNetAmount = watch('freightNetAmount');
              const freightTaxAmount = watch('freightTaxAmount');
              const totals = computeTotals(itemsForTotals, 0, interState, { freightNetAmount, freightTaxAmount });
              // Supplier State matching the company's own state -> GST family
              // (GST, GST+TCS) only; any other state -> IGST family (IGST,
              // IGST+TCS) only. See taxTypeFamilyFor in lib/taxCodeOptions.js.
              const taxCodeOptionsForRow = useMemo(
                () => buildTaxCodeOptions(taxCodes, { taxType: taxTypeFamilyFor(interState) }),
                [taxCodes, interState]
              );
              // Default Tax Code for a row added via "Add Item" once the
              // supplier (and so State) is known — GST@18% intra-state,
              // IGST@18% inter-state, following the same family the dropdown
              // itself is filtered to. The plain top-level defaultTaxCode
              // (GST@18%) is still what seeds getEmptyValues' very first row,
              // since no supplier is chosen yet at that point.
              const liveDefaultTaxCode = useMemo(
                () => pickDefaultTaxCode(taxCodes, { taxType: taxTypeFamilyFor(interState) }),
                [taxCodes, interState]
              );
              // A Tax Code left over from before State (supplierState)
              // flipped intra <-> inter-state (e.g. an IGST code still
              // selected on a line, then the user switches to a supplier
              // registered in the same state as the company) is no longer
              // one of the options above. Skipped on first render — same
              // prevRef pattern as PurchaseInvoice.jsx's own guard — so
              // loading an existing, already-consistent GRN for edit/view
              // never clears its rows; it only resets a row picked before
              // the user's own supplier change made it invalid.
              const prevInterStateRef = useRef(interState);
              useEffect(() => {
                if (prevInterStateRef.current === interState) return;
                prevInterStateRef.current = interState;
                const validTaxCodeIds = new Set(taxCodeOptionsForRow.map((o) => o.value));
                watchedItems.forEach((item, idx) => {
                  if (item?.taxCodeId != null && !validTaxCodeIds.has(Number(item.taxCodeId))) {
                    // Re-default to the OTHER family's plain rate (GST<->IGST)
                    // rather than clearing the field blank — the supplier's
                    // State changing is what invalidated the old code in the
                    // first place, so the row should follow it to the new
                    // family's own default, same as a brand-new row would.
                    setValue(`items.${idx}.taxCodeId`, liveDefaultTaxCode ? liveDefaultTaxCode.id : null, { shouldValidate: true });
                    setValue(`items.${idx}.taxPercent`, liveDefaultTaxCode ? liveDefaultTaxCode.rate : null, { shouldValidate: true });
                  }
                });
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [interState, taxCodeOptionsForRow, liveDefaultTaxCode]);

              // Belt-and-braces for a brand-new GRN opened before the Tax
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

              // Defaults Place of Supply to the company's own registered
              // state on a fresh create only, same as Purchase Invoice —
              // still a plain editable FormSelect afterwards, this just
              // saves re-picking the common case on every new receipt.
              useEffect(() => {
                if (company?.state && !editingRow && !watch('placeOfSupply')) {
                  setValue('placeOfSupply', company.state, { shouldValidate: true });
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [company]);

              const supplierValue = watch('supplier');
              const supplierRecord = useMemo(
                () => (suppliers || []).find((s) => s.supplierName === supplierValue),
                [suppliers, supplierValue]
              );
              // Ship From no longer comes from a picklist of the supplier's
              // Business Partner addresses. Ship To doesn't either: it now
              // defaults from the selected BRANCH's own address instead
              // (branchShipTo below, by the "branch" const declared further
              // down). Ship From is a free-text box the user may edit by
              // hand, auto-filled from the supplier's default Billing
              // address whenever the selected supplier changes — see
              // supplierShipFrom/lastAutoShipFromRef below. Same pattern as
              // Purchase Order — see that effect there (this form has no
              // Contact Person/Phone/Email fields to also sync, so there is
              // no separate "previous supplier" effect left here).

              // Supplier's default (or only) Billing address, formatted the
              // same way branchShipTo formats the branch's address for Ship
              // To — the source Ship From auto-fills from whenever the
              // selected supplier changes.
              const supplierShipFrom = useMemo(() => {
                const billing = (supplierRecord?.addresses || []).filter((a) => a.addressType === 'Billing');
                const defaultBilling = billing.find((a) => a.isDefault) || billing[0];
                return formatBusinessPartnerAddress(defaultBilling) || '';
              }, [supplierRecord]);
              // lastAutoShipFromRef mirrors lastAutoShipToRef: a supplier
              // switch only re-fills a field that still holds our own
              // previous auto-fill (or is empty) — a value the user typed
              // themselves is left alone.
              const lastAutoShipFromRef = useRef(editingRow ? null : '');
              useEffect(() => {
                if (editingRow) return;
                if (!supplierShipFrom) return;
                const current = watch('shipFrom');
                if (!current || current === lastAutoShipFromRef.current) {
                  if (supplierShipFrom !== current) {
                    setValue('shipFrom', supplierShipFrom, { shouldValidate: true });
                  }
                  lastAutoShipFromRef.current = supplierShipFrom;
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [supplierShipFrom]);

              // State — display-only, auto-filled from the same supplier
              // Billing address supplierShipFrom above reads, but never
              // hand-typed, so unlike shipFrom it needs no "don't clobber a
              // value the user typed" ref-tracking: a supplier change simply
              // overwrites it every time, and it fills in immediately for an
              // existing record too. Independent of placeOfSupply above,
              // which is required and tracks a different concept.
              const supplierState = useMemo(() => {
                const billing = (supplierRecord?.addresses || []).filter((a) => a.addressType === 'Billing');
                const defaultBilling = billing.find((a) => a.isDefault) || billing[0];
                return defaultBilling?.state || '';
              }, [supplierRecord]);
              useEffect(() => {
                setValue('supplierState', supplierState || '', { shouldValidate: true });
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [supplierState]);

              const poDateValue = watch('poDate');
              const receivedDateMinDate = [poDateValue]
                .filter(Boolean)
                .map((v) => dayjs(v))
                .reduce((max, d) => (!max || d.isAfter(max, 'day') ? d : max), null);

              const branch = watch('branch');

              // Ship To now defaults from the selected branch's own address
              // (the same Branch Master row the printable resolves via
              // printBranchRecord below), not the supplier's Business
              // Partner shipping address — see PurchaseOrder.jsx's identical
              // effect for the reasoning. branchAddressLines() returns []
              // for no/blank branch, which just leaves Ship To untouched
              // rather than forcing an empty box.
              const shipToBranchRecord = useMemo(
                () => (branches || []).find((b) => b.branchName === branch),
                [branches, branch]
              );
              const branchShipTo = useMemo(
                () => branchAddressLines(shipToBranchRecord).join('\n'),
                [shipToBranchRecord]
              );
              // lastAutoShipToRef remembers the value WE last auto-filled so
              // a branch switch only re-fills a field that still holds our
              // own previous auto-fill (or is empty) — a value the user
              // typed themselves is left alone.
              const lastAutoShipToRef = useRef(editingRow ? null : '');
              // "Ship to a different customer" — see the identical feature on
              // Purchase Invoice (PurchaseInvoice.jsx) for the full write-up.
              // Checked, it owns Ship To (via the customer-driven effect
              // below); this branch-driven effect backs off while it's
              // checked so the two don't fight over the field.
              const shipToDifferentCustomer = watch('shipToDifferentCustomer');
              useEffect(() => {
                if (editingRow) return;
                if (shipToDifferentCustomer) return;
                if (!branchShipTo) return;
                const current = watch('shipTo');
                if (!current || current === lastAutoShipToRef.current) {
                  if (branchShipTo !== current) {
                    setValue('shipTo', branchShipTo, { shouldValidate: true });
                  }
                  lastAutoShipToRef.current = branchShipTo;
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [branchShipTo, shipToDifferentCustomer]);

              // Unchecking "ship to a different customer" hands Ship To
              // straight back to the ordinary branch default above (and
              // drops whichever customer was selected) — same shape as
              // Purchase Invoice's own toggle-off effect.
              const prevShipToDifferentCustomer = useRef(shipToDifferentCustomer);
              useEffect(() => {
                if (prevShipToDifferentCustomer.current && !shipToDifferentCustomer) {
                  setValue('shipToCustomer', '', { shouldValidate: true });
                  setValue('shipTo', branchShipTo, { shouldValidate: true });
                  lastAutoShipToRef.current = branchShipTo;
                }
                prevShipToDifferentCustomer.current = shipToDifferentCustomer;
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [shipToDifferentCustomer]);

              // Selecting a Customer in the "ship to a different customer"
              // CFL fills Ship To from that Business Partner's own Shipping
              // Address — same mechanics as Purchase Invoice's identical
              // effect (shipToCustomers already carries a pre-resolved
              // `shippingAddress` string per row; see toLegacyPartnerShape in
              // features/resources.js). Ship To stays a plain editable field
              // afterwards — an edit made after autofill is what gets saved
              // and printed, not the customer's address, and the print
              // template reads the customer's name straight off the saved
              // shipToCustomer field rather than parsing it out of shipTo.
              const shipToCustomerValue = watch('shipToCustomer');
              const prevShipToCustomer = useRef(editingRow ? (editingRow.shipToCustomer || '') : '');
              useEffect(() => {
                if (shipToCustomerValue !== prevShipToCustomer.current) {
                  if (shipToDifferentCustomer) {
                    const found = (shipToCustomers || []).find((c) => c.customerName === shipToCustomerValue);
                    setValue('shipTo', found?.shippingAddress || '', { shouldValidate: true });
                  }
                  prevShipToCustomer.current = shipToCustomerValue;
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [shipToCustomerValue, shipToDifferentCustomer, shipToCustomers]);

              // Once Branch is picked, the Warehouse dropdown is scoped to
              // that branch's warehouses only — see useWarehouseOptions.js.
              // Lines can each carry their own warehouse, distinct from the
              // header's — every one of them must survive edit/view even when
              // it isn't in the currently-selected branch's list — see
              // useWarehouseOptions.js.
              const { options: branchWarehouseOptions } = useWarehouseOptions({
                currentValue: [editingRow?.warehouse, ...watchedItems.map((i) => i.warehouse)],
                branch,
              });

              const submitWithStatus = (status) => rhfHandleSubmit((values) => handleSubmit(values, status, methods.setError))();

              // Copy From pulls Branch, PO Date, delivery date, terms and the
              // item details (product, HSN/SAC, unit, PO quantity, unit price)
              // straight from the chosen PO.
              //
              // Supplier is NOT pulled across, because on this form supplier is
              // now the input rather than the output: it is what the user picks
              // first, what enables Copy From, and what the dialog filters its
              // list by. Every PO the dialog can offer already belongs to that
              // supplier, so copying it back would only ever re-set it to the
              // value it already holds.
              //
              // The pulled columns used to render `disabled`, on the grounds
              // that they aren't GRN-specific data. In practice that made the
              // item table unusable for the things a goods receipt actually has
              // to record: a delivery of something not on the PO, a substituted
              // product, a corrected unit price, or a receipt with no PO behind
              // it at all — "Add Item" produced a row whose product, HSN, unit
              // and price could never be filled in. They are editable now; the
              // PO lookup still pre-fills them, it just no longer forbids a
              // correction.
              //
              // Nothing downstream depends on those columns matching the PO:
              // PO fulfilment is recomputed from the GRN's actual
              // receivedQuantity (recomputePurchaseOrder in
              // backend/src/utils/documentFlow.js), and poQuantity is stored
              // on the line purely as the reference figure shown to whoever
              // checks the delivery (hidden from this form's UI, but Copy
              // From still writes it and the schema still requires it).
              //
              // This used to run as an effect watching the PO No. dropdown. It
              // is a plain function now, called only from the dialog's Choose
              // button: an effect keyed on a form value also fires when that
              // value is restored on edit or reset, which is why it needed the
              // prevPo bookkeeping to tell "user picked a PO" apart from "form
              // loaded". An explicit call has no such ambiguity.
              const applyOrder = (found) => {
                if (found) {
                  setValue('poNo', found.poNo || '', { shouldValidate: true });
                  setValue('branch', found.branch || '', { shouldValidate: true });
                  // Only reachable via Copy To — this page's own Copy From
                  // dialog is already filtered by supplier, so it never
                  // needed this; landing here fresh from Copy To, Supplier
                  // was never carried across at all until now.
                  setValue('supplier', found.supplier || '', { shouldValidate: true });
                  setValue('poDate', found.poDate || null, { shouldValidate: true });
                  setValue('termsConditions', found.termsConditions || '', { shouldValidate: true });
                  // Carried on the order but previously left behind on
                  // Copy To — the Other Details block and Ship From/Ship To
                  // exist on both the order and the GRN.
                  setValue('billingType', found.billingType || '', { shouldValidate: true });
                  setValue('purchaseType', found.purchaseType || '', { shouldValidate: true });
                  setValue('typeOfPurchase', found.typeOfPurchase || '', { shouldValidate: true });
                  setValue('salesType', found.salesType || '', { shouldValidate: true });
                  setValue('purchaseEmployee', found.purchaseEmployee || '', { shouldValidate: true });
                  setValue('transportMode', found.transportMode || '', { shouldValidate: true });
                  setValue('approvedBy', found.approvedBy || '', { shouldValidate: true });
                  setValue('placeOfSupply', found.placeOfSupply || '', { shouldValidate: true });
                  setValue('shipFrom', found.shipFrom || '', { shouldValidate: true });
                  // Carry the order's "ship to a different customer"
                  // selection across too, not just the resolved shipTo text —
                  // otherwise a GRN copied from an order that shipped to a
                  // customer would show Ship To's checkbox unchecked with no
                  // way to tell (or re-pick) which customer the text came
                  // from. Sync the prevShipToDifferentCustomer/
                  // prevShipToCustomer refs to the incoming value FIRST, so
                  // the toggle-off-revert effect and the customer-autofill
                  // effect above don't see a "change" on the next render and
                  // overwrite the shipTo we set explicitly here right after.
                  prevShipToDifferentCustomer.current = !!found.shipToDifferentCustomer;
                  setValue('shipToDifferentCustomer', !!found.shipToDifferentCustomer, { shouldValidate: true });
                  prevShipToCustomer.current = found.shipToCustomer || '';
                  setValue('shipToCustomer', found.shipToCustomer || '', { shouldValidate: true });
                  setValue('shipTo', found.shipTo || '', { shouldValidate: true });
                  if (found.items && found.items.length) {
                    // Purchase Order lines now carry their own warehouse too
                    // (see PurchaseOrderItem.warehouse) — carried straight
                    // across like every other Copy From, editable per row
                    // afterwards.
                    const mappedItems = found.items.map((i, n) => ({
                      productCode: i.productCode || '', productName: i.productName || '', description: i.description || '',
                      hsnCode: i.hsnCode || '', uom: i.uom || '',
                      warehouse: i.warehouse || '',
                      poQuantity: i.quantity != null ? Number(i.quantity) : 0,
                      receivedQuantity: i.quantity != null ? Number(i.quantity) : 1,
                      unitPrice: priceListRates?.get(i.productCode) ?? (i.unitPrice != null ? Number(i.unitPrice) : 0),
                      // Copy From: this line came from the PO's line n.
                      baseType: 'Purchase Order',
                      baseEntry: found.id ?? null,
                      baseNo: found.poNo || null,
                      baseLine: n + 1,
                      // Carried across like every other line field. Omitting
                      // it left each row's Tax % undefined after a PO was
                      // picked, which rendered the cell blank and taxed the
                      // whole receipt at 0% unless someone retyped every rate
                      // by hand — the Zod schema defaults it to 0, so nothing
                      // complained.
                      taxPercent: i.taxPercent != null ? Number(i.taxPercent) : 0,
                      taxCodeId: i.taxCodeId != null ? Number(i.taxCodeId) : null,
                      batches: [], serials: [],
                      // The Purchase Order has no Machine Serial No/Model of
                      // its own (they only ever exist on GRN/Invoice lines),
                      // so there is nothing to carry across here. Set
                      // explicitly to '' rather than omitted, matching every
                      // other controlled field on this row.
                      machineSerialNo: '', machineModel: '', machineEngineNo: '',
                    }));
                    replaceItems(mappedItems);
                    // Belt-and-braces: replace() giving every row a fresh
                    // field id is meant to stop ProductCell's own master-
                    // lookup effect from treating this as a productCode
                    // "change", but that guard has been observed losing the
                    // race in practice (reported: Rate landing at the
                    // Product Master's own default instead of the order's).
                    // Reasserting the order's own values a moment later —
                    // after that cell's effect has had every chance to run
                    // and lose — guarantees the copied figures win
                    // regardless of exactly how that race goes.
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

              // "Copy To > Purchase GRN" from a Purchase Quotation — not
              // reachable from this page's own Copy From button (Purchase
              // Order only), only from the intent-consuming effect below.
              const applyQuotation = (found) => {
                if (found) {
                  setValue('branch', found.branch || '', { shouldValidate: true });
                  // Only reachable via Copy To — see the matching note on
                  // applyOrder above.
                  setValue('supplier', found.supplier || '', { shouldValidate: true });
                  setValue('termsConditions', found.termsConditions || '', { shouldValidate: true });
                  // Carried on the quotation but previously left behind on
                  // Copy To (the quotation has no Other Details block, so
                  // this is all there is to bring across).
                  setValue('approvedBy', found.approvedBy || '', { shouldValidate: true });
                  setValue('shipTo', found.shipTo || '', { shouldValidate: true });
                  if (found.items && found.items.length) {
                    const mappedItems = found.items.map((i, n) => ({
                      productCode: i.productCode || '', productName: i.productName || '', description: i.description || '',
                      hsnCode: i.hsnCode || '', uom: i.uom || '',
                      warehouse: i.warehouse || '',
                      poQuantity: i.quantity != null ? Number(i.quantity) : 0,
                      receivedQuantity: i.quantity != null ? Number(i.quantity) : 1,
                      unitPrice: priceListRates?.get(i.productCode) ?? (i.unitPrice != null ? Number(i.unitPrice) : 0),
                      baseType: 'Purchase Quotation',
                      baseEntry: found.id ?? null,
                      baseNo: found.quotationNo || null,
                      baseLine: n + 1,
                      taxPercent: i.taxPercent != null ? Number(i.taxPercent) : 0,
                      taxCodeId: i.taxCodeId != null ? Number(i.taxCodeId) : null,
                      batches: [], serials: [],
                    }));
                    replaceItems(mappedItems);
                    // Belt-and-braces reassert — see the matching comment on
                    // applyOrder above.
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
              // with it, rather than leaving a stale PO's figures sitting in a
              // GRN that no longer claims to reference it.
              //
              // Supplier is deliberately NOT cleared. It is the user's own
              // selection — it is what made Copy From available in the first
              // place, and clearing it would close the dialog off and force a
              // re-pick just to try a different order from the same vendor.
              const poValue = watch('poNo');
              const clearOrder = () => {
                setValue('poNo', '', { shouldValidate: true });
                setValue('poDate', null, { shouldValidate: true });
                setValue('termsConditions', '', { shouldValidate: true });
                replaceItems([{ ...emptyItem }]);
              };

              const handleFile = (file) => {
                if (file) setValue('attachmentName', file.name, { shouldValidate: true });
              };

              // Switching Branch invalidates a per-line Warehouse choice that
              // doesn't belong to the new branch. Skipped on the very first
              // render so loading an existing record for edit/view doesn't
              // wipe a value it just loaded. There is no header Warehouse any
              // more — each line owns its own — so this only ever touches
              // the item rows.
              const prevBranchRef = useRef(branch);
              useEffect(() => {
                if (prevBranchRef.current === branch) return;
                prevBranchRef.current = branch;
                const allowed = new Set(
                  (warehouses || []).filter((w) => !branch || w.branch === branch).map((w) => w.whsCode)
                );
                (watch('items') || []).forEach((it, idx) => {
                  if (it.warehouse && !allowed.has(it.warehouse)) setValue(`items.${idx}.warehouse`, '');
                });
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [branch]);

              // Print data — same pattern as PurchaseOrder.jsx/PurchaseInvoice.jsx:
              // read every current form value plus the matching supplier/PO
              // records, so the printable sheet always reflects what's on
              // screen (including an unsaved edit) rather than only a saved row.
              const allValues = watch();
              const printSupplierRecord = (suppliers || []).find((s) => s.supplierName === allValues.supplier);
              const printPoRecord = (purchaseOrders || []).find((p) => p.poNo === allValues.poNo);
              // The Branch Master row for this document's own "Branch *" field —
              // what the print's Shipping Address box gets its address lines
              // from (see PurchaseGRNPrintable/PurchaseInvoicePrintable).
              // Matched on branchName because that is what the Branch
              // FormSelect stores: useBranchNameOptions' options are
              // {label: branchName, value: branchName}, NOT the branch id.
              const printBranchRecord = (branches || []).find((b) => b.branchName === allValues.branch);
              // items: itemsForTotals, not allValues.items — same fix
              // SalesInvoice.jsx's own printOrder already applies. A form
              // item row only ever carries taxCodeId, never the resolved
              // taxType ('GST'/'IGST'/'GST+TCS'/'IGST+TCS') itself;
              // itemsForTotals above is what joins the two (for the live
              // totals panel) and is the only place in this component that
              // has it. Passing allValues.items straight through left every
              // print item's taxType undefined, so
              // PurchaseGRNPrintable's isTcsTaxType(it.taxType) check could
              // never see a TCS-typed line no matter what Tax Code it used.
              const printOrder = { ...allValues, items: itemsForTotals, status: editingRow?.status || 'Draft' };
              // See SalesInvoice.jsx's identical approverSignatureUrl comment.
              const approverSignatureUrl = (salesEmployees || []).find((s) => s.employeeName === allValues.approvedBy)?.signatureUrl || null;

              // Consume a pending "Copy To" intent addressed to this page —
              // see copyIntentSlice.js and CopyToButton.jsx.
              useEffect(() => {
                if (!pendingCopyIntent || pendingCopyIntent.targetKey !== 'purchaseGRN') return;
                if (pendingCopyIntent.sourceType === 'purchaseOrder') applyOrder(pendingCopyIntent.sourceDoc);
                else if (pendingCopyIntent.sourceType === 'purchaseQuotation') applyQuotation(pendingCopyIntent.sourceDoc);
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
                    // The dialog picks from the purchase-order LIST, which
                    // no longer carries lines — applyOrder reads found.items
                    // to build the GRN's rows, so the chosen order is fetched
                    // in full by id first. On failure nothing is applied,
                    // which beats copying a header and leaving the user an
                    // order reference above an empty item grid.
                    onChoose={async (po) => {
                      try {
                        applyOrder(await fetchPurchaseOrderById(po.id).unwrap());
                      } catch (err) {
                        notify.error(err?.data?.message || `Couldn't load purchase order "${po.poNo}". Please try again.`);
                      }
                    }}
                    documents={copyablePurchaseOrders}
                    party={watch('supplier')}
                    title="Find Purchase Order"
                    columns={PO_COPY_COLUMNS}
                    emptyMessage="No purchase orders found for"
                  />
                  <PurchaseGRNPrintable
                    order={printOrder}
                    company={company}
                    supplierRecord={printSupplierRecord}
                    poRecord={printPoRecord}
                    branchRecord={printBranchRecord}
                    approverSignatureUrl={approverSignatureUrl}
                  />
                  <Card variant="outlined" sx={{ mb: 2 }}>
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                        <Typography variant="subtitle1" fontWeight={700}>
                          {readOnly ? 'Supplier & Document Details (View Only)' : 'Supplier & Document Details'}
                        </Typography>
                        <Button type="button" variant="outlined" color="inherit" startIcon={<ArrowBackIcon />} onClick={backToList}>
                          Back to List
                        </Button>
                      </Stack>

                      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, width: '100%', display: 'block' }}>
                        {/* Row-by-row pairing: Branch/GRN No., Supplier
                        Code/GRN Date, Supplier Name/Place of Supply — all six
                        are short single-line controls (text field or
                        select), so pairing them two-per-row leaves no row
                        with an empty second column. Warehouse no longer has
                        a header field at all — every line in the item table
                        already picks its own (see the Item Details card
                        below), so a header-level one was a redundant second
                        place to set it. Ship From is now the same multiline
                        rows={3} box as Ship To (auto-filled from the
                        selected supplier's default Billing address, same
                        pattern as Purchase Order — see
                        supplierShipFrom/lastAutoShipFromRef above), so the
                        two are paired together as one row, same as
                        PurchaseOrder.jsx does with its own Ship From/Ship
                        To — two matching multiline fields keep that row an
                        even height instead of stretching a single-line
                        partner to match. Vendor Reference No. is left on its
                        own row after them. Delivery Challan No. keeps a row
                        of its own below this grid — it wasn't named in
                        either column and wasn't asked to be removed. PO
                        No./PO Date are hidden further below (not removed —
                        Copy From still writes them and the server still
                        links this receipt's fulfilment off poNo). Challan
                        Date, Delivery Date, Received By and Notes are gone
                        outright, per request — the goods_received_notes
                        columns behind them are untouched, so nothing is lost
                        if they're ever wanted back. */}
                        <FormGrid columns={2} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING} singleColumnOnMobile>
                          <LabeledField label="Branch *">
                            <FormSelect name="branch" label="" placeholder="Select branch" options={branchOptions} />
                          </LabeledField>
                          <LabeledField label="GRN No. *">
                            <DocumentSeriesNoField documentCode="GRN" seriesFieldName="seriesId" numberFieldName="grnNo" isCreate={!editingRow} />
                          </LabeledField>

                          {/* Supplier drives this form now: it is picked first,
                          it enables Copy From, and it scopes the order list
                          that dialog shows. It used to be disabled and filled
                          only by the PO dropdown, which made a GRN without a
                          PO impossible to enter. */}
                          <LabeledField label="Supplier Code *">
                            <PartyCodeSelect name="supplier" label="" placeholder="Select supplier" options={supplierFieldOptions} showNameBelow={false} />
                          </LabeledField>
                          <LabeledField label="GRN Date *">
                            <FormDatePicker name="receivedDate" label="" minDate={receivedDateMinDate || undefined} triggerFields={['poDate']} />
                          </LabeledField>

                          {/* Read-only echo of the selected supplier's full
                          Name — the Supplier field above shows only its
                          Code (see PartyCodeSelect), so this is what tells
                          the user which supplier that code actually is. Not
                          a stored field: it just displays the current value
                          of `supplier`, which already holds the supplier's
                          name (see supplierFieldOptions above). Paired with
                          Vendor Reference No. — both are plain single-line
                          text fields, so the row stays a normal height. */}
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

                          <LabeledField label="Place of Supply *">
                            <FormSelect name="placeOfSupply" label="" placeholder="Select state" options={PLACE_OF_SUPPLY_OPTIONS} />
                          </LabeledField>
                          <LabeledField label="Ship From">
                            <FormTextField name="shipFrom" label="" placeholder="Supplier billing address" multiline rows={3} disabled />
                          </LabeledField>
                          {/* Ship To: unchecked (default) keeps deriving from
                          the selected Branch exactly as before this checkbox
                          existed — see branchShipTo/lastAutoShipToRef above.
                          Checked reveals the Customer CFL below it; picking a
                          customer there fills Ship To from that Business
                          Partner's own Shipping Address instead (see the
                          shipToCustomerValue effect above). Either way the
                          field itself is a plain editable textarea now (it
                          used to be permanently disabled) so a hand edit
                          after autofill is what actually gets saved/printed —
                          same feature, same shape as Purchase Invoice's own
                          Shipping To. */}
                          <LabeledField label="Ship To">
                            <Box sx={{ width: '100%' }}>
                              <FormCheckbox name="shipToDifferentCustomer" label="Ship to a different customer" compact />
                              {shipToDifferentCustomer && (
                                <Box sx={{ mb: 1 }}>
                                  <PartyCodeSelect
                                    name="shipToCustomer"
                                    label=""
                                    placeholder="Select customer"
                                    options={shipToCustomerFieldOptions}
                                    showNameBelow={false}
                                    fullWidth
                                    disabled={shipToCustomersLoading}
                                  />
                                </Box>
                              )}
                              <FormTextField name="shipTo" label="" placeholder="Branch delivery address" multiline rows={3} fullWidth />
                            </Box>
                          </LabeledField>
                          {/* Display-only, auto-filled from the selected
                          supplier's own Business Partner address — see the
                          supplierState useMemo above. Independent of Place
                          of Supply above. */}
                          <LabeledField label="State">
                            <FormTextField name="supplierState" label="" placeholder="Supplier state" disabled />
                          </LabeledField>
                        </FormGrid>

                        {/* Delivery Challan No. kept — only Challan Date,
                        Delivery Date, Received By and Notes were dropped
                        from this card. Given its own row below the main grid
                        since it doesn't fit the requested left/right pairing. */}
                        {/* <FormGrid columns={2} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING} singleColumnOnMobile>
                          <LabeledField label="Delivery Challan No.">
                            <FormTextField name="deliveryChallanNo" label="" placeholder="Enter challan number" />
                          </LabeledField>
                        </FormGrid> */}

                        {/* PO No./PO Date — hidden per request, not removed:
                        Copy From still writes them and the server still
                        links this receipt's fulfilment off poNo (see
                        recomputePurchaseOrder), so both stay mounted and
                        wired up, just outside the visible grid. */}
                        <Box sx={{ display: 'none' }}>
                          <FormTextField
                            name="poNo"
                            label="PO No."
                            placeholder="Use Copy From to select an order"
                            InputProps={{ readOnly: true }}
                          />
                          <FormDatePicker name="poDate" label="PO Date" triggerFields={['receivedDate']} />
                        </Box>
                      </fieldset>

                      {/* Deliberately OUTSIDE the <fieldset disabled={readOnly}> above.
                      This is a read-only display, never an editable form field, but
                      a native <fieldset disabled> disables every descendant form
                      control including a plain <button> — which silently killed
                      this icon's onClick specifically in View mode (handleView sets
                      readOnly=true), the one place a user would actually want to
                      check a GRN's posted Journal Entry. Edit mode (readOnly=false)
                      happened to work, which is what made this easy to miss.
                      editingRow.journalEntryNo/journalEntryId come from
                      attachJournalEntryRefs (a reverse lookup on
                      JournalEntry.sourceType/sourceDocNo, see routes/resources.js),
                      refreshed every time this GRN is (re)loaded, so this always
                      reflects the entry actually linked to THIS GRN — never
                      text-matched, never another GRN's entry, and never created
                      just to be viewed. Hidden until the GRN has been saved and
                      posted at least once. */}
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

                  <PurchaseOtherDetailsCard />

                  <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, width: '100%', display: 'block' }}>
                    <Card variant="outlined" sx={{ mb: 2 }}>
                      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                          <Typography variant="subtitle1" fontWeight={700}>Item Details</Typography>
                          <Stack direction="row" spacing={1.5}>
                            <Button type="button" variant="outlined" color="inherit" size="small" startIcon={<UploadFileIcon />} onClick={() => setItemsImportOpen(true)}>
                              Import from Excel
                            </Button>
                            <Button type="button" variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => append(withDefaultTaxCode({ ...emptyItem }, liveDefaultTaxCode))}>
                              Add Item
                            </Button>
                          </Stack>
                        </Stack>

                        {isMobile ? (
                          <Box>
                            {fields.map((field, index) => {
                              const qty = Number(watch(`items.${index}.receivedQuantity`)) || 0;
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
                                  <ProductCell index={index} methods={methods} options={productCodeOptions} products={products} taxCodeIdByRate={productTaxCodeIdByRate} priceListRates={priceListRates} label="Item No" placeholder="Select product" />
                                  <ProductCell index={index} methods={methods} options={productNameOptions} products={products} taxCodeIdByRate={productTaxCodeIdByRate} priceListRates={priceListRates} label="Description" placeholder="Select product" />
                                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 1.5, rowGap: 1.5 }}>
                                    <FormTextField name={`items.${index}.hsnCode`} label="HSN/SAC" placeholder="4, 6 or 8 digits" digitsOnly maxLength={8} />
                                    <FormTextField name={`items.${index}.uom`} label="Unit" placeholder="Unit" />
                                    <WarehouseCodeSelect name={`items.${index}.warehouse`} label="Warehouse *" placeholder={branch ? 'Select warehouse' : 'Select a branch first'} options={branchWarehouseOptions} disabled={!branch} />
                                    <FormTextField name={`items.${index}.receivedQuantity`} label="Received Qty *" type="number" />
                                    <FormSelect name={`items.${index}.taxCodeId`} label="Tax %" options={taxCodeOptionsForRow} popupFitContent onValueChange={(_v, option) => setValue(`items.${index}.taxPercent`, option ? option.rate : 0, { shouldValidate: true })} />
                                    <FormTextField name={`items.${index}.unitPrice`} label="Unit Price (₹)" type="number" />
                                  </Box>
                                  {isMachinePurchase ? (
                                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 1.5, rowGap: 1.5, mt: 1.5 }}>
                                      <FormTextField name={`items.${index}.machineSerialNo`} label="Machine Serial No" placeholder="Serial No" />
                                      <FormTextField name={`items.${index}.machineModel`} label="Machine Model" placeholder="Model" />
                                      <FormTextField name={`items.${index}.machineEngineNo`} label="Machine Engine No." placeholder="Engine No" />
                                    </Box>
                                  ) : null}
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
                                  <TableCell>Item No *</TableCell>
                                  <TableCell>Description</TableCell>
                                  <TableCell>HSN/SAC</TableCell>
                                  <TableCell>Unit</TableCell>
                                  <TableCell>Warehouse *</TableCell>
                                  <TableCell>Quantity *</TableCell>
                                  <TableCell>Unit Price (₹) *</TableCell>
                                  <TableCell>Tax %</TableCell>
                                  {isMachinePurchase ? (
                                    <>
                                      <TableCell>Machine Serial No</TableCell>
                                      <TableCell>Machine Model</TableCell>
                                      <TableCell>Machine Engine No.</TableCell>
                                    </>
                                  ) : null}
                                  <TableCell>Batch / Serial</TableCell>
                                  <TableCell align="right">Amount (₹)</TableCell>
                                  <TableCell width={48} />
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {fields.map((field, index) => {
                                  const qty = Number(watch(`items.${index}.receivedQuantity`)) || 0;
                                  const price = Number(watch(`items.${index}.unitPrice`)) || 0;
                                  const rowAmount = qty * price;
                                  return (
                                    <TableRow key={field.id} sx={{ '& > td': { verticalAlign: 'middle' } }}>
                                      <TableCell>{index + 1}</TableCell>
                                      <TableCell>
                                        <ProductCell index={index} methods={methods} options={productCodeOptions} products={products} taxCodeIdByRate={productTaxCodeIdByRate} priceListRates={priceListRates} placeholder="Select product" />
                                      </TableCell>
                                      <TableCell>
                                        <ProductCell index={index} methods={methods} options={productNameOptions} products={products} taxCodeIdByRate={productTaxCodeIdByRate} priceListRates={priceListRates} placeholder="Select product" />
                                      </TableCell>
                                      <TableCell>
                                        <FormTextField name={`items.${index}.hsnCode`} label="" placeholder="HSN/SAC" digitsOnly maxLength={8} />
                                      </TableCell>
                                      <TableCell>
                                        <FormTextField name={`items.${index}.uom`} label="" placeholder="Unit" />
                                      </TableCell>
                                      <TableCell>
                                        <WarehouseCodeSelect name={`items.${index}.warehouse`} label="" placeholder={branch ? 'Select' : 'Select branch first'} options={branchWarehouseOptions} disabled={!branch} popupFitContent showNameBelow={false} />
                                      </TableCell>
                                      <TableCell>
                                        <FormTextField name={`items.${index}.receivedQuantity`} label="" type="number" />
                                      </TableCell>
                                      <TableCell>
                                        <FormTextField name={`items.${index}.unitPrice`} label="" type="number" />
                                      </TableCell>
                                      <TableCell>
                                        <FormSelect name={`items.${index}.taxCodeId`} label="" options={taxCodeOptionsForRow} popupFitContent onValueChange={(_v, option) => setValue(`items.${index}.taxPercent`, option ? option.rate : 0, { shouldValidate: true })} />
                                      </TableCell>
                                      {isMachinePurchase ? (
                                        <>
                                          <TableCell>
                                            <FormTextField name={`items.${index}.machineSerialNo`} label="" placeholder="Serial No" />
                                          </TableCell>
                                          <TableCell>
                                            <FormTextField name={`items.${index}.machineModel`} label="" placeholder="Model" />
                                          </TableCell>
                                          <TableCell>
                                            <FormTextField name={`items.${index}.machineEngineNo`} label="" placeholder="Engine No" />
                                          </TableCell>
                                        </>
                                      ) : null}
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
                                <Button component="label" variant="outlined" size="small">
                                  Browse Files
                                  <input type="file" hidden onChange={(e) => handleFile(e.target.files?.[0])} />
                                </Button>
                                <Typography variant="caption" display="block" sx={{ mt: 1 }}>Supported formats: PDF, JPG, PNG (Max. 5MB)</Typography>
                                {watch('attachmentName') && (
                                  <Chip
                                    sx={{ mt: 1.5 }}
                                    size="small"
                                    label={watch('attachmentName')}
                                    onDelete={() => setValue('attachmentName', '')}
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
                        <CopyToButton
                          sourceType="purchaseGRN"
                          sourceDoc={editingRow}
                          sourceLabel="Purchase GRN"
                          docNoField="grnNo"
                          targets={[
                            { key: 'purchaseReturn', label: 'Purchase Return', path: '/purchase/return' },
                            { key: 'purchaseInvoice', label: 'Purchase Invoice', path: '/purchase/invoice' },
                          ]}
                        />
                        {/* Copy From sits immediately left of Cancel and stays
                          disabled until a Supplier is chosen — the dialog it
                          opens lists that supplier's purchase orders, so with
                          no supplier there is nothing for it to show. Hidden
                          in view mode, where nothing is being filled in. */}
                        {!readOnly && (
                          poValue ? (
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
                              disabled={!watch('supplier') || creating || updating}
                            >
                              Copy From
                            </Button>
                          )
                        )}
                        <Button fullWidth={isMobile} type="button" variant="outlined" color="inherit" startIcon={<CloseIcon />} onClick={backToList} disabled={creating || updating}>
                          Cancel
                        </Button>
                        <Button fullWidth={isMobile} type="button" variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => printPurchaseGRN()}>
                          Print
                        </Button>
                        {!readOnly && (
                          <>
                            <Button
                              fullWidth={isMobile}
                              variant="outlined"
                              type="button"
                              onClick={() => submitWithStatus('Draft')}
                              disabled={creating || updating}
                            >
                              {(creating || updating) && (
                                <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} />
                              )}
                              Save as Draft
                            </Button>
                            <Button
                              fullWidth={isMobile}
                              variant="contained"
                              type="button"
                              onClick={() => submitWithStatus('Open')}
                              disabled={creating || updating}
                            >
                              {(creating || updating) && (
                                <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} />
                              )}
                              {editingRow ? 'Update GRN' : 'Save GRN'}
                            </Button>
                          </>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>

                  {batchDialog && batchDialog.index < fields.length && (
                    <BatchSerialSetupDialog
                      open
                      onClose={() => setBatchDialog(null)}
                      mode={batchDialog.mode}
                      readOnly={readOnly}
                      docNo={editingRow?.grnNo}
                      itemNumber={watch(`items.${batchDialog.index}.productCode`)}
                      itemDescription={watch(`items.${batchDialog.index}.productName`)}
                      warehouseCode={watch(`items.${batchDialog.index}.warehouse`)}
                      warehouseName={(branchWarehouseOptions.find((w) => w.value === watch(`items.${batchDialog.index}.warehouse`)) || {}).label}
                      totalNeeded={Number(watch(`items.${batchDialog.index}.receivedQuantity`)) || 0}
                      value={watch(`items.${batchDialog.index}.${batchDialog.mode === 'Batch' ? 'batches' : 'serials'}`)}
                      onSave={(rows) => setValue(
                        `items.${batchDialog.index}.${batchDialog.mode === 'Batch' ? 'batches' : 'serials'}`,
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
                    templateUrl="/purchase/grn/items-import/template"
                    importUrl="/purchase/grn/items-import"
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
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              alignItems={{ xs: 'stretch', md: 'center' }}
              justifyContent="space-between"
              flexWrap="wrap"
              gap={1.5}
              sx={{ px: { xs: 2, sm: 3 }, pt: 2.5, pb: 1.5 }}
            >
              <Typography variant="subtitle1" fontWeight={700}>Purchase GRN List</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap sx={{ width: { xs: '100%', md: 'auto' } }}>
                <TableSearchFilter table={table} placeholder="Search by GRN no., supplier, PO no..." showFilter={false} />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
                  <Button
                    variant="outlined"
                    color="inherit"
                    startIcon={<FilterListIcon />}
                    onClick={() => setShowFilters((v) => !v)}
                    sx={{ width: { xs: '100%', sm: 'auto' }, height: 40, whiteSpace: 'nowrap' }}
                  >
                    Filter
                  </Button>
                  <CanAdd>
                    {/* React.Children.only needs one child — group both buttons in a Stack. */}
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
                      <Button
                        variant="outlined"
                        color="inherit"
                        startIcon={<UploadFileIcon />}
                        onClick={() => setBulkImportOpen(true)}
                        sx={{ width: { xs: '100%', sm: 'auto' }, height: 40, whiteSpace: 'nowrap' }}
                      >
                        Import from Excel
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        endIcon={<ArrowDropDownIcon />}
                        onClick={openCreate}
                        sx={{ width: { xs: '100%', sm: 'auto' }, height: 40, whiteSpace: 'nowrap' }}
                      >
                        Create GRN
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
                    label="Supplier"
                    allLabel="All Suppliers"
                    options={supplierOptions}
                    value={supplierFilter}
                    onChange={(v) => { setSupplierFilter(v); setPage(0); }}
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
                  <TextField
                    size="small"
                    fullWidth
                    label="PO No."
                    value={poFilter}
                    onChange={(e) => { setPoFilter(e.target.value); setPage(0); }}
                    placeholder="Enter PO no."
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    size="small"
                    fullWidth
                    label="Reference No."
                    value={refFilter}
                    onChange={(e) => { setRefFilter(e.target.value); setPage(0); }}
                    placeholder="Enter reference no."
                    InputLabelProps={{ shrink: true }}
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
                    title={row.grnNo}
                    statusChip={<Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />}
                    fields={[
                      { label: 'Supplier', value: row.supplier || '—' },
                      { label: 'PO No.', value: row.poNo || '—' },
                      { label: 'GRN Date', value: row.receivedDate ? dayjs(row.receivedDate).format('DD/MM/YYYY') : '—' },
                      { label: 'Total Items', value: row.totalItems ?? (row.items?.length || 0) },
                      { label: 'Amount', value: `₹${Number(row.amount).toFixed(2)}` },
                      { label: 'Delivery No.', value: row.deliveryChallanNo || '—' },
                    ]}
                    // Cancelled GRNs are fully locked — no View/Edit/Delete/
                    // Cancel action once isCancelled is true, only the status
                    // chip above shows "Cancelled".
                    onEdit={row.isCancelled ? undefined : () => handleEdit(row)}
                    onDelete={row.isCancelled ? undefined : () => handleDelete(row)}
                    extraActions={row.isCancelled ? [] : [
                      { key: 'cancel', label: 'Cancel', icon: <CancelOutlinedIcon fontSize="small" />, color: 'warning', onClick: () => handleCancel(row) },
                    ]}
                  />
                ))}
                {!isLoading && filteredRows.length === 0 && (
                  <EmptyState icon={<ShoppingCartOutlinedIcon sx={{ fontSize: 48 }} />} title="No GRNs found" message="Add your first GRN to get started" />
                )}
              </Box>
            ) : (
              <ScrollableTableContainer>
                <Table
                  size="small"
                  stickyHeader
                  sx={{
                    '& th, & td': {
                      height: GRN_LIST_TABLE_ROW_HEIGHT,
                      paddingTop: `${GRN_LIST_TABLE_CELL_PADDING_Y}px`,
                      paddingBottom: `${GRN_LIST_TABLE_CELL_PADDING_Y}px`,
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
                      <SortableHeaderCell field="grnNo" sort={table.sort} onSort={table.toggleSort}>GRN No.</SortableHeaderCell>
                      <SortableHeaderCell field="supplier" sort={table.sort} onSort={table.toggleSort}>Supplier</SortableHeaderCell>
                      <SortableHeaderCell field="poNo" sort={table.sort} onSort={table.toggleSort}>PO No.</SortableHeaderCell>
                      <SortableHeaderCell field="receivedDate" sort={table.sort} onSort={table.toggleSort}>GRN Date</SortableHeaderCell>
                      <SortableHeaderCell field="totalItems" sort={table.sort} onSort={table.toggleSort}>Total Items</SortableHeaderCell>
                      <SortableHeaderCell align="right" field="amount" sort={table.sort} onSort={table.toggleSort}>Amount (₹)</SortableHeaderCell>
                      <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                      <SortableHeaderCell field="deliveryChallanNo" sort={table.sort} onSort={table.toggleSort}>Delivery No.</SortableHeaderCell>
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
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.grnNo}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.supplier || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.poNo || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.receivedDate ? dayjs(row.receivedDate).format('DD/MM/YYYY') : '—'}</TableCell>
                        <TableCell>{row.totalItems ?? (row.items?.length || 0)}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{Number(row.amount).toFixed(2)}</TableCell>
                        <TableCell>
                          <Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.deliveryChallanNo || '-'}</TableCell>
                        <TableCell align="right">
                          {row.isCancelled ? (
                            // Fully locked once cancelled — no View/Edit/
                            // Print/Delete/Cancel, only the status chip
                            // above says "Cancelled".
                            <Typography variant="caption" color="text.secondary">Cancelled</Typography>
                          ) : (
                            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                              <Tooltip title="View">
                                <IconButton size="small" onClick={() => handleView(row)} aria-label="view">
                                  <VisibilityOutlinedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <RouteMapButton flow="purchase" type="grn" docNo={row.grnNo} />
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
                          <EmptyState icon={<ShoppingCartOutlinedIcon sx={{ fontSize: 48 }} />} title="No GRNs found" message="Add your first GRN to get started" />
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

            <EntityListPagination total={filteredRows.length} page={page} onChange={setPage} pageSize={pageSize} onPageSizeChange={(v) => { setPageSize(v); setPage(0); }} />
          </CardContent>
        </Card>
      )}

      <BulkImportDialog
        open={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        resourceName="Purchase GRNs"
        templateUrl="/purchase/grn/bulk-import/template"
        importUrl="/purchase/grn/bulk-import"
        onImported={refetchGrns}
      />
    </Box>
  );
}

// Isolated so the per-row product-select auto-fill effect only re-runs for
// the row whose product actually changed, not every row on every keystroke.
// Both the Item No and Description columns are selects over the same
// underlying items.{index}.productCode field — Item No lists codes,
// Description lists names, and picking either fills the rest of the row from
// the product master.
//
// Selecting a PO pre-fills these rows (see the poNo effect above, which calls
// replaceItems), but the user can still change them: a delivery does not
// always match its order, and a GRN can be raised without a PO at all.
function ProductCell({ index, methods, options, products, taxCodeIdByRate, priceListRates, label = '', placeholder = 'Select product', disabled = false, multiline = false, sx }) {
  const { watch, setValue } = methods;
  const notify = useNotify();
  const allItems = watch('items') || [];
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

  const productCodeValue = watch(`items.${index}.productCode`);
  const prevValue = useRef(productCodeValue);

  useEffect(() => {
    if (productCodeValue !== prevValue.current) {
      if (productCodeValue && otherSelectedCodes.has(String(productCodeValue).trim().toUpperCase())) {
        notify.error(`Item "${productCodeValue}" is already added to this document.`);
        setValue(`items.${index}.productCode`, '');
        setValue(`items.${index}.productName`, '');
        setValue(`items.${index}.description`, '');
        setValue(`items.${index}.hsnCode`, '');
        setValue(`items.${index}.uom`, '');
        setValue(`items.${index}.taxPercent`, 0);
        setValue(`items.${index}.taxCodeId`, null);
        setValue(`items.${index}.unitPrice`, 0);
        prevValue.current = '';
        return;
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
        // Keep the Tax % select (bound to taxCodeId, not the raw rate — see
        // taxCodeOptions.js) in sync with the rate just set above, instead of
        // going blank because nothing here ever touched taxCodeId.
        setValue(`items.${index}.taxCodeId`, taxCodeIdByRate?.get(productTaxRate) ?? null, { shouldValidate: true });
        const priceListRate = priceListRates?.get(found.productCode);
        setValue(`items.${index}.unitPrice`, priceListRate != null ? priceListRate : (found.unitPrice != null ? Number(found.unitPrice) : 0), { shouldValidate: true });
      }
      prevValue.current = productCodeValue;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productCodeValue, otherSelectedCodes]);

  return (
    <FormSelect
      name={`items.${index}.productCode`}
      label={label}
      placeholder={placeholder}
      options={optionsWithDisabledLabel}
      getOptionDisabled={(opt) => otherSelectedCodes.has(String(opt?.value ?? '').trim().toUpperCase())}
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
// matching setup dialog, labelled with how much of the line is allocated so
// far so an incomplete line is visible without opening it.
function BatchSerialCell({ index, methods, product, onOpen }) {
  const { watch } = methods;
  const trackingMode = product?.manageItemBy;
  if (trackingMode !== 'Batch' && trackingMode !== 'Serial') {
    return <Typography variant="caption" color="text.secondary">—</Typography>;
  }
  const needed = Number(watch(`items.${index}.receivedQuantity`)) || 0;
  const batches = watch(`items.${index}.batches`) || [];
  const serials = watch(`items.${index}.serials`) || [];
  const allocated = trackingMode === 'Batch'
    ? batches.reduce((sum, b) => sum + (Number(b.quantity) || 0), 0)
    : serials.length;
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
