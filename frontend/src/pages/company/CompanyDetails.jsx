import React, { useState } from 'react';
import { Box, Button, Card, CardContent, Stack, Grid, IconButton, Typography, alpha } from '@mui/material';
import ApartmentIcon from '@mui/icons-material/Apartment';
import EditIcon from '@mui/icons-material/EditOutlined';
import CloseIcon from '@mui/icons-material/Close';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useTranslation } from 'react-i18next';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import Spinner from '../../components/ui/Spinner';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { companyDetailsSchema } from '../../lib/validation/companySchemas';
import {
  useGetCompanyDetailsQuery, useUpdateCompanyDetailsMutation,
  useUploadCompanyLogoMutation, useRemoveCompanyLogoMutation,
} from '../../features/company/companyDetailsApi';
import { countries, getStateOptions } from '../../lib/constants/locations';
import { getCityOptions } from '../../lib/constants/locationsCities';
import CompanyInfoField from './components/CompanyInfoField';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';

// Accepted logo types and size cap, enforced client-side before anything is
// sent to the server -- mirrors backend/src/routes/company.js's own
// LOGO_ALLOWED_MIME / LOGO_MAX_BYTES so a rejected file never makes a round
// trip just to be told what it could have been told immediately.
const LOGO_ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

function validateLogoFile(file) {
  if (!LOGO_ACCEPTED_TYPES.includes(file.type)) {
    return 'Please choose a PNG, JPG, SVG or WEBP image.';
  }
  if (file.size > LOGO_MAX_BYTES) {
    return 'Image is too large. Maximum size is 2MB.';
  }
  return null;
}

// Logo preview + file picker + remove, shown above the field grid in both
// view and edit mode. Upload/remove don't hit the server immediately on
// pick/click -- they're staged locally (logoFile / removeRequested) and only
// sent to OCI Object Storage when the surrounding form is actually saved
// (see CompanyDetails' handleSubmit), so backing out of an edit with Cancel
// never leaves a half-applied logo change.
function CompanyLogoField({ currentLogoUrl, editing, logoFile, previewUrl, removeRequested, onFileSelected, onRemove, error }) {
  const showImage = !removeRequested && (previewUrl || currentLogoUrl);
  const imageSrc = logoFile ? previewUrl : currentLogoUrl;

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file name after an error
    if (!file) return;
    onFileSelected(file);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
      <Box
        sx={{
          position: 'relative',
          width: 96, height: 96,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', flexShrink: 0,
        }}
      >
        {showImage ? (
          <Box component="img" src={imageSrc} alt="Company logo" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <ApartmentIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
        )}
        {editing && (
          <IconButton
            component="label"
            size="small"
            sx={{ position: 'absolute', bottom: -4, right: -4, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}
          >
            <PhotoCameraIcon fontSize="small" />
            <input type="file" accept={LOGO_ACCEPTED_TYPES.join(',')} hidden onChange={handleChange} />
          </IconButton>
        )}
      </Box>
      <Box>
        <Typography variant="subtitle2">Company Logo</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          PNG, JPG, SVG or WEBP. Max 2MB.
        </Typography>
        {error && (
          <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.5 }}>
            {error}
          </Typography>
        )}
        {editing && showImage && (
          <Button
            size="small"
            color="error"
            startIcon={<DeleteOutlineIcon fontSize="small" />}
            onClick={onRemove}
            sx={{ mt: 0.5, px: 0 }}
          >
            Remove
          </Button>
        )}
      </Box>
    </Box>
  );
}

