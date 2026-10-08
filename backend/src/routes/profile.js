const router = require('express').Router();
const { body } = require('express-validator');
const { validationResult } = require('express-validator');
const prisma = require('../prisma/client');
const auth = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

// Profile: photo (URL), name (editable), email (read-only — never accepted here).
router.put(
  '/',
  auth(),
  [body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters')],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }
    const { name, profilePhotoUrl } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (profilePhotoUrl !== undefined) data.profilePhotoUrl = profilePhotoUrl;

    const user = await prisma.appUser.update({ where: { id: req.user.id }, data });
    const { passwordHash, ...safe } = user;
    res.json({ success: true, user: safe });
  })
);

module.exports = router;
