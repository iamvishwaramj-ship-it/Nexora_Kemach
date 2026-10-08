import React, { useState } from 'react';
import { Box, Typography, Tabs, Tab, Avatar, Card, CardContent, Button, IconButton } from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import FormTextField from '../../components/form/FormTextField';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { selectCurrentUser } from '../../store/authSlice';
import { profileSchema } from '../../lib/validation/authSchemas';
import { resetPasswordSchema } from '../../lib/validation/authSchemas';
import { useUpdateProfileMutation } from '../../features/profile/profileApi';
import { useResetPasswordMutation } from '../../features/auth/authApi';

function ProfileTab({ user, notify }) {
  const navigate = useNavigate();
  const [updateProfile, { isLoading }] = useUpdateProfileMutation();
  const [preview, setPreview] = useState(user?.profilePhotoUrl || '');

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (values, methods) => {
    try {
      await updateProfile({ name: values.name, profilePhotoUrl: preview !== user?.profilePhotoUrl ? preview : undefined }).unwrap();
      notify.success('Profile updated');
    } catch (err) {
      notify.error(applyServerErrors(err, methods.setError, 'Update failed'));
    }
  };

  return (
    <AppForm schema={profileSchema} defaultValues={{ name: user?.name || '', email: user?.email || '' }} onSubmit={handleSubmit}>
      {({ reset }) => {
        const handleCancel = () => {
          reset({ name: user?.name || '', email: user?.email || '' });
          setPreview(user?.profilePhotoUrl || '');
          navigate(-1);
        };
        return (
          <Box sx={{ maxWidth: 480 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Box sx={{ position: 'relative' }}>
                <Avatar src={preview} sx={{ width: 72, height: 72, bgcolor: 'primary.main', fontSize: '1.5rem' }}>
                  {user?.name?.charAt(0)}
                </Avatar>
                <IconButton
                  component="label"
                  size="small"
                  sx={{ position: 'absolute', bottom: -4, right: -4, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}
                >
                  <PhotoCameraIcon fontSize="small" />
                  <input type="file" accept="image/*" hidden onChange={handlePhotoChange} />
                </IconButton>
              </Box>
            </Box>

            <FormGrid columns={1}>
              <FormTextField name="name" label="Name *" />
              <FormTextField name="email" label="Email" disabled />
            </FormGrid>

            <Box sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
              <FormSubmitButton disabled={isLoading}>Save</FormSubmitButton>
              <Button type="button" variant="outlined" color="inherit" disabled={isLoading} onClick={handleCancel}>Cancel</Button>
            </Box>
          </Box>
        );
      }}
    </AppForm>
  );
}

function SecurityTab({ notify }) {
  const navigate = useNavigate();
  const [resetPassword, { isLoading }] = useResetPasswordMutation();

  const handleSubmit = async (values, methods) => {
    try {
      await resetPassword({ currentPassword: values.currentPassword, newPassword: values.newPassword }).unwrap();
      notify.success('Password updated successfully');
    } catch (err) {
      notify.error(applyServerErrors(err, methods.setError, 'Password update failed'));
    }
  };

  return (
    <AppForm schema={resetPasswordSchema} defaultValues={{ currentPassword: '', newPassword: '', confirmPassword: '' }} onSubmit={handleSubmit}>
      {({ reset }) => (
        <Box sx={{ maxWidth: 420 }}>
          <FormGrid columns={1}>
            <FormTextField name="currentPassword" label="Current Password" type="password" />
            <FormTextField name="newPassword" label="New Password" type="password" />
            <FormTextField name="confirmPassword" label="Confirm New Password" type="password" />
          </FormGrid>
          <Box sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
            <FormSubmitButton disabled={isLoading}>Update Password</FormSubmitButton>
            <Button
              type="button"
              variant="outlined"
              color="inherit"
              disabled={isLoading}
              onClick={() => {
                reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
                navigate(-1);
              }}
            >
              Cancel
            </Button>
          </Box>
        </Box>
      )}
    </AppForm>
  );
}

export default function Profile() {
  const { t } = useTranslation();
  const notify = useNotify();
  const user = useSelector(selectCurrentUser);
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>{t('common.profile')}</Typography>
      <Card variant="outlined">
        <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ borderBottom: '1px solid', borderColor: 'divider', px: 2 }}>
          <Tab label={t('common.profile')} />
          <Tab label="Security" />
        </Tabs>
        <CardContent>
          {tab === 0 && <ProfileTab user={user} notify={notify} />}
          {tab === 1 && <SecurityTab notify={notify} />}
        </CardContent>
      </Card>
    </Box>
  );
}
