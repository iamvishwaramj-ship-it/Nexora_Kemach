import React from 'react';
import { TableContainer } from '@mui/material';
import useDragScroll from './useDragScroll';

// Shared with the item-details grids (PurchaseOrder, SalesInvoice, GRN, etc.),
// which build their own TableContainer instead of this wrapper because they
// need overflowX-only scrolling and no fixed height. Those tables are
// essentially all editable cells (FormTextField/FormSelect), which — being
// real <input>/<select> elements — are deliberately excluded from starting a
// click-and-drag pan (see useDragScroll's INTERACTIVE list), so the only
// pixels of most rows a pointer can grab from are the thin cell-padding
// gaps. A visible, generously-sized scrollbar thumb is the reliable fallback
// for those tables: dragging it is native browser behavior, needs no JS, and
// always works regardless of how much of the row is covered by inputs.
// Firefox has no ::-webkit-scrollbar pseudo-elements, hence the
// scrollbarWidth/scrollbarColor pair alongside it.
export const dragScrollbarSx = {
  scrollbarWidth: 'auto',
  scrollbarColor: (theme) => `${theme.palette.action.disabled} transparent`,
  '&::-webkit-scrollbar': { width: 12, height: 12 },
  '&::-webkit-scrollbar-thumb': {
    borderRadius: 8,
    backgroundColor: 'action.disabled',
    border: '3px solid transparent',
    backgroundClip: 'padding-box',
  },
  '&::-webkit-scrollbar-thumb:hover': { backgroundColor: 'action.active' },
};

/**
 * TableContainer that keeps scrolling *inside* the table instead of growing
 * the page: rows scroll within a viewport capped at `maxHeight`, the header
 * row stays pinned once that cap is reached, and click-and-drag panning
 * works in both axes.
 *
 * This used to set a fixed `height` instead of a `maxHeight`, which forced
 * every table — even a 2-row list — to reserve the full viewport-relative
 * height, leaving a card full of dead space below the last row and above
 * the pagination controls. `maxHeight` lets the card shrink to fit a short
 * list while still capping a long one at the same viewport-relative ceiling
 * so it scrolls internally instead of pushing the page taller than the
 * window.
 *
 * Usage:
 *   <ScrollableTableContainer>
 *     <Table size="small" stickyHeader>...</Table>
 *   </ScrollableTableContainer>
 */
export default function ScrollableTableContainer({
  children,
  maxHeight = 'clamp(240px, calc(100vh - 340px), 560px)',
  sx,
  ...rest
}) {
  const scrollRef = useDragScroll();

  return (
    <TableContainer
      ref={scrollRef}
      sx={{
        maxHeight,
        overflow: 'auto',
        cursor: 'grab',
        overscrollBehavior: 'contain', // don't hand the scroll off to the page at the ends
        // Sticky header needs an opaque background or rows show through as
        // they scroll under it. primary.main (not background.paper) so the
        // pinned header keeps the same themed fill as every other table
        // header (see MuiTableHead in createAppTheme.js) instead of going
        // back to a plain card-colored bar the moment a table scrolls.
        '& thead th': {
          backgroundColor: 'primary.main',
          backgroundImage: 'none',
          zIndex: 3,
        },
        ...dragScrollbarSx,
        ...sx,
      }}
      {...rest}
    >
      {children}
    </TableContainer>
  );
}
