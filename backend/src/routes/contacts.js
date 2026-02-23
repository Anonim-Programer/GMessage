const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');
const reputationService = require('../services/reputationService');

router.use(authenticate);

router.get('/', async (req, res) => {
  const r = await query(
    `SELECT c.id, c.status, c.nickname, c.created_at,
            json_build_object('id', u.id, 'username', u.username, 'first_name', u.first_name,
            'last_name', u.last_name, 'avatar_url', u.avatar_url, 'status', u.status) as user
     FROM contacts c JOIN users u ON (
       CASE WHEN c.user_id = $1 THEN c.contact_id ELSE c.user_id END = u.id
     )
     WHERE (c.user_id = $1 OR c.contact_id = $1)`,
    [req.userId]
  );
  res.json({ contacts: r.rows });
});

router.post('/', async (req, res) => {
  const { contactId } = req.body;
  if (contactId === req.userId) return res.status(400).json({ error: 'Нельзя добавить себя' });
  
  await query(
    `INSERT INTO contacts (user_id, contact_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [req.userId, contactId]
  );
  res.json({ success: true });
});

router.put('/:contactId/accept', async (req, res) => {
  await query(
    `UPDATE contacts SET status = 'accepted' WHERE user_id = $1 AND contact_id = $2`,
    [req.params.contactId, req.userId]
  );
  await reputationService.addPoints(req.userId, req.params.contactId, 'contact_accepted', 5, 'Принятие контакта');
  res.json({ success: true });
});

router.put('/:contactId/block', async (req, res) => {
  await query(
    `INSERT INTO contacts (user_id, contact_id, status) VALUES ($1, $2, 'blocked')
     ON CONFLICT (user_id, contact_id) DO UPDATE SET status = 'blocked'`,
    [req.userId, req.params.contactId]
  );
  await reputationService.addPoints(req.params.contactId, req.userId, 'blocked', -10, 'Заблокирован пользователем');
  res.json({ success: true });
});

router.delete('/:contactId', async (req, res) => {
  await query(
    'DELETE FROM contacts WHERE (user_id = $1 AND contact_id = $2) OR (user_id = $2 AND contact_id = $1)',
    [req.userId, req.params.contactId]
  );
  res.json({ success: true });
});

module.exports = router;
