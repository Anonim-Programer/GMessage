const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { redis } = require('../config/redis');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'gmessage-secret-key-change-in-production';

// Track connected users: userId -> Set of socketIds
const connectedUsers = new Map();

function initSocketHandlers(io) {
  // Auth middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, JWT_SECRET);

      // Check user exists and is not banned
      const result = await query(
        'SELECT id, username, avatar_url, is_banned FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (!result.rows[0] || result.rows[0].is_banned) {
        return next(new Error('Access denied'));
      }

      socket.userId = decoded.userId;
      socket.user = result.rows[0];
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const { userId } = socket;
    logger.info(`User connected: ${userId} (socket: ${socket.id})`);

    // Track connection
    if (!connectedUsers.has(userId)) connectedUsers.set(userId, new Set());
    connectedUsers.get(userId).add(socket.id);

    // Update user status
    await updateUserStatus(userId, 'online');

    // Join user's chat rooms
    await joinUserChats(socket, userId);

    // Notify contacts that user is online
    await notifyContactsStatusChange(io, userId, 'online');

    // ============================================================
    // MESSAGING EVENTS
    // ============================================================
    socket.on('message:send', async (data) => {
      try {
        const { chatId, content, type = 'text', replyToId, fileUrl, fileName, fileSize, fileMimeType, duration } = data;

        // Verify user is a chat member
        const membership = await query(
          'SELECT id FROM chat_members WHERE chat_id = $1 AND user_id = $2 AND is_banned = FALSE',
          [chatId, userId]
        );
        if (!membership.rows.length) {
          return socket.emit('error', { message: 'Нет доступа к чату' });
        }

        // Save message to DB
        const result = await query(
          `INSERT INTO messages (chat_id, sender_id, type, content, reply_to_id, file_url, file_name, 
           file_size, file_mime_type, duration)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id, chat_id, sender_id, type, content, reply_to_id, file_url, file_name, 
           file_size, file_mime_type, duration, created_at`,
          [chatId, userId, type, content, replyToId, fileUrl, fileName, fileSize, fileMimeType, duration]
        );

        const message = result.rows[0];

        // Get sender info
        const senderInfo = await query(
          'SELECT id, username, first_name, last_name, avatar_url FROM users WHERE id = $1',
          [userId]
        );
        message.sender = senderInfo.rows[0];

        // If it's a reply, fetch the original message preview
        if (replyToId) {
          const replyMsg = await query(
            'SELECT id, content, type, sender_id FROM messages WHERE id = $1',
            [replyToId]
          );
          message.replyTo = replyMsg.rows[0];
        }

        // Update chat's last message timestamp
        await query('UPDATE chats SET updated_at = NOW() WHERE id = $1', [chatId]);

        // Emit to all chat members
        io.to(`chat:${chatId}`).emit('message:new', message);

        // Send push notifications to offline members
        await sendOfflineNotifications(io, chatId, userId, message);

        // Award reputation for activity
        await query(
          `INSERT INTO reputation_events (user_id, event_type, points, reason)
           VALUES ($1, 'message_sent', 1, 'Активность в чате')`,
          [userId]
        );

        // Every 100 messages, update score
        const msgCount = await query(
          'SELECT COUNT(*) FROM messages WHERE sender_id = $1', [userId]
        );
        if (parseInt(msgCount.rows[0].count) % 100 === 0) {
          await query(
            'UPDATE users SET reputation_score = reputation_score + 5 WHERE id = $1', [userId]
          );
        }

      } catch (err) {
        logger.error('message:send error:', err);
        socket.emit('error', { message: 'Ошибка при отправке сообщения' });
      }
    });

    socket.on('message:edit', async (data) => {
      try {
        const { messageId, content } = data;

        const result = await query(
          `UPDATE messages SET content = $1, is_edited = TRUE, edited_at = NOW()
           WHERE id = $2 AND sender_id = $3 AND is_deleted = FALSE
           RETURNING *`,
          [content, messageId, userId]
        );

        if (!result.rows.length) return socket.emit('error', { message: 'Нельзя редактировать это сообщение' });

        io.to(`chat:${result.rows[0].chat_id}`).emit('message:edited', {
          messageId,
          content,
          editedAt: result.rows[0].edited_at
        });
      } catch (err) {
        logger.error('message:edit error:', err);
      }
    });

    socket.on('message:delete', async (data) => {
      try {
        const { messageId } = data;

        // Allow sender or chat admin to delete
        const msgResult = await query(
          'SELECT chat_id, sender_id FROM messages WHERE id = $1', [messageId]
        );
        if (!msgResult.rows.length) return;

        const msg = msgResult.rows[0];
        const isAdmin = await query(
          `SELECT id FROM chat_members WHERE chat_id = $1 AND user_id = $2 
           AND role IN ('owner', 'admin', 'moderator')`,
          [msg.chat_id, userId]
        );

        if (msg.sender_id !== userId && !isAdmin.rows.length) {
          return socket.emit('error', { message: 'Нет прав для удаления' });
        }

        await query(
          'UPDATE messages SET is_deleted = TRUE, deleted_at = NOW(), content = NULL WHERE id = $1',
          [messageId]
        );

        io.to(`chat:${msg.chat_id}`).emit('message:deleted', { messageId, chatId: msg.chat_id });
      } catch (err) {
        logger.error('message:delete error:', err);
      }
    });

    socket.on('message:reaction', async (data) => {
      try {
        const { messageId, emoji } = data;

        // Get chat for this message
        const msgResult = await query('SELECT chat_id FROM messages WHERE id = $1', [messageId]);
        if (!msgResult.rows.length) return;

        const chatId = msgResult.rows[0].chat_id;

        // Toggle reaction
        const existing = await query(
          'SELECT id FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
          [messageId, userId, emoji]
        );

        if (existing.rows.length) {
          await query('DELETE FROM message_reactions WHERE id = $1', [existing.rows[0].id]);
          io.to(`chat:${chatId}`).emit('message:reaction_removed', { messageId, userId, emoji });
        } else {
          await query(
            'INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)',
            [messageId, userId, emoji]
          );
          io.to(`chat:${chatId}`).emit('message:reaction_added', { messageId, userId, emoji });
        }
      } catch (err) {
        logger.error('message:reaction error:', err);
      }
    });

    socket.on('message:read', async (data) => {
      try {
        const { messageIds, chatId } = data;

        // Bulk insert read status
        const values = messageIds.map((id, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
        const params = messageIds.flatMap(id => [id, userId]);

        await query(
          `INSERT INTO message_reads (message_id, user_id) VALUES ${values}
           ON CONFLICT (message_id, user_id) DO NOTHING`,
          params
        );

        // Update last read in chat members
        await query(
          `UPDATE chat_members SET last_read_message_id = $1 
           WHERE chat_id = $2 AND user_id = $3`,
          [messageIds[messageIds.length - 1], chatId, userId]
        );

        socket.to(`chat:${chatId}`).emit('message:read_by', { messageIds, userId, chatId });
      } catch (err) {
        logger.error('message:read error:', err);
      }
    });

    // ============================================================
    // TYPING INDICATOR
    // ============================================================
    socket.on('typing:start', async ({ chatId }) => {
      socket.to(`chat:${chatId}`).emit('typing:started', {
        chatId,
        userId,
        username: socket.user.username
      });
    });

    socket.on('typing:stop', async ({ chatId }) => {
      socket.to(`chat:${chatId}`).emit('typing:stopped', { chatId, userId });
    });

    // ============================================================
    // WEBRTC SIGNALING FOR CALLS
    // ============================================================
    socket.on('call:initiate', async (data) => {
      try {
        const { targetUserId, type, chatId } = data;

        // Check if target is online
        const targetSockets = connectedUsers.get(targetUserId);
        if (!targetSockets || targetSockets.size === 0) {
          return socket.emit('call:user_offline', { targetUserId });
        }

        // Create call record
        const callResult = await query(
          `INSERT INTO calls (caller_id, chat_id, type, status) VALUES ($1, $2, $3, 'ringing')
           RETURNING id`,
          [userId, chatId, type]
        );
        const callId = callResult.rows[0].id;

        await query(
          'INSERT INTO call_participants (call_id, user_id) VALUES ($1, $2), ($1, $3)',
          [callId, userId, targetUserId]
        );

        // Notify target
        const callerInfo = await query(
          'SELECT id, username, first_name, last_name, avatar_url FROM users WHERE id = $1', [userId]
        );

        io.to([...targetSockets]).emit('call:incoming', {
          callId,
          caller: callerInfo.rows[0],
          type
        });

        socket.emit('call:ringing', { callId });

        // Auto-cancel if no answer in 30 seconds
        setTimeout(async () => {
          const callStatus = await query('SELECT status FROM calls WHERE id = $1', [callId]);
          if (callStatus.rows[0]?.status === 'ringing') {
            await query('UPDATE calls SET status = $1, ended_at = NOW() WHERE id = $2', ['missed', callId]);
            io.to([...targetSockets]).emit('call:missed', { callId });
            socket.emit('call:no_answer', { callId });
          }
        }, 30000);

      } catch (err) {
        logger.error('call:initiate error:', err);
      }
    });

    socket.on('call:accept', async ({ callId }) => {
      try {
        await query(
          `UPDATE calls SET status = 'active', started_at = NOW() WHERE id = $1
           RETURNING caller_id`,
          [callId]
        );
        await query(
          'UPDATE call_participants SET joined_at = NOW() WHERE call_id = $1 AND user_id = $2',
          [callId, userId]
        );

        // Notify caller
        const callData = await query('SELECT caller_id FROM calls WHERE id = $1', [callId]);
        const callerSockets = connectedUsers.get(callData.rows[0].caller_id);

        if (callerSockets) {
          io.to([...callerSockets]).emit('call:accepted', { callId, userId });
        }
      } catch (err) {
        logger.error('call:accept error:', err);
      }
    });

    socket.on('call:decline', async ({ callId }) => {
      try {
        await query('UPDATE calls SET status = $1, ended_at = NOW() WHERE id = $2', ['declined', callId]);
        const callData = await query('SELECT caller_id FROM calls WHERE id = $1', [callId]);
        const callerSockets = connectedUsers.get(callData.rows[0]?.caller_id);
        if (callerSockets) {
          io.to([...callerSockets]).emit('call:declined', { callId, userId });
        }
      } catch (err) {
        logger.error('call:decline error:', err);
      }
    });

    socket.on('call:end', async ({ callId }) => {
      try {
        const callData = await query(
          'SELECT started_at, caller_id FROM calls WHERE id = $1', [callId]
        );
        const duration = callData.rows[0]?.started_at
          ? Math.floor((Date.now() - callData.rows[0].started_at) / 1000)
          : 0;

        await query(
          `UPDATE calls SET status = 'ended', ended_at = NOW(), duration = $1 WHERE id = $2`,
          [duration, callId]
        );
        await query(
          'UPDATE call_participants SET left_at = NOW() WHERE call_id = $1 AND user_id = $2',
          [callId, userId]
        );

        io.to(`call:${callId}`).emit('call:ended', { callId, duration });
      } catch (err) {
        logger.error('call:end error:', err);
      }
    });

    // WebRTC signaling pass-through
    socket.on('webrtc:offer', ({ targetUserId, callId, offer }) => {
      const targetSockets = connectedUsers.get(targetUserId);
      if (targetSockets) {
        io.to([...targetSockets]).emit('webrtc:offer', { callId, offer, fromUserId: userId });
      }
    });

    socket.on('webrtc:answer', ({ targetUserId, callId, answer }) => {
      const targetSockets = connectedUsers.get(targetUserId);
      if (targetSockets) {
        io.to([...targetSockets]).emit('webrtc:answer', { callId, answer, fromUserId: userId });
      }
    });

    socket.on('webrtc:ice_candidate', ({ targetUserId, callId, candidate }) => {
      const targetSockets = connectedUsers.get(targetUserId);
      if (targetSockets) {
        io.to([...targetSockets]).emit('webrtc:ice_candidate', { callId, candidate, fromUserId: userId });
      }
    });

    socket.on('call:media_state', ({ callId, isVideoOn, isMuted, isScreenSharing }) => {
      socket.to(`call:${callId}`).emit('call:media_state_changed', {
        userId,
        isVideoOn,
        isMuted,
        isScreenSharing
      });
    });

    // ============================================================
    // DISCONNECT
    // ============================================================
    socket.on('disconnect', async () => {
      const userSockets = connectedUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          connectedUsers.delete(userId);
          await updateUserStatus(userId, 'offline');
          await notifyContactsStatusChange(io, userId, 'offline');
        }
      }
      logger.info(`User disconnected: ${userId}`);
    });
  });

  return io;
}

