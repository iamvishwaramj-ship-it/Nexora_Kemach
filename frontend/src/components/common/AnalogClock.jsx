import React, { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';

// The sweeping hand's colour. One constant — change it here and the hand and
// the centre pin follow. Deliberately a fixed orange rather than a palette
// token so the clock reads the same against the light and dark themes.
const SWEEP_COLOR = '#FF5A1F';

// Geometry is expressed against a 100x100 viewBox, so the whole clock scales
// from the single `size` prop with no other numbers to keep in sync.
const C = 50;

/**
 * AnalogClock — a wall clock with a continuously sweeping second hand.
 *
 * The hand does NOT tick once per second. It is driven from the current time
 * *including milliseconds*, so it glides the way a real sweep movement does.
 *
 * Two things make that cheap enough to leave running in the sidebar forever:
 *
 *  1. requestAnimationFrame, not setInterval. rAF is aligned to the browser's
 *     paint, so the motion never stutters against the refresh rate, and the
 *     browser suspends it entirely while the tab is in the background —
 *     an interval would keep firing there for a clock nobody is looking at.
 *
 *  2. No React state. Ticking state 60 times a second would re-render this
 *     component — and re-running the sidebar's render with it — for what is
 *     ultimately one attribute change. The loop writes `transform` straight
 *     onto the three hand nodes through refs instead, so React renders this
 *     once and never again.
 *
 * Honours prefers-reduced-motion: where that is set, continuous movement is
 * exactly what the user asked not to see, so the hand falls back to a plain
 * one-second tick driven by a timer.
 */
export default function AnalogClock({ size = 132, showNumerals = true }) {
  const theme = useTheme();
  const hourRef = useRef(null);
  const minuteRef = useRef(null);
  const secondRef = useRef(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const point = (ref, angle) => {
      if (ref.current) ref.current.setAttribute('transform', `rotate(${angle} ${C} ${C})`);
    };

    const draw = () => {
      const now = new Date();
      // Milliseconds are what turn a tick into a sweep; dropping them is also
      // precisely how the reduced-motion fallback becomes a tick again.
      const seconds = now.getSeconds() + (reduceMotion ? 0 : now.getMilliseconds() / 1000);
      // Each hand carries the fraction of the one below it, so the hour hand
      // sits properly between numerals instead of jumping on the hour.
      const minutes = now.getMinutes() + seconds / 60;
      const hours = (now.getHours() % 12) + minutes / 60;

      point(secondRef, seconds * 6);   // 360 / 60
      point(minuteRef, minutes * 6);
      point(hourRef, hours * 30);      // 360 / 12
    };

    draw();

    if (reduceMotion) {
      const timer = setInterval(draw, 1000);
      return () => clearInterval(timer);
    }

    let frame = requestAnimationFrame(function loop() {
      draw();
      frame = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const face = theme.palette.background.paper;
  const ink = theme.palette.text.primary;
  const bezel = theme.palette.mode === 'dark' ? theme.palette.divider : '#1f1f1f';

  const numerals = showNumerals
    ? Array.from({ length: 12 }, (_, i) => {
        const n = i + 1;
        const angle = (n * 30 * Math.PI) / 180;
        return (
          <text
            key={n}
            x={C + 37 * Math.sin(angle)}
            y={C - 37 * Math.cos(angle)}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="11"
            fontWeight="500"
            fill={ink}
          >
            {n}
          </text>
        );
      })
    : null;

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        // The sidebar forces its own font (and possibly bold/italic/underline)
        // onto every descendant. Numerals on a clock face want none of that.
        '& text': {
          fontStyle: 'normal !important',
          textDecoration: 'none !important',
          letterSpacing: 'normal !important',
        },
      }}
    >
      <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Analog clock">
        <circle cx={C} cy={C} r="47" fill={face} stroke={bezel} strokeWidth="3" />

        {/* Minute ticks, with the quarters drawn longer and heavier. Rendered
            only alongside the numerals — at the collapsed sidebar's size they
            would collapse into a grey smudge. */}
        {showNumerals && Array.from({ length: 60 }, (_, i) => {
          const major = i % 5 === 0;
          return (
            <line
              key={i}
              x1={C}
              y1={major ? 6.5 : 7.5}
              x2={C}
              y2={major ? 10 : 9}
              stroke={ink}
              strokeOpacity={major ? 0.55 : 0.22}
              strokeWidth={major ? 1 : 0.5}
              transform={`rotate(${i * 6} ${C} ${C})`}
            />
          );
        })}

        {numerals}

        {/* Each hand points at 12 and is rotated into place by the loop above,
            so the geometry here only ever describes its length and weight. */}
        <g ref={hourRef}>
          <line x1={C} y1={C + 6} x2={C} y2={C - 21} stroke={ink} strokeWidth="4" strokeLinecap="round" />
        </g>
        <g ref={minuteRef}>
          <line x1={C} y1={C + 8} x2={C} y2={C - 31} stroke={ink} strokeWidth="2.8" strokeLinecap="round" />
        </g>
        <g ref={secondRef}>
          <line x1={C} y1={C + 12} x2={C} y2={C - 35} stroke={SWEEP_COLOR} strokeWidth="1.1" strokeLinecap="round" />
        </g>

        <circle cx={C} cy={C} r="2.6" fill={SWEEP_COLOR} />
      </svg>
    </Box>
  );
}
