import React from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableHead, TableRow,
  Stack, Alert, CircularProgress, Tooltip,
} from '@mui/material';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import EmptyState from '../../components/data-display/EmptyState';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import { useGetProductInventoryQuery } from '../../features/resources';

// Product Master > Inventory — one row per active warehouse, showing where this
// product's stock sits and what it is worth there.
//
// Every figure here is READ-ONLY and derived server-side from the stock
// movements and the open orders (see backend utils/productInventory.js).
// Nothing here is a stored quantity, which is what keeps it from ever
// disagreeing with the ledger it came from.
//
// Min/Max Inventory Level used to be the one editable exception (policy, not
// observation, saved per product+warehouse) — removed on request, DB column
// and all; see migration 20260823210000_drop_product_warehouse_levels.

// Row sizing/border for this table — separate constants so the height,
// border and each column's own width can all be tuned in one place without
// hunting through the JSX below:
//   - TABLE_ROW_HEIGHT       how tall every row (including the header) is —
//                             a floor, not a cap: MUI's own cell padding
//                             (see TABLE_CELL_PADDING_Y) can still push a row
//                             taller than this if it's set larger than that
//                             padding needs.
//   - TABLE_CELL_PADDING_Y   the actual top/bottom gap around each cell's
//                             value — this, not TABLE_ROW_HEIGHT, is what
//                             was making every row look tall, since a
//                             table-cell's padding adds on top of an
//                             explicit height rather than shrinking to fit it.
//   - COLUMN_WIDTHS          one width per column — see below
const TABLE_ROW_HEIGHT = 0;
const TABLE_CELL_PADDING_Y = 1;
// One entry per column, in table order, each independently adjustable.
// Passed as the `width` prop on that column's header TableCell — the same
// pattern already used elsewhere in this app (e.g. the "#" column on every
// list page) — so the browser's table layout takes it as a hint rather than
// a hard cap; a cell with wider content (a long warehouse code, a tooltip)
// can still grow past it.
const COLUMN_WIDTHS = {
  index: 48,
  warehouse: 50,
  onHand: 100,
  ordered: 100,
  committed: 100,
  available: 100,
  branch: 120,
  avgPrice: 110,
  fifoPrice: 110,
};

const num = (v) => (v == null ? '' : Number(v).toLocaleString('en-IN', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
}));
const qty = (v) => {
  if (v == null) return '';
  const n = Number(v);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

export default function ProductInventoryTab({ productCode, disabled }) {
  // skip on create: there is no product yet to have stock, and the request
  // would 404 on a code that has not been issued.
  const { data, isLoading, isFetching } = useGetProductInventoryQuery(productCode, {
    skip: !productCode || disabled,
  });

  if (disabled) {
    return (
      <Alert severity="info">
        Inventory is available once the product has been saved — its stock is tracked
        against the product code, which is issued on save.
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <Stack alignItems="center" sx={{ py: 4 }}><CircularProgress size={28} /></Stack>
    );
  }

  const rows = data?.rows || [];
  const totals = data?.totals;

  return (
    <Box>
      {/* Ordered and Committed are now attributed per warehouse, from the
          warehouse named on each open Purchase/Sales Order line — see
          backend utils/productInventory.js. An order line saved before that
          column existed has nothing to attribute to, so it counts in the
          Total row below but not on any single warehouse's row; this banner
          only needs to say something when that has actually happened. */}
      {totals?.unassignedOnHand ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="caption">
            <b>{qty(totals.unassignedOnHand)}</b> of the on-hand quantity is
            unassigned — opening stock and movements from documents that carry no
            warehouse — so the warehouse rows total less than the figure below.
          </Typography>
        </Alert>
      ) : null}

      <ScrollableTableContainer>
        <Table
          size="small"
          stickyHeader
          sx={{
            '& th, & td': {
              height: TABLE_ROW_HEIGHT,
              paddingTop: `${TABLE_CELL_PADDING_Y}px`,
              paddingBottom: `${TABLE_CELL_PADDING_Y}px`,
              boxSizing: 'border-box',
            },
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell width={COLUMN_WIDTHS.index}>#</TableCell>
              <TableCell width={COLUMN_WIDTHS.warehouse}>Warehouse</TableCell>
              <TableCell width={COLUMN_WIDTHS.onHand} align="right">On Hand</TableCell>
              <TableCell width={COLUMN_WIDTHS.ordered} align="right">Ordered</TableCell>
              <TableCell width={COLUMN_WIDTHS.committed} align="right">Committed</TableCell>
              <TableCell width={COLUMN_WIDTHS.available} align="right">Available</TableCell>
              <TableCell width={COLUMN_WIDTHS.branch}>Branch</TableCell>
              <TableCell width={COLUMN_WIDTHS.avgPrice} align="right">Avg Price</TableCell>
              <TableCell width={COLUMN_WIDTHS.fifoPrice} align="right">FIFO Price</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={r.warehouseCode} hover>
                <TableCell>{i + 1}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Tooltip title={r.warehouseName || ''} arrow>
                    <span>{r.warehouseCode}</span>
                  </Tooltip>
                </TableCell>
                <TableCell align="right">{qty(r.onHand) || '0'}</TableCell>
                <TableCell align="right">{qty(r.ordered) || '0'}</TableCell>
                <TableCell align="right">{qty(r.committed) || '0'}</TableCell>
                <TableCell align="right">{qty(r.available) || '0'}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.branch || '—'}</TableCell>
                <TableCell align="right">{num(r.averagePrice) || '0.00'}</TableCell>
                <TableCell align="right">{num(r.fifoPrice) || '0.00'}</TableCell>
              </TableRow>
            ))}

            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} sx={{ border: 'none' }}>
                  <EmptyState
                    icon={<WarehouseOutlinedIcon sx={{ fontSize: 48 }} />}
                    title="No active warehouses"
                    message="Add one under Company Setup > Warehouse Master"
                  />
                </TableCell>
              </TableRow>
            )}

            {/* The only row where Ordered, Committed and a true available-to-
                promise figure can honestly appear. Available here is SAP's
                definition: on hand, less what is already sold, plus what is
                already on its way in.

                Pinned to the bottom of the scrollable area (position: sticky,
                same mechanism ScrollableTableContainer already uses for the
                sticky header) rather than left in normal flow — with many
                warehouse rows the total used to scroll out of view along with
                everything else. Needs its own opaque background (the same
                one MUI gives the header) since sticky content still has rows
                scrolling underneath it. */}
            {totals && (
              <TableRow
                sx={{
                  '& td': {
                    fontWeight: 700,
                    borderTop: 2,
                    borderColor: 'divider',
                    position: 'sticky',
                    bottom: 0,
                    backgroundColor: 'background.paper',
                    zIndex: 2,
                  },
                }}
              >
                <TableCell />
                <TableCell>Total (all warehouses)</TableCell>
                <TableCell align="right">{qty(totals.onHand)}</TableCell>
                <TableCell align="right">{qty(totals.ordered)}</TableCell>
                <TableCell align="right">{qty(totals.committed)}</TableCell>
                <TableCell align="right">{qty(totals.available)}</TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollableTableContainer>

      {isFetching && (
        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
          <CircularProgress size={16} />
        </Stack>
      )}
    </Box>
  );
}
