import React, { useState } from 'react';
import { Box } from '@mui/material';

// Keeps a dense item-details table dense: the field sits at a small,
// compact width by default (its text ellipsis-truncated), and only grows —
// as a floating overlay above whatever sits next to it — while the pointer
// is over it, snapping back the instant the pointer leaves. The outer Box
// reserves the compact footprint permanently, so hovering never shifts the
// table's columns or rows; the inner Box is what actually grows, escaping
// its own footprint via position: absolute so it can overlap neighbors
// without disturbing layout.
//
// `children` is a render-prop — `(expanded) => <Field .../>` — so the
// wrapped field can switch to multiline/wrapping only while expanded,
// staying a clean single-line ellipsis while compact.
export default function HoverExpandCell({ width = 90, expandedWidth, height = 40, children }) {
  const [hovered, setHovered] = useState(false);
  const canExpand = (expandedWidth || width) > width;
  const active = hovered && canExpand;

  return (
    <Box
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{ position: 'relative', width, height }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: active ? expandedWidth : width,
          zIndex: active ? 20 : 1,
          transition: 'width 0.12s ease',
          borderRadius: 1,
          boxShadow: active ? 4 : 'none',
          backgroundColor: active ? 'background.paper' : 'transparent',
          '& .MuiAutocomplete-input, & .MuiInputBase-input': active ? {
            whiteSpace: 'normal',
            wordBreak: 'break-word',
          } : {
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          },
          '& .MuiOutlinedInput-root': active ? { alignItems: 'flex-start' } : undefined,
        }}
      >
        {typeof children === 'function' ? children(active) : children}
      </Box>
    </Box>
  );
}
