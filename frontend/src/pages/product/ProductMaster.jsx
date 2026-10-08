import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Typography, Button, Card, CardContent, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, Chip, IconButton, Tabs, Tab, Grid,
  Divider, Collapse,
} from '@mui/material';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { z } from 'zod';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import { FormCheckbox } from '../../components/form/FormCheckbox';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import CompanyBadge from '../../components/common/CompanyBadge';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import useDragScroll from '../../components/data-display/useDragScroll';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { productBaseSchema, refineProductUsageFlags, refineItemCategoryRequired } from '../../lib/validation/productSchemas';
import { SHIPPING_TYPE_OPTIONS } from '../../lib/validation/partnerSchemas';
import ProductUsageFlags from './ProductUsageFlags';
import {
  productApi, taxCodeApi, hsnMasterApi, priceListApi,
  useGetProductCurrentStockQuery, useGetProductUsageQuery, useGetProductFormLookupsQuery,
} from '../../features/resources';
import useServerListTable from '../../components/data-display/useServerListTable';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import DocumentNoField from '../../components/form/DocumentNoField';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
import ProductInventoryTab from './ProductInventoryTab';

import { CanAdd } from '../../components/common/PermissionGate';
import { usePermissions } from '../../lib/permissions';
import { canDelete as canDeleteConfig } from '../../config/deleteConfig';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import TableSkeleton from '../../components/feedback/TableSkeleton';
import LoadingState from '../../components/feedback/LoadingState';
import EmptyState from '../../components/data-display/EmptyState';

// Label-left field layout (per the "Edit Items / Material" reference
// template) — a plain label sits to the left of a plain box, instead of this
// app's usual MUI floating-label style (label riding inside the box,
// shrinking onto the border on focus). Originally built for this page only;
// now shared via components/form/LabeledField.jsx so Warehouse Master,
// Product Group and Product Sub-Group can use the identical concept on
// their own General tabs instead of each hand-copying it. Every
// FormTextField/FormSelect/DocumentNoField wrapped in it still needs its own
// `label=""` passed, so the label text LabeledField renders is the only one
// shown.
// Local schema — the list's "Active" state is exposed as a checkbox rather
// than the shared Active/Inactive select, so swap the shared `status` enum
// for a boolean `active` field here and translate it back on submit.
// Built from the UNREFINED object and refined afterwards: `.superRefine()`
// returns a ZodEffects, which has no `.omit()`/`.extend()`, so the
// at-least-one-flow rule has to be applied after this reshaping rather than
// inherited through it. See refineProductUsageFlags.
const productDetailsSchema = productBaseSchema
  .omit({ status: true })
  .extend({ active: z.boolean().optional() })
  .superRefine(refineProductUsageFlags)
  .superRefine(refineItemCategoryRequired);

const emptyValues = {
  productCode: '', productName: '', barcode: '', productGroup: '', productSubGroup: '', brand: '',
  productType: '',
  // A new product is offered in every flow until someone says otherwise —
  // the same default the database applies, so a product created and saved
  // without touching these behaves exactly as products did before the flags
  // existed.
  salesItem: true, purchaseItem: true, inventoryItem: true,
  uom: '', salesUom: '', hsnCode: '', excisable: false, gst: false,
  chapterId: '', taxCategory: '',
  calculationMethod: 'None',
  manageItemBy: 'None',
  glAccountsBy: 'Warehouse',
  costPrice: 0, openingStock: 0, reorderLevel: 0,
  expiryApplicable: false, defaultSupplier: '', defaultLocation: '', rackNo: '',
  description: '', remarks: '', active: true,

  // --- General tab (header) — see migration 20260823150000_add_product_tab_fields ---
  foreignName: '', manufacturer: '', msdc: '', additionalIdentifier: '', shippingType: '',
  costCenterCode: '', costCenterName: '', manageMethod: '', priceList: '', unitPrice: 0,
  assetItem: false,

  // --- Purchase tab ---
  mfrCatalogNo: '', purchasingUomName: '', itemsPerPurchaseUnit: 0,
  purchasePackagingUomName: '', quantityPerPurchasePackage: 0, customsGroup: '',

  // --- Sales tab ---
  itemsPerSalesUnit: 0, salesPackagingUomName: '', quantityPerSalesPackage: 0,

  // --- Shared physical attributes ---
  taxGroup: '', productLength: 0, width: 0, height: 0, volume: 0, weight: 0,

  // --- Inventory tab ---
  manageInventoryByWarehouse: false, inventoryLevelRequired: 0, minimumLevel: 0,
  maximumLevel: 0, inventoryUomName: '',
};

const PRODUCT_TYPE_OPTIONS = [
  { label: 'Raw Material', value: 'Raw Material' },
  { label: 'Semi-Finished Goods', value: 'Semi-Finished Goods' },
  { label: 'Finished Goods', value: 'Finished Goods' },
  { label: 'Trading Goods', value: 'Trading Goods' },
  { label: 'Service', value: 'Service' },
  { label: 'Consumable', value: 'Consumable' },
  { label: 'Other', value: 'Other' },
];

// Inventory costing method. Picking FIFO or Moving Average makes each of this
// product's stock movements store its unit cost under that method in the
// stock journal's FIFO / MAV columns — a background record only, not shown
// anywhere in the app. 'None' stores neither. No other calculation in the
// application is affected by this choice.
const CALCULATION_METHOD_OPTIONS = [
  { label: 'None', value: 'None' },
  { label: 'FIFO', value: 'FIFO' },
  { label: 'Moving Average', value: 'Moving Average' },
];

