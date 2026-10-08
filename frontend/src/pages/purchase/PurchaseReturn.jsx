import React, { useEffect, useMemo, useRef, useState } from 'react';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import EmptyState from '../../components/data-display/EmptyState';
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
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
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
import PurchaseOtherDetailsCard from '../../components/common/PurchaseOtherDetailsCard';
import BatchSerialSelectionDialog from '../../components/common/BatchSerialSelectionDialog';
import { CanAdd, CanEdit, CanDelete, CanCancel } from '../../components/common/PermissionGate';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { applyServerErrors } from '../../lib/formErrors';
import usePriceListRates from '../../hooks/usePriceListRates';
import { itemTableSx } from '../../lib/columnWidth';
import { purchaseReturnSchema } from '../../lib/validation/purchaseSchemas';
import { buildDocument, round2, num, isInterState, computeFreightGross, computeItemDiscountTotal } from '../../lib/documentTotals';
import DocumentTotalsPanel from '../../components/form/DocumentTotalsPanel';
import { useGetCompanyDetailsQuery } from '../../features/company/companyDetailsApi';
import { buildTaxCodeOptions, taxTypeFamilyFor, buildTaxCodeIdByRate, pickDefaultTaxCode, withDefaultTaxCode } from '../../lib/taxCodeOptions';
import { productOptionsFor, PRODUCT_USAGE } from '../../lib/productUsage';
import { taxCodeApi, productApi, salesEmployeeApi } from '../../features/resources';
import { useWarehouseOptions, warehouseLabel, warehouseCodesForBranch } from '../../lib/useWarehouseOptions';
import { purchaseReturnApi, goodsReceivedNoteApi, purchaseInvoiceApi, purchaseOrderApi, supplierApi } from '../../features/resources';
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
import { useWarehouseStock } from '../../lib/useWarehouseStock';
import CopyToButton from '../../components/common/CopyToButton';
import { useDispatch, useSelector } from 'react-redux';
import { selectCurrentUser } from '../../store/authSlice';
import { clearCopyIntent } from '../../store/copyIntentSlice';
import PurchaseReturnPrintable, { printPurchaseReturn } from '../../components/print/PurchaseReturnPrintable';
import BulkImportDialog from '../../components/common/BulkImportDialog';
import ImportItemsDialog from '../../components/common/ImportItemsDialog';

// Columns for the "Find Purchase Receipt" dialog opened by Copy From.
const GRN_COPY_COLUMNS = [
  { field: 'grnNo', headerName: 'Receipt No', nowrap: true },
  { field: 'supplier', headerName: 'Supplier Name' },
  { field: 'receivedDate', headerName: 'Document Date', type: 'date' },
  { field: 'notes', headerName: 'Comments', type: 'optional' },
];

const PAGE_SIZE = 10;

const emptyItem = {
  productCode: '', productName: '', description: '', hsnCode: '', uom: '',
  receivedQuantity: 0, returnQuantity: 1, unitPrice: 0,
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
 * Blocks the return save when a Batch/Serial-tracked line's return quantity
 * isn't fully covered by its selected batches/serials — the client-side half
 * of the same rule the server enforces in assertBatchSerialIssueAllocation
 * (utils/businessRules.js). Mirrors DeliveryChallan.jsx's
 * validateBatchSerialAllocation — a return draws down stock exactly the same
 * way a despatch does.
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
    returnNo: '', seriesId: '', status: 'Open', grnNo: '', supplier: '', supplierName: '',
    contactPerson: '', phone: '', supplierRefNo: '', branch: '', warehouse: '',
    // postingDate/dueDate/billDoDate default to null, not today — those
    // fields are no longer shown in the Supplier & Document Details card
    // (see the FormGrid below), and a Date default here would leave a
    // hidden field able to fail dateRange's documentDate comparison with no
    // visible input left to fix it. dateRange (lib/validation/common.js)
    // skips its check entirely when the end value isn't a Date, so null
    // keeps these silent regardless of what documentDate is edited to.
    documentDate: today, postingDate: null, dueDate: null,
    paymentTerms: '', billDoNo: '', billDoDate: null, reason: '', comments: '',
    placeOfSupply: '', supplierState: '', discountPercent: 0,
    termsConditions: '', attachmentName: '',
    preparedBy: preparedBy || '', approvedBy: '',
    // "Other Details" card fields — see PurchaseOtherDetailsCard.jsx,
    // rendered below with variant="return". purchaseEmployee is part of the
    // data model (same as GRN/Invoice's own hidden PO No.) even though the
    // card never shows it here.
    billingType: '', purchaseType: '', typeOfPurchase: '', salesType: '',
    purchaseEmployee: '', transportMode: '', vendorRefNo: '',
    freightTransportId: null, freightName: '', freightRemarks: '', freightTaxCodeId: null,
    freightTaxAmount: 0, freightNetAmount: 0, freightGrossAmount: 0,
    items: [withDefaultTaxCode({ ...emptyItem }, defaultTaxCode)],
  };
}

