import React from 'react';
import { TableRow, TableCell, Skeleton } from '@mui/material';

export default function TableSkeleton({ columns = 5, rows = 5 }) {
  return Array.from({ length: rows }).map((_, r) => (
    <TableRow key={r}>
      {Array.from({ length: columns }).map((__, c) => (
        <TableCell key={c}>
          <Skeleton variant="text" />
        </TableCell>
      ))}
    </TableRow>
  ));
}
