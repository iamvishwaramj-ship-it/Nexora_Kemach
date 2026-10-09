import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatPartnerAddress, cleanAddressText } from '../../lib/addressFormat';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import EmptyState from '../../components/data-display/EmptyState';
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
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import WarehouseCodeSelect from '../../components/form/WarehouseCodeSelect';
import PartyCodeSelect, { buildPartyCodeOptions } from '../../components/form/PartyCodeSelect';
import FormDatePicker from '../../components/form/FormDatePicker';
import DocumentSeriesNoField from '../../components/form/DocumentSeriesNoField';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import usePriceListRates from '../../hooks/usePriceListRates';
import CompanyBadge from '../../components/common/CompanyBadge';
import BatchSerialSelectionDialog from '../../components/common/BatchSerialSelectionDialog';
import { CanAdd, CanEdit, CanDelete, CanCancel } from '../../components/common/PermissionGate';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { applyServerErrors } from '../../lib/formErrors';
import { itemTableSx } from '../../lib/columnWidth';
// PURCHASE_CREDIT_MEMO_STATUS_OPTIONS is no longer imported: Status has no
// input on this form any more (it still defaults to 'Open' and still saves —
// see the header card comment), so the option list has nothing to feed here.
import { purchaseCreditMemoSchema } from '../../lib/validation/purchaseSchemas';
import { buildDocument, round2, num, isInterState, computeFreightGross, computeItemDiscountTotal } from '../../lib/documentTotals';
import DocumentTotalsPanel from '../../components/form/DocumentTotalsPanel';
import { useGetCompanyDetailsQuery } from '../../features/company/companyDetailsApi';
import { buildTaxCodeOptions, taxTypeFamilyFor, buildTaxCodeIdByRate, pickDefaultTaxCode, withDefaultTaxCode } from '../../lib/taxCodeOptions';
import { productOptionsFor, PRODUCT_USAGE } from '../../lib/productUsage';
import { taxCodeApi, productApi, salesEmployeeApi } from '../../features/resources';
import { useWarehouseOptions, warehouseLabel, warehouseCodesForBranch } from '../../lib/useWarehouseOptions';
import { PAYMENT_TERMS_OPTIONS } from '../../lib/validation/partnerSchemas';
import { purchaseCreditMemoApi, purchaseInvoiceApi, supplierApi } from '../../features/resources';
import { useBranchNameOptions } from '../../lib/useBranchOptions';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import RouteMapButton from '../../components/common/RouteMapButton';
import RouteMapContextMenu from '../../components/common/RouteMapContextMenu';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import CopyFromDocumentDialog from '../../components/common/CopyFromDocumentDialog';
import JournalEntryViewDialog from '../../components/accounting/JournalEntryViewDialog';
import PurchaseCreditMemoPrintable, { printPurchaseCreditMemo } from '../../components/print/PurchaseCreditMemoPrintable';
import PurchaseOtherDetailsCard from '../../components/common/PurchaseOtherDetailsCard';
import { branchAddressLines } from '../../lib/branchAddress';
// Every currency dropdown reads live from Currency Master rather than a
// hardcoded list — same hook Sales Invoice's own Currency field uses.
import { useCurrencyOptions } from '../../lib/currencyOptions';
import { useDispatch, useSelector } from 'react-redux';
import { selectCurrentUser } from '../../store/authSlice';
import { clearCopyIntent } from '../../store/copyIntentSlice';
import BulkImportDialog from '../../components/common/BulkImportDialog';
import ImportItemsDialog from '../../components/common/ImportItemsDialog';

// Columns for the "Find Purchase Invoice" dialog opened by Copy From.
//
// "Location" reads off the invoice's `branch`: PurchaseInvoice has no
// `location` column of its own (see schema.prisma) — branch is where the
// document was raised, which is the same thing this column is asking.
const INVOICE_COPY_COLUMNS = [
  { field: 'supplier', headerName: 'Vendor Name' },
  { field: 'invoiceNo', headerName: 'Invoice No', nowrap: true },
  { field: 'branch', headerName: 'Location' },
  { field: 'invoiceDate', headerName: 'Invoice Date', type: 'date' },
  { field: 'notes', headerName: 'Comments', type: 'optional' },
];

const PAGE_SIZE = 10;

// Flattens a Business Partner address row into the one-line form the Bill
// From box shows. Byte-identical to PurchaseOrder.jsx's own copy, which
// feeds its Ship From field from exactly the same source — duplicated
// rather than shared only because that one is a file-local helper there
// too; if a third document needs it, it should move to lib/. `suppliers`
// rows carry `.addresses` because supplierApi is a thin alias over GET
// /business-partners (see features/resources.js), which includes them.
function formatBusinessPartnerAddress(addr) {
  // Address Name, Street, Street No, Building/Floor/Room, Block, Country,
  // State, City, Zip Code -- see lib/addressFormat.js (no double commas).
  return formatPartnerAddress(addr);
}

const emptyItem = {
  productCode: '', productName: '', description: '', hsnCode: '', uom: '',
  invoicedQuantity: 0, quantity: 1, unitPrice: 0,
  discountPercent: 0, taxPercent: 0, taxCodeId: null,
  // Which warehouse this line ships back out of — defaults to the header's
  // own (required) Warehouse when a row is added.
  warehouse: '',
  // Populated via the "Batches Number - Selection" / "Serial Numbers -
  // Selection" dialog — see BatchSerialSelectionDialog. Empty unless the
  // selected product's Manage Item By is Batch or Serial.
  batchAllocations: [], serialAllocations: [],
};

/**
 * Blocks the credit memo save when a Batch/Serial-tracked line's quantity
 * isn't fully covered by its selected batches/serials — the client-side half
 * of the same rule the server enforces in assertBatchSerialIssueAllocation
 * (utils/businessRules.js). Mirrors DeliveryChallan.jsx's
 * validateBatchSerialAllocation — a credit memo draws down stock exactly the
 * same way a despatch does.
 */
