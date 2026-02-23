const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.post('/register', [
  body('username').trim().isLength({ min: 3, max: 32 }).matches(/^[a-z0-9_]+$/i)
    .withMessage('Username: 3-32 символа, только буквы, цифры и _'),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Пароль должен содержать заглавные, строчные буквы и цифры'),
  body('firstName').optional().trim().isLength({ max: 64 }),
  body('lastName').optional().trim().isLength({ max: 64 }),
  validate
], authController.register);

router.post('/login', [
  body('emailOrUsername').trim().notEmpty(),
  body('password').notEmpty(),
  validate
], authController.login);

router.post('/logout', authenticate, authController.logout);

router.post('/refresh', [
  body('refreshToken').notEmpty(),
  validate
], authController.refreshToken);

router.get('/verify-email/:token', authController.verifyEmail);

router.post('/forgot-password', [
  body('email').isEmail(),
  validate
], authController.forgotPassword);

router.post('/reset-password', [
  body('token').notEmpty(),
  body('password').isLength({ min: 8 }),
  validate
], authController.resetPassword);

router.post('/2fa/setup', authenticate, authController.setup2FA);
router.post('/2fa/enable', authenticate, [
  body('code').isLength({ min: 6, max: 6 }),
  validate
], authController.enable2FA);

module.exports = router;
