import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatPartnerAddress, cleanAddressText } from '../../lib/addressFormat';
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
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
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
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import PartyCodeSelect, { buildPartyCodeOptions } from '../../components/form/PartyCodeSelect';
import { FormCheckbox } from '../../components/form/FormCheckbox';
import usePriceListRates from '../../hooks/usePriceListRates';
import WarehouseCodeSelect from '../../components/form/WarehouseCodeSelect';
import FormDatePicker from '../../components/form/FormDatePicker';
import { peekNextDocumentNumber } from '../../components/form/DocumentNoField';
import DocumentSeriesNoField from '../../components/form/DocumentSeriesNoField';
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
import PurchaseOtherDetailsCard from '../../components/common/PurchaseOtherDetailsCard';
import { applyServerErrors } from '../../lib/formErrors';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { purchaseOrderSchema, PO_STATUS_OPTIONS } from '../../lib/validation/purchaseSchemas';
import { useWarehouseOptions, warehouseCodesForBranch } from '../../lib/useWarehouseOptions';
import { buildDocument, round2, isInterState, computeFreightGross, computeItemDiscountTotal } from '../../lib/documentTotals';
import DocumentTotalsPanel from '../../components/form/DocumentTotalsPanel';
import { purchaseOrderApi, purchaseQuotationApi, supplierApi, customerApi, productApi, branchApi, houseBankApi, taxCodeApi, salesEmployeeApi } from '../../features/resources';
import { useBranchNameOptions } from '../../lib/useBranchOptions';
import { productOptionsFor, PRODUCT_USAGE } from '../../lib/productUsage';
import { buildTaxCodeOptions, taxTypeFamilyFor, buildTaxCodeIdByRate, pickDefaultTaxCode, withDefaultTaxCode } from '../../lib/taxCodeOptions';
import { itemTableSx } from '../../lib/columnWidth';
import { useGetCompanyDetailsQuery, usePeekDocumentNumberMutation } from '../../features/company/companyDetailsApi';
import { branchAddressLines } from '../../lib/branchAddress';
import PurchaseOrderPrintable, { printPurchaseOrder } from '../../components/print/PurchaseOrderPrintable';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer, { dragScrollbarSx } from '../../components/data-display/ScrollableTableContainer';

import { CanAdd, CanEdit, CanDelete, CanCancel } from '../../components/common/PermissionGate';
import { canDelete } from '../../config/deleteConfig';
import { canDuplicate } from '../../config/duplicateConfig';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';
import RouteMapButton from '../../components/common/RouteMapButton';
import RouteMapContextMenu from '../../components/common/RouteMapContextMenu';
import CopyFromDocumentDialog from '../../components/common/CopyFromDocumentDialog';
import BulkImportDialog from '../../components/common/BulkImportDialog';
import ImportItemsDialog from '../../components/common/ImportItemsDialog';
import CopyToButton from '../../components/common/CopyToButton';
import { useDispatch, useSelector } from 'react-redux';
import { selectCurrentUser } from '../../store/authSlice';
import { clearCopyIntent } from '../../store/copyIntentSlice';

// Columns for the "Find Purchase Quotation" dialog opened by Copy From.
const QUOTATION_COPY_COLUMNS = [
  { field: 'quotationNo', headerName: 'Quotation No', nowrap: true },
  { field: 'quotationDate', headerName: 'Date', type: 'date' },
  { field: 'supplier', headerName: 'Vendor' },
  { field: 'validUpto', headerName: 'Valid Until', type: 'date' },
  { field: 'remarks', headerName: 'Comments', type: 'optional' },
];
// "Other Details" classification (Billing Type/Purchase Type/Type of
// Purchase/Type of Sales/Purchase Employee/Transport Mode/Invoice Type) is
// rendered by the shared PurchaseOtherDetailsCard component (also used by
// Purchase GRN and Purchase Invoice) — see its own file for the option
// lists and the Invoice Type "Define New" behaviour.

// Ship From is a free-text box auto-filled from the selected supplier's own
// Business Partner record — its Addresses tab, default Billing Address (Ship
// To auto-fills from the selected branch's own address instead — see
// branchShipTo further down). See BusinessPartnerAddress in schema.prisma;
// `suppliers` rows here already carry `.addresses` because supplierApi is a
// thin alias over GET /business-partners (see features/resources.js), which
// includes addresses on every row.
function formatBusinessPartnerAddress(addr) {
  // Address Name, Street, Street No, Building/Floor/Room, Block, Country,
  // State, City, Zip Code -- see lib/addressFormat.js (no double commas).
  return formatPartnerAddress(addr);
}

// Supplier Code/Name picker lives in the shared PartyCodeSelect component
// now (see its import above) — options are still built per-page since each
// document's field name/value semantics differ slightly, but the dropdown's
// two-column rendering, filtering and name-below display are shared code.

const emptyItem = { productCode: '', productName: '', description: '', hsnCode: '', uom: '', quantity: 1, unitPrice: 0, taxPercent: 18, taxCodeId: null, warehouse: '' };

function getEmptyValues(preparedBy, defaultTaxCode) {
  return {
    poNo: '', seriesId: '', branch: '', supplier: '', contactPerson: '', phone: '', email: '',
    poDate: new Date(), quotationNo: '', referenceNo: '', vendorRefNo: '',
    currency: 'INR', paymentTerms: '', deliveryDate: null, shipTo: '', shipFrom: '', supplierState: '',
    shipToDifferentCustomer: false, shipToCustomer: '',
    termsConditions: '', attachmentName: '', discountPercent: 0, status: 'Open',
    billingType: '', purchaseType: '', salesType: '', typeOfPurchase: '',
    buyingBranch: '', department: '', placeOfSupply: '', transportMode: '',
    eWayBillNo: '', eWayBillDate: null, packingForwarding: '', loadingUnloading: '',
    inspection: '', warranty: '', remarks: '', bankAccount: '',
    purchaseEmployee: '',
    preparedBy: preparedBy || '', checkedBy: '', approvedBy: '',
    freightTransportId: null, freightName: '', freightRemarks: '', freightTaxCodeId: null,
    freightTaxAmount: 0, freightNetAmount: 0, freightGrossAmount: 0,
    items: [withDefaultTaxCode({ ...emptyItem }, defaultTaxCode)],
  };
}

