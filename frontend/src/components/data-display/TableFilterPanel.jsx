import React from 'react';
import {
  Box, Grid, Stack, Typography, TextField, Button, MenuItem, Chip, Collapse, Divider, Autocomplete,
} from '@mui/material';
import { noSpinnersSx } from '../form/FormTextField';

/**
 * The inline row of per-column filter inputs that sits between a list's
 * toolbar and its table. Toggled by the toolbar's Filter button — both read
 * `filterPanelOpen` off the same useTableFeatures instance, which is why that
 * state lives in the hook rather than in either component.
 *
 * It replaced a popover. A popover had to be small enough to float, so a table
 * with a dozen filterable columns turned into a narrow scrolling list that hid
 * the very rows it was filtering. Inline, the inputs get the full width of the
 * card, sit directly above the data they act on, and stay visible while the
 * user reads the result.
 *
 * <TableFilterPanel table={table} />
 *
 * `embedded` is for the transaction lists, which already own an inline filter
 * panel of their own (Customer, Status, Date Range...) behind their own Filter
 * button. Rather than leave those pages with two Filter buttons, the column
 * filters are dropped into that existing panel and the shared button is turned
 * off. Embedded means: no Collapse and no outer padding — the host panel is
 * already providing both — just the divider, heading and grid.
 */
export default function TableFilterPanel({ table, columns = 4, embedded = false, open }) {
  if (!table) return null;
  const {
    filterColumns = [], filters = {}, setFilter, clearFilters,
    activeFilterCount = 0, filterPanelOpen = false,
  } = table;

  if (!filterColumns.length) return null;
  const isOpen = open === undefined ? filterPanelOpen : open;

  const control = (col) => {
    const value = filters[col.field];

    // Single-pick searchable dropdown over {label, value} options (e.g. the
    // chart-of-accounts list). Enabled per column with filterInput:
    // 'autocomplete'; the stored filter value is the option's `value`, which
    // the 'select' matching in useTableFeatures compares against the row.
    if (col.filter === 'select' && col.filterInput === 'autocomplete') {
      const opts = col.filterOptions || [];
      const current = opts.find((o) => o.value === value) || null;
      return (
        <Autocomplete
          size="small"
          fullWidth
          options={opts}
          value={current}
          onChange={(_, opt) => setFilter(col.field, opt ? opt.value : '')}
          getOptionLabel={(o) => o?.label ?? ''}
          isOptionEqualToValue={(o, v) => o.value === v.value}
          noOptionsText="No matching accounts"
          renderInput={(params) => (
            <TextField
              {...params}
              label={col.headerName}
              placeholder="All"
              InputLabelProps={{ ...params.InputLabelProps, shrink: true }}
            />
          )}
        />
      );
    }

    if (col.filter === 'select') {
      const selected = Array.isArray(value) ? value : value ? [value] : [];
      return (
        <TextField
          select
          size="small"
          fullWidth
          label={col.headerName}
          value={selected}
          onChange={(e) => setFilter(col.field, e.target.value)}
          InputLabelProps={{ shrink: true }}
          SelectProps={{
            multiple: true,
            displayEmpty: true,
            renderValue: (vals) => (vals.length ? (
              <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                {vals.map((v) => <Chip key={v} size="small" label={v} />)}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.disabled">All</Typography>
            )),
          }}
        >
          {(col.filterOptions || []).map((opt) => (
            <MenuItem key={opt} value={opt}>{opt}</MenuItem>
          ))}
        </TextField>
      );
    }

    if (col.filter === 'dateRange') {
      const v = value || { from: '', to: '' };
      return (
        <Stack direction="row" spacing={1}>
          <TextField
            size="small" type="date" fullWidth label={`${col.headerName} from`}
            InputLabelProps={{ shrink: true }}
            value={v.from || ''}
            onChange={(e) => setFilter(col.field, { ...v, from: e.target.value })}
          />
          <TextField
            size="small" type="date" fullWidth label="to"
            InputLabelProps={{ shrink: true }}
            value={v.to || ''}
            onChange={(e) => setFilter(col.field, { ...v, to: e.target.value })}
          />
        </Stack>
      );
    }

    if (col.filter === 'numberRange') {
      const v = value || { min: '', max: '' };
      return (
        <Stack direction="row" spacing={1}>
          <TextField
            size="small" type="number" fullWidth label={`${col.headerName} min`} sx={noSpinnersSx}
            InputLabelProps={{ shrink: true }}
            value={v.min ?? ''}
            onChange={(e) => setFilter(col.field, { ...v, min: e.target.value })}
          />
          <TextField
            size="small" type="number" fullWidth label="max" sx={noSpinnersSx}
            InputLabelProps={{ shrink: true }}
            value={v.max ?? ''}
            onChange={(e) => setFilter(col.field, { ...v, max: e.target.value })}
          />
        </Stack>
      );
    }

    // 'text' — the default
    return (
      <TextField
        size="small"
        fullWidth
        label={col.headerName}
        placeholder={`Filter by ${String(col.headerName).toLowerCase()}`}
        InputLabelProps={{ shrink: true }}
        value={value || ''}
        onChange={(e) => setFilter(col.field, e.target.value)}
      />
    );
  };

  const body = (
    <>
      <Divider sx={{ mb: 2 }} />
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          Filter by column
        </Typography>
        <Button size="small" color="inherit" onClick={clearFilters} disabled={activeFilterCount === 0}>
          Clear all
        </Button>
      </Stack>
      <Grid container spacing={{ xs: 1, sm: 2 }}>
        {filterColumns.map((col) => (
          // Range filters carry two inputs, so they take a double slot rather
          // than being squeezed into the same width as a single text box.
          <Grid
            item
            key={col.field}
            xs={12}
            sm={6}
            md={col.filter === 'dateRange' || col.filter === 'numberRange' ? 24 / columns : 12 / columns}
          >
            {control(col)}
          </Grid>
        ))}
      </Grid>
    </>
  );

  if (embedded) {
    return isOpen ? <Box sx={{ mt: 2 }}>{body}</Box> : null;
  }

  return (
    // unmountOnExit: a closed panel keeps no inputs mounted, so a long column
    // list costs nothing while it is hidden.
    <Collapse in={isOpen} unmountOnExit>
      <Box sx={{ px: { xs: 2, sm: 3 }, pb: 2 }}>{body}</Box>
    </Collapse>
  );
}
