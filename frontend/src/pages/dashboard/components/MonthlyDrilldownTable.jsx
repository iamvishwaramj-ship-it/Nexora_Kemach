import React, { useMemo } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableRow, Typography, Stack, Box,
} from '@mui/material';
import dayjs from 'dayjs';
import useTableFeatures from '../../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';
import EmptyState from '../../../components/data-display/EmptyState';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';

const currency = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

// Shared body for the Sales/Purchase Overview drill-down popups -- both are
// "here's the real invoices behind this bar/point", just against a
// different resource and party field (customer vs supplier).
export default function MonthlyDrilldownTable({ rows, partyLabel, exactTotal }) {
  const columns = useMemo(() => ([
    { field: 'no', headerName: 'Invoice No.', filter: 'text' },
    { field: 'party', headerName: partyLabel, filter: 'text' },
    { field: 'date', headerName: 'Date', filter: 'dateRange', sortValue: (r) => (r.date ? new Date(r.date).getTime() : null), searchValue: (r) => (r.date ? dayjs(r.date).format('DD/MM/YYYY') : '') },
    { field: 'amount', headerName: 'Amount', filter: 'numberRange', sortValue: (r) => Number(r.amount) || 0 },
  ]), [partyLabel]);
  const table = useTableFeatures(rows, columns);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} sx={{ mb: 1.5 }}>
        <Typography variant="body2" color="text.secondary">
          {table.rows.length}{table.isFiltering ? ` of ${rows.length}` : ''} invoice{table.rows.length === 1 ? '' : 's'}
        </Typography>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <TableSearchFilter table={table} placeholder="Search invoices..." width={200} />
          <Typography variant="subtitle2" fontWeight={700}>{currency(exactTotal)}</Typography>
        </Stack>
      </Stack>

      {rows.length === 0 ? (
        <EmptyState
          icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />}
          title="No invoices in this period"
        />
      ) : (
        <ScrollableTableContainer maxHeight="min(50vh, 340px)">
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <SortableHeaderCell field="no" sort={table.sort} onSort={table.toggleSort}>Invoice No.</SortableHeaderCell>
                <SortableHeaderCell field="party" sort={table.sort} onSort={table.toggleSort}>{partyLabel}</SortableHeaderCell>
                <SortableHeaderCell field="date" sort={table.sort} onSort={table.toggleSort}>Date</SortableHeaderCell>
                <SortableHeaderCell field="amount" sort={table.sort} onSort={table.toggleSort} align="right">Amount</SortableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {table.rows.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.no}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.party || '—'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.date ? dayjs(r.date).format('DD/MM/YYYY') : '—'}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(r.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollableTableContainer>
      )}
    </Box>
  );
}
