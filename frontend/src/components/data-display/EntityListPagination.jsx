import React from 'react';
import { Stack, Typography, Button, IconButton, Select, MenuItem } from '@mui/material';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import LastPageIcon from '@mui/icons-material/LastPage';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

function range(start, end) {
  const length = end - start + 1;
  return Array.from({ length }, (_, i) => start + i);
}

// Truncated page list ("1 2 3 4 5 … 50", "1 … 24 25 26 … 50", "1 … 46 47 48
// 49 50") instead of one button per page. Below ~500 rows at the smallest
// page size this used to render 50 page-number buttons in a row with no
// wrapping/overflow control — on a real dataset (Opening Balance's 2000+
// current-stock rows is exactly this case) that spilled the button row well
// past the card's right edge instead of stopping at a sane width.
// `current`/`total` are 1-indexed; returns an array of page numbers and the
// string 'dots' for a collapsed run.
function paginationRange(current, total, siblingCount = 1) {
  const totalPageNumbers = siblingCount * 2 + 5; // first + last + current + 2*siblings + 2*dots
  if (totalPageNumbers >= total) return range(1, total);

  const leftSiblingIndex = Math.max(current - siblingCount, 1);
  const rightSiblingIndex = Math.min(current + siblingCount, total);

  const shouldShowLeftDots = leftSiblingIndex > 2;
  const shouldShowRightDots = rightSiblingIndex < total - 2;

  if (!shouldShowLeftDots && shouldShowRightDots) {
    const leftItemCount = 3 + 2 * siblingCount;
    return [...range(1, leftItemCount), 'dots', total];
  }
  if (shouldShowLeftDots && !shouldShowRightDots) {
    const rightItemCount = 3 + 2 * siblingCount;
    return [1, 'dots', ...range(total - rightItemCount + 1, total)];
  }
  return [1, 'dots', ...range(leftSiblingIndex, rightSiblingIndex), 'dots', total];
}

// Stands in for "every row" as a page size. A real Infinity (or the -1 MUI's
// own TablePagination uses) would need every call site that does
// `rows.slice(page * pageSize, page * pageSize + pageSize)` to special-case
// it — this way that arithmetic just keeps working: page is always 0 once
// everything fits on one page, and slice(0, 100000) on a shorter array
// simply returns the whole thing.
export const ALL_ROWS = 100000;

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100, ALL_ROWS];

// "Showing X to Y of Z entries" pagination bar used under bespoke list
// tables (Branch List, Financial Year List, ...). For pages that use the
// generic DataTable component, its own TablePagination is used instead —
// this is specifically for the numbered-row, custom-table page template.
//
// `pageSize`/`onPageSizeChange` are optional — a caller that doesn't pass
// `onPageSizeChange` gets the old fixed-page-size bar with no selector,
// which existed for a while as a page-size-per-page constant with no way
// for the person actually looking at the list to change it.
export default function EntityListPagination({
  total, page, onChange, pageSize = 10, onPageSizeChange, pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);

  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5, flexWrap: 'wrap', gap: 1 }}>
      <Typography variant="body2" color="text.secondary">
        Showing {from} to {to} of {total} entries
      </Typography>
      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
        {onPageSizeChange && (
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              Rows per page:
            </Typography>
            <Select
              size="small"
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
              }}
              renderValue={(v) => (v === ALL_ROWS ? 'All' : v)}
              sx={{ minWidth: 84, borderRadius: 1.5 }}
            >
              {pageSizeOptions.map((size) => (
                <MenuItem key={size} value={size}>{size === ALL_ROWS ? 'All' : size}</MenuItem>
              ))}
            </Select>
          </Stack>
        )}
        <Stack direction="row" spacing={0.5} alignItems="center">
          <IconButton size="small" disabled={page === 0} onClick={() => onChange(0)}><FirstPageIcon fontSize="small" /></IconButton>
          <IconButton size="small" disabled={page === 0} onClick={() => onChange(page - 1)}><ChevronLeftIcon fontSize="small" /></IconButton>
          {paginationRange(page + 1, pageCount).map((item, idx) => (
            item === 'dots' ? (
              <Typography key={`dots-${idx}`} variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
                &hellip;
              </Typography>
            ) : (
              <Button
                key={item}
                size="small"
                variant={item - 1 === page ? 'contained' : 'text'}
                color={item - 1 === page ? 'primary' : 'inherit'}
                onClick={() => onChange(item - 1)}
                sx={{ minWidth: 32, px: 0 }}
              >
                {item}
              </Button>
            )
          ))}
          <IconButton size="small" disabled={page >= pageCount - 1} onClick={() => onChange(page + 1)}><ChevronRightIcon fontSize="small" /></IconButton>
          <IconButton size="small" disabled={page >= pageCount - 1} onClick={() => onChange(pageCount - 1)}><LastPageIcon fontSize="small" /></IconButton>
        </Stack>
      </Stack>
    </Stack>
  );
}