function validateBatchSerialAllocation(items, productsByCode) {
  for (let i = 0; i < (items || []).length; i++) {
    const item = items[i];
    const trackingMode = productsByCode[item.productCode]?.manageItemBy;
    if (trackingMode !== 'Batch' && trackingMode !== 'Serial') continue;
    const label = item.productCode || `Row ${i + 1}`;
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

// Built fresh per "Add" click rather than held in a module constant, so the
// dates are today's whenever the form opens instead of whenever the JS module
// first loaded — the same reason the other transaction pages do this.
function getEmptyValues(preparedBy, defaultTaxCode) {
  const today = new Date();
  return {
    // status/postingDate/location/billDoNo/billDoDate/reason have no input
    // on the header card any more (see its own comment) but are still real
    // columns doing real work off-form, so they keep their defaults here and
    // still go up with every save: status drives stock posting and the
    // list's Status column, postingDate is the journal entry's posting date,
    // and the other four are printed on the memo.
    creditNo: '', seriesId: '', status: 'Open', invoiceNo: '', supplier: '', supplierName: '',
    supplierCode: '',
    location: '', branch: '', warehouse: '',
    currency: 'INR', billFrom: '', shipTo: '',
    purchaseType: '', typeOfPurchase: '', salesType: '', purchaseEmployee: '', transportMode: '', vendorRefNo: '',
    documentDate: today, postingDate: today, dueDate: null,
    paymentTerms: '', billDoNo: '', billDoDate: null, reason: '', comments: '',
    placeOfSupply: '', supplierState: '', discountPercent: 0,
    termsConditions: '', attachmentName: '',
    preparedBy: preparedBy || '', approvedBy: '',
    freightTransportId: null, freightName: '', freightRemarks: '', freightTaxCodeId: null,
    freightTaxAmount: 0, freightNetAmount: 0, freightGrossAmount: 0,
    items: [withDefaultTaxCode({ ...emptyItem }, defaultTaxCode)],
  };
}

// DocumentTotalsPanel reads `discount` and `grandTotal`, which the shared
// engine does not return — every other purchase document derives them in a
// wrapper exactly like this one. Passing buildDocument's raw totals straight
// to the panel is what made it crash on totals.grandTotal.toFixed().
function computeMemoTotals(items, discountPercent, interState, extraCharges = {}) {
  const { totals } = buildDocument(items, discountPercent, {
    quantityField: 'quantity',
    interState,
    roundOff: true,
    freightAmount: extraCharges.freightNetAmount,
  });
  // Freight Charges mirrors the Sales documents' Freight Charges feature
  // exactly (see FreightChargesEditor.jsx), folded into grandTotal here so
  // the panel and the saved record can't disagree. Road Tax Amount has been
  // removed from Purchase documents' UI/print and no longer feeds this total.
  const freightGrossAmount = computeFreightGross(extraCharges.freightNetAmount, extraCharges.freightTaxAmount);
  return {
    ...totals,
    discount: computeItemDiscountTotal(items),
    freightGrossAmount,
    grandTotal: round2(totals.amount + num(extraCharges.freightTaxAmount)),
  };
}

const money = (v) => (Number(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function rowToFormValues(row, taxCodes) {
  const toDate = (v) => (v ? new Date(v) : null);
  const taxCodeIdByRate = buildTaxCodeIdByRate(taxCodes);
  return {
    ...getEmptyValues(),
    ...row,
    supplierState: row.supplierState || '',
    // `...row` overwrites the defaults above with whatever the API returned,
    // and a memo created before these columns existed returns null for each
    // of them — which would put null into a select/text input that expects a
    // string. Coerced back to the empty-string default so an older record
    // opens cleanly instead of with React complaining about a null value.
    currency: row.currency || 'INR',
    billFrom: cleanAddressText(row.billFrom),
    shipTo: cleanAddressText(row.shipTo),
    purchaseType: row.purchaseType || '',
    typeOfPurchase: row.typeOfPurchase || '',
    salesType: row.salesType || '',
    purchaseEmployee: row.purchaseEmployee || '',
    transportMode: row.transportMode || '',
    vendorRefNo: row.vendorRefNo || '',
    documentDate: toDate(row.documentDate),
    postingDate: toDate(row.postingDate),
    dueDate: toDate(row.dueDate),
    billDoDate: toDate(row.billDoDate),
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
      // Line-first, header-fallback — same convention as GRN's
      // toGrnItemData: a row saved before this field existed still shows the
      // memo's own warehouse rather than a blank.
      warehouse: i.warehouse || row.warehouse || '',
      batchAllocations: (i.batchAllocations || []).map((b) => ({ batchNo: b.batchNo, quantity: Number(b.quantity) || 0 })),
      serialAllocations: (i.serialAllocations || []).map((s) => ({ serialNo: s.serialNo })),
    })),
  };
}

/**
 * Purchase Credit Memo — a credit received from a supplier, raised against a
 * Purchase Invoice.
 *
 * Totals, including the CGST/SGST vs IGST split, are computed by the shared
 * document engine and recomputed identically on the server, so the panel can
 * never disagree with what gets stored. The memo posts no payables adjustment:
 * it records the credit's value only.
 */
const PURCHASE_CREDIT_MEMO_LIST_TABLE_ROW_HEIGHT = 0;
const PURCHASE_CREDIT_MEMO_LIST_TABLE_CELL_PADDING_Y = 6;
export default function PurchaseCreditMemo({ openDocNo } = {}) {
  const currentUser = useSelector(selectCurrentUser);
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();

  const { data: rows, isLoading, refetch: refetchCreditMemos } = purchaseCreditMemoApi.useList();
  const [create, { isLoading: creating }] = purchaseCreditMemoApi.useCreate();
  const [update, { isLoading: updating }] = purchaseCreditMemoApi.useUpdate();
  const [remove] = purchaseCreditMemoApi.useDelete();
  const [cancelCreditMemo] = purchaseCreditMemoApi.useCancel();
  const { data: invoices } = purchaseInvoiceApi.useList();
  const { data: suppliers } = supplierApi.useList();
  // Location Master is no longer fetched here: the header card's Location
  // dropdown is gone, and nothing else on this page reads it. The `location`
  // COLUMN still exists and still saves (it is printed on the memo) — it
  // just has no picker feeding it any more.
  const { data: taxCodes } = taxCodeApi.useList();
  // A brand-new item row's Tax (%) CFL defaults to this Tax Code instead of
  // showing empty — see pickDefaultTaxCode's own doc comment.
  const defaultTaxCode = useMemo(() => pickDefaultTaxCode(taxCodes), [taxCodes]);
  const { data: salesEmployees } = salesEmployeeApi.useList();
  const { data: products } = productApi.useList({ view: 'picker' });
  const { rates: priceListRates } = usePriceListRates('DLP');
  const { data: company } = useGetCompanyDetailsQuery();
  // Tax (%) is now a Tax Code CFL: every active Tax Code master entry gets
  // its own option (never collapsed by rate — see buildTaxCodeOptions),
  // keyed by taxCodeId (not the rate), so two Tax Codes that happen to
  // share a rate both still show up in the dropdown.
  const taxCodeOptions = useMemo(() => buildTaxCodeOptions(taxCodes), [taxCodes]);
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
  const [formKey, setFormKey] = useState(0);
  // Journal Entry view popup — opened from the header's "View Journal Entry"
  // icon (rendered only once editingRow.journalEntryId exists, i.e. this
  // credit memo already has a linked entry). Same pattern as Purchase GRN.
  const [journalViewOpen, setJournalViewOpen] = useState(false);
  // Copy From ("Find Purchase Invoice") dialog. Held at page level rather than
  // inside AppForm's render prop so remounting the form on formKey change
  // can't leave a dialog orphaned open over a freshly reset form.
  const [copyFromOpen, setCopyFromOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [rowMenuAnchor, setRowMenuAnchor] = useState(null);
  const [rowMenuTarget, setRowMenuTarget] = useState(null);
  // { index, mode } for the item row whose "Batches Number - Selection" /
  // "Serial Numbers - Selection" dialog is open; null when closed.
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

  // A credit memo reverses billed value, so a cancelled invoice is not a valid
  // target — there is nothing left to credit. The backend refuses these
  // (assertCreditMemoAllowed in utils/routeMap.js); excluding them here means
  // the user is never offered one that will be rejected on save.
  //
  // The invoice already on the record being edited stays selectable regardless,
  // so opening an existing credit memo cannot blank its link.
  // Per (invoiceNo, productCode), how much has already been credited by
  // OTHER purchase credit memos (i.e. not the one currently being edited).
  // Used to cap what THIS memo can still take — two memos against the same
  // invoice line must share its billed quantity, not each get the full
  // amount.
  const creditedByInvoiceProductOther = useMemo(() => {
    const totals = new Map();
    (rows || [])
      .filter((r) => r.status !== 'Cancelled' && r.invoiceNo && r.creditNo !== editingRow?.creditNo)
      .forEach((r) => {
        (r.items || []).forEach((item) => {
          if (!item.productCode) return;
          const key = `${r.invoiceNo}::${item.productCode}`;
          totals.set(key, (totals.get(key) || 0) + (Number(item.quantity) || 0));
        });
      });
    return totals;
  }, [rows, editingRow]);

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
  const supplierOptions = useMemo(
    () => buildPartyCodeOptions(suppliers, 'supplierCode', 'supplierName'),
    [suppliers]
  );
  const { options: branchOptions, branches } = useBranchNameOptions({ currentValue: editingRow?.branch });
  const currencyOptions = useCurrencyOptions();
  // Prepared By lists every Sales Employee; Approved By is scoped to the
  // ones flagged with approval authorization on the Sales Employee master.
  const approvedByOptions = (salesEmployees || []).filter((s) => s.approvalAuthorization === true).map((s) => ({ label: s.employeeName, value: s.employeeName }));

  const tableColumns = useMemo(() => ([
    { field: 'creditNo', headerName: 'Credit No', filter: 'text' },
    { field: 'invoiceNo', headerName: 'Invoice No.', filter: 'text' },
    { field: 'supplier', headerName: 'Supplier', filter: 'select' },
    {
      field: 'documentDate',
      headerName: 'Document Date',
      filter: 'dateRange',
      sortValue: (r) => (r.documentDate ? new Date(r.documentDate).getTime() : null),
      searchValue: (r) => (r.documentDate ? dayjs(r.documentDate).format('DD MMM YYYY') : ''),
    },
    { field: 'totalItems', headerName: 'Items', filter: 'numberRange' },
    { field: 'amount', headerName: 'Amount', filter: 'numberRange', sortValue: (r) => Number(r.amount) || 0 },
    { field: 'status', headerName: 'Status', filter: 'select' },
  ]), []);

  const table = useTableFeatures(rows || [], tableColumns, { onChange: setPage });
  const visibleRows = table.rows;
  const pagedRows = useMemo(
    () => visibleRows.slice(page * pageSize, page * pageSize + pageSize),
    [visibleRows, page, pageSize]
  );

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

  const [printRequestCreditMemoNo, setPrintRequestCreditMemoNo] = useState(null);

  // Row-level Print, so this list carries the same action set as every other
  // purchase list (View / Route Map / Print / more). Opens the row in its
  // read-only View first and prints once that has rendered — the same
  // open-then-print sequence Purchase GRN and Purchase Invoice use, and for
  // the same reason: the printable content only exists once the form for that
  // row is on screen, so printing immediately would catch the list instead.
  const handlePrint = (row) => {
    setRowMenuAnchor(null);
    handleView(row);
    setPrintRequestCreditMemoNo(row.creditNo);
  };

  useEffect(() => {
    if (!printRequestCreditMemoNo) return;
    if (!editingRow || editingRow.creditNo !== printRequestCreditMemoNo) return;

    const returnToListAfterPrint = () => {
      window.removeEventListener('afterprint', returnToListAfterPrint);
      setPrintRequestCreditMemoNo(null);
      backToList();
    };

    window.addEventListener('afterprint', returnToListAfterPrint);
    printPurchaseCreditMemo();
  }, [printRequestCreditMemoNo, editingRow]);

  // Opened from the Route Map's document preview popup: jump straight into
  // this record's own read-only View, exactly as clicking it in the list
  // would, instead of requiring the user to find and click the row.
  useEffect(() => {
    if (!openDocNo) return;
    if (editingRow && editingRow.creditNo === openDocNo) return;
    const match = (rows || []).find((r) => r.creditNo === openDocNo);
    if (match) handleView(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDocNo, rows]);

  // "Copy To > Purchase Credit Memo" lands the browser on this page's
  // route, but that alone used to leave the user on the LIST view — the
  // intent-consuming effect that actually applies the source document's
  // data lives inside AppForm's render prop below, which only mounts once
  // `view` is 'form', so nothing happened until the user clicked "+ Add
  // New" themselves first. Mirrors the openDocNo effect just above: notice
  // a pending intent addressed to this page on arrival and open the create
  // form immediately, so the user lands straight on a pre-filled memo.
  const pendingCopyIntentForAutoOpen = useSelector((s) => s.copyIntent.pending);
  useEffect(() => {
    if (!pendingCopyIntentForAutoOpen || pendingCopyIntentForAutoOpen.targetKey !== 'purchaseCreditMemo') return;
    if (view === 'form') return;
    openCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCopyIntentForAutoOpen]);

  const handleDelete = async (row) => {
    setRowMenuAnchor(null);
    const ok = await confirmDialog({
      title: 'Delete purchase credit memo',
      message: `Are you sure you want to delete "${row.creditNo}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Purchase credit memo deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  // Cancel — a soft alternative to Delete, same feature as PurchaseOrder.jsx's
  // own Cancel action: the credit memo stays in the list (status becomes
  // "Cancelled") but View/Edit/Print get blocked below once isCancelled is
  // true. The backend gives back any batch/serial qty this memo consumed and
  // reverses whatever stock/G/L it already posted.
  const handleCancel = async (row) => {
    setRowMenuAnchor(null);
    const ok = await confirmDialog({
      title: 'Cancel purchase credit memo',
      message: `Are you sure you want to cancel "${row.creditNo}"? This cannot be undone — the credit memo will be locked.`,
      confirmLabel: 'Cancel Credit Memo',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await cancelCreditMemo(row.id).unwrap();
      notify.success('Purchase credit memo cancelled');
    } catch (err) {
      notify.error(err?.data?.message || 'Cancel failed');
    }
  };

  const handleSubmit = async (values, methods) => {
    // "Save as Draft" is a shortcut that forces Draft regardless of what the
    // Status field shows — an explicit "I'm not done yet" action. The main
    // Save/Update button does NOT force a status: it used to always set
    // 'Open', which silently discarded any other value the user had picked
    // in the Status dropdown (Closed, Cancelled, ...) — the record would
    // save, but always as Open, so an edit to e.g. Cancelled appeared to
    // "not save" because the list kept showing Open. Only Draft is special;
    // everything else comes from the form itself.
    const allocationError = validateBatchSerialAllocation(values.items, productsByCode);
    if (allocationError) {
      notify.error(allocationError);
      return;
    }

    const payload = { ...values, status: pendingStatusRef.current || values.status };
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...payload }).unwrap();
        notify.success('Purchase credit memo updated');
      } else {
        await create(payload).unwrap();
        notify.success('Purchase credit memo created');
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
        <RouteMapContextMenu flow="purchase" type="creditMemo" docNo={editingRow?.creditNo}>
          <AppForm
            key={formKey}
            readOnly={readOnly}
            schema={purchaseCreditMemoSchema}
            defaultValues={editingRow ? rowToFormValues(editingRow, taxCodes) : getEmptyValues(currentUser?.name || currentUser?.email, defaultTaxCode)}
            onSubmit={handleSubmit}
          >
            {(methods) => {
              const { control, watch, setValue } = methods;
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
              // keyed off the form's actual current lines -- see the same
              // fix on PurchaseOrder.jsx for why: a product Copy From just
              // brought in wasn't in that static list and its Item No /
              // Description Select rendered blank.
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
                  PRODUCT_USAGE.PURCHASE,
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

              // Every column of this item table is sized to show its values IN FULL —
              // no ellipsis, no wrapping, no hover, however long the text is. The
              // spec below is positional: it mirrors the header row top to bottom,
              // and `null` leaves a column (the # counter, the action column) at
              // whatever width it already has. See itemTableSx in lib/columnWidth.js.
              const itemColumnsSx = itemTableSx(watchedItems, [
                null,
                { header: 'Item No', get: (i) => i?.productCode, field: 'select' },
                { header: 'Description', get: (i) => i?.productName, field: 'select' },
                { header: 'UOM', get: (i) => i?.uom, field: 'text' },
                { header: 'Warehouse *', get: (i) => i?.warehouse, field: 'select' },
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

              // Copy From pulls the supplier block across and replaces the lines
              // with what the invoice billed.
              //
              // This used to run as an effect watching the Invoice No. dropdown,
              // guarded by a ref so it fired only on a real change. It is a plain
              // function now, called only from the dialog's Choose button: an
              // effect keyed on a form value also fires when that value is
              // restored on edit or reset, which is what the ref bookkeeping
              // existed to detect. An explicit call has no such ambiguity.
              //
              // Supplier is still set from the invoice, unlike the sibling
              // purchase pages: this form keeps supplierName and supplierCode
              // alongside it, so the pull has real work to do here, and the value
              // it writes is the supplier the dialog was already filtered by.
              const applyInvoice = (invoice) => {
                if (!invoice) return;
                setValue('invoiceNo', invoice.invoiceNo || '', { shouldValidate: true });
                setValue('supplier', invoice.supplier || '');
                setValue('supplierName', invoice.supplier || '');
                setValue('branch', invoice.branch || '');
                setValue('paymentTerms', invoice.paymentTerms || '');
                setValue('termsConditions', invoice.termsConditions || '');
                // Header-level discount was never carried across — each
                // line's own discountPercent copies fine below, but the
                // invoice's overall discountPercent was left at whatever
                // this form already had (0 on a fresh memo), silently
                // dropping the source invoice's discount from the totals.
                setValue('discountPercent', invoice.discountPercent != null ? Number(invoice.discountPercent) : 0, { shouldValidate: true });
                // Carried on the invoice but previously left behind on
                // Copy To (the credit memo schema has no Other Details
                // block, so this is all there is to bring across).
                setValue('approvedBy', invoice.approvedBy || '', { shouldValidate: true });
                setValue('placeOfSupply', invoice.placeOfSupply || '', { shouldValidate: true });
                // replace(), never setValue('items', ...) — the field array has to
                // remount so each row's inputs pick up the new values.
                //
                // A purchase invoice line stores its billed amount under
                // `quantity` — PurchaseInvoiceItem has no `invoicedQuantity`
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
                // row's position on the invoice, not in the filtered subset.
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
                      unitPrice: priceListRates?.get(i.productCode) ?? (i.unitPrice != null ? Number(i.unitPrice) : 0),
                      discountPercent: Number(i.discountPercent) || 0,
                      taxPercent: Number(i.taxPercent) || 0,
                      taxCodeId: i.taxCodeId != null ? Number(i.taxCodeId) : null,
                      // Where the goods physically are, so the memo's own
                      // return-to-supplier default points at the same place
                      // the invoice line (or its header) said they landed;
                      // falls back to whatever this memo's header has.
                      warehouse: i.warehouse || '',
                      // Copy From: a credit memo is raised against the invoice.
                      baseType: 'Purchase Invoice',
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

              // "Copy To > Purchase Credit Memo" from a Purchase Return — not
              // reachable from this page's own Copy From dialog (Purchase
              // Invoice only), only from the intent-consuming effect below.
              // There is no invoicedQuantity to cap against here (nothing was
              // billed yet), so each return line's own returnQuantity becomes
              // both the cap (invoicedQuantity) and the pre-filled credit
              // quantity — the user can still reduce it for a partial credit.
              const applyReturn = (found) => {
                if (!found) return;
                setValue('invoiceNo', '', { shouldValidate: true });
                setValue('supplier', found.supplier || '');
                setValue('supplierName', found.supplier || '');
                setValue('branch', found.branch || '');
                setValue('termsConditions', found.termsConditions || '');
                setValue('discountPercent', found.discountPercent != null ? Number(found.discountPercent) : 0, { shouldValidate: true });
                // Carried on the return but previously left behind on
                // Copy To (the credit memo schema has no Other Details
                // block, so this is all there is to bring across).
                setValue('approvedBy', found.approvedBy || '', { shouldValidate: true });
                setValue('placeOfSupply', found.placeOfSupply || '', { shouldValidate: true });
                setValue('paymentTerms', found.paymentTerms || '', { shouldValidate: true });
                const items = (found.items || []).filter((i) => (Number(i.returnQuantity) || 0) > 0.005);
                const mappedItems = items.length
                  ? items.map((i, n) => ({
                      productCode: i.productCode || '',
                      productName: i.productName || '',
                      description: i.description || '',
                      hsnCode: i.hsnCode || '',
                      uom: i.uom || '',
                      invoicedQuantity: Number(i.returnQuantity) || 0,
                      quantity: Number(i.returnQuantity) || 0,
                      unitPrice: priceListRates?.get(i.productCode) ?? (i.unitPrice != null ? Number(i.unitPrice) : 0),
                      discountPercent: Number(i.discountPercent) || 0,
                      taxPercent: Number(i.taxPercent) || 0,
                      taxCodeId: i.taxCodeId != null ? Number(i.taxCodeId) : null,
                      warehouse: i.warehouse || '',
                      baseType: 'Purchase Return',
                      baseEntry: found.id ?? null,
                      baseNo: found.returnNo || null,
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
              // Supplier is deliberately NOT cleared. It is the user's own
              // selection — it is what made Copy From available in the first
              // place, and clearing it would close the dialog off and force a
              // re-pick just to try a different invoice from the same vendor.
              const clearInvoice = () => {
                setValue('invoiceNo', '', { shouldValidate: true });
                setValue('paymentTerms', '');
                setValue('termsConditions', '');
                setValue('discountPercent', 0, { shouldValidate: true });
                replaceItems([{ ...emptyItem }]);
              };

              // Picking a Supplier auto-fills its Code, Name and Bill From
              // address from the Business Partner record behind it — same
              // pattern as PurchaseOrder.jsx's own supplier effect, which
              // fills shipFrom from the identical source. Guarded by
              // prevSupplierRef so it only runs on an actual change, not when
              // the value is restored on edit/view or set by Copy From
              // (applyInvoice above already sets supplier/supplierName itself
              // from the invoice). Contact Person is no longer set here: that
              // field, its column and its data are gone (migration
              // 20260919060100).
              const supplierValue = watch('supplier');
              const prevSupplierRef = useRef(editingRow ? editingRow.supplier : null);
              useEffect(() => {
                if (supplierValue === prevSupplierRef.current) return;
                prevSupplierRef.current = supplierValue;
                const found = (suppliers || []).find((s) => s.supplierName === supplierValue);
                if (found) {
                  setValue('supplierCode', found.supplierCode || '', { shouldValidate: true });
                  setValue('supplierName', found.supplierName || '', { shouldValidate: true });
                  // Bill From is a disabled box, so unlike PurchaseOrder's
                  // shipFrom there is no user-typed value to protect and no
                  // "did we write this ourselves" ref to keep — whatever
                  // supplier is selected simply owns the field. Only on
                  // create: an existing memo keeps the address it was saved
                  // with, which is what the document actually went out with.
                  if (!editingRow) {
                    const billing = (found.addresses || []).filter((a) => a.addressType === 'Billing');
                    const defaultBilling = billing.find((a) => a.isDefault) || billing[0];
                    setValue('billFrom', formatBusinessPartnerAddress(defaultBilling), { shouldValidate: true });
                  }
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [supplierValue]);

              // State -- display-only, auto-filled from the selected supplier's
              // Business Partner Billing address (same as Purchase Order/GRN/
              // Invoice), never hand-typed. This -- NOT Place of Supply -- is
              // what decides CGST/SGST vs IGST (see interState above) and
              // which Tax Code family the Tax (%) column offers.
              const supplierState = useMemo(() => {
                const found = (suppliers || []).find((s) => s.supplierName === supplierValue);
                const billing = (found?.addresses || []).filter((a) => a.addressType === 'Billing');
                const defaultBilling = billing.find((a) => a.isDefault) || billing[0];
                return defaultBilling?.state || found?.state || '';
              }, [suppliers, supplierValue]);
              useEffect(() => {
                // Wait for the supplier list so an existing document's saved
                // State isn't blanked while it is still loading.
                if (!suppliers) return;
                setValue('supplierState', supplierState || '', { shouldValidate: true });
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [suppliers, supplierState]);

              // Ship To mirrors Bill From, sourced from the selected Branch's
              // own address — the counterpart pairing Purchase Order already
              // uses (supplier billing address on the left, branch address on
              // the right). Same create-only guard, same reasoning.
              const branchShipTo = useMemo(
                () => branchAddressLines((branches || []).find((b) => b.branchName === branch)).join('\n'),
                [branches, branch]
              );
              useEffect(() => {
                if (editingRow) return;
                setValue('shipTo', branchShipTo || '', { shouldValidate: true });
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [branchShipTo]);

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

              const interState = isInterState(watch('supplierState'), company?.state);
              // Kerala supplier State -> GST family (GST, GST+TCS) only;
              // any other state -> IGST family (IGST, IGST+TCS) only. See
              // taxTypeFamilyFor in lib/taxCodeOptions.js.
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
              const documentDateValue = watch('documentDate');
              const documentDateMinDate = documentDateValue ? dayjs(documentDateValue) : undefined;
              const discountPercent = watch('discountPercent');
              // taxType (from each line's own taxCodeId) drives the TCS
              // carve-out in documentTotals.js's computeTotals -- see
              // buildTaxCodeOptions/taxCodeById above, which now carries
              // taxType alongside label/value/rate.
              const itemsForTotals = watchedItems.map((it) => ({ ...it, taxType: taxCodeById.get(it.taxCodeId)?.taxType || '' }));
              const freightNetAmount = watch('freightNetAmount');
              const freightTaxAmount = watch('freightTaxAmount');
              const totals = computeMemoTotals(itemsForTotals, discountPercent, interState, { freightNetAmount, freightTaxAmount });

              // Print data — Credit Memo's own `supplier` field stores the
              // supplier CODE (see PartyCodeSelect below), unlike PO/GRN/
              // Invoice where it stores the name, so the match key differs.
              const allValues = watch();
              // Matched on supplierName, not supplierCode. supplierOptions is
              // built with buildPartyCodeOptions(suppliers, 'supplierCode',
              // 'supplierName'), whose `value` is the NAME (the code is only
              // the label) — exactly as on Purchase Order. The old code
              // compared against supplierCode and so never matched anything,
              // leaving the print layout without a supplier record; the same
              // lookup now also feeds Bill From, which made the bug visible.
              const printSupplierRecord = (suppliers || []).find((s) => s.supplierName === allValues.supplier);
              const printBranchRecord = (branches || []).find((b) => b.branchName === allValues.branch);
              // items: itemsForTotals, not allValues.items — same fix
              // SalesInvoice.jsx's own printOrder already applies. A form
              // item row only ever carries taxCodeId, never the resolved
              // taxType ('GST'/'IGST'/'GST+TCS'/'IGST+TCS') itself;
              // itemsForTotals above is what joins the two (for the live
              // totals panel) and is the only place in this component that
              // has it. Passing allValues.items straight through left every
              // print item's taxType undefined, so
              // PurchaseCreditMemoPrintable's isTcsTaxType(it.taxType) check
              // could never see a TCS-typed line no matter what Tax Code it
              // used.
              const printOrder = { ...allValues, items: itemsForTotals, status: editingRow?.status || 'Open' };
              // See SalesInvoice.jsx's identical approverSignatureUrl comment.
              const approverSignatureUrl = (salesEmployees || []).find((s) => s.employeeName === allValues.approvedBy)?.signatureUrl || null;

              // Consume a pending "Copy To" intent addressed to this page —
              // see copyIntentSlice.js and CopyToButton.jsx.
              useEffect(() => {
                if (!pendingCopyIntent || pendingCopyIntent.targetKey !== 'purchaseCreditMemo') return;
                if (pendingCopyIntent.sourceType === 'purchaseReturn') applyReturn(pendingCopyIntent.sourceDoc);
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
                    party={watch('supplier')}
                    title="Find Purchase Invoice"
                    columns={INVOICE_COPY_COLUMNS}
                    emptyMessage="No purchase invoices found for"
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
                      {/* Two equal columns, listed left-item/right-item per
                        row so the 2-column grid lays them out as two even
                        stacks rather than flowing row-major — the same
                        arrangement PurchaseOrder.jsx's own card uses, which
                        is the reference for this layout:

                          Branch         | Credit Memo No
                          Supplier Code  | Invoice No
                          Supplier Name  | Document Date
                          Payment Terms  | Due Date
                          Currency       | Comments
                          Bill From      | Ship To

                        Nine fields that used to sit here are gone from the
                        card. Three went entirely — Contact Person, Supplier
                        Ref No. and Transaction Type: field, column and data
                        (migration 20260919060100), because nothing outside
                        this form ever read them.

                        The other six are still saved on every memo, they
                        just have no input any more, because each one is
                        load-bearing somewhere this form isn't:
                          - status      drives syncStockPosting, and the
                                        list's Status column/filter/chip and
                                        Copy From's not-Cancelled filter.
                                        New memos default to 'Open'.
                          - postingDate is where the journal entry takes its
                                        posting date from (JOURNAL_DATE_FIELDS
                                        in utils/glPosting.js). Defaults to
                                        today, same as Document Date.
                          - location, billDoNo, billDoDate, reason are all
                                        printed on the credit memo document
                                        (PurchaseCreditMemoPrintable.jsx), so
                                        the columns must stay even though the
                                        printout will now show them blank on
                                        anything created from this form. */}
                      <FormGrid columns={2} singleColumnOnMobile rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                        <LabeledField label="Branch *">
                          <FormSelect name="branch" label="" placeholder="Select branch" options={branchOptions} />
                        </LabeledField>
                        <LabeledField label="Credit Memo No *">
                          <DocumentSeriesNoField documentCode="PCM" seriesFieldName="seriesId" numberFieldName="creditNo" isCreate={!editingRow} />
                        </LabeledField>

                        {/* The supplier picker itself, showing the Code —
                          its two-column Code | Name dropdown is how the name
                          is found, and the row below echoes the chosen one.
                          Same split PurchaseOrder.jsx uses for its own
                          Supplier Code / Supplier Name pair. */}
                        <LabeledField label="Supplier Code *">
                          <PartyCodeSelect
                            name="supplier"
                            label=""
                            placeholder="Select supplier"
                            options={supplierOptions}
                            showNameBelow={false}
                          />
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

                        <LabeledField label="Supplier Name">
                          <FormTextField name="supplierName" label="" placeholder="Supplier name" InputProps={{ readOnly: true }} />
                        </LabeledField>

                        {/* Display-only, auto-filled from the selected supplier's
                        Business Partner address -- drives CGST/SGST vs IGST. */}
                        <LabeledField label="State">
                          <FormTextField name="supplierState" label="" placeholder="Supplier state" disabled />
                        </LabeledField>
                        <LabeledField label="Document Date *">
                          <FormDatePicker name="documentDate" label="" triggerFields={['postingDate', 'dueDate', 'billDoDate']} />
                        </LabeledField>

                        <LabeledField label="Payment Terms">
                          <FormSelect
                            name="paymentTerms"
                            label=""
                            placeholder="Select payment terms"
                            options={PAYMENT_TERMS_OPTIONS}
                          />
                        </LabeledField>
                        <LabeledField label="Due Date">
                          <FormDatePicker name="dueDate" label="" minDate={documentDateMinDate} triggerFields={['documentDate']} />
                        </LabeledField>

                        <LabeledField label="Currency">
                          <FormSelect name="currency" label="" placeholder="Select currency" options={currencyOptions} />
                        </LabeledField>
                        <LabeledField label="Comments">
                          <FormTextField name="comments" label="" placeholder="Enter comments" />
                        </LabeledField>
                        {/* Empty cell: the State field added above made the field count
                          odd, which pushed Bill From to the right column and Ship To to the
                          left. This keeps Bill From (left) / Ship To (right) as before. */}
                        <Box sx={{ display: { xs: 'none', sm: 'block' } }} />

                        {/* Both auto-filled and disabled: Bill From from the
                          selected supplier's default Billing address, Ship To
                          from the branch's own address (see the two effects
                          above). Identical treatment to Purchase Order's
                          Ship From / Ship To pair. */}
                        <LabeledField label="Bill From">
                          <FormTextField name="billFrom" label="" placeholder="Supplier billing address" multiline rows={3} disabled />
                        </LabeledField>
                        <LabeledField label="Ship To">
                          <FormTextField name="shipTo" label="" placeholder="Branch address" multiline rows={3} disabled />
                        </LabeledField>
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

                  {/* Card two, exactly as on Purchase Order / GRN / Invoice:
                    the same shared component, so this document's Other
                    Details can never drift from theirs. It renders Purchase
                    Type | Type of Purchase, Payment Method | Purchase
                    Employee, Transport Mode — the five field names its doc
                    comment requires are all on this form's schema and
                    defaultValues now, and on the table behind it (migration
                    20260919060000). */}
                  <PurchaseOtherDetailsCard />

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
                              <TableCell>Item No *</TableCell>
                              <TableCell>Description</TableCell>
                              <TableCell>UOM</TableCell>
                              <TableCell>Warehouse *</TableCell>
                              <TableCell align="right">Invoiced Qty</TableCell>
                              <TableCell align="right">Qty *</TableCell>
                              <TableCell align="right">Unit Price *</TableCell>
                              <TableCell align="right">Disc %</TableCell>
                              <TableCell align="right">Tax %</TableCell>
                              <TableCell>Batch/Serial Selection</TableCell>
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
                                  <TableCell sx={{ minWidth: 100 }}>
                                    <FormTextField name={`items.${index}.uom`} label="" placeholder="UOM" />
                                  </TableCell>
                                  <TableCell sx={{ minWidth: 160 }}>
                                    <WarehouseCodeSelect name={`items.${index}.warehouse`} label="" placeholder={branch ? 'Select' : 'Select branch first'} options={branchWarehouseOptions} disabled={!branch} popupFitContent showNameBelow={false} />
                                  </TableCell>
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
                                  <TableCell>
                                    <FormSelect name={`items.${index}.taxCodeId`} label="" options={taxCodeOptionsForRow} disableClearable sx={{ minWidth: 96 }} popupFitContent onValueChange={(_v, option) => setValue(`items.${index}.taxPercent`, option ? option.rate : 0, { shouldValidate: true })} />
                                  </TableCell>
                                  <TableCell sx={{ minWidth: 140 }}>
                                    <BatchSerialCell index={index} methods={methods} product={productsByCode[watch(`items.${index}.productCode`)]} onOpen={(mode) => setBatchDialog({ index, mode })} />
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
                    <BatchSerialSelectionDialog
                      open
                      onClose={() => setBatchDialog(null)}
                      mode={batchDialog.mode}
                      readOnly={readOnly}
                      docNo={editingRow?.creditNo}
                      itemNumber={watch(`items.${batchDialog.index}.productCode`)}
                      itemDescription={watch(`items.${batchDialog.index}.productName`)}
                      warehouseCode={watch('warehouse')}
                      warehouseName={warehouseLabel((warehouses || []).find((w) => w.whsCode === watch('warehouse')))}
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

                  <PurchaseCreditMemoPrintable
                    order={printOrder}
                    company={company}
                    supplierRecord={printSupplierRecord}
                    branchRecord={printBranchRecord}
                    approverSignatureUrl={approverSignatureUrl}
                  />

                  {/* Terms, attachments and the money panel — the same footer the
                    other purchase documents carry, so a return reads and prints
                    consistently beside them. */}
                  <Card variant="outlined" sx={{ mb: 2 }}>
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, width: '100%', display: 'block' }}>
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
                      </fieldset>

                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1.5}
                        justifyContent={{ xs: 'stretch', sm: 'flex-end' }}
                        sx={{ mt: 3 }}
                      >
                        {/* Copy From sits immediately left of Cancel and stays
                          disabled until a Supplier is chosen — the dialog it
                          opens lists that supplier's invoices, so with no
                          supplier there is nothing for it to show. Hidden in
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
                              disabled={!watch('supplier') || creating || updating}
                            >
                              Copy From
                            </Button>
                          )
                        )}
                        <Button fullWidth={isMobile} type="button" variant="outlined" color={readOnly ? 'error' : 'inherit'} startIcon={<CloseIcon />} onClick={backToList} disabled={creating || updating}>
                          {readOnly ? 'Close' : 'Cancel'}
                        </Button>
                        <Button fullWidth={isMobile} type="button" variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => printPurchaseCreditMemo()}>
                          Print
                        </Button>
                        {/* pendingStatusRef, not setValue: the click has to record
                          which button was pressed before submit reads it, and a
                          setValue here would re-render mid-click. Only "Save as
                          Draft" overrides — the main button leaves the Status
                          field's own value alone (see the note in handleSubmit). */}
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
                    templateUrl="/purchase/credit-memos/items-import/template"
                    importUrl="/purchase/credit-memos/items-import"
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
              <Typography variant="subtitle1" fontWeight={700}>Purchase Credit Memo List</Typography>
              <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="center">
                <TableSearchFilter table={table} placeholder="Search by credit no., invoice, supplier..." />
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
                      { label: 'Supplier', value: row.supplier },
                      { label: 'Amount', value: money(row.amount) },
                    ]}
                    onView={() => handleView(row)}
                    onEdit={row.isCancelled ? undefined : () => handleEdit(row)}
                    onDelete={row.isCancelled ? undefined : () => handleDelete(row)}
                    extraActions={
                      row.isCancelled
                        ? []
                        : [
                            {
                              key: 'cancel',
                              label: 'Cancel',
                              icon: <CancelOutlinedIcon fontSize="small" />,
                              color: 'warning',
                              onClick: () => handleCancel(row),
                            },
                          ]
                    }
                  />
                ))}
                {!isLoading && visibleRows.length === 0 && (
                  <EmptyState icon={<ShoppingCartOutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No credit memos yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first credit memo to get started'} />
                )}
              </Box>
            ) : (
              <ScrollableTableContainer>
                <Table
                  size="small"
                  stickyHeader
                  sx={{
                    '& th, & td': {
                      height: PURCHASE_CREDIT_MEMO_LIST_TABLE_ROW_HEIGHT,
                      paddingTop: `${PURCHASE_CREDIT_MEMO_LIST_TABLE_CELL_PADDING_Y}px`,
                      paddingBottom: `${PURCHASE_CREDIT_MEMO_LIST_TABLE_CELL_PADDING_Y}px`,
                      boxSizing: 'border-box',
                    },
                  }}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell width={48}>#</TableCell>
                      <SortableHeaderCell field="creditNo" sort={table.sort} onSort={table.toggleSort}>Credit No</SortableHeaderCell>
                      <SortableHeaderCell field="invoiceNo" sort={table.sort} onSort={table.toggleSort}>Invoice No.</SortableHeaderCell>
                      <SortableHeaderCell field="supplier" sort={table.sort} onSort={table.toggleSort}>Supplier</SortableHeaderCell>
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
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.supplier || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {row.documentDate ? dayjs(row.documentDate).format('DD MMM YYYY') : '—'}
                        </TableCell>
                        <TableCell>{row.totalItems}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{money(row.amount)}</TableCell>
                        <TableCell>
                          <Chip size="small" label={row.status} variant="outlined" />
                        </TableCell>
                        {/* Same action set, order, spacing and tooltips as every
                        other purchase list (see Purchase Order): View, Route
                        Map, Print, then the overflow menu, laid out by a Stack
                        so the icons are evenly spaced and right-aligned. This
                        cell used to put bare IconButtons straight into the
                        TableCell with no Stack and no tooltip on View, which is
                        why its buttons sat tighter together than the other
                        lists' and gave no hint of what they did. */}
                        <TableCell align="right">
                          {row.isCancelled ? (
                            <Typography variant="caption" color="text.secondary">Cancelled</Typography>
                          ) : (
                            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                              <Tooltip title="View">
                                <IconButton size="small" onClick={() => handleView(row)} aria-label="view">
                                  <VisibilityOutlinedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <RouteMapButton flow="purchase" type="creditMemo" docNo={row.creditNo} />
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
                          <EmptyState icon={<ShoppingCartOutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No credit memos yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first credit memo to get started'} />
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
              total={visibleRows.length}
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
        resourceName="Purchase Credit Memos"
        templateUrl="/purchase/credit-memos/bulk-import/template"
        importUrl="/purchase/credit-memos/bulk-import"
        onImported={refetchCreditMemos}
      />
    </Box>
  );
}

// Item No / Description picker for one item row. Both columns render
// this and both WRITE items.N.productCode — they differ only in whether the
// options are labelled by code or by name — so picking in either updates both,
// exactly as on Purchase Order/GRN/Invoice. Mirrors PurchaseReturn.jsx's
// ProductCell.
//
// Choosing a product fills the line's own descriptive fields from Product
// Master. It deliberately does NOT touch invoicedQuantity: on a credit memo
// that figure is what the source Purchase Invoice billed, not anything the
// product master knows, and the Qty validation is checked against it.
function ProductCell({ index, methods, options, products, priceListRates, label = '', placeholder = 'Select product' }) {
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
        setValue(`items.${index}.unitPrice`, 0);
        setValue(`items.${index}.batchAllocations`, [], { shouldValidate: true });
        setValue(`items.${index}.serialAllocations`, [], { shouldValidate: true });
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
        const priceListRate = priceListRates?.get(found.productCode);
        setValue(`items.${index}.unitPrice`, priceListRate != null ? priceListRate : (found.unitPrice != null ? Number(found.unitPrice) : 0), { shouldValidate: true });
        // A different product invalidates whatever batches/serials were picked
        // for the old one — they belong to that product's stock, not this one's.
        setValue(`items.${index}.batchAllocations`, [], { shouldValidate: true });
        setValue(`items.${index}.serialAllocations`, [], { shouldValidate: true });
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
      popupFitContent
    />
  );
}

// Shows nothing for a None-tracked (or unrecognised) product — the column
// only means something once Product Master's Manage Item By is Batch or
// Serial for the row's selected product. Otherwise a button that opens the
// matching "... - Selection" dialog, labelled with how much of the line is
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
