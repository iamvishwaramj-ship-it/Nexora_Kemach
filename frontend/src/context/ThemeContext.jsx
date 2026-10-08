import React, { useMemo } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { useSelector } from 'react-redux';
import { createAppTheme } from '../theme/createAppTheme';

// Color + mode live in Redux (theme slice, persisted to localStorage) so the
// choice survives the session — every theme works in both light and dark
// via MUI's palette.mode, not hardcoded component variants.
export const AppThemeProvider = ({ children }) => {
  const colorScheme = useSelector((s) => s.theme.colorScheme);
  const mode = useSelector((s) => s.theme.mode);
  const sidebarFont = useSelector((s) => s.theme.sidebarFont);
  const bodyFont = useSelector((s) => s.theme.bodyFont);
  const sidebarBold = useSelector((s) => s.theme.sidebarBold);
  const sidebarItalic = useSelector((s) => s.theme.sidebarItalic);
  const sidebarUnderline = useSelector((s) => s.theme.sidebarUnderline);
  const bodyBold = useSelector((s) => s.theme.bodyBold);
  const bodyItalic = useSelector((s) => s.theme.bodyItalic);
  const bodyUnderline = useSelector((s) => s.theme.bodyUnderline);

  const theme = useMemo(
    () =>
      createAppTheme(
        colorScheme,
        mode,
        sidebarFont,
        bodyFont,
        { bold: sidebarBold, italic: sidebarItalic, underline: sidebarUnderline },
        { bold: bodyBold, italic: bodyItalic, underline: bodyUnderline }
      ),
    [
      colorScheme,
      mode,
      sidebarFont,
      bodyFont,
      sidebarBold,
      sidebarItalic,
      sidebarUnderline,
      bodyBold,
      bodyItalic,
      bodyUnderline,
    ]
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        {children}
      </LocalizationProvider>
    </ThemeProvider>
  );
};
