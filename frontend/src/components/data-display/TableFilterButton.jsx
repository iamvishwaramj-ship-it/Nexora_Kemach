import React from 'react';
import { Badge, Button } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';

/**
 * The toolbar's Filter button. It only toggles — the inputs themselves live in
 * <TableFilterPanel />, rendered inline between the toolbar and the table.
 *
 * The two are deliberately split. The panel has to appear above the table, but
 * the button belongs in the toolbar beside the search box, and the two sit in
 * different parts of each page's markup. Keeping the open/closed state in
 * useTableFeatures lets both read it without either owning the other.
 *
 * Rendered by TableSearchFilter / TableToolbar — pages don't use it directly.
 */
export default function TableFilterButton({
  filterColumns = [],
  activeFilterCount = 0,
  filterPanelOpen = false,
  toggleFilterPanel,
  size = 'small',
  label = 'Filter',
}) {
  // Nothing to filter by means no button — a table whose columns declare no
  // `filter` would otherwise offer an empty panel.
  if (!filterColumns.length) return null;

  const highlight = activeFilterCount > 0 || filterPanelOpen;

  return (
    <Badge badgeContent={activeFilterCount} color="primary">
      <Button
        size={size}
        variant={highlight ? 'contained' : 'outlined'}
        color={highlight ? 'primary' : 'inherit'}
        startIcon={<FilterListIcon />}
        onClick={toggleFilterPanel}
        aria-expanded={filterPanelOpen}
        sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
      >
        {label}
      </Button>
    </Badge>
  );
}
