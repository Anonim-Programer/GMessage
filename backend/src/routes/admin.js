const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { query } = require('../config/database');

router.use(authenticate, requireAdmin);

router.get('/stats', async (req, res) => {
  const [users, messages, calls, reports] = await Promise.all([
    query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = $1) as online FROM users', ['online']),
    query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL $1) as today FROM messages', ['1 day']),
    query('SELECT COUNT(*) as total FROM calls WHERE created_at > NOW() - INTERVAL $1', ['1 day']),
    query(`SELECT COUNT(*) as pending FROM reports WHERE status = 'pending'`)
  ]);
  res.json({
    users: users.rows[0],
    messages: messages.rows[0],
    calls: calls.rows[0],
    reports: reports.rows[0]
  });
});

router.get('/reports', async (req, res) => {
  const r = await query(
    `SELECT r.*, json_build_object('username', u.username) as reporter,
     json_build_object('username', u2.username) as reported
     FROM reports r JOIN users u ON r.reporter_id = u.id
     LEFT JOIN users u2 ON r.reported_user_id = u2.id
     WHERE r.status = 'pending' ORDER BY r.created_at ASC LIMIT 50`
  );
  res.json({ reports: r.rows });
});

router.put('/reports/:id/resolve', async (req, res) => {
  const { action, notes } = req.body;
  await query(
    `UPDATE reports SET status = 'resolved', admin_notes = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3`,
    [notes, req.userId, req.params.id]
  );
  if (action === 'ban') {
    const report = await query('SELECT reported_user_id FROM reports WHERE id = $1', [req.params.id]);
    await query(`UPDATE users SET is_banned = TRUE, ban_reason = $1 WHERE id = $2`, [notes, report.rows[0].reported_user_id]);
  }
  res.json({ success: true });
});

router.post('/users/:userId/ban', async (req, res) => {
  const { reason, expiresHours } = req.body;
  const expires = expiresHours ? new Date(Date.now() + expiresHours * 3600000) : null;
  await query(
    `UPDATE users SET is_banned = TRUE, ban_reason = $1, ban_expires = $2 WHERE id = $3`,
    [reason, expires, req.params.userId]
  );
  res.json({ success: true });
});

module.exports = router;
