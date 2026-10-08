import React from 'react';
import { Stack, TextField, InputAdornment, IconButton } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Close';
import TableFilterButton from './TableFilterButton';

/**
 * Drop-in replacement for a list page's search box: global search across every
 * column plus the all-column filter popover, in one control.
 *
 * It is deliberately layout-neutral so it can sit inside a page's existing
 * toolbar without disturbing the title or the page's own action buttons.
 *
 * <TableSearchFilter table={table} placeholder="Search brands..." width={220} />
 */
export default function TableSearchFilter({
  table,
  placeholder = 'Search...',
  width = 220,
  showFilter = true,
  sx,
}) {
  const {
    search, setSearch, filterColumns, activeFilterCount, filterPanelOpen, toggleFilterPanel,
  } = table;

  return (
    <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap sx={sx}>
      <TextField
        size="small"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={placeholder}
        sx={{ minWidth: width }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
          ),
          endAdornment: search ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setSearch('')} aria-label="clear search">
                <ClearIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : null,
        }}
      />
      {showFilter && (
        <TableFilterButton
          filterColumns={filterColumns}
          activeFilterCount={activeFilterCount}
          filterPanelOpen={filterPanelOpen}
          toggleFilterPanel={toggleFilterPanel}
          // Labelled "Filter", not "Columns": "Columns" reads like a
          // show/hide-columns control, which is why the per-column filters on
          // these lists went unnoticed.
          label="Filter"
        />
      )}
    </Stack>
  );
}
