import React, { useMemo } from 'react';
import {
  Card, CardContent, Typography, Stack, Box, Table, TableBody, TableCell,
  TableHead, TableRow, Chip, Link,
} from '@mui/material';
import MobileRecordCard from '../../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../../components/data-display/useIsMobileListView';
import useTableFeatures from '../../../components/data-display/useTableFeatures';
import SortableHeaderCell from '../../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';

export default function InventoryStockAlertCard({ rows = [], onViewAll }) {
  // Sorting only — this is a compact dashboard card, so a search box and
  // filter popover would be more chrome than the handful of rows warrants.
  const columns = useMemo(() => ([
    { field: 'name', headerName: 'Product' },
    { field: 'currentStock', headerName: 'Current Stock', sortValue: (r) => Number(r.currentStock) || 0 },
    { field: 'status', headerName: 'Status' },
  ]), []);
  const table = useTableFeatures(rows, columns);

  const isMobile = useIsMobileListView();

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="subtitle1" fontWeight={700}>Inventory Stock Alert</Typography>
          <Link component="button" underline="hover" variant="body2" fontWeight={600} onClick={onViewAll}>
            View All
          </Link>
        </Stack>

        {isMobile ? (
          <Box>
            {rows.map((r) => (
              <MobileRecordCard
                key={r.name}
                title={r.name}
                statusChip={<Chip size="small" label={r.status} color={r.status === 'Low Stock' ? 'error' : 'success'} variant="outlined" />}
                fields={[{ label: 'Current Stock', value: `${r.currentStock} pcs` }]}
              />
            ))}
            {rows.length === 0 && (
              <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>No stock alerts</Typography>
            )}
          </Box>
        ) : (
          <ScrollableTableContainer maxHeight="min(50vh, 320px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <SortableHeaderCell field="name" sort={table.sort} onSort={table.toggleSort}>Product</SortableHeaderCell>
                  <SortableHeaderCell field="currentStock" sort={table.sort} onSort={table.toggleSort}>Current Stock</SortableHeaderCell>
                  <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort} align="right">Status</SortableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {table.rows.map((r) => (
                  <TableRow key={r.name} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.name}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.currentStock} pcs</TableCell>
                    <TableCell align="right">
                      <Chip
                        size="small"
                        label={r.status}
                        color={r.status === 'Low Stock' ? 'error' : 'success'}
                        variant="outlined"
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>No stock alerts</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollableTableContainer>
        )}
      </CardContent>
    </Card>
  );
}
