const { query, transaction } = require('../config/database');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

async function getChats(req, res) {
  try {
    const result = await query(
      `SELECT c.id, c.type, c.name, c.avatar_url, c.updated_at,
              cm.role, cm.muted_until, cm.notifications_enabled,
              (SELECT json_build_object(
                'id', m.id, 'content', m.content, 'type', m.type, 'created_at', m.created_at,
                'sender', json_build_object('username', u.username, 'first_name', u.first_name)
              ) FROM messages m LEFT JOIN users u ON m.sender_id = u.id
               WHERE m.chat_id = c.id AND m.is_deleted = FALSE
               ORDER BY m.created_at DESC LIMIT 1) as last_message,
              (SELECT COUNT(*) FROM messages m2 
               WHERE m2.chat_id = c.id AND m2.is_deleted = FALSE
               AND m2.created_at > COALESCE(
                 (SELECT mr.read_at FROM message_reads mr WHERE mr.message_id = m2.id AND mr.user_id = $1 LIMIT 1),
                 '1970-01-01'
               ) AND m2.sender_id != $1) as unread_count,
              CASE WHEN c.type = 'personal' THEN (
                SELECT json_build_object('id', u2.id, 'username', u2.username, 
                  'first_name', u2.first_name, 'last_name', u2.last_name,
                  'avatar_url', u2.avatar_url, 'status', u2.status)
                FROM chat_members cm2
                JOIN users u2 ON cm2.user_id = u2.id
                WHERE cm2.chat_id = c.id AND cm2.user_id != $1
                LIMIT 1
              ) END as partner
       FROM chats c
       JOIN chat_members cm ON c.id = cm.chat_id
       WHERE cm.user_id = $1 AND cm.is_banned = FALSE
       ORDER BY c.updated_at DESC`,
      [req.userId]
    );
    res.json({ chats: result.rows });
  } catch (err) {
    logger.error('getChats error:', err);
    res.status(500).json({ error: 'Ошибка загрузки чатов' });
  }
}

async function createPersonalChat(req, res) {
  const { targetUserId } = req.body;

  try {
    // Check if personal chat already exists
    const existing = await query(
      `SELECT c.id FROM chats c
       JOIN chat_members cm1 ON c.id = cm1.chat_id AND cm1.user_id = $1
       JOIN chat_members cm2 ON c.id = cm2.chat_id AND cm2.user_id = $2
       WHERE c.type = 'personal'`,
      [req.userId, targetUserId]
    );

    if (existing.rows.length) {
      return res.json({ chat: { id: existing.rows[0].id }, alreadyExists: true });
    }

    // Check if blocked
    const blocked = await query(
      `SELECT id FROM contacts WHERE (user_id = $1 AND contact_id = $2 OR user_id = $2 AND contact_id = $1)
       AND status = 'blocked'`,
      [req.userId, targetUserId]
    );
    if (blocked.rows.length) return res.status(403).json({ error: 'Пользователь заблокирован' });

    const chat = await transaction(async (client) => {
      const chatResult = await client.query(
        `INSERT INTO chats (type, created_by) VALUES ('personal', $1) RETURNING id`,
        [req.userId]
      );
      const chatId = chatResult.rows[0].id;

      await client.query(
        `INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1, $2, 'member'), ($1, $3, 'member')`,
        [chatId, req.userId, targetUserId]
      );

      return { id: chatId };
    });

    res.status(201).json({ chat });
  } catch (err) {
    logger.error('createPersonalChat error:', err);
    res.status(500).json({ error: 'Ошибка создания чата' });
  }
}

async function createGroupChat(req, res) {
  const { name, description, memberIds = [] } = req.body;

  try {
    const chat = await transaction(async (client) => {
      const chatResult = await client.query(
        `INSERT INTO chats (type, name, description, created_by, invite_link)
         VALUES ('group', $1, $2, $3, $4) RETURNING id`,
        [name, description, req.userId, uuidv4().substring(0, 10)]
      );
      const chatId = chatResult.rows[0].id;

      // Add creator as owner
      await client.query(
        `INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1, $2, 'owner')`,
        [chatId, req.userId]
      );

      // Add members
      for (const memberId of memberIds.slice(0, 199)) {
        await client.query(
          `INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1, $2, 'member')
           ON CONFLICT DO NOTHING`,
          [chatId, memberId]
        );
      }

      return { id: chatId };
    });

    res.status(201).json({ chat });
  } catch (err) {
    logger.error('createGroupChat error:', err);
    res.status(500).json({ error: 'Ошибка создания группы' });
  }
}

async function getChatInfo(req, res) {
  const { chatId } = req.params;
  try {
    const chatResult = await query(
      `SELECT c.*, 
              (SELECT COUNT(*) FROM chat_members WHERE chat_id = c.id AND is_banned = FALSE) as member_count
       FROM chats c
       JOIN chat_members cm ON c.id = cm.chat_id
       WHERE c.id = $1 AND cm.user_id = $2`,
      [chatId, req.userId]
    );
    if (!chatResult.rows.length) return res.status(404).json({ error: 'Чат не найден' });

    const members = await query(
      `SELECT u.id, u.username, u.first_name, u.last_name, u.avatar_url, u.status,
              cm.role, cm.joined_at
       FROM chat_members cm
       JOIN users u ON cm.user_id = u.id
       WHERE cm.chat_id = $1 AND cm.is_banned = FALSE
       ORDER BY cm.role, u.username LIMIT 200`,
      [chatId]
    );

    res.json({ chat: chatResult.rows[0], members: members.rows });
  } catch (err) {
    logger.error('getChatInfo error:', err);
    res.status(500).json({ error: 'Ошибка' });
  }
}

module.exports = { getChats, createPersonalChat, createGroupChat, getChatInfo };
