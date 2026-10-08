import React, { useMemo } from 'react';
import {
  Card, CardContent, Typography, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, Link, Box,
} from '@mui/material';
import MobileRecordCard from '../../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../../components/data-display/useIsMobileListView';
import useTableFeatures from '../../../components/data-display/useTableFeatures';
import SortableHeaderCell from '../../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';

const currency = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const TYPE_COLOR = {
  'Sales Invoice': 'success.main',
  'Receipt': 'success.main',
  'Purchase Invoice': 'error.main',
  'Payment': 'warning.main',
};

const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export default function RecentTransactionsCard({ rows = [], onViewAll }) {
  // Sorting only — a compact dashboard card, so no search/filter chrome.
  const columns = useMemo(() => ([
    { field: 'type', headerName: 'Type' },
    { field: 'refNo', headerName: 'Number' },
    { field: 'party', headerName: 'Party' },
    { field: 'date', headerName: 'Date', sortValue: (r) => (r.date ? new Date(r.date).getTime() : null) },
    { field: 'amount', headerName: 'Amount', sortValue: (r) => Number(r.amount) || 0 },
  ]), []);
  const table = useTableFeatures(rows, columns);

  const isMobile = useIsMobileListView();

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="subtitle1" fontWeight={700}>Recent Transactions</Typography>
        </Stack>

        {isMobile ? (
          <Box>
            {rows.map((r) => (
              <MobileRecordCard
                key={`${r.type}-${r.refNo}`}
                title={r.refNo || '—'}
                statusChip={(
                  <Typography variant="caption" fontWeight={700} sx={{ color: TYPE_COLOR[r.type] || 'text.primary' }}>
                    {r.type}
                  </Typography>
                )}
                fields={[
                  { label: 'Party', value: r.party || '—' },
                  { label: 'Date', value: formatDate(r.date) },
                  { label: 'Amount', value: currency(r.amount) },
                ]}
              />
            ))}
            {rows.length === 0 && (
              <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>No transactions yet</Typography>
            )}
          </Box>
        ) : (
          <ScrollableTableContainer maxHeight="min(50vh, 320px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <SortableHeaderCell field="type" sort={table.sort} onSort={table.toggleSort}>Type</SortableHeaderCell>
                  <SortableHeaderCell field="refNo" sort={table.sort} onSort={table.toggleSort}>Number</SortableHeaderCell>
                  <SortableHeaderCell field="party" sort={table.sort} onSort={table.toggleSort}>Party</SortableHeaderCell>
                  <SortableHeaderCell field="date" sort={table.sort} onSort={table.toggleSort}>Date</SortableHeaderCell>
                  <SortableHeaderCell field="amount" sort={table.sort} onSort={table.toggleSort} align="right">Amount</SortableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {table.rows.map((r) => (
                  <TableRow key={`${r.type}-${r.refNo}`} hover>
                    <TableCell sx={{ color: TYPE_COLOR[r.type] || 'text.primary', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {r.type}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.refNo || '—'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.party || '—'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(r.date)}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(r.amount)}</TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>No transactions yet</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollableTableContainer>
        )}

        <Box sx={{ textAlign: 'center', mt: 1.5 }}>
          <Link component="button" underline="hover" variant="body2" fontWeight={600} onClick={onViewAll}>
            View All Transactions
          </Link>
        </Box>
      </CardContent>
    </Card>
  );
}
