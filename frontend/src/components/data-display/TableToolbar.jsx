import React from 'react';
import { Stack, Typography } from '@mui/material';
import TableSearchFilter from './TableSearchFilter';

/**
 * Toolbar for the bespoke list tables: title + global search box + a Filter
 * button that opens a popover of per-column filters.
 *
 * Drive it with the values returned by useTableFeatures:
 * <TableToolbar title="Financial Year List" {...table} searchPlaceholder="Search..." />
 */
export default function TableToolbar({
  title,
  table,
  searchPlaceholder = 'Search...',
  resultCount,
  totalCount,
  rightContent,
  showFilter = true,
}) {
  const showCount = table.isFiltering && resultCount != null;

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      flexWrap="wrap"
      gap={1.5}
      sx={{ px: 3, pt: 2.5, pb: 1.5 }}
    >
      <Stack direction="row" alignItems="baseline" spacing={1}>
        {title && <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>}
        {showCount && (
          <Typography variant="caption" color="text.secondary">
            {resultCount} of {totalCount} shown
          </Typography>
        )}
      </Stack>

      <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
        <TableSearchFilter table={table} placeholder={searchPlaceholder} width={240} showFilter={showFilter} />
        {rightContent}
      </Stack>
    </Stack>
  );
}