// How this product's stock is tracked at the unit level. Display/
// classification only — no stock movement, valuation or inventory
// calculation currently branches on it.
const MANAGE_ITEM_BY_OPTIONS = [
  { label: 'None', value: 'None' },
  { label: 'Batch', value: 'Batch' },
  { label: 'Serial', value: 'Serial' },
];

// When this product's batch/serial numbers get assigned — display/
// classification only, same as MANAGE_ITEM_BY_OPTIONS above; nothing in the
// batch/serial allocation flow currently branches on it.
const MANAGE_METHOD_OPTIONS = [
  { label: 'On Every Transaction', value: 'On Every Transaction' },
  { label: 'On Release Only', value: 'On Release Only' },
];

// GST Tax Category — display/classification only on this form, shown next to
// the conditional HSN field while GST is ticked.
const TAX_CATEGORY_OPTIONS = [
  { label: 'Regular', value: 'Regular' },
  { label: 'Nil Rated', value: 'Nil Rated' },
  { label: 'Exempt', value: 'Exempt' },
];

// Which level's Accounting-tab G/L account mappings this product posts
// through — WarehouseMaster's own Accounting tab, or the product's
// ProductGroup's Accounting tab (see PRODUCT_GROUP_ACCOUNT_MAP in
// ProductGroup.jsx). Warehouse is the default, matching every product
// saved before this field existed.
const GL_ACCOUNTS_BY_OPTIONS = [
  { label: 'Warehouse', value: 'Warehouse' },
  { label: 'Product Group', value: 'Product Group' },
];

const PAGE_SIZE = 10;

