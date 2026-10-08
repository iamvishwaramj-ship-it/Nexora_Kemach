import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, ToggleButtonGroup, ToggleButton, Slider, MenuItem, Select, FormControl, InputLabel, Avatar, Stack, RadioGroup, FormControlLabel, Radio,
  TextField, Switch, Button, Alert, Divider,
} from '@mui/material';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  setColorScheme, setMode, setSidebarFont, setBodyFont,
  setSidebarBold, setSidebarItalic, setSidebarUnderline,
  setBodyBold, setBodyItalic, setBodyUnderline,
  setSidebar3dHoverEnabled, setSidebarIconColorsEnabled, setSmartAddEnabled, setMasterQuickLinkEnabled,
} from '../../store/themeSlice';
import { setMaxTabs, closeAllTabs } from '../../store/tabsSlice';
import { colorSchemeList } from '../../theme/colorSchemes';
import { fontList } from '../../theme/fonts';
import { selectCurrentUser } from '../../store/authSlice';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import AppButton from '../../components/ui/AppButton';
import {
  useGetEInvoiceSettingsQuery, useUpdateEInvoiceSettingsMutation, useTestEInvoiceConnectionMutation,
} from '../../features/company/companyDetailsApi';

const EINVOICE_ENVIRONMENT_OPTIONS = [
  { value: 'sandbox', label: 'Sandbox (test)' },
  { value: 'production', label: 'Production (live)' },
];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ta', label: 'தமிழ் (Tamil)' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
];

