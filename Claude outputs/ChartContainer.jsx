import { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';

/**
 * Wraps a recharts <ResponsiveContainer> so it only mounts once its parent
 * box has actually been measured with a non-zero size.
 *
 * Rendering <ResponsiveContainer> immediately on mount can momentarily hit a
 * 0x0 parent (before the surrounding Grid/Card layout has settled), which
 * makes recharts log "The width(0) and height(0) of chart should be greater
 * than 0..." to the console. Deferring the chart's mount to the first
 * measured non-zero size avoids that warning without changing what's shown
 * to the user (the delay is a single frame).
 */
export default function ChartContainer({ sx, children }) {
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const checkSize = () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        setReady(true);
      }
    };

    checkSize();

    if (typeof ResizeObserver === 'undefined') {
      // No ResizeObserver support: fall back to rendering immediately.
      setReady(true);
      return undefined;
    }

    const observer = new ResizeObserver(checkSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Box ref={containerRef} sx={sx}>
      {ready ? children : null}
    </Box>
  );
}