// Quantity display for the "Stock" column, in the list and the mobile cards.
//
// Both used to render a bare `Number(row.currentStock)`, which prints whatever
// the float happens to be — a stock of 10.2 arriving as 10.199999999999999
// showed in full, and a whole number's trailing ".00" appeared or vanished
// depending on which document last moved it. Whole numbers print plain, part
// units to two decimals: the same rule as the Inventory tab's own `qty` (see
// ProductInventoryTab.jsx), so the two views of the same figure agree.
const formatStock = (v) => {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

const PRODUCT_MASTER_LIST_TABLE_ROW_HEIGHT = 0;
const PRODUCT_MASTER_LIST_TABLE_CELL_PADDING_Y = 6;
export default function ProductMaster() {
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const permissions = usePermissions();
  const canEdit = permissions.canEdit;
  const canDelete = canDeleteConfig && permissions.canDelete;
  // `view: 'summary'` — Phase 2 of the data-loading performance work (pure
  // data-access, no business-logic change): this list only ever renders the
  // six columns in `tableColumns` below, so the server sends just those
  // (see the `listViews.summary` projection on the `/products` route in
  // backend/src/routes/resources.js) instead of every product column. The
  // full record for one product is fetched separately, on demand, via
  // `fetchProduct` below whenever a row is actually opened for Edit/View —
  // see openEditor.
  //
  // Phase 3 (server-side paging/search/sort/filter, also pure data-access) —
  // `table` below (useServerListTable, see that file) now fetches ONE page
  // at a time via `productApi.useListPaged`, with search/sort/filter sent
  // as query params for every column except "Stock" (see tableColumns'
  // comment). `products`/`isLoading` are gone; the loaded rows live in
  // `table.rows`.
  const { data: currentStockByCode } = useGetProductCurrentStockQuery();
  const [create, { isLoading: creating }] = productApi.useCreate();
  const [update, { isLoading: updating }] = productApi.useUpdate();
  const [remove] = productApi.useDelete();
  const [fetchProduct, { isFetching: fetchingProduct }] = productApi.useLazyGet();

  // Form is hidden by default -- it expands in a Collapse ABOVE the list
  // (which stays visible) when "Add Product" or an edit action is
  // triggered, per the inline form template (Payment Entry/Deposit Entry),
  // instead of swapping the whole page out for a separate form view.
  const [showForm, setShowForm] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [readOnly, setReadOnly] = useState(false);

  // Phase 4 of the data-loading performance work (pure data-access, no
  // business-logic change) — one combined round-trip (see /products/
  // form-lookups in backend/src/routes/resources.js) replaces what used to
  // be five separate `useList(undefined, { skip: !showForm })` calls, one
  // each for the FAST dropdowns (Item Group, Sub-Group, Brand, UOM,
  // Preferred Vendor). Still gated behind the form being open — same
  // `skip: !showForm` as before, just on one request instead of five.
  // `productGroups`/`productSubGroups`/`brands`/`uoms`/`suppliers` below are
  // destructured straight off the combined response so every downstream
  // reference to them (the `...Options` derivations further down) needs no
  // change at all.
  //
  // Tax Code is deliberately NOT part of the combined endpoint — its route
  // lives in routes/company.js (see that endpoint's own comment for why),
  // so it keeps its own separate, already-gated call.
  //
  // HSN Master and Price List were folded into the combined endpoint in the
  // first cut of Phase 4, then pulled back out (this revision) after
  // measurement showed the combined call taking ~9.8s / 5.4MB — the whole
  // form ended up blocked on whichever of the two was slowest, instead of
  // only that one field lagging the way it did before Phase 4. They're back
  // to their own separate, already-gated calls here — exactly their
  // pre-Phase-4 behaviour — so `hsnMasters`/`priceLists` are no longer part
  // of `formLookups`; every downstream reference to them below is unchanged
  // since the variable names are identical.
  const { data: formLookups } = useGetProductFormLookupsQuery(undefined, { skip: !showForm });
  const {
    productGroups, productSubGroups, brands, uoms, suppliers,
  } = formLookups || {};
  const { data: taxCodes } = taxCodeApi.useList(undefined, { skip: !showForm });
  const { data: hsnMasters } = hsnMasterApi.useList(undefined, { skip: !showForm });
  const { data: priceLists } = priceListApi.useList(undefined, { skip: !showForm });

  const productGroupOptions = (productGroups || []).map((g) => ({ label: g.groupName, value: g.groupName }));
  // Price List dropdown — every Active Price List's own name (Company Setup
  // > Product Setup > Price List). Selecting one autofills Unit Price from
  // that price list's own row for this product, see the effect inside the
  // form below; typing one in by hand is no longer possible; this used to be
  // a free-text field, so an existing product's already-saved value is kept
  // selectable even if that price list has since been renamed, deactivated,
  // or removed — same "keep the legacy value visible" rule every other
  // cross-master dropdown in this app follows.
  const priceListOptions = useMemo(() => {
    const rows = (priceLists || []).filter((pl) => pl.status === 'Active');
    const out = rows.map((pl) => ({ label: pl.priceListName, value: pl.priceListName }));
    const current = editingRow?.priceList || '';
    if (current && !out.some((o) => o.value === current)) {
      out.unshift({ label: `${current} (not in Price List)`, value: current });
    }
    return out;
  }, [priceLists, editingRow]);
  const brandOptions = (brands || []).map((b) => ({ label: b.brandName, value: b.brandName }));
  const hsnOptions = useMemo(() => (hsnMasters || [])
    .filter((h) => h.isActive !== false)
    .map((h) => ({ label: h.description ? `${h.hsnCode} — ${h.description}` : h.hsnCode, value: h.hsnCode })),
    [hsnMasters]);
  const uomOptions = (uoms || []).map((u) => ({ label: u.uomName, value: u.uomName }));
  const supplierOptions = (suppliers || []).map((s) => ({ label: s.supplierName, value: s.supplierName }));
  const taxGroupOptions = useMemo(() => (taxCodes || [])
    .filter((t) => t.status === 'Active')
    .map((t) => ({ label: `${t.taxCode} (${t.taxRate}%)`, value: t.taxCode })),
    [taxCodes]);
  // Which of the three flow flags are pinned by documents already using this
  // product, so those checkboxes render locked. Skipped while creating — a
  // product that does not exist yet is used nowhere, so nothing can be locked.
  const { data: productUsage } = useGetProductUsageQuery(editingRow?.productCode, {
    skip: !editingRow?.productCode,
  });
  const [formKey, setFormKey] = useState(0);
  const [tab, setTab] = useState(0);

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useServerListTable.js. `server:
  // true` marks a column whose sort/filter is sent to the server as a query
  // param (see the /products route's sortableFields/filterFields in
  // backend/src/routes/resources.js); "Stock" deliberately has no `server`
  // flag — it's a live computed value (opening stock + stock-ledger
  // movements, see the comment below), not a plain DB column, so it keeps
  // being sorted/filtered client-side, over just the currently-loaded page.
  const tableColumns = useMemo(() => ([
    { field: 'productCode', headerName: 'Item No', filter: 'text', server: true },
    { field: 'productName', headerName: 'Description', filter: 'text', server: true },
    { field: 'productGroup', headerName: 'Item Group', filter: 'text', server: true },
    // No `server` flag (see the comment above): `value`/`sortValue` compute
    // the live figure from currentStockByCode the same way the `rows` merge
    // below does, so useServerListTable's client-side filter/sort for this
    // one column (applied only to the current page) reads the right number
    // instead of the plain (and here absent) `row.currentStock`.
    {
      field: 'currentStock',
      headerName: 'Stock',
      filter: 'numberRange',
      value: (row) => (currentStockByCode?.[row.productCode] ?? row.openingStock),
      sortValue: (row) => {
        const v = currentStockByCode?.[row.productCode] ?? row.openingStock;
        return v == null || v === '' ? null : Number(v);
      },
    },
    { field: 'status', headerName: 'Status', filter: 'select', server: true },
  ]), [currentStockByCode]);

  const table = useServerListTable(productApi.useListPaged, {
    columns: tableColumns,
    baseParams: { view: 'summary' },
    initialPageSize: PAGE_SIZE,
  });

  // "Stock" in the list shows live current stock — the product-wide opening
  // stock on the record, plus every Opening Balance row keyed for it under
  // Inventory > Opening Balance, plus every posted document that moves stock
  // (see backend utils/stockLedger.js). Not just the static opening-stock
  // field. Falls back to openingStock while the current-stock lookup is still
  // loading. Computed only over the current page's rows (table.rows), same
  // as before Phase 3 — the difference is table.rows is now one server page
  // instead of the full list.
  const rows = useMemo(() => table.rows.map((p) => ({
    ...p,
    currentStock: currentStockByCode?.[p.productCode] ?? p.openingStock,
  })), [table.rows, currentStockByCode]);

  const openCreate = () => {
    setEditingRow(null);
    setReadOnly(false);
    setFormKey((k) => k + 1);
    setTab(0);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingRow(null);
  };

  // Edit/View open the form from the FULL product record, fetched on demand
  // via GET /products/:id (unchanged, full row) — not from the slim list
  // row above, which no longer carries every field. The row from the list
  // still identifies which product to fetch (row.id); RTK Query caches the
  // result the same way useGet always has, so reopening the same product
  // shortly after doesn't refetch. See the `view: 'summary'` comment above.
  const openEditor = async (row, ro) => {
    try {
      const full = await fetchProduct(row.id).unwrap();
      setEditingRow(full);
      setReadOnly(ro);
      setFormKey((k) => k + 1);
      setTab(0);
      setShowForm(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      notify.error(err?.data?.message || 'Failed to load product details');
    }
  };

  // Read-only look at a record — same form, every field disabled
  // and the save button removed (see AppForm's readOnly prop).
  const handleView = (row) => openEditor(row, true);

  const handleEdit = (row) => openEditor(row, false);

  const handleDelete = async (row) => {
    const ok = await confirmDialog({
      title: 'Delete product',
      message: `Are you sure you want to delete "${row.productName}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Product deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    const { active, ...rest } = values;
    const payload = { ...rest, status: active ? 'Active' : 'Inactive' };
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...payload }).unwrap();
        notify.success('Product updated');
      } else {
        await create(payload).unwrap();
        notify.success('Product added');
      }
      closeForm();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<Inventory2OutlinedIcon />}
        title="Product Master"
        subtitle="Create and manage products."
        rightContent={<CompanyBadge />}
      />

      <Collapse in={showForm} unmountOnExit>
        <Box sx={{ mb: 2 }}>
          <Card variant="outlined">
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 1 }}>
                <Typography variant="subtitle1" fontWeight={700}>
                  {readOnly ? 'View Product' : editingRow ? 'Edit Product' : 'Create Product'}
                </Typography>
                <Button variant="outlined" color="inherit" startIcon={<CloseIcon />} onClick={closeForm}>
                  Close
                </Button>
              </Stack>

              <AppForm readOnly={readOnly}
                key={formKey}
                schema={productDetailsSchema}
                defaultValues={editingRow ? {
                  ...emptyValues,
                  ...editingRow,
                  costPrice: editingRow.costPrice != null ? Number(editingRow.costPrice) : 0,
                  openingStock: editingRow.openingStock != null ? Number(editingRow.openingStock) : 0,
                  reorderLevel: editingRow.reorderLevel != null ? Number(editingRow.reorderLevel) : 0,
                  unitPrice: editingRow.unitPrice != null ? Number(editingRow.unitPrice) : 0,
                  itemsPerPurchaseUnit: editingRow.itemsPerPurchaseUnit != null ? Number(editingRow.itemsPerPurchaseUnit) : 0,
                  quantityPerPurchasePackage: editingRow.quantityPerPurchasePackage != null ? Number(editingRow.quantityPerPurchasePackage) : 0,
                  itemsPerSalesUnit: editingRow.itemsPerSalesUnit != null ? Number(editingRow.itemsPerSalesUnit) : 0,
                  quantityPerSalesPackage: editingRow.quantityPerSalesPackage != null ? Number(editingRow.quantityPerSalesPackage) : 0,
                  productLength: editingRow.productLength != null ? Number(editingRow.productLength) : 0,
                  width: editingRow.width != null ? Number(editingRow.width) : 0,
                  height: editingRow.height != null ? Number(editingRow.height) : 0,
                  volume: editingRow.volume != null ? Number(editingRow.volume) : 0,
                  weight: editingRow.weight != null ? Number(editingRow.weight) : 0,
                  inventoryLevelRequired: editingRow.inventoryLevelRequired != null ? Number(editingRow.inventoryLevelRequired) : 0,
                  minimumLevel: editingRow.minimumLevel != null ? Number(editingRow.minimumLevel) : 0,
                  maximumLevel: editingRow.maximumLevel != null ? Number(editingRow.maximumLevel) : 0,
                  assetItem: !!editingRow.assetItem,
                  manageInventoryByWarehouse: !!editingRow.manageInventoryByWarehouse,
                  excisable: !!editingRow.excisable,
                  gst: !!editingRow.gst,
                  // Products saved before this field existed come back null;
                  // show them as 'None' so the select isn't blank.
                  calculationMethod: editingRow.calculationMethod || 'None',
                  manageItemBy: editingRow.manageItemBy || 'None',
                  glAccountsBy: editingRow.glAccountsBy || 'Warehouse',
                  // `!== false` rather than a plain truthiness test: a product
                  // saved before these columns existed comes back with them
                  // undefined, and the column default is true, so an absent
                  // value must read as ticked — not as a product that belongs
                  // to no flow at all.
                  salesItem: editingRow.salesItem !== false,
                  purchaseItem: editingRow.purchaseItem !== false,
                  inventoryItem: editingRow.inventoryItem !== false,
                  active: editingRow.status === 'Active',
                } : emptyValues}
                onSubmit={handleSubmit}
              >
                {(methods) => {
                  const groupValue = methods.watch('productGroup');
                  const subGroupOptions = (productSubGroups || [])
                    .filter((s) => !groupValue || !s.groupName || s.groupName === groupValue)
                    .map((s) => ({ label: s.subGroupName, value: s.subGroupName }));

                  // Auto-fill the UOM from the selected Product Group's own
                  // default UOM (still editable afterwards) whenever the
                  // group selection actually changes — including on an
                  // existing product, so re-grouping a product re-derives its
                  // UOM rather than leaving behind whatever the old group set.
                  // A group with no UOM configured leaves the field alone.
                  const prevGroupValue = useRef(editingRow ? editingRow.productGroup : null);
                  useEffect(() => {
                    if (groupValue !== prevGroupValue.current) {
                      const group = (productGroups || []).find((g) => g.groupName === groupValue);
                      if (group && group.uom) methods.setValue('uom', group.uom, { shouldValidate: true });
                      prevGroupValue.current = groupValue;
                    }
                    // eslint-disable-next-line react-hooks/exhaustive-deps
                  }, [groupValue]);

                  // Unit Price autofill — the whole reason Price List became
                  // a dropdown instead of free text. Picking a Price List
                  // looks up THIS product's own row in that price list's
                  // items (Price List page's Item table) and copies its
                  // Price across; Unit Price stays editable afterwards for a
                  // one-off override. No matching row (product not added to
                  // that price list yet) leaves Unit Price untouched rather
                  // than clearing it. Guarded the same way the Item Group
                  // effect above is, so opening an existing product for
                  // edit/view doesn't re-fire this the moment the form mounts.
                  const priceListValue = methods.watch('priceList');
                  const productCodeValue = methods.watch('productCode');
                  const prevPriceListValue = useRef(editingRow ? editingRow.priceList : null);
                  useEffect(() => {
                    if (priceListValue !== prevPriceListValue.current) {
                      prevPriceListValue.current = priceListValue;
                      if (priceListValue) {
                        const list = (priceLists || []).find((pl) => pl.priceListName === priceListValue);
                        const item = (list?.items || []).find((it) => it.productCode === productCodeValue);
                        if (item) methods.setValue('unitPrice', Number(item.price) || 0, { shouldValidate: true });
                      }
                    }
                    // eslint-disable-next-line react-hooks/exhaustive-deps
                  }, [priceListValue, productCodeValue]);

                  // Item Category — Excisable / GST are mutually exclusive:
                  // ticking one unchecks the other, rather than letting both
                  // sit ticked at once. Two one-way effects rather than a
                  // single shared handler because FormCheckbox owns its own
                  // Controller/onChange (see components/form/FormCheckbox.jsx)
                  // — there's no hook to intercept a click on before it
                  // writes, only a value to react to after it does.
                  const excisableValue = methods.watch('excisable');
                  const gstValue = methods.watch('gst');
                  useEffect(() => {
                    if (excisableValue) methods.setValue('gst', false, { shouldValidate: true });
                    // eslint-disable-next-line react-hooks/exhaustive-deps
                  }, [excisableValue]);
                  useEffect(() => {
                    if (gstValue) methods.setValue('excisable', false, { shouldValidate: true });
                    // eslint-disable-next-line react-hooks/exhaustive-deps
                  }, [gstValue]);

                  // Volume — the one live calculation on this form: length *
                  // width * height, recomputed whenever any of the three
                  // changes, on both Purchase and Sales tabs since they share
                  // the same three fields. Read-only on the field itself (see
                  // the Volume LabeledField below) so nobody's typed value is
                  // silently overwritten by a stale product's dimensions.
                  const lengthValue = Number(methods.watch('productLength')) || 0;
                  const widthValue = Number(methods.watch('width')) || 0;
                  const heightValue = Number(methods.watch('height')) || 0;
                  useEffect(() => {
                    const computed = lengthValue && widthValue && heightValue
                      ? Math.round(lengthValue * widthValue * heightValue * 1000000) / 1000000
                      : 0;
                    methods.setValue('volume', computed, { shouldValidate: true });
                    // eslint-disable-next-line react-hooks/exhaustive-deps
                  }, [lengthValue, widthValue, heightValue]);

                  return (
                    <>
                      {/* Persistent header — visible on every tab, matching the
                          reference template's "Item No / Description / Item
                          Group / UoM Group / Price List / Unit Price / Item
                          Listed In" band that sits above its tab strip. */}
                      <FormGrid columns={2} singleColumnOnMobile rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                        {/* Driven by the 'PRD' numbering series (Company Setup
                            > Document Numbering > Product): auto-fills and
                            locks when that series' Auto Generate switch is on,
                            or is left blank and typable when Manual Entry is
                            on instead — DocumentNoField peeks the series on
                            mount to pick which. This used to look like it
                            could never actually honour Manual Entry for a
                            master series; the real cause was a bug in the
                            Document Numbering admin routes that rejected every
                            save of a master series' toggle with "financial
                            year is required" (master series have none) — see
                            the fix in routes/company.js and
                            services/documentNumberService.js. Left untouched
                            on edit so an existing product's code is never
                            rewritten. */}
                        <LabeledField label="Item No *">
                          <DocumentNoField documentCode="PRD" name="productCode" label="" isCreate={!editingRow} placeholder="Enter item code" />
                        </LabeledField>
                        <LabeledField label="Description *">
                          <FormTextField name="productName" label="" placeholder="Enter product name" />
                        </LabeledField>

                        <LabeledField label="Foreign Name">
                          <FormTextField name="foreignName" label="" placeholder="Foreign name" />
                        </LabeledField>
                        <LabeledField label="Item Group *">
                          <FormSelect name="productGroup" label="" placeholder="Select group" options={productGroupOptions} />
                        </LabeledField>

                        <LabeledField label="UoM Group *">
                          <FormSelect name="uom" label="" placeholder="Select unit" options={uomOptions} />
                        </LabeledField>
                        <LabeledField label="Price List">
                          {/* Once a product has been saved with a Price List,
                              that choice is locked — even on Edit, not just
                              View — so it can't be switched later. Only a
                              product that has never had one set (editingRow
                              with an empty priceList, or a brand-new product
                              before its first save) can still pick one. */}
                          <FormSelect
                            name="priceList"
                            label=""
                            placeholder="Select price list"
                            options={priceListOptions}
                            disabled={!!editingRow?.priceList}
                          />
                        </LabeledField>

                        <LabeledField label="Unit Price">
                          <FormTextField name="unitPrice" label="" type="number" placeholder="0.00" />
                        </LabeledField>

                        <LabeledField label="Item Listed In *" align="center">
                          {/* useGetProductUsageQuery keeps returning the last
                              successful result even after the query is
                              skipped (editingRow cleared), so gate it on
                              editingRow here too — otherwise opening "Add
                              Product" right after editing another product
                              shows that product's stale locked/ticked flags. */}
                          <ProductUsageFlags usage={editingRow ? productUsage : null} />
                        </LabeledField>

                      </FormGrid>

                      {/* "Item Listed In" — which flows this product may be
                          used in. Sales/Purchase/Inventory drive real picker
                          behaviour elsewhere in the app (see
                          lib/productUsage.js) and can be locked by existing
                          usage. */}
                      <Divider sx={{ mt: 2, mb: 1.5 }} />


                      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mt: 2, mb: 2, borderBottom: 1, borderColor: 'divider' }}>
                        <Tab label="General" />
                        <Tab label="Purchase" />
                        <Tab label="Sales" />
                        {/* Where this product's stock sits, per warehouse. Only
                            meaningful once the product exists — its movements are
                            tracked against a product code that is issued on save — so
                            on create the tab is present but explains itself rather
                            than showing an empty grid. */}
                        <Tab label="Inventory" />
                      </Tabs>

                      {tab === 0 && (
                        <>
                          <FormGrid columns={2} singleColumnOnMobile rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                            <LabeledField label="Barcode">
                              <FormTextField name="barcode" label="" placeholder="Enter barcode" />
                            </LabeledField>
                            <LabeledField label="Product Sub-Group">
                              <FormSelect name="productSubGroup" label="" placeholder="Select sub-group" options={subGroupOptions} />
                            </LabeledField>

                            <LabeledField label="Brand & Manufacturer">
                              <FormSelect name="brand" label="" placeholder="Select brand" options={brandOptions} />
                            </LabeledField>
                            <LabeledField label="Product Type">
                              <FormSelect name="productType" label="" placeholder="Select type" options={PRODUCT_TYPE_OPTIONS} />
                            </LabeledField>

                            <LabeledField label="Additional Identifier">
                              <FormTextField name="additionalIdentifier" label="" placeholder="additional_identifier" />
                            </LabeledField>

                            <LabeledField label="Manage Item By *">
                              <FormSelect name="manageItemBy" label="" placeholder="Select option" options={MANAGE_ITEM_BY_OPTIONS} />
                            </LabeledField>
                            <LabeledField label="Shipping Type">
                              <FormSelect name="shippingType" label="" placeholder="Select shipping type" options={SHIPPING_TYPE_OPTIONS} />
                            </LabeledField>
                            <LabeledField label="Manage Method">
                              <FormSelect name="manageMethod" label="" placeholder="Select option" options={MANAGE_METHOD_OPTIONS} />
                            </LabeledField>

                            <LabeledField label="Remarks">
                              <FormTextField name="remarks" label="" placeholder="Enter remarks" multiline rows={1.5} />
                            </LabeledField>
                            <LabeledField label="Item Category *" align="center">
                              <Stack direction="row" spacing={3}>
                                <FormCheckbox name="excisable" label="Excisable" />
                                <FormCheckbox name="gst" label="GST" />
                              </Stack>
                            </LabeledField>
                          </FormGrid>

                          {/* Conditional Item Category detail fields — Chapter ID
                              only while Excisable is ticked; HSN and Tax Category
                              only while GST is ticked. Item Category itself sits in
                              the RIGHT column of the grid above (to the right of
                              Remarks), so each of these is placed as an empty
                              left-column spacer + a right-column field, row by row —
                              that's what actually stacks them straight under Item
                              Category instead of under Remarks on the left (a plain
                              2-column FormGrid always starts a fresh row at the left
                              column, which is what put HSN / Tax Category on the
                              wrong side before). */}
                          {(excisableValue || gstValue) && (
                            <Grid container rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                              {excisableValue && (
                                <>
                                  <Grid item xs={12} sm={6} md={6} />
                                  <Grid item xs={12} sm={6} md={6}>
                                    <LabeledField label="Chapter ID">
                                      <FormTextField name="chapterId" label="" placeholder="Enter chapter ID" />
                                    </LabeledField>
                                  </Grid>
                                </>
                              )}
                              {gstValue && (
                                <>
                                  <Grid item xs={12} sm={6} md={6} />
                                  <Grid item xs={12} sm={6} md={6}>
                                    {/* Sourced from HSN Master (Product Setup) rather than
                                        free text — see hsnOptions above. The stored value is
                                        still the plain hsnCode string, so productBaseSchema
                                        and the DB column are unchanged. */}
                                    <LabeledField label="HSN">
                                      <FormSelect name="hsnCode" label="" placeholder="Select HSN / SAC code" options={hsnOptions} />
                                    </LabeledField>
                                  </Grid>
                                  <Grid item xs={12} sm={6} md={6} />
                                  <Grid item xs={12} sm={6} md={6}>
                                    <LabeledField label="Tax Category">
                                      <FormSelect name="taxCategory" label="" placeholder="Select category" options={TAX_CATEGORY_OPTIONS} />
                                    </LabeledField>
                                  </Grid>
                                </>
                              )}
                            </Grid>
                          )}





                          {/* Item Category tax treatment — Excisable and GST
                              are mutually exclusive (see the excisableValue/
                              gstValue effects above): ticking one always
                              unchecks the other, so a product can never be
                              flagged both at once. Remarks now lives in the
                              main FormGrid above, to the left of Item
                              Category. */}
                        </>
                      )}

                      {tab === 1 && (
                        <FormGrid columns={2} singleColumnOnMobile rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                          <LabeledField label="Preferred Vendor">
                            <FormSelect name="defaultSupplier" label="" placeholder="Select supplier" options={supplierOptions} />
                          </LabeledField>
                          <LabeledField label="Mfr Catalog No.">
                            <FormTextField name="mfrCatalogNo" label="" placeholder="Catalog No" />
                          </LabeledField>

                          <LabeledField label="Purchasing UoM Name">
                            <FormSelect name="purchasingUomName" label="" placeholder="Select unit" options={uomOptions} />
                          </LabeledField>
                          <LabeledField label="Items per Purchase Unit">
                            <FormTextField name="itemsPerPurchaseUnit" label="" type="number" placeholder="Items per purchase unit" />
                          </LabeledField>

                          <LabeledField label="Packaging UoM Name">
                            <FormTextField name="purchasePackagingUomName" label="" placeholder="p_pakcaging_uom_name" />
                          </LabeledField>
                          <LabeledField label="Quantity per Package">
                            <FormTextField name="quantityPerPurchasePackage" label="" type="number" placeholder="Quantity per package" />
                          </LabeledField>

                          <LabeledField label="Customs Group">
                            <FormTextField name="customsGroup" label="" placeholder="Enter customs group" />
                          </LabeledField>
                          <LabeledField label="Tax Group">
                            <FormSelect name="taxGroup" label="" placeholder="Select tax group" options={taxGroupOptions} />
                          </LabeledField>

                          <LabeledField label="Cost Price (Purchase Price) *">
                            <FormTextField name="costPrice" label="" type="number" placeholder="0.00" />
                          </LabeledField>
                          <LabeledField label="Manage Item By *">
                            <FormSelect name="manageItemBy" label="" placeholder="Select option" options={MANAGE_ITEM_BY_OPTIONS} />
                          </LabeledField>

                          <LabeledField label="Valuation Method">
                            <FormSelect name="calculationMethod" label="" placeholder="Select method" options={CALCULATION_METHOD_OPTIONS} />
                          </LabeledField>
                          <LabeledField label="Set G/L Accounts By">
                            <FormSelect
                              name="glAccountsBy"
                              label=""
                              placeholder="Select level"
                              options={GL_ACCOUNTS_BY_OPTIONS}
                            />
                          </LabeledField>

                          <LabeledField label="Length">
                            <FormTextField name="productLength" label="" type="number" placeholder="p_length" />
                          </LabeledField>
                          <LabeledField label="Width">
                            <FormTextField name="width" label="" type="number" placeholder="p_width" />
                          </LabeledField>

                          <LabeledField label="Height">
                            <FormTextField name="height" label="" type="number" placeholder="p_height" />
                          </LabeledField>
                          {/* Read-only: computed as Length × Width × Height —
                              see the volume effect above, which recomputes it
                              live whenever any of the three changes. */}
                          <LabeledField label="Volume">
                            <FormTextField name="volume" label="" type="number" placeholder="Volume" disabled />
                          </LabeledField>

                          <LabeledField label="Weight">
                            <FormTextField name="weight" label="" type="number" placeholder="Weight" />
                          </LabeledField>
                        </FormGrid>
                      )}

                      {tab === 2 && (
                        <FormGrid columns={2} singleColumnOnMobile rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                          {/* Shared with the Purchase tab — same taxGroup
                              field and taxGroupOptions, see the Purchase
                              tab's Tax Group field above. */}
                          <LabeledField label="Tax Group">
                            <FormSelect name="taxGroup" label="" placeholder="Select tax group" options={taxGroupOptions} />
                          </LabeledField>
                          <LabeledField label="Sales UoM Name">
                            <FormSelect name="salesUom" label="" placeholder="Select sales unit" options={uomOptions} />
                          </LabeledField>

                          <LabeledField label="Items per Sales Unit">
                            <FormTextField name="itemsPerSalesUnit" label="" type="number" placeholder="Items per Sales Unit" />
                          </LabeledField>
                          <LabeledField label="Packaging UoM Name">
                            <FormTextField name="salesPackagingUomName" label="" placeholder="Packaging UoM Name" />
                          </LabeledField>

                          <LabeledField label="Quantity per Package">
                            <FormTextField name="quantityPerSalesPackage" label="" type="number" placeholder="Quantity per Package" />
                          </LabeledField>
                          <LabeledField label="Width">
                            <FormTextField name="width" label="" type="number" placeholder="Width" />
                          </LabeledField>
                          <LabeledField label="Height">
                            <FormTextField name="height" label="" type="number" placeholder="Height" />
                          </LabeledField>

                          {/* Shared with the Purchase tab — see the volume
                              effect above. */}
                          <LabeledField label="Volume">
                            <FormTextField name="volume" label="" type="number" placeholder="Volume" disabled />
                          </LabeledField>
                          <LabeledField label="Weight">
                            <FormTextField name="weight" label="" type="number" placeholder="Weight" />
                          </LabeledField>
                        </FormGrid>
                      )}

                      {tab === 3 && (
                        <>
                          <FormGrid columns={2} singleColumnOnMobile rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                            <LabeledField label="Set G/L Accounts By">
                              <FormSelect
                                name="glAccountsBy"
                                label=""
                                placeholder="Select level"
                                options={GL_ACCOUNTS_BY_OPTIONS}
                              />
                            </LabeledField>

                            <LabeledField label="UoM Name">
                              <FormSelect name="inventoryUomName" label="" placeholder="Select unit" options={uomOptions} />
                            </LabeledField>
                            <LabeledField label="Valuation Method">
                              <FormSelect name="calculationMethod" label="" placeholder="Select method" options={CALCULATION_METHOD_OPTIONS} />
                            </LabeledField>
                            <LabeledField label="Minimum">
                              <FormTextField name="minimumLevel" label="" type="number" placeholder="Minimum" />
                            </LabeledField>
                            <LabeledField label="Weight">
                              <FormTextField name="weight" label="" type="number" placeholder="Weight" />
                            </LabeledField>
                            <LabeledField label="Maximum">
                              <FormTextField name="maximumLevel" label="" type="number" placeholder="Maximum" />
                            </LabeledField>



                          </FormGrid>

                          {/* Per-warehouse stock — only meaningful once the
                              product exists, see the Tab label comment above. */}
                          <Divider sx={{ mt: 2, mb: 1.5 }} />
                          <ProductInventoryTab
                            productCode={editingRow?.productCode}
                            disabled={!editingRow}
                          />
                        </>
                      )}

                      <Divider sx={{ my: 3 }} />

                      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5}>
                        <FormCheckbox name="active" label="Active" />
                        <Stack direction="row" spacing={1.5}>
                          <Button variant="outlined" color="inherit" onClick={() => methods.reset(emptyValues)} disabled={creating || updating}>
                            Reset
                          </Button>
                          <FormSubmitButton disabled={creating || updating}>
                            {readOnly ? 'View' : editingRow ? 'Update Product' : 'Save Product'}
                          </FormSubmitButton>
                        </Stack>
                      </Stack>
                    </>
                  );
                }}
              </AppForm>
            </CardContent>
          </Card>
        </Box>
      </Collapse>

      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>Product List</Typography>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              <TableSearchFilter table={table} placeholder="Search products..." width={220} />
              <CanAdd>
                <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                  Add Product
                </Button>
              </CanAdd>
            </Stack>

            <TableFilterPanel table={table} />
          </Stack>

          {isMobile ? (
            <Box sx={{ px: 2, pb: 1 }}>
              {table.isLoading && <LoadingState label="Loading products…" />}
              {!table.isLoading && rows.map((row) => (
                <MobileRecordCard
                  key={row.id}
                  title={row.productName}
                  statusChip={<Chip size="small" label={row.status} color={row.status === 'Active' ? 'success' : 'default'} variant="outlined" />}
                  fields={[
                    { label: 'Item No', value: row.productCode },
                    { label: 'Item Group', value: row.productGroup || '—' },
                    { label: 'Stock', value: formatStock(row.currentStock) },
                  ]}
                  onView={() => handleView(row)}
                  onEdit={() => handleEdit(row)}
                  onDelete={() => handleDelete(row)}
                />
              ))}
              {!table.isLoading && rows.length === 0 && (
                <EmptyState
                  icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />}
                  title={table.isFiltering ? 'No matches' : 'No products yet'}
                  message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first product to get started'}
                  action={!table.isFiltering && (
                    <CanAdd>
                      <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add Product</Button>
                    </CanAdd>
                  )}
                />
              )}
            </Box>
          ) : (
            <ScrollableTableContainer>
              <Table
                size="small"
                stickyHeader
                sx={{
                  '& th, & td': {
                    height: PRODUCT_MASTER_LIST_TABLE_ROW_HEIGHT,
                    paddingTop: `${PRODUCT_MASTER_LIST_TABLE_CELL_PADDING_Y}px`,
                    paddingBottom: `${PRODUCT_MASTER_LIST_TABLE_CELL_PADDING_Y}px`,
                    boxSizing: 'border-box',
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell width={48}>#</TableCell>
                    <SortableHeaderCell field="productCode" sort={table.sort} onSort={table.toggleSort}>Item No</SortableHeaderCell>
                    <SortableHeaderCell field="productName" sort={table.sort} onSort={table.toggleSort}>Description</SortableHeaderCell>
                    <SortableHeaderCell field="productGroup" sort={table.sort} onSort={table.toggleSort}>Item Group</SortableHeaderCell>
                    <SortableHeaderCell field="currentStock" sort={table.sort} onSort={table.toggleSort}>Stock</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {table.isLoading && <TableSkeleton columns={7} rows={table.pageSize > 8 ? 8 : table.pageSize} />}
                  {!table.isLoading && rows.map((row, i) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{table.page * table.pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.productCode}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.productName}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.productGroup || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatStock(row.currentStock)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={row.status} color={row.status === 'Active' ? 'success' : 'default'} variant="outlined" />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <IconButton size="small" onClick={() => handleView(row)} aria-label="view" disabled={fetchingProduct}>
                            <VisibilityOutlinedIcon fontSize="small" />
                          </IconButton>
                          {canEdit && (
                                <IconButton size="small" color="primary" onClick={() => handleEdit(row)} aria-label="edit" disabled={fetchingProduct}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              )}
                              {canDelete && (
                                <IconButton size="small" color="error" onClick={() => handleDelete(row)} aria-label="delete">
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!table.isLoading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} sx={{ border: 'none' }}>
                        <EmptyState
                          icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />}
                          title={table.isFiltering ? 'No matches' : 'No products yet'}
                          message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first product to get started'}
                          action={!table.isFiltering && (
                            <CanAdd>
                              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add Product</Button>
                            </CanAdd>
                          )}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollableTableContainer>
          )}

          <EntityListPagination total={table.total} page={table.page} onChange={table.setPage} pageSize={table.pageSize} pageSizeOptions={[10, 25, 50, 100, 250]} onPageSizeChange={(v) => { table.setPageSize(v); table.setPage(0); }} />
        </CardContent>
      </Card>
    </Box>
  );
}
