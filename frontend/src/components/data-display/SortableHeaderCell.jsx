import React from 'react';
import { TableCell, Box, Tooltip } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';

/**
 * Header cell with a tri-state sort control beside the column name:
 * normal order -> ascending -> descending -> normal order.
 *
 * The idle state shows a dimmed up/down icon so users can see the column is
 * sortable; MUI's TableSortLabel hides it until hover and has no third state,
 * which is why this is a custom cell.
 *
 * <SortableHeaderCell field="startDate" sort={sort} onSort={toggleSort}>Start Date</SortableHeaderCell>
 */
export default function SortableHeaderCell({
  field,
  sort,
  onSort,
  children,
  align = 'left',
  sortable = true,
  sx,
  ...rest
}) {
  const active = sortable && sort?.field === field;
  const direction = active ? sort.direction : null;

  if (!sortable) {
    return <TableCell align={align} sx={sx} {...rest}>{children}</TableCell>;
  }

  const label = direction === 'asc'
    ? 'Sorted ascending — click for descending'
    : direction === 'desc'
      ? 'Sorted descending — click to reset'
      : 'Click to sort ascending';

  const Icon = direction === 'asc' ? ArrowUpwardIcon : direction === 'desc' ? ArrowDownwardIcon : UnfoldMoreIcon;

  return (
    <TableCell
      align={align}
      sortDirection={direction || false}
      sx={{ whiteSpace: 'nowrap', ...sx }}
      {...rest}
    >
      <Tooltip title={label} enterDelay={600}>
        <Box
          component="span"
          role="button"
          tabIndex={0}
          aria-label={`${typeof children === 'string' ? children : field}: ${label}`}
          onClick={() => onSort(field)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSort(field); }
          }}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            cursor: 'pointer',
            userSelect: 'none',
            borderRadius: 1,
            // Header cells now sit on the theme's primary color (see
            // MuiTableHead in createAppTheme.js), so the active column can't
            // be picked out with primary.main text any more — it would land
            // on a same-color background and disappear. Weight + full icon
            // opacity carry that signal instead; color stays 'inherit' so it
            // always matches the header's own (already-contrasting) text.
            color: 'inherit',
            fontWeight: active ? 700 : 'inherit',
            '&:hover .sort-icon': { opacity: 1 },
            '&:focus-visible': { outline: '2px solid', outlineColor: 'currentColor', outlineOffset: 2 },
          }}
        >
          {children}
          <Icon
            className="sort-icon"
            fontSize="inherit"
            sx={{
              fontSize: 16,
              opacity: active ? 1 : 0.35,
              transition: 'opacity .15s ease',
            }}
          />
        </Box>
      </Tooltip>
    </TableCell>
  );
}
