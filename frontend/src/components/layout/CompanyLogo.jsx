import React, { useState, useEffect } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import ApartmentIcon from '@mui/icons-material/Apartment';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGetCompanyDetailsQuery } from '../../features/company/companyDetailsApi';

// Tenant/company logo slot for the header — distinct from the Nexora product
// wordmark (Nexora_Logo.jsx), which stays in its own place in the sidebar
// cluster. This is "your company's logo", fetched from whatever the admin
// uploaded in Company Setup > Company Details (see pages/company/CompanyDetails.jsx
// and backend routes/company.js's /company/logo endpoints).
//
// getCompanyDetails already runs on app bootstrap for other parts of the UI
// (CompanyBadge, etc.), so this component doesn't trigger an extra fetch of
// its own — RTK Query dedupes the subscription — and the logo is present on
// first paint rather than popping in after a delayed request.
//
// Falls back to a generic building icon when no logo is set, or if the
// pre-signed image URL ever fails to load (e.g. it expired between the
// bootstrap fetch and the image actually rendering).
export default function CompanyLogo({ size = 32 }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: company } = useGetCompanyDetailsQuery();
  const [imgFailed, setImgFailed] = useState(false);

  // A new logoUrl (fresh upload, or a freshly re-signed URL after refetch)
  // deserves a fresh chance to load, even if a previous URL had failed.
  useEffect(() => { setImgFailed(false); }, [company?.logoUrl]);

  const goHome = () => navigate('/dashboard');
  const label = t('common.companyLogo', 'Company logo');

  if (company?.logoUrl && !imgFailed) {
    return (
      <Tooltip title={label}>
        <Box
          component="img"
          src={company.logoUrl}
          alt={company?.companyName || label}
          onClick={goHome}
          onError={() => setImgFailed(true)}
          sx={{
            height: size,
            maxWidth: size * 4,
            width: 'auto',
            objectFit: 'contain',
            cursor: 'pointer',
            display: 'block',
          }}
        />
      </Tooltip>
    );
  }

  // No logo uploaded yet (or it failed to load) — generic placeholder,
  // same icon used for "company" elsewhere in the app (CompanyBadge).
  return (
    <Tooltip title={label}>
      <IconButton onClick={goHome} aria-label={label} size="small" sx={{ width: size, height: size }}>
        <ApartmentIcon sx={{ fontSize: size * 0.6, color: 'text.secondary' }} />
      </IconButton>
    </Tooltip>
  );
}
