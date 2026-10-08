import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';

// Monospace so the digits don't jitter the layout as they change — a
// proportional font's "1" is narrower than its "0", which makes a ticking
// clock visibly wobble from side to side. Same reasoning as the drawer-code
// font in Chart Of Accounts.
const DIGIT_FONT_FAMILY = '"Roboto Mono", "Courier New", monospace';

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * DigitalClock — sidebar replacement for AnalogClock. Ticks once a second
 * via setInterval (a digital readout only ever changes on whole seconds, so
 * there's no reason to reach for requestAnimationFrame the way the analog
 * sweep hand needed to) and re-renders this small component only, not the
 * rest of the sidebar.
 *
 * `compact` mirrors AnalogClock's collapsed-sidebar look: just HH:MM, no
 * seconds and no date, so it stays legible at the 44px collapsed rail width.
 */
export default function DigitalClock({ compact = false }) {
  const theme = useTheme();
  // The active color scheme's own color (see createAppTheme.js) — reading it
  // here rather than a fixed shade means the clock always matches whatever
  // scheme is picked in Settings, light or dark mode alike.
  const themeColor = theme.palette.primary.main;
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // Aligns the first tick to the next real second boundary, then ticks
    // every second on the second — otherwise the interval free-runs from
    // whatever moment the sidebar happened to mount and the seconds digit
    // updates up to 999ms late.
    let interval;
    const msToNextSecond = 1000 - new Date().getMilliseconds();
    const timeout = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 1000);
    }, msToNextSecond);
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);

  const hours24 = now.getHours();
  const hours12 = hours24 % 12 || 12;
  const meridiem = hours24 < 12 ? 'AM' : 'PM';
  const minutes = pad2(now.getMinutes());
  const seconds = pad2(now.getSeconds());
  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  if (compact) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Typography
          variant="caption"
          sx={{
            fontFamily: `${DIGIT_FONT_FAMILY} !important`,
            fontWeight: 600,
            fontStyle: 'normal !important',
            letterSpacing: '0 !important',
            color: themeColor,
            lineHeight: 1.2,
          }}
        >
          {hours12}:{minutes}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.25,
        py: 0.5,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
        <Typography
          sx={{
            fontFamily: `${DIGIT_FONT_FAMILY} !important`,
            fontWeight: 700,
            fontStyle: 'normal !important',
            letterSpacing: '0.02em !important',
            fontSize: '1.5rem',
            color: themeColor,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {hours12}:{minutes}:{seconds}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            fontFamily: `${DIGIT_FONT_FAMILY} !important`,
            fontWeight: 600,
            fontStyle: 'normal !important',
            color: 'text.secondary',
          }}
        >
          {meridiem}
        </Typography>
      </Box>
      <Typography
        variant="caption"
        sx={{
          fontStyle: 'normal !important',
          textDecoration: 'none !important',
          color: 'text.secondary',
        }}
      >
        {dateLabel}
      </Typography>
    </Box>
  );
}
