import { useCallback, useState } from 'react';

// Powers "hover to see the full value" columns like Product Code / Product
// Name in item-detail tables. HTML table columns share one width across
// every row, so this widens the WHOLE column (every row's cell in it) when
// any one row is hovered, instead of floating an overlay above neighboring
// cells — an overlay can only ever sit on top of whatever's next to it,
// hiding it, and escapes the row's own height, bleeding into the row
// below. Widening the real column instead makes the table reflow like any
// other resize: neighboring cells and rows genuinely make room, nothing is
// covered up top or bottom. Snaps back to the compact default the instant
// the pointer leaves.
export function useHoverColumnWidth(baseWidth) {
  const [hover, setHover] = useState(null); // { index, width } | null
  const width = hover ? hover.width : baseWidth;

  const handlersFor = useCallback((index, rowWidth) => ({
    onMouseEnter: () => setHover({ index, width: rowWidth }),
    onMouseLeave: () => setHover((h) => (h && h.index === index ? null : h)),
  }), []);

  const isHovered = useCallback((index) => hover?.index === index, [hover]);

  return { width, handlersFor, isHovered };
}
