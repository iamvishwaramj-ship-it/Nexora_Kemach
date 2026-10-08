const router = require('express').Router();
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const controller = require('../controllers/authController');

// The login identifier is an Employee User Code (AppUser.userCode) or an
// email address, so it is validated as plain non-empty text — isEmail() here
// would reject every user code outright. Accepted under either body key
// (`userCode` from the current login form, `email` from anything still
// posting the old shape); see controllers/authController.js.
router.post(
  '/login',
  [
    body('userCode')
      .custom((value, { req }) => {
        const identifier = value ?? req.body.email;
        return typeof identifier === 'string' && identifier.trim().length > 0;
      })
      .withMessage('User code is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  controller.login
);

router.post('/refresh', controller.refresh);
router.post('/logout', controller.logout);
router.get('/me', auth(), controller.me);

router.post(
  '/reset-password',
  auth(),
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
      .matches(/[A-Z]/).withMessage('New password must contain an uppercase letter')
      .matches(/[0-9]/).withMessage('New password must contain a number'),
  ],
  controller.resetPassword
);

module.exports = router;