function computeTotals(items, discountPercent, interState = false, extraCharges = {}) {
  const { totals } = buildDocument(items, discountPercent, {
    interState,
    roundOff: true,
    freightAmount: extraCharges.freightNetAmount,
  });
  const freightGrossAmount = computeFreightGross(extraCharges.freightNetAmount, extraCharges.freightTaxAmount);
  return {
    ...totals,
    discount: computeItemDiscountTotal(items),
    freightGrossAmount,
    grandTotal: round2(totals.amount + (Number(extraCharges.freightTaxAmount) || 0)),
  };
}

function rowToFormValues(row, taxCodes) {
  const taxCodeIdByRate = buildTaxCodeIdByRate(taxCodes);
  return {
    poNo: row.poNo, seriesId: '', branch: row.branch || '', supplier: row.supplier || '', contactPerson: row.contactPerson || '',
    phone: row.phone || '', email: row.email || '',
    poDate: row.poDate,
    quotationNo: row.quotationNo || '', referenceNo: row.referenceNo || '', vendorRefNo: row.vendorRefNo || '',
    currency: row.currency || 'INR', paymentTerms: row.paymentTerms || '', deliveryDate: row.deliveryDate,
    shipTo: cleanAddressText(row.shipTo), shipFrom: cleanAddressText(row.shipFrom), supplierState: row.supplierState || '',
    shipToDifferentCustomer: !!row.shipToDifferentCustomer, shipToCustomer: row.shipToCustomer || '',
    termsConditions: row.termsConditions || '', attachmentName: row.attachmentName || '',
    discountPercent: row.discountPercent != null ? Number(row.discountPercent) : 0, status: row.status || 'Open',
    billingType: row.billingType || '', purchaseType: row.purchaseType || '', salesType: row.salesType || '', typeOfPurchase: row.typeOfPurchase || '',
    buyingBranch: row.buyingBranch || '', department: row.department || '', placeOfSupply: row.placeOfSupply || '',
    transportMode: row.transportMode || '', eWayBillNo: row.eWayBillNo || '', eWayBillDate: row.eWayBillDate || null,
    packingForwarding: row.packingForwarding || '', loadingUnloading: row.loadingUnloading || '',
    inspection: row.inspection || '', warranty: row.warranty || '', remarks: row.remarks || '',
    bankAccount: row.bankAccount || '', preparedBy: row.preparedBy || '', checkedBy: row.checkedBy || '',
    approvedBy: row.approvedBy || '', purchaseEmployee: row.purchaseEmployee || '',
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
      taxPercent: i.taxPercent != null ? Number(i.taxPercent) : 18,
      taxCodeId: i.taxCodeId != null
        ? Number(i.taxCodeId)
        : (taxCodeIdByRate.get(i.taxPercent != null ? Number(i.taxPercent) : 18) ?? null),
      // No header warehouse exists on this document to fall back to — a row
      // saved before this field existed simply reopens blank.
      warehouse: i.warehouse || '',
    })),
  };
}

const PAGE_SIZE = 10;
const STATUS_FILTERS = ['All Status', ...PO_STATUS_OPTIONS];
// A Machine-type purchase order always routes approval to this one fixed
// Sales Employee -- Approved By becomes locked/read-only rather than a
// picker (see the purchaseTypeValue === 'Machine' branches below). Same
// rule/pattern as SalesQuotation.jsx's own salesCategory === 'Machine'
// handling. Parts/Services/etc. are unaffected: Approved By there is
// still the same employee picker, scoped to approvalAuthorization === true.
const MACHINE_APPROVER_EMPLOYEE_CODE = 'KE2021000';

const STATUS_COLORS = {
  Draft: 'default', Open: 'success', 'Partially Received': 'info', Received: 'success',
  'Partially Invoiced': 'warning', Closed: 'default', Cancelled: 'error',
};

