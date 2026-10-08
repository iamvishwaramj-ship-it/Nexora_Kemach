import { z } from 'zod';
import { email, password, confirmPasswordRefinement, personName } from './common';

// The login identifier is an Employee User Code (AppUser.userCode) or an
// email address — validated as plain non-empty text, since email() would
// reject every user code. The server accepts either against both columns
// (see backend services/authService.js's login()).
export const loginSchema = z.object({
  userCode: z
    .string({ required_error: 'Employee user code is required' })
    .trim()
    .min(1, 'Employee user code is required'),
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

export const resetPasswordSchema = confirmPasswordRefinement(
  z.object({
    currentPassword: z.string({ required_error: 'Current password is required' }).min(1, 'Current password is required'),
    newPassword: password('New password'),
    confirmPassword: z.string({ required_error: 'Please confirm your new password' }).min(1, 'Please confirm your new password'),
  }),
  'newPassword',
  'confirmPassword'
);

export const profileSchema = z.object({
  name: personName('Name'),
  email: email('Email').optional(), // read-only on the profile form
});