// DocumentTotalsPanel reads `discount` and `grandTotal`, which the shared
// engine does not return — every other purchase document derives them in a
// wrapper exactly like this one. Passing buildDocument's raw totals straight
// to the panel is what made it crash on totals.grandTotal.toFixed().
function computeReturnTotals(items, discountPercent, interState, extraCharges = {}) {
  const { totals } = buildDocument(items, discountPercent, {
    quantityField: 'returnQuantity',
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
    discount: computeItemDiscountTotal(items, { quantityField: 'returnQuantity' }),
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
      receivedQuantity: Number(i.receivedQuantity) || 0,
      returnQuantity: Number(i.returnQuantity) || 0,
      unitPrice: Number(i.unitPrice) || 0,
      discountPercent: Number(i.discountPercent) || 0,
      taxPercent: Number(i.taxPercent) || 0,
      taxCodeId: i.taxCodeId != null
        ? Number(i.taxCodeId)
        : (taxCodeIdByRate.get(Number(i.taxPercent) || 0) ?? null),
      // Line-first, header-fallback — same convention as GRN's
      // toGrnItemData: a row saved before this field existed still shows the
      // return's own warehouse rather than a blank.
      warehouse: i.warehouse || row.warehouse || '',
      batchAllocations: (i.batchAllocations || []).map((b) => ({ batchNo: b.batchNo, quantity: Number(b.quantity) || 0 })),
      serialAllocations: (i.serialAllocations || []).map((s) => ({ serialNo: s.serialNo })),
    })),
  };
}

/**
 * Purchase Return — goods going back to a supplier, raised against a GRN.
 *
 * Totals, including the CGST/SGST vs IGST split, are computed by the shared
 * document engine and recomputed identically on the server, so the panel can
 * never disagree with what gets stored. The return posts no stock movement and
 * no payables adjustment: it records the value of what is going back only.
 */