const PO_LIST_TABLE_ROW_HEIGHT = 0;
const PO_LIST_TABLE_CELL_PADDING_Y = 6;
export default function PurchaseOrder({ openDocNo } = {}) {
  const currentUser = useSelector(selectCurrentUser);
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const itemScrollRef = useDragScroll();
  // Headers only, and bounded server-side (see GET /purchase/orders). That
  // route had no `take` and returned every purchase order ever raised with
  // all of its lines, to a page that shows a paginated table of headers —
  // one of the two requests that made the purchase pages take minutes to
  // open on live data. `includeItems: 'false'` is a switch the route already
  // supported; nothing was passing it. Everything that needs an order's
  // lines — View, Edit, Duplicate, and Copy To, which hands the whole
  // document to the next page — fetches that one order by id below.
  const { data: orders, isLoading, refetch: refetchOrders } = purchaseOrderApi.useList({ includeItems: 'false' });
  const [fetchOrderById] = purchaseOrderApi.useLazyGet();
  const [openingDoc, setOpeningDoc] = useState(false);
  const { data: quotations } = purchaseQuotationApi.useList();
  const { data: suppliers } = supplierApi.useList();
  // "Ship to a different customer" — the Customer CFL revealed by that
  // checkbox on the Supplier & Document Details card. Same source (and same
  // pre-resolved `shippingAddress` string per row) as Purchase Invoice's own
  // shipToCustomers — see the comment there (features/resources.js's
  // toLegacyPartnerShape).
  const { data: shipToCustomers, isLoading: shipToCustomersLoading } = customerApi.useList();
  const { data: products } = productApi.useList({ view: 'picker' });
  const { rates: priceListRates } = usePriceListRates('DLP');
  const { data: branches } = branchApi.useList();
  const { data: houseBanks } = houseBankApi.useList();
  const { data: taxCodes } = taxCodeApi.useList();
  // A brand-new item row's Tax (%) CFL defaults to this Tax Code instead of
  // showing empty — see pickDefaultTaxCode's own doc comment.
  const defaultTaxCode = useMemo(() => pickDefaultTaxCode(taxCodes), [taxCodes]);
  const { data: salesEmployees } = salesEmployeeApi.useList();
  const taxCodeOptions = useMemo(() => buildTaxCodeOptions(taxCodes), [taxCodes]);
  const taxCodeById = useMemo(() => new Map(taxCodeOptions.map((o) => [o.value, o])), [taxCodeOptions]);
  const { data: company } = useGetCompanyDetailsQuery();
  const [create, { isLoading: creating }] = purchaseOrderApi.useCreate();
  const [update, { isLoading: updating }] = purchaseOrderApi.useUpdate();
  const [remove] = purchaseOrderApi.useDelete();
  const [cancelOrder] = purchaseOrderApi.useCancel();
  const [peekDocumentNumber] = usePeekDocumentNumberMutation();

  const supplierOptions = (suppliers || []).map((s) => ({ label: s.supplierName, value: s.supplierName }));
  // Prepared By lists every Sales Employee; Approved By is scoped to the
  // ones flagged with approval authorization on the Sales Employee master.
  const approvedByOptions = (salesEmployees || []).filter((s) => s.approvalAuthorization === true).map((s) => ({ label: s.employeeName, value: s.employeeName }));
  // Used for the create/edit form's Supplier field only (the shared
  // PartyCodeSelect). value stays the supplier NAME — everything downstream
  // (the contact-info effect, Copy From's supplier match, the print record
  // lookup) compares against supplierName — while label/code/name drive the
  // Code/Name picker itself.
  // Memoized so typing in the form doesn't rebuild a fresh options array
  // (and fresh option objects) on every keystroke, which was racing
  // Autocomplete's own filtered/highlighted state and intermittently
  // showing stale/unrelated rows while typing quickly.
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
  // Quotations are no longer offered as a dropdown on the form — they are
  // picked through the Copy From dialog, which scopes the list to the
  // selected supplier. A Quotation already marked Closed has nothing left to
  // copy forward, so it's dropped from the pickable list rather than the raw
  // `quotations` list going straight to the dialog.
  const copyableQuotations = useMemo(
    () => (quotations || []).filter((q) => q.status !== 'Closed' && q.status !== 'Cancelled'),
    [quotations]
  );
  // View toggles between the order list and the full-page Create/Edit form —
  // same page, no dialog/popup, per the standard CRUD page template.
  const [view, setView] = useState('list');
  const [editingRow, setEditingRow] = useState(null);
  // Scoped to the signed-in user's own granted branches (see
  // useBranchOptions.js) so a non-admin can't pick a branch they were never
  // granted. Two separate calls (rather than one shared list) so each
  // field's own already-saved value stays selectable via currentValue.
  const { options: branchOptions } = useBranchNameOptions({ currentValue: editingRow?.branch });

  // selectableProducts/productCodeOptions/productNameOptions used to live
  // here, computed from editingRow?.items — a static snapshot that only
  // reflected the record's lines as of page load. That went stale the moment
  // Copy From replaced the items array with a different document's lines, so
  // it's now computed live inside AppForm's render prop instead (keyed off
  // watchedItems, which tracks the form's actual current rows) — see the
  // fix note next to watchedItems below.
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  // Copy From ("Find Purchase Quotation") dialog. Held at page level rather
  // than inside AppForm's render prop so remounting the form on formKey change
  // can't leave a dialog orphaned open over a freshly reset form.
  const [copyFromOpen, setCopyFromOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState('All Status');
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
  const pendingStatusRef = useRef(null);

  const rows = orders || [];

  const baseTableRows = useMemo(() => {
    const q = '';
    const ref = refFilter.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesSearch = !q || [r.poNo, r.supplier, r.referenceNo].some((v) => String(v || '').toLowerCase().includes(q));
      const matchesSupplier = !supplierFilter || r.supplier === supplierFilter.value;
      const matchesStatus = statusFilter === 'All Status' || r.status === statusFilter;
      const matchesRef = !ref || String(r.referenceNo || '').toLowerCase().includes(ref);
      const pd = r.poDate ? dayjs(r.poDate) : null;
      const matchesFrom = !dateFrom || (pd && !pd.isBefore(dateFrom, 'day'));
      const matchesTo = !dateTo || (pd && !pd.isAfter(dateTo, 'day'));
      return matchesSearch && matchesSupplier && matchesStatus && matchesRef && matchesFrom && matchesTo;
    });
  }, [rows, supplierFilter, statusFilter, refFilter, dateFrom, dateTo]);

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'id', headerName: 'Select', filter: false, searchable: false },
    { field: 'poNo', headerName: 'PO No.', filter: 'text' },
    { field: 'supplier', headerName: 'Supplier', filter: 'text' },
    { field: 'poDate', headerName: 'PO Date', filter: 'dateRange', sortValue: (row) => (row.poDate ? new Date(row.poDate).getTime() : null) },
    { field: 'deliveryDate', headerName: 'Delivery Date', filter: 'dateRange', sortValue: (row) => (row.deliveryDate ? new Date(row.deliveryDate).getTime() : null) },
    { field: 'amount', headerName: 'Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.amount == null || row.amount === '' ? null : Number(row.amount)) },
    { field: 'status', headerName: 'Status', filter: 'select' },
    { field: 'referenceNo', headerName: 'Reference (Quotation No.)', filter: 'text' },
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

  // The list row is a header — no lines. View, Edit, Duplicate and Print all
  // go through here so the form (and Copy To, which passes `editingRow`
  // wholesale to the next document) always holds the complete order. A
  // correctness requirement rather than a completeness one: saving an edit
  // replaces the order's lines, so a form opened on a header-only row would
  // empty the order on save. A failed fetch aborts instead, and the return
  // value tells the caller whether anything opened.
  const openDocument = async (row, readOnlyMode) => {
    setOpeningDoc(true);
    let full;
    try {
      full = await fetchOrderById(row.id).unwrap();
    } catch (err) {
      notify.error(err?.data?.message || `Couldn't load purchase order "${row.poNo}". Please try again.`);
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
    if (editingRow && editingRow.poNo === openDocNo) return;
    const match = rows.find((r) => r.poNo === openDocNo);
    if (match) handleView(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDocNo, rows]);

  // "Copy To > Purchase Order" lands the browser on this page's route, but
  // that alone used to leave the user on the LIST view — the intent-
  // consuming effect that actually applies the source document's data lives
  // inside AppForm's render prop below, which only mounts once `view` is
  // 'form', so nothing happened until the user clicked "+ Add New"
  // themselves first. Mirrors the openDocNo effect just above: notice a
  // pending intent addressed to this page on arrival and open the create
  // form immediately, so the user lands straight on a pre-filled order.
  const pendingCopyIntentForAutoOpen = useSelector((s) => s.copyIntent.pending);
  useEffect(() => {
    if (!pendingCopyIntentForAutoOpen || pendingCopyIntentForAutoOpen.targetKey !== 'purchaseOrder') return;
    if (view === 'form') return;
    openCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCopyIntentForAutoOpen]);

  const handleEdit = (row) => {
    setRowMenuAnchor(null);
    openDocument(row, false);
  };

  // Awaits the open rather than racing it: the order's lines now arrive over
  // the network, so a fixed delay after a synchronous setState would print a
  // half-empty sheet on a slow connection. The 300ms below is still for the
  // render/@page work, which is what it was always for.
  const handlePrint = async (row) => {
    setRowMenuAnchor(null);
    const opened = await openDocument(row, true);
    if (!opened) return;
    // printPurchaseOrder(), not window.print(): it installs the Purchase
    // Order sheet's own @page rule and print-scoping classes for the duration
    // of the job (see PurchaseOrderPrintable.jsx), which is what keeps the
    // output portrait and the ruled frame filling the sheet.
    setTimeout(() => printPurchaseOrder(), 300);
  };

  const handleDuplicate = async (row) => {
    // Fetched in full first: rowToFormValues maps row.items, and the list row
    // no longer has them — duplicating from it would create an order with no
    // lines at all, which is worse than failing.
    let source;
    try {
      source = await fetchOrderById(row.id).unwrap();
    } catch (err) {
      notify.error(err?.data?.message || `Couldn't load purchase order "${row.poNo}" to duplicate.`);
      return;
    }
    const poNo = await peekNextDocumentNumber(peekDocumentNumber, 'PO', notify);
    const payload = { ...rowToFormValues(source, taxCodes), poNo, status: 'Open' };
    try {
      await create(payload).unwrap();
      notify.success('Purchase order duplicated as a new draft');
    } catch (err) {
      notify.error(err?.data?.message || 'Duplicate failed');
    }
  };

  const handleDelete = async (row) => {
    setRowMenuAnchor(null);
    const ok = await confirmDialog({
      title: 'Delete purchase order',
      message: `Are you sure you want to delete "${row.poNo}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Purchase order deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  // Cancel — a soft alternative to Delete: the order stays in the list
  // (status becomes "Cancelled") but is dropped from every Copy From / "pick
  // a source document" picker downstream (see copyablePurchaseOrders in
  // PurchaseGRN.jsx) and View/Edit/Print get blocked for it below, once
  // isCancelled is true. Only allowed while nothing has been received or
  // invoiced against the order yet — the backend enforces this and returns
  // a clear message if not, same as any other guarded action in this app.
  const handleCancel = async (row) => {
    setRowMenuAnchor(null);
    const ok = await confirmDialog({
      title: 'Cancel purchase order',
      message: `Are you sure you want to cancel "${row.poNo}"? This cannot be undone — the order will be locked and hidden from GRN/Invoice creation.`,
      confirmLabel: 'Cancel Order',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await cancelOrder(row.id).unwrap();
      notify.success('Purchase order cancelled');
    } catch (err) {
      notify.error(err?.data?.message || 'Cancel failed');
    }
  };

  const removeSelected = async () => {
    const ok = await confirmDialog({
      title: 'Delete selected purchase orders',
      message: `Delete ${checkedIds.length} selected purchase order${checkedIds.length > 1 ? 's' : ''}? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await Promise.all(checkedIds.map((id) => remove(id).unwrap()));
      notify.success('Selected purchase orders deleted');
      setCheckedIds([]);
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    // "Save as Draft" is a shortcut that forces Draft. The main Save/Update
    // button does NOT force a status — it used to always set 'Open', which
    // silently downgraded an already Partially Received / Received / Closed
    // PO back to Open on every edit, even one that only changed an unrelated
    // field. There is no Status dropdown on this form (status here is mostly
    // system-derived — see recomputePurchaseOrder), so falling back to
    // values.status just keeps whatever the record's current status already
    // is, exactly like leaving the field untouched should.
    const payload = { ...values, status: pendingStatusRef.current || values.status };
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...payload }).unwrap();
        notify.success('Purchase order updated');
      } else {
        await create(payload).unwrap();
        notify.success('Purchase order saved');
      }
      backToList();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
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
  if (openingDoc || (openDocNo && (!editingRow || editingRow.poNo !== openDocNo))) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box>

      {view === 'form' ? (
        <RouteMapContextMenu flow="purchase" type="order" docNo={editingRow?.poNo}>
          <AppForm
            key={formKey}
            schema={purchaseOrderSchema}
            defaultValues={editingRow ? rowToFormValues(editingRow, taxCodes) : getEmptyValues(currentUser?.name || currentUser?.email, defaultTaxCode)}
            onSubmit={handleSubmit}
          >
            {(methods) => {
              const { control, watch, setValue } = methods;
              const { fields, append, remove: removeItem, replace: replaceItems } = useFieldArray({ control, name: 'items' });
              // "Copy To" hand-off — see copyIntentSlice.js and CopyToButton.jsx.
              const dispatch = useDispatch();
              const pendingCopyIntent = useSelector((s) => s.copyIntent.pending);

              // Purchase Type 'Machine' locks Approved By to one fixed
              // employee (looked up by Employee Code, not hardcoded, so a
              // rename in Sales Employee Master is picked up automatically;
              // falls back to the bare code if that master hasn't loaded
              // yet or no longer has a matching employee). Switching back
              // to any other Purchase Type restores whatever was chosen
              // before the switch, same caching pattern SalesQuotation.jsx
              // uses for its own Machine-only fields.
              const purchaseTypeValue = watch('purchaseType');
              const prevPurchaseTypeRef = useRef(purchaseTypeValue);
              const approvedByCacheRef = useRef('');
              const machineApprover = (salesEmployees || []).find((e) => e.employeeCode === MACHINE_APPROVER_EMPLOYEE_CODE);
              const machineApproverName = machineApprover?.employeeName || MACHINE_APPROVER_EMPLOYEE_CODE;
              useEffect(() => {
                const prevType = prevPurchaseTypeRef.current;
                prevPurchaseTypeRef.current = purchaseTypeValue;
                if (prevType === purchaseTypeValue) return;
                if (purchaseTypeValue === 'Machine') {
                  approvedByCacheRef.current = methods.getValues('approvedBy') || '';
                  setValue('approvedBy', machineApproverName, { shouldValidate: true });
                } else if (prevType === 'Machine') {
                  setValue('approvedBy', approvedByCacheRef.current || '', { shouldValidate: true });
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [purchaseTypeValue]);

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
                  warehouse: raw.warehouse || (''),
                };
              };
              const handleItemsImported = (rawItems) => {
                append(rawItems.map(resolveImportedItem));
              };
              const watchedItems = watch('items') || [];

              // Only products flagged for the purchase flow are offered here
              // — see lib/productUsage.js. Computed from watchedItems (the
              // form's actual current lines), NOT editingRow?.items — that
              // used to be a static snapshot of what the record looked like
              // on page load, so a product brought in afterwards by Copy
              // From (one that isn't purchase-flagged, or has since gone
              // Inactive) fell outside it and its Item No/Description Select
              // rendered blank even though the row's other fields copied
              // across fine. Keying off watchedItems instead keeps every
              // currently-present line's product in the picker, Copy From
              // included.
              const selectableProducts = productOptionsFor(
                products,
                PRODUCT_USAGE.PURCHASE,
                watchedItems.map((i) => i.productCode)
              );
              const productCodeOptions = selectableProducts.map((p) => ({ label: p.productCode, value: p.productCode }));
              const productNameOptions = selectableProducts.map((p) => ({ label: p.productName, value: p.productCode }));

              // Every column of this item table is sized to show its values IN FULL —
              // no ellipsis, no wrapping, no hover, however long the text is. The
              // spec below is positional: it mirrors the header row top to bottom,
              // and `null` leaves a column (the # counter, the action column) at
              // whatever width it already has. See itemTableSx in lib/columnWidth.js.
              const itemColumnsSx = itemTableSx(watchedItems, [
                null,
                { header: 'Item No *', get: (i) => i?.productCode, field: 'select' },
                { header: 'Description', get: (i) => i?.productName, field: 'select' },
                { header: 'HSN/SAC', get: (i) => i?.hsnCode, field: 'text' },
                { header: 'Unit', get: (i) => i?.uom, field: 'text' },
                { header: 'Warehouse *', get: (i) => i?.warehouse, field: 'select' },
                { header: 'Quantity *', get: (i) => i?.quantity, field: 'text' },
                { header: 'Unit Price (₹) *', get: (i) => i?.unitPrice, field: 'text' },
                { header: 'Tax (%)', get: (i) => taxCodeById.get(i?.taxCodeId)?.label ?? i?.taxPercent, field: 'select' },
                { header: 'Amount (₹)', get: (i) => ((Number(i?.quantity) || 0) * (Number(i?.unitPrice) || 0)).toFixed(2), field: 'plain', min: 110 },
                null,
              ]);
              const poDateValue = watch('poDate');
              const poDateForMin = poDateValue ? dayjs(poDateValue) : null;
              const today = dayjs();
              const endDateMinDate = poDateForMin && poDateForMin.isAfter(today, 'day') ? poDateForMin : today;
              const discountPercent = watch('discountPercent');
              const interState = isInterState(watch('supplierState'), company?.state);

              const itemsForTotals = watchedItems.map((it) => ({ ...it, taxType: taxCodeById.get(it.taxCodeId)?.taxType || '' }));
              const freightNetAmount = watch('freightNetAmount');
              const freightTaxAmount = watch('freightTaxAmount');
              const totals = computeTotals(itemsForTotals, discountPercent, interState, { freightNetAmount, freightTaxAmount });
              const taxCodeOptionsForRow = useMemo(
                () => buildTaxCodeOptions(taxCodes, { taxType: taxTypeFamilyFor(interState) }),
                [taxCodes, interState]
              );
              const liveDefaultTaxCode = useMemo(
                () => pickDefaultTaxCode(taxCodes, { taxType: taxTypeFamilyFor(interState) }),
                [taxCodes, interState]
              );
              const prevInterStateRef = useRef(interState);
              useEffect(() => {
                if (prevInterStateRef.current === interState) return;
                prevInterStateRef.current = interState;
                const validTaxCodeIds = new Set(taxCodeOptionsForRow.map((o) => o.value));
                watchedItems.forEach((item, idx) => {
                  if (item?.taxCodeId != null && !validTaxCodeIds.has(Number(item.taxCodeId))) {
                    setValue(`items.${idx}.taxCodeId`, liveDefaultTaxCode ? liveDefaultTaxCode.id : null, { shouldValidate: true });
                    setValue(`items.${idx}.taxPercent`, liveDefaultTaxCode ? liveDefaultTaxCode.rate : null, { shouldValidate: true });
                  }
                });
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [interState, taxCodeOptionsForRow, liveDefaultTaxCode]);
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

              const allValues = watch();
              const printSupplierRecord = (suppliers || []).find((s) => s.supplierName === allValues.supplier);
              const printBranchRecord = (branches || []).find((b) => b.branchName === allValues.branch);
              const printHouseBankRecord = (houseBanks || []).find((b) => `${b.bankName} - ${b.accountNumber}` === allValues.bankAccount);

              const printShipToCustomerRecord = allValues.shipToCustomer
                ? (shipToCustomers || []).find((c) => c.customerName === allValues.shipToCustomer)
                : null;

              const printOrder = { ...allValues, items: itemsForTotals, status: editingRow?.status || 'Open' };

              const approverSignatureUrl = (salesEmployees || []).find((s) => s.employeeName === allValues.approvedBy)?.signatureUrl || null;

              const supplierValue = watch('supplier');
              const supplierRecord = useMemo(
                () => (suppliers || []).find((s) => s.supplierName === supplierValue),
                [suppliers, supplierValue]
              );

              const prevSupplier = useRef(editingRow ? editingRow.supplier : null);
              useEffect(() => {
                if (supplierValue !== prevSupplier.current) {
                  const found = (suppliers || []).find((s) => s.supplierName === supplierValue);
                  if (found) {
                    setValue('contactPerson', found.contactPerson || '', { shouldValidate: true });
                    setValue('phone', found.phone || '', { shouldValidate: true });
                    setValue('email', found.email || '', { shouldValidate: true });
                  }
                  prevSupplier.current = supplierValue;
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [supplierValue]);
              const supplierShipFrom = useMemo(() => {
                const billing = (supplierRecord?.addresses || []).filter((a) => a.addressType === 'Billing');
                const defaultBilling = billing.find((a) => a.isDefault) || billing[0];
                return formatBusinessPartnerAddress(defaultBilling) || '';
              }, [supplierRecord]);

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


              const supplierState = useMemo(() => {
                const billing = (supplierRecord?.addresses || []).filter((a) => a.addressType === 'Billing');
                const defaultBilling = billing.find((a) => a.isDefault) || billing[0];
                return defaultBilling?.state || '';
              }, [supplierRecord]);
              useEffect(() => {
                setValue('supplierState', supplierState || '', { shouldValidate: true });
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [supplierState]);

              const applyQuotation = (found) => {
                if (found) {

                  setValue('quotationNo', found.quotationNo || '', { shouldValidate: true });
                  setValue('referenceNo', found.quotationNo || '', { shouldValidate: true });
                  setValue('supplier', found.supplier || '', { shouldValidate: true });
                  setValue('branch', found.branch || '', { shouldValidate: true });

                  prevSupplier.current = found.supplier || '';
                  setValue('contactPerson', found.contactPerson || '', { shouldValidate: true });
                  setValue('phone', found.phone || '', { shouldValidate: true });
                  setValue('email', found.email || '', { shouldValidate: true });
                  setValue('currency', found.currency || 'INR', { shouldValidate: true });
                  setValue('paymentTerms', found.paymentTerms || '', { shouldValidate: true });
                  setValue('deliveryDate', found.deliveryDate || null, { shouldValidate: true });
                  setValue('shipTo', found.shipTo || '', { shouldValidate: true });
                  setValue('termsConditions', found.termsConditions || '', { shouldValidate: true });
                  setValue('discountPercent', found.discountPercent != null ? Number(found.discountPercent) : 0, { shouldValidate: true });
                  // Carried on the quotation but previously left behind on
                  // Copy To (the quotation has no Other Details block, so
                  // this is all there is to bring across).
                  setValue('approvedBy', found.approvedBy || '', { shouldValidate: true });
                  if (found.items && found.items.length) {
                    // replaceItems(), not setValue('items', ...) — see the
                    // same fix on Delivery Challan's order-fetch effect.
                    // replace() (useFieldArray's own API) gives every row a
                    // fresh field id, remounting each ProductCell instead of
                    // reusing the old one — reused cells saw productCode
                    // change from '' to the quotation's value, read that as a
                    // user picking a product, and overwrote the tax rate/unit
                    // price just set here with the *product master's*
                    // defaults instead of the quotation's.
                    const mappedItems = found.items.map((i, n) => ({
                      productCode: i.productCode || '', productName: i.productName || '', description: i.description || '',
                      hsnCode: i.hsnCode || '', uom: i.uom || '',
                      quantity: i.quantity != null ? Number(i.quantity) : 1,
                      unitPrice: priceListRates?.get(i.productCode) ?? (i.unitPrice != null ? Number(i.unitPrice) : 0),
                      taxPercent: i.taxPercent != null ? Number(i.taxPercent) : 18,
                      taxCodeId: i.taxCodeId != null ? Number(i.taxCodeId) : null,
                      // Quotation lines now carry their own warehouse too —
                      // carried straight across, editable afterwards.
                      warehouse: i.warehouse || '',
                      // Copy From: this line came from the quotation's line n.
                      baseType: 'Purchase Quotation',
                      baseEntry: found.id ?? null,
                      baseNo: found.quotationNo || null,
                      baseLine: n + 1,
                    }));
                    replaceItems(mappedItems);
                    // Belt-and-braces: replace() giving every row a fresh
                    // field id is meant to stop ProductCell's own master-
                    // lookup effect from treating this as a productCode
                    // "change", but that guard has been observed losing the
                    // race in practice (reported: Rate landing at the
                    // Product Master's own default instead of the
                    // quotation's). Reasserting the quotation's own values a
                    // moment later — after that cell's effect has had every
                    // chance to run and lose — guarantees the copied figures
                    // win regardless of exactly how that race goes.
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
              // in a PO that no longer claims to reference it.
              //
              // The supplier is deliberately NOT cleared. It is the user's own
              // selection — it is what made Copy From available in the first
              // place, and clearing it would close the dialog off and force a
              // re-pick just to try a different quotation from the same vendor.
              // Contact Person / Phone / Email stay too: they belong to the
              // supplier, not the quotation.
              const referenceValue = watch('referenceNo');
              const clearQuotation = () => {
                // Drop the real link too, so the quotation reopens on save.
                setValue('quotationNo', '', { shouldValidate: true });
                setValue('referenceNo', '', { shouldValidate: true });
                setValue('currency', 'INR', { shouldValidate: true });
                setValue('paymentTerms', '', { shouldValidate: true });
                setValue('deliveryDate', null, { shouldValidate: true });
                setValue('shipTo', branchShipTo || '', { shouldValidate: true });
                lastAutoShipToRef.current = branchShipTo;
                setValue('shipFrom', supplierShipFrom || '', { shouldValidate: true });
                lastAutoShipFromRef.current = supplierShipFrom;
                setValue('termsConditions', '', { shouldValidate: true });
                setValue('discountPercent', 0, { shouldValidate: true });
                replaceItems([{ ...emptyItem }]);
              };

              const handleFile = (file) => {
                if (file) setValue('attachmentName', file.name, { shouldValidate: true });
              };

              // Once Branch is picked, the Warehouse dropdown is scoped to
              // that branch's warehouses only — see useWarehouseOptions.js.
              const branch = watch('branch');

              // Ship To now defaults from the selected branch's own address
              // (the same Branch Master row printBranchRecord above resolves
              // for the printable), not the supplier's Business Partner
              // shipping address — the whole point being that Ship To
              // reflects where the goods are actually delivered (the
              // ordering branch), not an address on the supplier's own
              // record. branchAddressLines() returns [] for no/blank
              // branch, which just leaves Ship To untouched instead of
              // forcing an empty box.
              const branchShipTo = useMemo(
                () => branchAddressLines(printBranchRecord).join('\n'),
                [printBranchRecord]
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

              const { warehouses } = useWarehouseOptions({});
              // Every line can carry a different warehouse, and on edit/view
              // a saved value that isn't in the currently-selected branch's
              // list (a different branch, a since-deactivated warehouse, ...)
              // must still show, not render blank — see useWarehouseOptions.js.
              const { options: branchWarehouseOptions } = useWarehouseOptions({
                branch,
                currentValue: watchedItems.map((i) => i.warehouse),
              });

              useEffect(() => {
                const branchRecord = (branches || []).find((b) => b.branchName === branch);
                setValue('placeOfSupply', branchRecord?.state || '', { shouldValidate: true });
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [branch, branches]);

              const prevBranchRef = useRef(branch);
              useEffect(() => {
                if (prevBranchRef.current === branch) return;
                prevBranchRef.current = branch;
                const allowed = warehouseCodesForBranch(warehouses, branch);
                (watch('items') || []).forEach((it, idx) => {
                  if (it.warehouse && !allowed.has(it.warehouse)) setValue(`items.${idx}.warehouse`, '');
                });
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [branch]);

              // Consume a pending "Copy To" intent addressed to this page —
              // see copyIntentSlice.js and CopyToButton.jsx.
              useEffect(() => {
                if (!pendingCopyIntent || pendingCopyIntent.targetKey !== 'purchaseOrder') return;
                if (pendingCopyIntent.sourceType === 'purchaseQuotation') applyQuotation(pendingCopyIntent.sourceDoc);
                dispatch(clearCopyIntent());
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [pendingCopyIntent]);

              return (
                <>
                  <CopyFromDocumentDialog
                    open={copyFromOpen}
                    onClose={() => setCopyFromOpen(false)}
                    onChoose={applyQuotation}
                    documents={copyableQuotations}
                    party={supplierValue}
                    title="Find Purchase Quotation"
                    columns={QUOTATION_COPY_COLUMNS}
                    emptyMessage="No quotations found for"
                  />
                  <PurchaseOrderPrintable
                    order={printOrder}
                    company={company}
                    supplierRecord={printSupplierRecord}
                    branchRecord={printBranchRecord}
                    houseBankRecord={printHouseBankRecord}
                    shipToCustomerRecord={printShipToCustomerRecord}
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
                        <FormGrid columns={2} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING} singleColumnOnMobile>
                          <LabeledField label="Branch *">
                            <FormSelect name="branch" label="" placeholder="Select branch" options={branchOptions} />
                          </LabeledField>
                          <LabeledField label="PO No. *">
                            <DocumentSeriesNoField documentCode="PO" seriesFieldName="seriesId" numberFieldName="poNo" isCreate={!editingRow} />
                          </LabeledField>

                          <LabeledField label="Supplier Code *">
                            <PartyCodeSelect
                              name="supplier"
                              label=""
                              placeholder="Select supplier"
                              options={supplierFieldOptions}
                              // The name is shown in its own row right below
                              // (Supplier Name) instead of inline here.
                              showNameBelow={false}
                            />
                          </LabeledField>
                          <LabeledField label="PO Date *">
                            <FormDatePicker name="poDate" label="" triggerFields={['deliveryDate']} />
                          </LabeledField>

                          {/* Read-only echo of the selected supplier's full
                          name — the Supplier field above shows only its Code,
                          so this is what tells the user which supplier that
                          code actually is. Not a stored field: it just
                          displays the current value of `supplier`, which
                          already holds the supplier's name (see
                          supplierFieldOptions above). */}
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
                          <LabeledField label="Delivery Date *">
                            <FormDatePicker name="deliveryDate" label="" minDate={endDateMinDate} triggerFields={['poDate']} />
                          </LabeledField>

                          {/* No short field left to pair this with — every
                          other short control above is already paired off,
                          and the only fields left (Ship From/Ship To) are
                          both tall multiline boxes, so pairing either of
                          them here would leave this row visibly lopsided.
                          Gets its own row instead, same as Place of Supply
                          on Purchase Invoice's card. */}

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
                          of Supply, which tracks the branch's state. */}
                          <LabeledField label="State">
                            <FormTextField name="supplierState" label="" placeholder="Supplier state" disabled />
                          </LabeledField>
                        </FormGrid>
                      </fieldset>
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
                                  <ProductCell index={index} methods={methods} options={productCodeOptions} products={products} priceListRates={priceListRates} label="Item No *" placeholder="Select product code" />
                                  <ProductCell index={index} methods={methods} options={productNameOptions} products={products} priceListRates={priceListRates} label="Description" placeholder="Select product name" />
                                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 1.5, rowGap: 1.5 }}>
                                    <FormTextField name={`items.${index}.hsnCode`} label="HSN/SAC" placeholder="HSN/SAC" digitsOnly maxLength={8} />
                                    <FormTextField name={`items.${index}.uom`} label="Unit" placeholder="Unit" />
                                    <WarehouseCodeSelect name={`items.${index}.warehouse`} label="Warehouse *" placeholder={branch ? 'Select warehouse' : 'Select a branch first'} options={branchWarehouseOptions} disabled={!branch} />
                                    <FormTextField name={`items.${index}.quantity`} label="Quantity *" type="number" />
                                    <FormTextField name={`items.${index}.unitPrice`} label="Unit Price (₹) *" type="number" />
                                    <FormSelect name={`items.${index}.taxCodeId`} label="Tax (%)" options={taxCodeOptionsForRow} popupFitContent onValueChange={(_v, option) => setValue(`items.${index}.taxPercent`, option ? option.rate : 0, { shouldValidate: true })} />
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
                                  <TableCell>Tax (%)</TableCell>
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
                                      <TableCell>
                                        <WarehouseCodeSelect name={`items.${index}.warehouse`} label="" placeholder={branch ? 'Select' : 'Select branch first'} options={branchWarehouseOptions} disabled={!branch} popupFitContent showNameBelow={false} />
                                      </TableCell>
                                      <TableCell>
                                        <FormTextField name={`items.${index}.quantity`} label="" type="number" />
                                      </TableCell>
                                      <TableCell>
                                        <FormTextField name={`items.${index}.unitPrice`} label="" type="number" />
                                      </TableCell>
                                      <TableCell>
                                        <FormSelect name={`items.${index}.taxCodeId`} label="" options={taxCodeOptionsForRow} disableClearable sx={{ minWidth: 96 }} popupFitContent onValueChange={(_v, option) => setValue(`items.${index}.taxPercent`, option ? option.rate : 0, { shouldValidate: true })} />
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
                              <DocumentTotalsPanel totals={totals} interState={interState} subtotalLabel="Subtotal" showRoundOff={false} discountField={null} showFreight />
                            </Box>
                          </Grid>

                          <Grid item xs={12} md={4}>
                            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Prepared By</Typography>
                            <FormTextField name="preparedBy" label="" disabled />
                          </Grid>

                          <Grid item xs={12} md={4}>
                            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Approved By</Typography>
                            {purchaseTypeValue === 'Machine' ? (
                              <FormTextField name="approvedBy" label="" disabled />
                            ) : (
                              <FormSelect name="approvedBy" label="" placeholder="Select employee" options={approvedByOptions} />
                            )}
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
                          sourceType="purchaseOrder"
                          sourceDoc={editingRow}
                          sourceLabel="Purchase Order"
                          docNoField="poNo"
                          targets={[
                            { key: 'purchaseGRN', label: 'Purchase GRN', path: '/purchase/grn' },
                            { key: 'purchaseInvoice', label: 'Purchase Invoice', path: '/purchase/invoice' },
                          ]}
                        />
                        {/* Copy From sits immediately left of Cancel and stays
                          disabled until a Supplier is chosen — the dialog it
                          opens lists that supplier's quotations, so with no
                          supplier there is nothing for it to show. Hidden in
                          view mode, where nothing is being filled in. */}
                        {!readOnly && (
                          referenceValue ? (
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
                              disabled={!supplierValue || creating || updating}
                            >
                              Copy From
                            </Button>
                          )
                        )}
                        <Button fullWidth={isMobile} type="button" variant="outlined" color="inherit" startIcon={<CloseIcon />} onClick={backToList} disabled={creating || updating}>
                          Cancel
                        </Button>
                        <Button fullWidth={isMobile} type="button" variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => printPurchaseOrder()}>
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
                              onClick={() => { pendingStatusRef.current = null; }}
                              disabled={creating || updating}
                              loading={creating || updating}
                            >
                              {editingRow ? 'Update Purchase Order' : 'Save Purchase Order'}
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
                    templateUrl="/purchase/orders/items-import/template"
                    importUrl="/purchase/orders/items-import"
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
              <Typography variant="subtitle1" fontWeight={700}>Purchase Order List</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap sx={{ width: { xs: '100%', md: 'auto' } }}>
                <TableSearchFilter table={table} placeholder="Search by PO no., supplier, reference..." showFilter={false} />
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
                        Create Purchase Order
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
                    label="Reference (Quotation No.)"
                    value={refFilter}
                    onChange={(e) => { setRefFilter(e.target.value); setPage(0); }}
                    placeholder="Enter quotation no."
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
                    title={row.poNo}
                    statusChip={<Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />}
                    fields={[
                      { label: 'Supplier', value: row.supplier || '—' },
                      { label: 'PO Date', value: row.poDate ? dayjs(row.poDate).format('DD/MM/YYYY') : '—' },
                      { label: 'Delivery Date', value: row.deliveryDate ? dayjs(row.deliveryDate).format('DD/MM/YYYY') : '—' },
                      { label: 'Amount', value: `₹${Number(row.amount).toFixed(2)}` },
                      { label: 'Reference (Quotation No.)', value: row.referenceNo || '—' },
                    ]}
                    // Cancelled orders are fully locked — no View/Edit/Delete/
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
                  <EmptyState icon={<ShoppingCartOutlinedIcon sx={{ fontSize: 48 }} />} title="No purchase orders found" message="Add your first purchase order to get started" />
                )}
              </Box>
            ) : (
              <ScrollableTableContainer>
                <Table
                  size="small"
                  stickyHeader
                  sx={{
                    '& th, & td': {
                      height: PO_LIST_TABLE_ROW_HEIGHT,
                      paddingTop: `${PO_LIST_TABLE_CELL_PADDING_Y}px`,
                      paddingBottom: `${PO_LIST_TABLE_CELL_PADDING_Y}px`,
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
                      <SortableHeaderCell field="poNo" sort={table.sort} onSort={table.toggleSort}>PO No.</SortableHeaderCell>
                      <SortableHeaderCell field="supplier" sort={table.sort} onSort={table.toggleSort}>Supplier</SortableHeaderCell>
                      <SortableHeaderCell field="poDate" sort={table.sort} onSort={table.toggleSort}>PO Date</SortableHeaderCell>
                      <SortableHeaderCell field="deliveryDate" sort={table.sort} onSort={table.toggleSort}>Delivery Date</SortableHeaderCell>
                      <SortableHeaderCell align="right" field="amount" sort={table.sort} onSort={table.toggleSort}>Amount (₹)</SortableHeaderCell>
                      <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                      <SortableHeaderCell field="referenceNo" sort={table.sort} onSort={table.toggleSort}>Reference (Quotation No.)</SortableHeaderCell>
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
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.poNo}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.supplier || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.poDate ? dayjs(row.poDate).format('DD/MM/YYYY') : '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.deliveryDate ? dayjs(row.deliveryDate).format('DD/MM/YYYY') : '—'}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{Number(row.amount).toFixed(2)}</TableCell>
                        <TableCell>
                          <Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.referenceNo || '-'}</TableCell>
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
                              <RouteMapButton flow="purchase" type="order" docNo={row.poNo} />
                              {canDuplicate && (
                                <Tooltip title="Duplicate">
                                  <IconButton size="small" onClick={() => handleDuplicate(row)} aria-label="view">
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
                          <EmptyState icon={<ShoppingCartOutlinedIcon sx={{ fontSize: 48 }} />} title="No purchase orders found" message="Add your first purchase order to get started" />
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
        resourceName="Purchase Orders"
        templateUrl="/purchase/orders/bulk-import/template"
        importUrl="/purchase/orders/bulk-import"
        onImported={refetchOrders}
      />
    </Box>
  );
}

// Isolated so the per-row product-select auto-fill effect only re-runs for
// the row whose product actually changed, not every row on every keystroke.
// Both the Item No and Description columns are selects over the same
// underlying items.{index}.productCode field — Item No lists codes,
// Description lists names, but selecting either one sets the same value, so
// whichever the user picks from, the row's product identity (and therefore
// the auto-filled HSN/UOM/price below) stays in sync.
function ProductCell({ index, methods, options, products, priceListRates, label = '', placeholder = 'Select product', multiline = false, sx }) {
  const notify = useNotify();
  const { watch, setValue, trigger } = methods;
  const productCodeValue = watch(`items.${index}.productCode`);
  const allItems = watch('items') || [];
  const prevValue = useRef(productCodeValue);

  const otherSelectedCodes = useMemo(()=>{
    const set = new Set();
    allItems.forEach((it,i)=>{
      if(i !== index && it?.productCode) {
        set.add(String(it.productCode).trim().toUpperCase());
      }
    });
    return set;
  }, [allItems, index]);

  const optionsWithDisabledLabel = useMemo(()=>{
    return options.map((opt)=>({
      ...opt,
      label: otherSelectedCodes.has(String(opt.value).trim().toUpperCase()) ? `${opt.label} (Already selected)` : opt.label,
    }));
  }, [options, otherSelectedCodes]);

  useEffect(() => {
    if (productCodeValue !== prevValue.current) {
      if(productCodeValue){
        const normalized = String(productCodeValue).trim().toUpperCase();

        if(otherSelectedCodes.has(normalized)){
          const duplicateIdx = allItems.findIndex((it,i)=>i!==index && String(it?.productCode).trim().toUpperCase() === normalized);
          notify.error(`Item "${productCodeValue}" is already selected in row ${duplicateIdx+1}. Please choose a different product.`);
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
      trigger('items')
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
          multiline={multiline}
          sx={sx}
          popupFitContent
        />
      );
}