// Every settings card shares this footprint so cards in the same row match
// height (via Grid's default row stretch) without ballooning past what their
// content actually needs.
const CARD_SX = { height: '100%', minHeight: 260, display: 'flex', flexDirection: 'column' };
const CARD_CONTENT_SX = { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', p: 2.5, '&:last-child': { pb: 2.5 } };

export default function Settings() {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const user = useSelector(selectCurrentUser);
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
  const sidebar3dHoverEnabled = useSelector((s) => s.theme.sidebar3dHoverEnabled);
  const sidebarIconColorsEnabled = useSelector((s) => s.theme.sidebarIconColorsEnabled);
  const smartAddEnabled = useSelector((s) => s.theme.smartAddEnabled);
  const masterQuickLinkEnabled = useSelector((s) => s.theme.masterQuickLinkEnabled);
  const maxTabs = useSelector((s) => s.tabs.maxTabs);

  // "E-Invoice / E-Way Bill Settings" card — the non-secret half of the
  // TaxPro GSP config (see backend/src/services/taxproGsp.service.js and
  // the EInvoiceSettings model). Unlike the cards above, this one has an
  // explicit Save (and a Test Connection dry run) rather than dispatching
  // on every keystroke, since these values are sent to a real external API
  // and shouldn't autosave a half-typed GSTIN.
  const { data: einvoiceSettings, isLoading: einvoiceLoading } = useGetEInvoiceSettingsQuery();
  const [updateEInvoiceSettings, { isLoading: savingEInvoice }] = useUpdateEInvoiceSettingsMutation();
  const [testEInvoiceConnection, { isLoading: testingEInvoice }] = useTestEInvoiceConnectionMutation();
  const [einvoiceForm, setEinvoiceForm] = useState(null); // null until the GET resolves
  const [einvoiceTestResult, setEinvoiceTestResult] = useState(null); // { ok, message } | null

  useEffect(() => {
    if (!einvoiceSettings) return;
    setEinvoiceForm({
      enabled: Boolean(einvoiceSettings.enabled),
      environment: einvoiceSettings.environment || 'sandbox',
      sandboxApiUrl: einvoiceSettings.sandboxApiUrl || '',
      productionApiUrl: einvoiceSettings.productionApiUrl || '',
      qrCodeSize: einvoiceSettings.qrCodeSize != null ? String(einvoiceSettings.qrCodeSize) : '300',
      aspId: einvoiceSettings.aspId || '',
      sandboxGstin: einvoiceSettings.sandboxGstin || '',
      sandboxUsername: einvoiceSettings.sandboxUsername || '',
      productionGstin: einvoiceSettings.productionGstin || '',
      productionUsername: einvoiceSettings.productionUsername || '',
    });
  }, [einvoiceSettings]);

  const setEinvoiceField = (field) => (e) => {
    const value = field === 'enabled' ? e.target.checked : e.target.value;
    setEinvoiceForm((prev) => ({ ...prev, [field]: value }));
  };

  const einvoicePayload = () => ({ ...einvoiceForm, qrCodeSize: Number(einvoiceForm.qrCodeSize) || 300 });

  const handleSaveEInvoiceSettings = async () => {
    setEinvoiceTestResult(null);
    try {
      await updateEInvoiceSettings(einvoicePayload()).unwrap();
      notify.success('E-Invoice / E-Way Bill settings saved');
    } catch (err) {
      notify.error(err?.data?.message || 'Could not save settings');
    }
  };

  const handleTestEInvoiceConnection = async () => {
    setEinvoiceTestResult(null);
    try {
      await testEInvoiceConnection(einvoicePayload()).unwrap();
      setEinvoiceTestResult({ ok: true, message: 'Connected to TaxPro GSP successfully.' });
    } catch (err) {
      setEinvoiceTestResult({ ok: false, message: err?.data?.message || 'Connection failed.' });
    }
  };

  const sidebarStyleValues = [
    sidebarBold && 'bold',
    sidebarItalic && 'italic',
    sidebarUnderline && 'underline',
  ].filter(Boolean);
  const bodyStyleValues = [
    bodyBold && 'bold',
    bodyItalic && 'italic',
    bodyUnderline && 'underline',
  ].filter(Boolean);

  const handleSidebarStyleChange = (_e, values) => {
    dispatch(setSidebarBold(values.includes('bold')));
    dispatch(setSidebarItalic(values.includes('italic')));
    dispatch(setSidebarUnderline(values.includes('underline')));
  };
  const handleBodyStyleChange = (_e, values) => {
    dispatch(setBodyBold(values.includes('bold')));
    dispatch(setBodyItalic(values.includes('italic')));
    dispatch(setBodyUnderline(values.includes('underline')));
  };

  const handleLanguageChange = (e) => {
    i18n.changeLanguage(e.target.value);
    localStorage.setItem('nexora_language', e.target.value);
  };

  const handleCloseAllTabs = async () => {
    const ok = await confirmDialog({ title: 'Close all tabs', message: 'This will close every open tab. Continue?' });
    if (ok) {
      dispatch(closeAllTabs());
      notify.success('All tabs closed');
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>{t('common.settings')}</Typography>

      <Grid container spacing={3} alignItems="stretch">
        <Grid item xs={12} sm={6} md={4}>
          <Card variant="outlined" sx={CARD_SX}>
            <CardContent sx={CARD_CONTENT_SX}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>{t('common.profile')}</Typography>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
                <Avatar
                  src={user?.profilePhotoUrl}
                  sx={{ width: 64, height: 64, bgcolor: 'primary.main', fontSize: '1.5rem' }}
                >
                  {user?.name?.charAt(0)}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle1" fontWeight={600} noWrap>{user?.name || '—'}</Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>{user?.email || '—'}</Typography>
                  {user?.role && (
                    <Typography variant="caption" color="text.secondary">{user.role}</Typography>
                  )}
                </Box>
              </Stack>
              <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
                <AppButton variant="outlined" onClick={() => navigate('/settings/profile')}>
                  Manage Profile
                </AppButton>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card variant="outlined" sx={CARD_SX}>
            <CardContent sx={CARD_CONTENT_SX}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>{t('common.theme')}</Typography>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Color</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                {colorSchemeList.map((s) => (
                  <Box
                    key={s.key}
                    onClick={() => dispatch(setColorScheme(s.key))}
                    title={s.label}
                    sx={{
                      width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
                      background: `linear-gradient(135deg, ${s.primary}, ${s.accent})`,
                      border: colorScheme === s.key ? '3px solid' : '1px solid',
                      borderColor: colorScheme === s.key ? 'text.primary' : 'divider',
                    }}
                  />
                ))}
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Mode</Typography>
              <ToggleButtonGroup exclusive value={mode} onChange={(_e, v) => v && dispatch(setMode(v))} size="small">
                <ToggleButton value="light">{t('common.lightMode')}</ToggleButton>
                <ToggleButton value="dark">{t('common.darkMode')}</ToggleButton>
              </ToggleButtonGroup>

              <Typography variant="body2" color="text.secondary" sx={{ mt: 3, mb: 1 }}>
                Sidebar 3D hover effect
              </Typography>
              <RadioGroup
                row
                value={sidebar3dHoverEnabled ? 'on' : 'off'}
                onChange={(e) => dispatch(setSidebar3dHoverEnabled(e.target.value === 'on'))}
              >
                <FormControlLabel value="on" control={<Radio size="small" />} label="On" />
                <FormControlLabel value="off" control={<Radio size="small" />} label="Off" />
              </RadioGroup>

              <Typography variant="body2" color="text.secondary" sx={{ mt: 3, mb: 1 }}>
                Sidebar icon colors
              </Typography>
              <RadioGroup
                row
                value={sidebarIconColorsEnabled ? 'on' : 'off'}
                onChange={(e) => dispatch(setSidebarIconColorsEnabled(e.target.value === 'on'))}
              >
                <FormControlLabel value="on" control={<Radio size="small" />} label="On" />
                <FormControlLabel value="off" control={<Radio size="small" />} label="Off" />
              </RadioGroup>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card variant="outlined" sx={CARD_SX}>
            <CardContent sx={CARD_CONTENT_SX}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Fonts</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Sidebar font
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-end', mb: 3 }}>
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel>Sidebar font</InputLabel>
                  <Select
                    value={sidebarFont}
                    label="Sidebar font"
                    onChange={(e) => dispatch(setSidebarFont(e.target.value))}
                  >
                    {fontList.map((f) => (
                      <MenuItem key={f.key} value={f.key} sx={{ fontFamily: f.stack }}>
                        {f.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <ToggleButtonGroup size="small" value={sidebarStyleValues} onChange={handleSidebarStyleChange}>
                  <ToggleButton value="bold" aria-label="Sidebar bold"><FormatBoldIcon fontSize="small" /></ToggleButton>
                  <ToggleButton value="italic" aria-label="Sidebar italic"><FormatItalicIcon fontSize="small" /></ToggleButton>
                  <ToggleButton value="underline" aria-label="Sidebar underline"><FormatUnderlinedIcon fontSize="small" /></ToggleButton>
                </ToggleButtonGroup>
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Body font (dashboard &amp; all pages)
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-end' }}>
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel>Body font</InputLabel>
                  <Select
                    value={bodyFont}
                    label="Body font"
                    onChange={(e) => dispatch(setBodyFont(e.target.value))}
                  >
                    {fontList.map((f) => (
                      <MenuItem key={f.key} value={f.key} sx={{ fontFamily: f.stack }}>
                        {f.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <ToggleButtonGroup size="small" value={bodyStyleValues} onChange={handleBodyStyleChange}>
                  <ToggleButton value="bold" aria-label="Body bold"><FormatBoldIcon fontSize="small" /></ToggleButton>
                  <ToggleButton value="italic" aria-label="Body italic"><FormatItalicIcon fontSize="small" /></ToggleButton>
                  <ToggleButton value="underline" aria-label="Body underline"><FormatUnderlinedIcon fontSize="small" /></ToggleButton>
                </ToggleButtonGroup>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card variant="outlined" sx={CARD_SX}>
            <CardContent sx={CARD_CONTENT_SX}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>{t('common.language')}</Typography>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel>{t('common.language')}</InputLabel>
                <Select value={i18n.language?.split('-')[0] || 'en'} label={t('common.language')} onChange={handleLanguageChange}>
                  {LANGUAGES.map((l) => (
                    <MenuItem key={l.code} value={l.code}>{l.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card variant="outlined" sx={CARD_SX}>
            <CardContent sx={CARD_CONTENT_SX}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Tabs</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Max open tabs: {maxTabs}
              </Typography>
              <Slider
                value={maxTabs}
                min={1}
                max={10}
                step={1}
                marks
                valueLabelDisplay="auto"
                onChange={(_e, v) => dispatch(setMaxTabs(v))}
                sx={{ maxWidth: 320, mb: 2 }}
              />
              <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
                <AppButton variant="outlined" color="error" onClick={handleCloseAllTabs}>
                  {t('common.closeAll')}
                </AppButton>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card variant="outlined" sx={CARD_SX}>
            <CardContent sx={CARD_CONTENT_SX}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Developer Settings</Typography>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Smart Add (sales documents)
              </Typography>
              <RadioGroup
                row
                value={smartAddEnabled ? 'on' : 'off'}
                onChange={(e) => dispatch(setSmartAddEnabled(e.target.value === 'on'))}
              >
                <FormControlLabel value="on" control={<Radio size="small" />} label="On" />
                <FormControlLabel value="off" control={<Radio size="small" />} label="Off" />
              </RadioGroup>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 1, mt: 2 }}>
                Master Quick Link (Customer/Warehouse/Branch icon)
              </Typography>
              <RadioGroup
                row
                value={masterQuickLinkEnabled ? 'on' : 'off'}
                onChange={(e) => dispatch(setMasterQuickLinkEnabled(e.target.value === 'on'))}
              >
                <FormControlLabel value="on" control={<Radio size="small" />} label="On" />
                <FormControlLabel value="off" control={<Radio size="small" />} label="Off" />
              </RadioGroup>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 0 }}>
        <Grid item xs={12}>
          <Card variant="outlined">
            <CardContent sx={{ p: 2.5 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle1" fontWeight={700}>E-Invoice / E-Way Bill Settings</Typography>
                <FormControlLabel
                  labelPlacement="start"
                  label={einvoiceForm?.enabled ? 'Enabled' : 'Disabled'}
                  control={(
                    <Switch
                      checked={Boolean(einvoiceForm?.enabled)}
                      onChange={setEinvoiceField('enabled')}
                      disabled={!einvoiceForm}
                    />
                  )}
                />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Connects Sales Invoice&apos;s IRN / e-way bill generation to TaxPro GSP (NIC e-Invoice System). Passwords
                are configured on the server (.env) and are not shown or editable here.
              </Typography>

              {!einvoiceForm ? (
                <Typography variant="body2" color="text.secondary">
                  {einvoiceLoading ? 'Loading…' : 'Could not load settings.'}
                </Typography>
              ) : (
                <>
                  <Typography variant="body2" color="text.secondary" fontWeight={600} sx={{ mb: 1.5 }}>
                    General
                  </Typography>
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={6} md={3}>
                      <FormControl size="small" fullWidth>
                        <InputLabel>Environment</InputLabel>
                        <Select
                          value={einvoiceForm.environment}
                          label="Environment"
                          onChange={setEinvoiceField('environment')}
                        >
                          {EINVOICE_ENVIRONMENT_OPTIONS.map((o) => (
                            <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        size="small"
                        fullWidth
                        label="QR Code Size (px)"
                        type="number"
                        value={einvoiceForm.qrCodeSize}
                        onChange={setEinvoiceField('qrCodeSize')}
                        helperText="Size of the e-invoice QR printed on the invoice"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        size="small"
                        fullWidth
                        label="Sandbox API URL"
                        value={einvoiceForm.sandboxApiUrl}
                        onChange={setEinvoiceField('sandboxApiUrl')}
                        placeholder="https://gstsandbox.charteredinfo.com"
                        helperText="TaxPro test server, used when Environment is Sandbox"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        size="small"
                        fullWidth
                        label="Production API URL"
                        value={einvoiceForm.productionApiUrl}
                        onChange={setEinvoiceField('productionApiUrl')}
                        placeholder="https://einvapi.charteredinfo.com"
                        helperText="TaxPro live server (primary): einvapi.charteredinfo.com"
                      />
                    </Grid>
                  </Grid>

                  <Divider sx={{ mb: 3 }} />

                  <Typography variant="body2" color="text.secondary" fontWeight={600} sx={{ mb: 1.5 }}>
                    TaxPro ASP Account
                  </Typography>
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        size="small"
                        fullWidth
                        label="ASP ID"
                        value={einvoiceForm.aspId}
                        onChange={setEinvoiceField('aspId')}
                        helperText="Your TaxPro ASP account number (also your crm.gstefiling.co.in login)"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        size="small"
                        fullWidth
                        label="ASP Password"
                        value="Configured on the server"
                        disabled
                        helperText="TaxPro ASP password. Set via TAXPRO_ASP_PASSWORD (production override: TAXPRO_PRODUCTION_ASP_PASSWORD) in .env"
                      />
                    </Grid>
                  </Grid>

                  <Divider sx={{ mb: 3 }} />

                  <Typography variant="body2" color="text.secondary" fontWeight={600} sx={{ mb: 1.5 }}>
                    Sandbox Login (test)
                  </Typography>
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        size="small"
                        fullWidth
                        label="GSTIN"
                        value={einvoiceForm.sandboxGstin}
                        onChange={setEinvoiceField('sandboxGstin')}
                        helperText="TaxPro test GSTIN: 34AACCC1596Q002"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        size="small"
                        fullWidth
                        label="E-Invoice User Name"
                        value={einvoiceForm.sandboxUsername}
                        onChange={setEinvoiceField('sandboxUsername')}
                        helperText="TaxPro test user: TaxProEnvPON"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        size="small"
                        fullWidth
                        label="E-Invoice Password"
                        value="Configured on the server"
                        disabled
                        helperText="TaxPro test password. Set via TAXPRO_PASSWORD in .env"
                      />
                    </Grid>
                  </Grid>

                  <Divider sx={{ mb: 3 }} />

                  <Typography variant="body2" color="text.secondary" fontWeight={600} sx={{ mb: 1.5 }}>
                    Production Login (live)
                  </Typography>
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        size="small"
                        fullWidth
                        label="GSTIN"
                        value={einvoiceForm.productionGstin}
                        onChange={setEinvoiceField('productionGstin')}
                        helperText="Your company GSTIN registered for e-invoicing"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        size="small"
                        fullWidth
                        label="E-Invoice User Name"
                        value={einvoiceForm.productionUsername}
                        onChange={setEinvoiceField('productionUsername')}
                        helperText="API user created on einvoice1.gst.gov.in (API Registration → via GSP → TaxPro). Not the GST portal login"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        size="small"
                        fullWidth
                        label="E-Invoice Password"
                        value="Configured on the server"
                        disabled
                        helperText="Password of that e-invoice API user. Set via TAXPRO_PRODUCTION_PASSWORD in .env"
                      />
                    </Grid>
                  </Grid>

                  {einvoiceTestResult && (
                    <Alert severity={einvoiceTestResult.ok ? 'success' : 'error'} sx={{ mb: 2 }}>
                      {einvoiceTestResult.message}
                    </Alert>
                  )}

                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
                    <AppButton
                      variant="outlined"
                      onClick={handleTestEInvoiceConnection}
                      disabled={testingEInvoice || savingEInvoice}
                    >
                      {testingEInvoice ? 'Testing…' : 'Test Connection'}
                    </AppButton>
                    <AppButton
                      variant="contained"
                      onClick={handleSaveEInvoiceSettings}
                      disabled={savingEInvoice || testingEInvoice}
                    >
                      {savingEInvoice ? 'Saving…' : 'Save'}
                    </AppButton>
                  </Box>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
