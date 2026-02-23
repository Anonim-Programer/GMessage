const { query } = require('../config/database');
const logger = require('../utils/logger');

async function getChatMessages(req, res) {
  const { chatId } = req.params;
  const { before, limit = 50 } = req.query;

  try {
    // Verify membership
    const membership = await query(
      'SELECT id FROM chat_members WHERE chat_id = $1 AND user_id = $2',
      [chatId, req.userId]
    );
    if (!membership.rows.length) return res.status(403).json({ error: 'Нет доступа' });

    let queryStr = `
      SELECT m.*, 
             json_build_object('id', u.id, 'username', u.username, 'first_name', u.first_name, 
             'last_name', u.last_name, 'avatar_url', u.avatar_url) as sender,
             (SELECT json_agg(json_build_object('emoji', r.emoji, 'user_id', r.user_id))
              FROM message_reactions r WHERE r.message_id = m.id) as reactions,
             (SELECT json_build_object('id', rm.id, 'content', rm.content, 'type', rm.type)
              FROM messages rm WHERE rm.id = m.reply_to_id) as reply_to
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      WHERE m.chat_id = $1 AND m.is_deleted = FALSE
    `;
    const params = [chatId];

    if (before) {
      params.push(before);
      queryStr += ` AND m.created_at < $${params.length}`;
    }

    queryStr += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1}`;
    params.push(Math.min(parseInt(limit), 100));

    const result = await query(queryStr, params);

    res.json({
      messages: result.rows.reverse(),
      hasMore: result.rows.length === parseInt(limit)
    });
  } catch (err) {
    logger.error('getChatMessages error:', err);
    res.status(500).json({ error: 'Ошибка загрузки сообщений' });
  }
}

async function searchMessages(req, res) {
  const { chatId } = req.params;
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Поисковый запрос обязателен' });

  try {
    const result = await query(
      `SELECT m.*, json_build_object('id', u.id, 'username', u.username, 'avatar_url', u.avatar_url) as sender
       FROM messages m
       LEFT JOIN users u ON m.sender_id = u.id
       WHERE m.chat_id = $1 AND m.is_deleted = FALSE
       AND to_tsvector('russian', coalesce(m.content, '')) @@ plainto_tsquery('russian', $2)
       ORDER BY m.created_at DESC LIMIT 50`,
      [chatId, q]
    );
    res.json({ messages: result.rows });
  } catch (err) {
    logger.error('searchMessages error:', err);
    res.status(500).json({ error: 'Ошибка поиска' });
  }
}

async function pinMessage(req, res) {
  const { messageId } = req.params;
  try {
    const msg = await query('SELECT chat_id FROM messages WHERE id = $1', [messageId]);
    if (!msg.rows.length) return res.status(404).json({ error: 'Сообщение не найдено' });

    const isAdmin = await query(
      `SELECT id FROM chat_members WHERE chat_id = $1 AND user_id = $2 AND role IN ('owner', 'admin', 'moderator')`,
      [msg.rows[0].chat_id, req.userId]
    );
    if (!isAdmin.rows.length) return res.status(403).json({ error: 'Нет прав' });

    await query('UPDATE messages SET is_pinned = TRUE WHERE id = $1', [messageId]);

    const io = req.app.get('io');
    io.to(`chat:${msg.rows[0].chat_id}`).emit('message:pinned', { messageId });

    res.json({ success: true });
  } catch (err) {
    logger.error('pinMessage error:', err);
    res.status(500).json({ error: 'Ошибка' });
  }
}

module.exports = { getChatMessages, searchMessages, pinMessage };