export default function CompanyDetails() {
  const { t } = useTranslation();
  const notify = useNotify();
  const { data, isLoading } = useGetCompanyDetailsQuery();
  const [updateDetails, { isLoading: saving }] = useUpdateCompanyDetailsMutation();
  const [uploadLogo, { isLoading: uploadingLogo }] = useUploadCompanyLogoMutation();
  const [removeLogo, { isLoading: removingLogo }] = useRemoveCompanyLogoMutation();
  const [editing, setEditing] = useState(false);

  // Logo changes are staged here and only committed on Save (see
  // handleSubmit) -- nothing is uploaded or removed just from picking a
  // file or clicking Remove.
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [removeLogoRequested, setRemoveLogoRequested] = useState(false);
  const [logoError, setLogoError] = useState(null);

  if (isLoading) return <Spinner label={t('common.loading')} />;

  const resetLogoState = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogoRequested(false);
    setLogoError(null);
  };

  const handleLogoFileSelected = (file) => {
    const validationError = validateLogoFile(file);
    if (validationError) {
      setLogoError(validationError);
      return;
    }
    setLogoError(null);
    setRemoveLogoRequested(false);
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleLogoRemoveClick = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setLogoError(null);
    setRemoveLogoRequested(true);
  };

  const isSaving = saving || uploadingLogo || removingLogo;

  const handleSubmit = async (values, formMethods) => {
    try {
      // Logo changes go through their own multipart/DELETE endpoints (OCI
      // Object Storage), so they're applied first, ahead of the plain JSON
      // PUT for the rest of the fields below. Stopping here on failure
      // means a failed logo upload never leaves the rest of the form
      // silently unsaved along with it, or vice versa.
      if (logoFile) {
        const formData = new FormData();
        formData.append('file', logoFile);
        await uploadLogo(formData).unwrap();
      } else if (removeLogoRequested) {
        await removeLogo().unwrap();
      }

      await updateDetails(values).unwrap();
      notify.success('Company details saved');
      resetLogoState();
      setEditing(false);
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError, 'Update failed'));
    }
  };

  const viewFields = [
    { name: 'companyName', label: 'Company Name' },
    { name: 'legalName', label: 'Legal Name' },
    { name: 'registrationNumber', label: 'Registration Number' },
    { name: 'pan', label: 'PAN Number' },
    { name: 'gstin', label: 'GST Number' },
    { name: 'hsnNo', label: 'HSN No.' },
    { name: 'email', label: 'Email' },
    { name: 'phone', label: 'Phone Number' },
    { name: 'website', label: 'Website' },
    { name: 'country', label: 'Country' },
    { name: 'state', label: 'State' },
    { name: 'city', label: 'City' },
    { name: 'pincode', label: 'Pincode' },
  ];

  return (
    <Box>
      <EntityHeaderCard
        icon={<ApartmentIcon />}
        title="Company Details"
        subtitle="View and update your company information."
        rightContent={!editing && (
          <Button variant="outlined" startIcon={<EditIcon />} onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      />

      <Card variant="outlined">
        <CardContent sx={{ p: 3 }}>
          <CompanyLogoField
            currentLogoUrl={data?.logoUrl}
            editing={editing}
            logoFile={logoFile}
            previewUrl={logoPreview}
            removeRequested={removeLogoRequested}
            onFileSelected={handleLogoFileSelected}
            onRemove={handleLogoRemoveClick}
            error={logoError}
          />
          {!editing ? (
            <Grid container spacing={2.5}>
              {viewFields.map((f) => (
                <Grid item xs={12} sm={6} md={3} key={f.name}>
                  <CompanyInfoField label={f.label} value={data?.[f.name]} />
                </Grid>
              ))}
              <Grid item xs={12}>
                <CompanyInfoField label="Address" value={data?.address} minHeight={48} />
              </Grid>
            </Grid>
          ) : (
            <AppForm schema={companyDetailsSchema} defaultValues={data || { currency: 'INR' }} onSubmit={handleSubmit}>
              {({ watch }) => {
                const selectedCountry = watch('country');
                const selectedState = watch('state');
                return (
                  <>
                    <FormGrid columns={2} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                      <LabeledField label="Company Name *">
                        <FormTextField name="companyName" label="" />
                      </LabeledField>
                      <LabeledField label="Legal Name">
                        <FormTextField name="legalName" label="" />
                      </LabeledField>
                      <LabeledField label="Registration Number">
                        <FormTextField name="registrationNumber" label="" />
                      </LabeledField>
                      <LabeledField label="TIN Number">
                        <FormTextField name="tinNumber" label="" />
                      </LabeledField>
                      <LabeledField label="GSTIN">
                        <FormTextField name="gstin" label="" maxLength={15} inputProps={{ style: { textTransform: 'uppercase' } }} />
                      </LabeledField>
                      <LabeledField label="PAN">
                        <FormTextField name="pan" label="" maxLength={10} inputProps={{ style: { textTransform: 'uppercase' } }} />
                      </LabeledField>
                      {/* Printed on every sales printable's header, right
                          below the KEMACH logo (Quotation/Order/Invoice/
                          Delivery Challan/Sales Return) — see those
                          components' own "HSN No." kv row next to IRN No. */}
                      <LabeledField label="HSN No.">
                        <FormTextField name="hsnNo" label="" />
                      </LabeledField>
                      <LabeledField label="Currency *">
                        <FormTextField name="currency" label="" />
                      </LabeledField>
                      <LabeledField label="Phone">
                        <FormTextField name="phone" label="" digitsOnly maxLength={10} />
                      </LabeledField>
                      <LabeledField label="Email">
                        <FormTextField name="email" label="" />
                      </LabeledField>
                      <LabeledField label="Website">
                        <FormTextField name="website" label="" />
                      </LabeledField>
                      <LabeledField label="Country">
                        <FormSelect name="country" label="" options={countries} />
                      </LabeledField>
                      <LabeledField label="State">
                        <FormSelect name="state" label="" options={getStateOptions(selectedCountry)} />
                      </LabeledField>
                      <LabeledField label="City">
                        <FormSelect name="city" label="" options={getCityOptions(selectedCountry, selectedState)} />
                      </LabeledField>
                      <LabeledField label="Pincode">
                        <FormTextField name="pincode" label="" digitsOnly maxLength={6} />
                      </LabeledField>
                    </FormGrid>
                    <FormGrid columns={1} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                      <LabeledField label="Address" align="flex-start">
                        <FormTextField name="address" label="" multiline rows={2} />
                      </LabeledField>
                    </FormGrid>
                    <Stack direction="row" spacing={1.5} sx={{ mt: 3 }}>
                      <FormSubmitButton disabled={isSaving}>{t('common.save')}</FormSubmitButton>
                      <Button
                        variant="outlined"
                        color="inherit"
                        startIcon={<CloseIcon />}
                        disabled={isSaving}
                        onClick={() => {
                          // Discard any staged (not-yet-saved) logo change
                          // along with the rest of the form.
                          resetLogoState();
                          setEditing(false);
                        }}
                      >
                        Cancel
                      </Button>
                    </Stack>
                  </>
                );
              }}
            </AppForm>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