async function joinUserChats(socket, userId) {
  try {
    const chats = await query(
      'SELECT chat_id FROM chat_members WHERE user_id = $1 AND is_banned = FALSE',
      [userId]
    );
    for (const row of chats.rows) {
      socket.join(`chat:${row.chat_id}`);
    }
  } catch (err) {
    logger.error('joinUserChats error:', err);
  }
}

async function updateUserStatus(userId, status) {
  await query(
    'UPDATE users SET status = $1, last_seen = NOW() WHERE id = $2',
    [status, userId]
  );
}

async function notifyContactsStatusChange(io, userId, status) {
  try {
    const contacts = await query(
      `SELECT user_id FROM contacts WHERE contact_id = $1 AND status = 'accepted'
       UNION
       SELECT contact_id FROM contacts WHERE user_id = $1 AND status = 'accepted'`,
      [userId]
    );

    for (const contact of contacts.rows) {
      const contactSockets = connectedUsers.get(contact.user_id || contact.contact_id);
      if (contactSockets) {
        io.to([...contactSockets]).emit('contact:status_changed', { userId, status });
      }
    }
  } catch (err) {
    logger.error('notifyContactsStatusChange error:', err);
  }
}

async function sendOfflineNotifications(io, chatId, senderId, message) {
  try {
    const members = await query(
      `SELECT cm.user_id FROM chat_members cm
       WHERE cm.chat_id = $1 AND cm.user_id != $2 
       AND cm.notifications_enabled = TRUE AND cm.muted_until IS NULL OR cm.muted_until < NOW()`,
      [chatId, senderId]
    );

    for (const member of members.rows) {
      if (!connectedUsers.has(member.user_id)) {
        await query(
          `INSERT INTO notifications (user_id, type, title, body, data)
           VALUES ($1, 'message', 'Новое сообщение', $2, $3)`,
          [member.user_id, message.content?.substring(0, 100), JSON.stringify({ chatId, messageId: message.id })]
        );
      }
    }
  } catch (err) {
    logger.error('sendOfflineNotifications error:', err);
  }
}

module.exports = { initSocketHandlers, connectedUsers };
