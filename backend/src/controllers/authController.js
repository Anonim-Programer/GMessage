const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const { query, transaction } = require('../config/database');
const { redis } = require('../config/redis');
const logger = require('../utils/logger');
const emailService = require('../services/emailService');
const reputationService = require('../services/reputationService');

const JWT_SECRET = process.env.JWT_SECRET || 'gmessage-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'gmessage-refresh-secret';
const JWT_EXPIRES = '15m';
const REFRESH_EXPIRES = '30d';

function generateTokens(userId) {
  const accessToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  const refreshToken = jwt.sign({ userId, jti: uuidv4() }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
  return { accessToken, refreshToken };
}

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register new user
 *     tags: [Auth]
 */
async function register(req, res) {
  const { username, email, password, firstName, lastName } = req.body;

  try {
    // Check for existing user
    const existing = await query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email.toLowerCase(), username.toLowerCase()]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email или username уже заняты' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    // Create user
    const result = await query(
      `INSERT INTO users (username, email, password_hash, first_name, last_name, 
       email_verification_token, email_verification_expires)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, username, email`,
      [username.toLowerCase(), email.toLowerCase(), passwordHash,
       firstName, lastName, verificationToken, verificationExpires]
    );

    const user = result.rows[0];

    // Award reputation for registration
    await reputationService.addPoints(user.id, null, 'registration', 10, 'Регистрация в системе');

    // Send verification email
    await emailService.sendVerificationEmail(email, verificationToken, firstName || username);

    // Generate tokens
    const tokens = generateTokens(user.id);

    // Save refresh token
    await query(
      `INSERT INTO sessions (user_id, refresh_token, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 days')`,
      [user.id, tokens.refreshToken, req.ip, req.get('user-agent')]
    );

    // Log audit
    await query(
      `INSERT INTO audit_log (user_id, action, resource_type, resource_id, ip_address)
       VALUES ($1, 'user_registered', 'user', $2, $3)`,
      [user.id, user.id, req.ip]
    );

    logger.info(`New user registered: ${user.username}`);

    res.status(201).json({
      message: 'Регистрация успешна. Проверьте почту для подтверждения.',
      user: { id: user.id, username: user.username, email: user.email },
      ...tokens
    });
  } catch (err) {
    logger.error('Register error:', err);
    res.status(500).json({ error: 'Ошибка при регистрации' });
  }
}

async function login(req, res) {
  const { emailOrUsername, password, twoFactorCode } = req.body;

  try {
    const result = await query(
      `SELECT id, username, email, password_hash, two_factor_enabled, two_factor_secret,
              is_banned, ban_reason, ban_expires, login_attempts, locked_until, email_verified
       FROM users WHERE email = $1 OR username = $1`,
      [emailOrUsername.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Неверные учётные данные' });
    }

    const user = result.rows[0];

    // Check ban
    if (user.is_banned) {
      if (!user.ban_expires || user.ban_expires > new Date()) {
        return res.status(403).json({ error: `Аккаунт заблокирован: ${user.ban_reason}` });
      }
      // Auto-unban if expired
      await query('UPDATE users SET is_banned = FALSE WHERE id = $1', [user.id]);
    }

    // Check account lock (brute force protection)
    if (user.locked_until && user.locked_until > new Date()) {
      const minutesLeft = Math.ceil((user.locked_until - Date.now()) / 60000);
      return res.status(429).json({ error: `Аккаунт временно заблокирован. Ожидайте ${minutesLeft} мин.` });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      // Increment failed attempts
      const attempts = user.login_attempts + 1;
      const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await query(
        'UPDATE users SET login_attempts = $1, locked_until = $2 WHERE id = $3',
        [attempts, lockUntil, user.id]
      );
      return res.status(401).json({ error: 'Неверные учётные данные' });
    }

    // Check 2FA
    if (user.two_factor_enabled) {
      if (!twoFactorCode) {
        return res.status(200).json({ requiresTwoFactor: true });
      }
      const verified = speakeasy.totp.verify({
        secret: user.two_factor_secret,
        encoding: 'base32',
        token: twoFactorCode,
        window: 2
      });
      if (!verified) {
        return res.status(401).json({ error: 'Неверный код 2FA' });
      }
    }

    // Reset login attempts
    await query(
      'UPDATE users SET login_attempts = 0, locked_until = NULL, status = $1, last_seen = NOW() WHERE id = $2',
      ['online', user.id]
    );

    const tokens = generateTokens(user.id);

    // Save session
    await query(
      `INSERT INTO sessions (user_id, refresh_token, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 days')`,
      [user.id, tokens.refreshToken, req.ip, req.get('user-agent')]
    );

    // Get full user data
    const userData = await query(
      `SELECT id, username, email, first_name, last_name, avatar_url, bio, status, 
              theme, reputation_score, reputation_level, email_verified, two_factor_enabled
       FROM users WHERE id = $1`,
      [user.id]
    );

    res.json({
      user: userData.rows[0],
      ...tokens
    });
  } catch (err) {
    logger.error('Login error:', err);
    res.status(500).json({ error: 'Ошибка при входе' });
  }
}

async function logout(req, res) {
  try {
    await query(
      'UPDATE sessions SET is_active = FALSE WHERE user_id = $1 AND refresh_token = $2',
      [req.userId, req.body.refreshToken]
    );

    await query(
      'UPDATE users SET status = $1, last_seen = NOW() WHERE id = $2',
      ['offline', req.userId]
    );

    res.json({ message: 'Выход выполнен' });
  } catch (err) {
    logger.error('Logout error:', err);
    res.status(500).json({ error: 'Ошибка при выходе' });
  }
}

async function refreshToken(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ error: 'Refresh token обязателен' });

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);

    const session = await query(
      'SELECT * FROM sessions WHERE refresh_token = $1 AND is_active = TRUE AND expires_at > NOW()',
      [refreshToken]
    );

    if (session.rows.length === 0) {
      return res.status(401).json({ error: 'Недействительный refresh token' });
    }

    // Check if token was blacklisted (logout from all devices)
    const blacklisted = await redis.get(`blacklist:${refreshToken}`);
    if (blacklisted) return res.status(401).json({ error: 'Токен отозван' });

    const tokens = generateTokens(decoded.userId);

    // Rotate refresh token
    await query(
      `UPDATE sessions SET refresh_token = $1, expires_at = NOW() + INTERVAL '30 days' 
       WHERE refresh_token = $2`,
      [tokens.refreshToken, refreshToken]
    );

    res.json(tokens);
  } catch (err) {
    res.status(401).json({ error: 'Недействительный refresh token' });
  }
}