const PURCHASE_RETURN_LIST_TABLE_ROW_HEIGHT = 0;
const PURCHASE_RETURN_LIST_TABLE_CELL_PADDING_Y = 6;
export default function PurchaseReturn({ openDocNo } = {}) {
  const currentUser = useSelector(selectCurrentUser);
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();

  const { data: rows, isLoading, refetch: refetchReturns } = purchaseReturnApi.useList();
  const [create, { isLoading: creating }] = purchaseReturnApi.useCreate();
  const [update, { isLoading: updating }] = purchaseReturnApi.useUpdate();
  const [remove] = purchaseReturnApi.useDelete();
  const [cancelReturn] = purchaseReturnApi.useCancel();
  const { data: grns } = goodsReceivedNoteApi.useList();
  // Needed to know which GRNs have already been invoiced — see copyableGrns.
  const { data: invoices } = purchaseInvoiceApi.useList();
  // GRN carries no Contact Person or Payment Terms of its own — those live one
  // level further up, on the Purchase Order it was received against. Needed
  // to pull them in transitively when a GRN is picked (see the poNo pull-in
  // effect below).
  const { data: purchaseOrders } = purchaseOrderApi.useList();
  const { data: suppliers } = supplierApi.useList();
  const { data: taxCodes } = taxCodeApi.useList();
  // A brand-new item row's Tax (%) CFL defaults to this Tax Code instead of
  // showing empty — see pickDefaultTaxCode's own doc comment.
  const defaultTaxCode = useMemo(() => pickDefaultTaxCode(taxCodes), [taxCodes]);
  const { data: salesEmployees } = salesEmployeeApi.useList();
  const { data: products } = productApi.useList({ view: 'picker' });
  const { data: company } = useGetCompanyDetailsQuery();
  const { rates: priceListRates } = usePriceListRates('DLP');
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
  // return already has a linked entry). Same pattern as Purchase GRN.
  const [journalViewOpen, setJournalViewOpen] = useState(false);
  // Copy From ("Find Purchase Receipt") dialog. Held at page level rather than
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

  // selectableProducts/productCodeOptions/productNameOptions used to live
  // here, computed from editingRow?.items — a static snapshot that only
  // reflected the record's lines as of page load. That went stale the moment
  // Copy From replaced the items array with a different document's lines, so
  // it's now computed live inside AppForm's render prop instead, keyed off
  // watchedItems (the form's actual current rows).

  const { warehouses } = useWarehouseOptions({ currentValue: editingRow?.warehouse });
  // Which of the two save buttons was pressed. A ref, not state: the click
  // handler has to record it before submit reads it, and setting state there
  // would re-render in the middle of the click.
  const pendingStatusRef = useRef(null);

  // Only GRNs that have NOT been invoiced can be returned against.
  //
  // Once a purchase invoice exists the goods have been billed, and sending
  // them back by return would leave the invoice standing against stock that
  // has gone — a Purchase Credit Memo is the instrument from then on. The
  // backend refuses these outright (assertReturnAllowed in utils/routeMap.js);
  // filtering here means the user never picks an option that will be rejected.
  //
  // A cancelled or draft invoice does not lock the GRN: neither has been
  // issued, so there is nothing yet to credit instead.
  const invoicedGrnNos = useMemo(() => new Set(
    (invoices || [])
      .filter((i) => !['Draft', 'Cancelled'].includes(i.status))
      .map((i) => i.grnNo)
      .filter(Boolean)
  ), [invoices]);

  // Per (grnNo, productCode), how much has already been returned by OTHER
  // purchase returns (i.e. not the one currently being edited). Used to cap
  // what THIS return can still take — two returns against the same GRN line
  // must share its quantity, not each get the full amount.
  const returnedByGrnProductOther = useMemo(() => {
    const totals = new Map();
    (rows || [])
      .filter((r) => r.status !== 'Cancelled' && r.grnNo && r.returnNo !== editingRow?.returnNo)
      .forEach((r) => {
        (r.items || []).forEach((item) => {
          if (!item.productCode) return;
          const key = `${r.grnNo}::${item.productCode}`;
          totals.set(key, (totals.get(key) || 0) + (Number(item.returnQuantity) || 0));
        });
      });
    return totals;
  }, [rows, editingRow]);

  // What the Copy From dialog is allowed to offer — an already-invoiced GRN is
  // excluded for the reason given above (the credit belongs on the invoice, so
  // the backend would reject it anyway). A Cancelled one (PurchaseGRN.jsx's
  // Cancel action) is dropped the same way — it was never actually received,
  // so there is nothing to return.
  //
  // This used to build the options for a GRN dropdown; it is now the record
  // list handed to the dialog. The "the GRN already on the record being edited
  // stays selectable" case the dropdown needed is gone with it — the field is
  // read-only now, so an existing return's own link is simply displayed and
  // never has to survive a filter to keep showing.
  const copyableGrns = useMemo(
    () => (grns || []).filter((g) => g.status !== 'Closed' && g.status !== 'Cancelled' && !invoicedGrnNos.has(g.grnNo)),
    [grns, invoicedGrnNos]
  );
  const supplierOptions = useMemo(
    () => buildPartyCodeOptions(suppliers, 'supplierCode', 'supplierName'),
    [suppliers]
  );
  const { options: branchOptions, branches } = useBranchNameOptions({ currentValue: editingRow?.branch });
  // Prepared By lists every Sales Employee; Approved By is scoped to the
  // ones flagged with approval authorization on the Sales Employee master.
  const approvedByOptions = (salesEmployees || []).filter((s) => s.approvalAuthorization === true).map((s) => ({ label: s.employeeName, value: s.employeeName }));

  const tableColumns = useMemo(() => ([
    { field: 'returnNo', headerName: 'Return No.', filter: 'text' },
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

  const [printRequestReturnNo, setPrintRequestReturnNo] = useState(null);

  // Row-level Print, so this list carries the same action set as every other
  // purchase list (View / Route Map / Print / more). Opens the row in its
  // read-only View first and prints once that has rendered — the same
  // open-then-print sequence Purchase GRN and Purchase Invoice use, and for
  // the same reason: the printable content only exists once the form for that
  // row is on screen, so printing immediately would catch the list instead.
  const handlePrint = (row) => {
    setRowMenuAnchor(null);
    handleView(row);
    setPrintRequestReturnNo(row.returnNo);
  };

  useEffect(() => {
    if (!printRequestReturnNo) return;
    if (!editingRow || editingRow.returnNo !== printRequestReturnNo) return;

    const returnToListAfterPrint = () => {
      window.removeEventListener('afterprint', returnToListAfterPrint);
      setPrintRequestReturnNo(null);
      backToList();
    };

    window.addEventListener('afterprint', returnToListAfterPrint);
    printPurchaseReturn();
  }, [printRequestReturnNo, editingRow]);

  // Opened from the Route Map's document preview popup: jump straight into
  // this record's own read-only View, exactly as clicking it in the list
  // would, instead of requiring the user to find and click the row.
  useEffect(() => {
    if (!openDocNo) return;
    if (editingRow && editingRow.returnNo === openDocNo) return;
    const match = (rows || []).find((r) => r.returnNo === openDocNo);
    if (match) handleView(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDocNo, rows]);

  // "Copy To > Purchase Return" lands the browser on this page's route, but
  // that alone used to leave the user on the LIST view — the intent-
  // consuming effect that actually applies the source document's data lives
  // inside AppForm's render prop below, which only mounts once `view` is
  // 'form', so nothing happened until the user clicked "+ Add New"
  // themselves first. Mirrors the openDocNo effect just above: notice a
  // pending intent addressed to this page on arrival and open the create
  // form immediately, so the user lands straight on a pre-filled return.
  const pendingCopyIntentForAutoOpen = useSelector((s) => s.copyIntent.pending);
  useEffect(() => {
    if (!pendingCopyIntentForAutoOpen || pendingCopyIntentForAutoOpen.targetKey !== 'purchaseReturn') return;
    if (view === 'form') return;
    openCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCopyIntentForAutoOpen]);

  const handleDelete = async (row) => {
    setRowMenuAnchor(null);
    const ok = await confirmDialog({
      title: 'Delete purchase return',
      message: `Are you sure you want to delete "${row.returnNo}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Purchase return deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  // Cancel — a soft alternative to Delete, same feature as PurchaseOrder.jsx's
  // own Cancel action: the return stays in the list (status becomes
  // "Cancelled") but View/Edit/Print get blocked below once isCancelled is
  // true. The backend reverses whatever stock/batch-serial/G/L this return
  // already posted.
  const handleCancel = async (row) => {
    setRowMenuAnchor(null);
    const ok = await confirmDialog({
      title: 'Cancel purchase return',
      message: `Are you sure you want to cancel "${row.returnNo}"? This cannot be undone — the return will be locked.`,
      confirmLabel: 'Cancel Return',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await cancelReturn(row.id).unwrap();
      notify.success('Purchase return cancelled');
    } catch (err) {
      notify.error(err?.data?.message || 'Cancel failed');
    }
  };

  const handleSubmit = async (values, methods) => {
    // A Batch/Serial-tracked line whose return quantity isn't fully covered
    // by its selected batches/serials cannot be saved — see
    // validateBatchSerialAllocation above. The server enforces the same
    // rule so this is a fast local check, not the only line of defence.
    const allocationError = validateBatchSerialAllocation(values.items, productsByCode);
    if (allocationError) {
      notify.error(allocationError);
      return;
    }
    // "Save as Draft" is a shortcut that forces Draft regardless of what the
    // Status field shows. The main Save/Update button does NOT force a
    // status — it used to always set 'Open', silently discarding any other
    // value picked in the Status dropdown (Closed, Cancelled, ...): the
    // record would save, but always as Open, so editing to e.g. Cancelled
    // appeared to "not save" because the list kept showing Open.
    const payload = { ...values, status: pendingStatusRef.current || values.status };
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...payload }).unwrap();
        notify.success('Purchase return updated');
      } else {
        await create(payload).unwrap();
        notify.success('Purchase return created');
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
      <EntityHeaderCard
        icon={<AssignmentReturnOutlinedIcon />}
        title="Purchase Return"
        subtitle={view === 'form'
          ? 'Return received goods to a supplier against a GRN.'
          : 'Manage goods returned to suppliers.'}
        rightContent={<CompanyBadge />}
      />

      {view === 'form' ? (
        <RouteMapContextMenu flow="purchase" type="return" docNo={editingRow?.returnNo}>
          <AppForm
            key={formKey}
            readOnly={readOnly}
            schema={purchaseReturnSchema}
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
                { header: 'Received Qty', get: (i) => i?.receivedQuantity, field: 'text' },
                { header: 'Return Qty', get: (i) => i?.returnQuantity, field: 'text' },
                { header: 'Unit Price', get: (i) => i?.unitPrice, field: 'text' },
                { header: 'Disc %', get: (i) => i?.discountPercent, field: 'text' },
                { header: 'Tax %', get: (i) => taxCodeById.get(i?.taxCodeId)?.label ?? i?.taxPercent, field: 'select' },
                null,
                { header: 'Amount', get: (i) => ((Number(i?.returnQuantity) || 0) * (Number(i?.unitPrice) || 0)).toFixed(2), field: 'plain', min: 110 },
                null,
              ]);
              const grnNo = watch('grnNo');
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
              // with what that GRN received.
              //
              // This used to run as an effect watching the GRN No. dropdown,
              // guarded by a ref so it fired only on a real change. It is a plain
              // function now, called only from the dialog's Choose button: an
              // effect keyed on a form value also fires when that value is
              // restored on edit or reset, which is what the ref bookkeeping
              // existed to detect. An explicit call has no such ambiguity.
              //
              // Supplier is still set from the GRN, unlike the sibling purchase
              // pages: this form keeps supplierName and contactPerson alongside
              // it, so the pull has real work to do here, and the value it writes
              // is the supplier the dialog was already filtered by.
              const applyGrn = (grn) => {
                if (!grn) return;
                setValue('grnNo', grn.grnNo || '', { shouldValidate: true });
                setValue('supplier', grn.supplier || '');
                setValue('supplierName', grn.supplier || '');
                setValue('branch', grn.branch || '');
                setValue('termsConditions', grn.termsConditions || '');
                // Contact Person and Payment Terms live one level further up —
                // the GRN itself doesn't carry them, but the Purchase Order it
                // was received against does. Reached transitively via the
                // GRN's own poNo.
                const sourcePo = (purchaseOrders || []).find((p) => p.poNo === grn.poNo);
                if (sourcePo) {
                  setValue('contactPerson', sourcePo.contactPerson || '');
                  setValue('paymentTerms', sourcePo.paymentTerms || '');
                }
                // Carried on the GRN but previously left behind on Copy To
                // (the return schema has no Other Details block, so this
                // is all there is to bring across).
                setValue('approvedBy', grn.approvedBy || '', { shouldValidate: true });
                setValue('placeOfSupply', grn.placeOfSupply || '', { shouldValidate: true });
                // replace(), never setValue('items', ...) — the field array has to
                // remount so each row's inputs pick up the new values.
                //
                // receivedQuantity on each line is NOT the raw GRN quantity — it is
                // what is still left to return after every OTHER purchase return
                // against this GRN is subtracted (returnedByGrnProductOther, below).
                // Two separate returns against the same 10-unit GRN line must not
                // each be allowed up to 10; the second one only has what the first
                // didn't take. A line with nothing left is dropped rather than
                // pulled in at zero, matching the same rule used in Purchase
                // Invoice's GRN pull-in.
                // `line` is captured BEFORE the filter: base_line names the
                // row's position on the GRN, not in the filtered subset.
                const remaining = (grn.items || [])
                  .map((i, n) => {
                    const received = Number(i.receivedQuantity) || 0;
                    const alreadyReturned = returnedByGrnProductOther.get(`${grn.grnNo}::${i.productCode}`) || 0;
                    return { item: i, line: n + 1, qty: round2(received - alreadyReturned) };
                  })
                  .filter(({ qty }) => qty > 0.005);
                const mappedItems = remaining.length
                  ? remaining.map(({ item: i, line, qty }) => ({
                      productCode: i.productCode || '',
                      productName: i.productName || '',
                      description: i.description || '',
                      hsnCode: i.hsnCode || '',
                      uom: i.uom || '',
                      receivedQuantity: qty,
                      returnQuantity: qty,
                      unitPrice: priceListRates?.get(i.productCode) ?? (Number(i.unitPrice) || 0),
                      discountPercent: Number(i.discountPercent) || 0,
                      taxPercent: Number(i.taxPercent) || 0,
                      taxCodeId: i.taxCodeId != null ? Number(i.taxCodeId) : null,
                      // Where the goods physically are, so the return's own
                      // ship-back-out default points at the same place the
                      // GRN line (or its header) said they landed.
                      warehouse: i.warehouse || '',
                      // Copy From: a return is raised against the GRN.
                      baseType: 'Purchase GRN',
                      baseEntry: grn.id ?? null,
                      baseNo: grn.grnNo || null,
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
                // own default instead of the GRN's). Reasserting the GRN's
                // own values a moment later — after that cell's effect has
                // had every chance to run and lose — guarantees the copied
                // figures win regardless of exactly how that race goes.
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
              // with it, rather than leaving a stale receipt's figures sitting in
              // a return that no longer claims to reference it.
              //
              // Supplier is deliberately NOT cleared. It is the user's own
              // selection — it is what made Copy From available in the first
              // place, and clearing it would close the dialog off and force a
              // re-pick just to try a different receipt from the same vendor.
              const clearGrn = () => {
                setValue('grnNo', '', { shouldValidate: true });
                setValue('contactPerson', '');
                setValue('paymentTerms', '');
                setValue('termsConditions', '');
                replaceItems([{ ...emptyItem }]);
              };

              // Picking a Supplier auto-fills its Phone Number, and now its
              // Supplier Name, from the Business Partner record behind it —
              // same pattern as PurchaseOrder.jsx's own supplier effect.
              // This form's `supplier` field stores the supplier's NAME, not
              // its code (see buildPartyCodeOptions: the CFL shows/labels
              // each option by supplierCode but its stored `value` is
              // r[nameField] — the same "label shows code, value is name"
              // convention as every party CFL in this app, Purchase
              // Invoice's own Supplier field included), so the match below
              // is on supplierName. This effect (and printSupplierRecord
              // further down, which fed the print's Supplier box) used to
              // match on supplierCode instead, which could never match
              // anything real — that's the pre-existing reason Phone Number
              // never actually auto-filled, and why the printed Purchase
              // Return's Supplier details box was always blank; both are
              // fixed together here since they share this one root cause.
              // Guarded by prevSupplierRef so it only runs on an actual
              // change, not when the value is restored on edit/view.
              //
              // supplierName used to only ever get set by Copy From (see
              // clearGrn's sibling effect above), leaving it blank for an
              // ordinary direct pick — PartyCodeSelect's own name caption
              // was the only thing showing the resolved name in that case
              // (see showNameBelow={false} above). Filling it here too
              // means the dedicated Supplier Name field always reflects the
              // current selection instead. It's still a plain editable
              // field afterwards, same as it always was — this only sets a
              // sensible default.
              const supplierValue = watch('supplier');
              const prevSupplierRef = useRef(editingRow ? editingRow.supplier : null);
              useEffect(() => {
                if (supplierValue === prevSupplierRef.current) return;
                prevSupplierRef.current = supplierValue;
                const found = (suppliers || []).find((s) => s.supplierName === supplierValue);
                if (found) {
                  setValue('phone', found.phone || '', { shouldValidate: true });
                  setValue('supplierName', found.supplierName || '', { shouldValidate: true });
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

              const headerWarehouse = watch('warehouse');
              const prevHeaderWarehouseRef = useRef(headerWarehouse);
              useEffect(() => {
                if (prevHeaderWarehouseRef.current === headerWarehouse) return;
                const oldWh = prevHeaderWarehouseRef.current;
                prevHeaderWarehouseRef.current = headerWarehouse;
                if (!headerWarehouse) return;
                (watch('items') || []).forEach((it, idx) => {
                  if (!it.warehouse || it.warehouse === oldWh) {
                    setValue(`items.${idx}.warehouse`, headerWarehouse, { shouldValidate: true });
                  }
                });
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [headerWarehouse]);

              // Tracks, per row (keyed by field.id so it survives index
              // shifts from add/remove), whether that line's Return Qty
              // exceeds live available stock in its own selected Warehouse —
              // computed by AvailableStockCell below via useWarehouseStock.
              // No static zod rule can express this (it needs a live server
              // fetch), so it is component state that gates the Save
              // buttons, mirroring DeliveryChallan.jsx/StockIssue.jsx's
              // identical idiom.
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
              const discountPercent = watch('discountPercent');
              // taxType (from each line's own taxCodeId) drives the TCS
              // carve-out in documentTotals.js's computeTotals -- see
              // buildTaxCodeOptions/taxCodeById above, which now carries
              // taxType alongside label/value/rate.
              const itemsForTotals = watchedItems.map((it) => ({ ...it, taxType: taxCodeById.get(it.taxCodeId)?.taxType || '' }));
              const freightNetAmount = watch('freightNetAmount');
              const freightTaxAmount = watch('freightTaxAmount');
              const totals = computeReturnTotals(itemsForTotals, discountPercent, interState, { freightNetAmount, freightTaxAmount });

              // Print data — Return's own `supplier` field actually stores
              // the supplier NAME, same as every other party CFL in this
              // app (see buildPartyCodeOptions: value = r[nameField], label
              // = r[codeField]) — the comment this replaced was wrong, and
              // matching on supplierCode here meant this record could never
              // be found, so the printed Return's Supplier address/GST box
              // has likely always been blank. Same root cause and fix as
              // the supplier-selection effect above.
              const allValues = watch();
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
              // PurchaseReturnPrintable's isTcsTaxType(it.taxType) check
              // could never see a TCS-typed line no matter what Tax Code it
              // used.
              const printOrder = { ...allValues, items: itemsForTotals, status: editingRow?.status || 'Open' };
              // See SalesInvoice.jsx's identical approverSignatureUrl comment.
              const approverSignatureUrl = (salesEmployees || []).find((s) => s.employeeName === allValues.approvedBy)?.signatureUrl || null;

              // Consume a pending "Copy To" intent addressed to this page —
              // see copyIntentSlice.js and CopyToButton.jsx.
              useEffect(() => {
                if (!pendingCopyIntent || pendingCopyIntent.targetKey !== 'purchaseReturn') return;
                if (pendingCopyIntent.sourceType === 'purchaseGRN') applyGrn(pendingCopyIntent.sourceDoc);
                dispatch(clearCopyIntent());
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [pendingCopyIntent]);

              return (
                <>
                  <CopyFromDocumentDialog
                    open={copyFromOpen}
                    onClose={() => setCopyFromOpen(false)}
                    onChoose={applyGrn}
                    documents={copyableGrns}
                    party={watch('supplier')}
                    title="Find Purchase Receipt"
                    columns={GRN_COPY_COLUMNS}
                    emptyMessage="No uninvoiced goods receipts found for"
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
                      {/* Two columns, top to bottom: Branch / Supplier Code /
                        Supplier Name / Contact Person / Status / Vendor
                        Reference No. on the left, Return No / Document Date /
                        GRN No. / Phone Number / Reason on the right —
                        FormGrid(columns=2) lays fields out
                        left-right-left-right, so the order below IS the
                        column assignment. Vendor Reference No. has no
                        right-column partner (its row is left alone). */}
                      <FormGrid columns={2} singleColumnOnMobile rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                        <LabeledField label="Branch *">
                          <FormSelect name="branch" label="" placeholder="Select branch" options={branchOptions} />
                        </LabeledField>
                        <LabeledField label="Return No. *">
                          <DocumentSeriesNoField documentCode="PRT" seriesFieldName="seriesId" numberFieldName="returnNo" isCreate={!editingRow} />
                        </LabeledField>

                        {/* This form's Supplier picker doubles as "Supplier
                          Code": PartyCodeSelect stores the selected
                          supplier's CODE as the field value (see
                          printSupplierRecord below), so no separate
                          read-only code display is needed alongside it. */}
                        <LabeledField label="Supplier Code *">
                          {/* showNameBelow={false}: this page already has a
                          dedicated "Supplier Name" field further down this
                          same grid (see the supplierValue effect below,
                          which now fills it) — PartyCodeSelect's own
                          built-in name caption defaulted on here too,
                          rendering the resolved name a second time directly
                          under this field in a mismatched style, which is
                          what threw off the vertical rhythm between this
                          column and Document Date/Contact Person beside it.
                          Same fix already applied to Purchase Invoice's own
                          Supplier CFL. */}
                          <PartyCodeSelect name="supplier" label="" placeholder="Select supplier" options={supplierOptions} showNameBelow={false} />
                        </LabeledField>
                        <LabeledField label="Document Date *">
                          <FormDatePicker name="documentDate" label="" triggerFields={['postingDate', 'dueDate', 'billDoDate']} />
                        </LabeledField>

                        <LabeledField label="Supplier Name">
                          <FormTextField name="supplierName" label="" placeholder="Supplier name" />
                        </LabeledField>

                        {/* Display-only, auto-filled from the selected supplier's
                        Business Partner address -- drives CGST/SGST vs IGST. */}
                        <LabeledField label="State">
                          <FormTextField name="supplierState" label="" placeholder="Supplier state" disabled />
                        </LabeledField>

                        {/* GRN No., Status and Invoice Type have been removed
                          from this card's UI entirely (per business
                          request). GRN No. and Status stay on the form's
                          data model, unrendered — Copy From still writes
                          grnNo (used to cap per-line return quantity against
                          what the GRN brought in) and status still defaults
                          to 'Open'/'Draft' via the Save/Save as Draft
                          buttons below — same "hidden, not removed"
                          convention already used for GRN's/Invoice's own
                          PO No. field. Invoice Type never applied to
                          Purchase Return in the first place. */}

                        <LabeledField label="Contact Person">
                          <FormTextField name="contactPerson" label="" placeholder="Enter contact person" />
                        </LabeledField>
                        <LabeledField label="Phone Number">
                          <FormTextField name="phone" label="" placeholder="Auto-filled from supplier" />
                        </LabeledField>

                        <LabeledField label="Reason">
                          <FormTextField name="reason" label="" placeholder="Reason for return" />
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

                  <PurchaseOtherDetailsCard variant="return" />

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
                              <TableCell align="right">Received Qty</TableCell>
                              <TableCell align="right">Return Qty *</TableCell>
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
                              const qty = Number(watch(`items.${index}.returnQuantity`)) || 0;
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
                                    <FormTextField name={`items.${index}.receivedQuantity`} label="" type="number" disabled />
                                  </TableCell>
                                  <TableCell sx={{ minWidth: 120 }}>
                                    <FormTextField name={`items.${index}.returnQuantity`} label="" type="number" />
                                    <AvailableStockCell index={index} methods={methods} fieldId={field.id} onErrorChange={handleStockErrorChange} products={products} />
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
                    <BatchSerialSelectionDialog
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

                  <PurchaseReturnPrintable
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
                        <CopyToButton
                          sourceType="purchaseReturn"
                          sourceDoc={editingRow}
                          sourceLabel="Purchase Return"
                          docNoField="returnNo"
                          targets={[
                            { key: 'purchaseInvoice', label: 'Purchase Invoice', path: '/purchase/invoice' },
                            { key: 'purchaseCreditMemo', label: 'Purchase Credit Memo', path: '/purchase/credit-memo' },
                          ]}
                        />
                        {/* Copy From sits immediately left of Cancel and stays
                          disabled until a Supplier is chosen — the dialog it
                          opens lists that supplier's goods receipts, so with no
                          supplier there is nothing for it to show. Hidden in
                          view mode, where nothing is being filled in. */}
                        {!readOnly && (
                          grnNo ? (
                            <Button
                              fullWidth={isMobile}
                              type="button"
                              variant="outlined"
                              color="inherit"
                              startIcon={<CloseIcon />}
                              onClick={clearGrn}
                              disabled={creating || updating}
                            >
                              Clear Copied GRN
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
                        <Button fullWidth={isMobile} type="button" variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => printPurchaseReturn()}>
                          Print
                        </Button>
                        {/* pendingStatusRef, not setValue: the click has to record
                          which button was pressed before submit reads it, and a
                          setValue here would re-render mid-click. */}
                        <FormSubmitButton
                          fullWidth={isMobile}
                          variant="outlined"
                          onClick={() => { pendingStatusRef.current = 'Draft'; }}
                          disabled={creating || updating || hasStockError}
                          loading={creating || updating}
                        >
                          Save as Draft
                        </FormSubmitButton>
                        <FormSubmitButton
                          fullWidth={isMobile}
                          onClick={() => { pendingStatusRef.current = null; }}
                          disabled={creating || updating || hasStockError}
                          loading={creating || updating}
                        >
                          {editingRow ? 'Update Purchase Return' : 'Save Purchase Return'}
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
                    templateUrl="/purchase/returns/items-import/template"
                    importUrl="/purchase/returns/items-import"
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
              <Typography variant="subtitle1" fontWeight={700}>Purchase Return List</Typography>
              <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="center">
                <TableSearchFilter table={table} placeholder="Search by return no., GRN, supplier..." />
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
                  <EmptyState icon={<ShoppingCartOutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No purchase returns yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first purchase return to get started'} />
                )}
              </Box>
            ) : (
              <ScrollableTableContainer>
                <Table
                  size="small"
                  stickyHeader
                  sx={{
                    '& th, & td': {
                      height: PURCHASE_RETURN_LIST_TABLE_ROW_HEIGHT,
                      paddingTop: `${PURCHASE_RETURN_LIST_TABLE_CELL_PADDING_Y}px`,
                      paddingBottom: `${PURCHASE_RETURN_LIST_TABLE_CELL_PADDING_Y}px`,
                      boxSizing: 'border-box',
                    },
                  }}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell width={48}>#</TableCell>
                      <SortableHeaderCell field="returnNo" sort={table.sort} onSort={table.toggleSort}>Return No.</SortableHeaderCell>
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
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.returnNo}</TableCell>
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
                              <RouteMapButton flow="purchase" type="return" docNo={row.returnNo} />
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
                          <EmptyState icon={<ShoppingCartOutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No purchase returns yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first purchase return to get started'} />
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
        resourceName="Purchase Returns"
        templateUrl="/purchase/returns/bulk-import/template"
        importUrl="/purchase/returns/bulk-import"
        onImported={refetchReturns}
      />
    </Box>
  );
}

// Item No / Description picker for one item row. Both columns render
// this and both WRITE items.N.productCode — they differ only in whether the
// options are labelled by code or by name — so picking in either updates both,
// exactly as on Purchase Order/GRN/Invoice.
//
// Choosing a product fills the line's own descriptive fields from Product
// Master. It deliberately does NOT touch receivedQuantity: on a return that
// figure is what the source Purchase Receipt recorded, not anything the
// product master knows, and the Return Qty validation is checked against it.
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
// selected so far. Mirrors DeliveryChallan.jsx's BatchSerialCell.
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
function AvailableStockCell({ index, methods, fieldId, onErrorChange, products }) {
      const { watch } = methods;
      const productCode = watch(`items.${index}.productCode`);
      const lineWarehouse = watch(`items.${index}.warehouse`);
      const headerWarehouse = watch('warehouse');
      const warehouse = lineWarehouse || headerWarehouse;
      const returnQty = Number(watch(`items.${index}.returnQuantity`)) || 0;
      // A non-inventory product (Product Master's Inventory Item unchecked) is
      // never stock-tracked — no ledger posting, no quantity validation, on
      // the server (see attachInventoryItemFlag in routes/resources.js) — so
      // its line gets a neutral placeholder here instead of a live figure,
      // and its quantity never blocks Save regardless of what's on hand.
      const isNonInventory = (products || []).find((p) => p.productCode === productCode)?.inventoryItem === false;
      const { onHand, isLoading } = useWarehouseStock(isNonInventory ? null : productCode, warehouse);
      const exceeds = !isNonInventory && onHand != null && returnQty > onHand;

      useEffect(() => {
        if (onErrorChange) onErrorChange(fieldId, exceeds);
        return () => { if (onErrorChange) onErrorChange(fieldId, false); };
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