// Professional/business font choices for the ERP UI. Sidebar and body (main
// content) fonts are selected independently in Settings and stored in the
// theme slice. Each entry's `stack` is the full CSS font-family value
// (Google Font first, sane system fallbacks after) and must match the
// families loaded in index.html.
export const fontList = [
  {
    key: 'inter',
    label: 'Inter',
    stack: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  {
    key: 'roboto',
    label: 'Roboto',
    stack: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  {
    key: 'poppins',
    label: 'Poppins',
    stack: '"Poppins", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  {
    key: 'openSans',
    label: 'Open Sans',
    stack: '"Open Sans", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  {
    key: 'lato',
    label: 'Lato',
    stack: '"Lato", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  {
    key: 'nunitoSans',
    label: 'Nunito Sans',
    stack: '"Nunito Sans", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  {
    key: 'ibmPlexSans',
    label: 'IBM Plex Sans',
    stack: '"IBM Plex Sans", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  {
    key: 'workSans',
    label: 'Work Sans',
    stack: '"Work Sans", "Roboto", "Helvetica", "Arial", sans-serif',
  },
];

export const fontByKey = fontList.reduce((acc, f) => {
  acc[f.key] = f;
  return acc;
}, {});

export function getFontStack(key, fallbackKey = 'inter') {
  return (fontByKey[key] || fontByKey[fallbackKey]).stack;
}

export const DEFAULT_SIDEBAR_FONT = 'inter';
export const DEFAULT_BODY_FONT = 'inter';

export default fontList;
