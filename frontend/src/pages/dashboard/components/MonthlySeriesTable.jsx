import React, { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import useTableFeatures from '../../../components/data-display/useTableFeatures';
import SortableHeaderCell from '../../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';

const currency = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

// Full-series table for the "whole card clicked" popup -- every bucket in
// the chart (not just the one the user clicked), with both the rounded
// chart-axis value (Lakhs) and the exact rupee total behind it.
// Sorting only: this lives in a drilldown dialog where a search box would be
// noise, but re-ordering by amount is genuinely useful.
export default function MonthlySeriesTable({ rows }) {
  const columns = useMemo(() => ([
    { field: 'name', headerName: 'Month', sortValue: (r) => new Date(r.year, monthIndex(r.name), 1).getTime() },
    { field: 'value', headerName: 'Chart Value (₹L)', sortValue: (r) => Number(r.value) || 0 },
    { field: 'rawValue', headerName: 'Exact Amount', sortValue: (r) => Number(r.rawValue) || 0 },
  ]), []);
  const table = useTableFeatures(rows, columns);

  return (
    <ScrollableTableContainer maxHeight="min(60vh, 420px)">
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <SortableHeaderCell field="name" sort={table.sort} onSort={table.toggleSort}>Month</SortableHeaderCell>
            <SortableHeaderCell field="value" sort={table.sort} onSort={table.toggleSort} align="right">Chart Value (₹L)</SortableHeaderCell>
            <SortableHeaderCell field="rawValue" sort={table.sort} onSort={table.toggleSort} align="right">Exact Amount</SortableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {table.rows.map((r) => (
            <TableRow key={`${r.year}-${r.month}`} hover>
              <TableCell>{r.name} {r.year}</TableCell>
              <TableCell align="right">₹{r.value}L</TableCell>
              <TableCell align="right">{currency(r.rawValue)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollableTableContainer>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthIndex = (name) => {
  const i = MONTHS.indexOf(String(name).slice(0, 3));
  return i < 0 ? 0 : i;
};
