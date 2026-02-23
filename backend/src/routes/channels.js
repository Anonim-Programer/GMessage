const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { query, transaction } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

router.use(authenticate);

router.post('/', async (req, res) => {
  const { name, description, username, category, isPublic = true } = req.body;
  try {
    const result = await transaction(async (client) => {
      const chatResult = await client.query(
        `INSERT INTO chats (type, name, description, created_by, is_public, invite_link)
         VALUES ('channel', $1, $2, $3, $4, $5) RETURNING id`,
        [name, description, req.userId, isPublic, uuidv4().substring(0, 10)]
      );
      const chatId = chatResult.rows[0].id;

      await client.query(
        `INSERT INTO channels (chat_id, username, category) VALUES ($1, $2, $3) RETURNING id`,
        [chatId, username?.toLowerCase(), category]
      );

      await client.query(
        `INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1, $2, 'owner')`,
        [chatId, req.userId]
      );

      return { chatId };
    });
    res.status(201).json({ channel: result });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username уже занят' });
    res.status(500).json({ error: 'Ошибка создания канала' });
  }
});

router.get('/explore', async (req, res) => {
  const { q, category } = req.query;
  let sql = `SELECT c.id, c.name, c.description, c.avatar_url,
              ch.username, ch.subscriber_count, ch.verified, ch.category
              FROM channels ch JOIN chats c ON ch.chat_id = c.id
              WHERE c.is_public = TRUE`;
  const params = [];
  if (q) { params.push(`%${q}%`); sql += ` AND (c.name ILIKE $${params.length} OR ch.username ILIKE $${params.length})`; }
  if (category) { params.push(category); sql += ` AND ch.category = $${params.length}`; }
  sql += ' ORDER BY ch.subscriber_count DESC LIMIT 50';
  const r = await query(sql, params);
  res.json({ channels: r.rows });
});

module.exports = router;
