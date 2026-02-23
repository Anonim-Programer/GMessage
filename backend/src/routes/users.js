const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');

router.use(authenticate);

router.get('/me', async (req, res) => {
  const r = await query(`SELECT id, username, email, first_name, last_name, avatar_url, bio, status, theme, 
    reputation_score, reputation_level, email_verified, two_factor_enabled, notification_settings, privacy_settings, created_at
    FROM users WHERE id = $1`, [req.userId]);
  res.json({ user: r.rows[0] });
});

router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json({ users: [] });
  const r = await query(
    `SELECT id, username, first_name, last_name, avatar_url, status, reputation_level
     FROM users WHERE (username ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1)
     AND is_banned = FALSE AND id != $2 LIMIT 20`,
    [`%${q}%`, req.userId]
  );
  res.json({ users: r.rows });
});

router.put('/me', async (req, res) => {
  const { firstName, lastName, bio, theme, customTheme, notificationSettings, privacySettings } = req.body;
  const r = await query(
    `UPDATE users SET first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name),
     bio = COALESCE($3, bio), theme = COALESCE($4, theme), custom_theme = COALESCE($5, custom_theme),
     notification_settings = COALESCE($6, notification_settings), privacy_settings = COALESCE($7, privacy_settings)
     WHERE id = $8 RETURNING id, username, first_name, last_name, bio, avatar_url, theme`,
    [firstName, lastName, bio, theme, customTheme ? JSON.stringify(customTheme) : null,
     notificationSettings ? JSON.stringify(notificationSettings) : null,
     privacySettings ? JSON.stringify(privacySettings) : null, req.userId]
  );
  res.json({ user: r.rows[0] });
});

router.get('/:userId', async (req, res) => {
  const r = await query(
    `SELECT id, username, first_name, last_name, avatar_url, bio, status, reputation_score, reputation_level, created_at
     FROM users WHERE id = $1 AND is_banned = FALSE`, [req.params.userId]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json({ user: r.rows[0] });
});

module.exports = router;