async function verifyEmail(req, res) {
  const { token } = req.params;

  try {
    const result = await query(
      `UPDATE users SET email_verified = TRUE, email_verification_token = NULL, email_verification_expires = NULL
       WHERE email_verification_token = $1 AND email_verification_expires > NOW()
       RETURNING id, username`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Неверный или истёкший токен подтверждения' });
    }

    // Award reputation for email verification
    await reputationService.addPoints(result.rows[0].id, null, 'email_verified', 20, 'Подтверждение email');

    res.json({ message: 'Email успешно подтверждён' });
  } catch (err) {
    logger.error('Email verification error:', err);
    res.status(500).json({ error: 'Ошибка при подтверждении email' });
  }
}

async function forgotPassword(req, res) {
  const { email } = req.body;

  try {
    const result = await query('SELECT id, first_name FROM users WHERE email = $1', [email.toLowerCase()]);

    // Always return success to prevent email enumeration
    res.json({ message: 'Если email существует, вы получите письмо для сброса пароля' });

    if (result.rows.length === 0) return;

    const user = result.rows[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await query(
      'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3',
      [resetToken, resetExpires, user.id]
    );

    await emailService.sendPasswordResetEmail(email, resetToken, user.first_name);
  } catch (err) {
    logger.error('Forgot password error:', err);
  }
}

async function resetPassword(req, res) {
  const { token, password } = req.body;

  try {
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await query(
      `UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL,
       login_attempts = 0, locked_until = NULL
       WHERE password_reset_token = $2 AND password_reset_expires > NOW()
       RETURNING id`,
      [passwordHash, token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Неверный или истёкший токен' });
    }

    // Invalidate all sessions
    await query('UPDATE sessions SET is_active = FALSE WHERE user_id = $1', [result.rows[0].id]);

    res.json({ message: 'Пароль успешно изменён' });
  } catch (err) {
    logger.error('Reset password error:', err);
    res.status(500).json({ error: 'Ошибка при сбросе пароля' });
  }
}

async function setup2FA(req, res) {
  try {
    const secret = speakeasy.generateSecret({ name: `GMessage (${req.userEmail})`, issuer: 'GMessage' });

    await query('UPDATE users SET two_factor_secret = $1 WHERE id = $2', [secret.base32, req.userId]);

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    res.json({ secret: secret.base32, qrCode: qrCodeUrl });
  } catch (err) {
    logger.error('2FA setup error:', err);
    res.status(500).json({ error: 'Ошибка при настройке 2FA' });
  }
}

async function enable2FA(req, res) {
  const { code } = req.body;

  try {
    const result = await query('SELECT two_factor_secret FROM users WHERE id = $1', [req.userId]);
    const { two_factor_secret } = result.rows[0];

    const verified = speakeasy.totp.verify({
      secret: two_factor_secret,
      encoding: 'base32',
      token: code,
      window: 2
    });

    if (!verified) return res.status(400).json({ error: 'Неверный код' });

    await query('UPDATE users SET two_factor_enabled = TRUE WHERE id = $1', [req.userId]);

    res.json({ message: '2FA успешно включена' });
  } catch (err) {
    logger.error('Enable 2FA error:', err);
    res.status(500).json({ error: 'Ошибка при включении 2FA' });
  }
}

module.exports = { register, login, logout, refreshToken, verifyEmail, forgotPassword, resetPassword, setup2FA, enable2FA };
