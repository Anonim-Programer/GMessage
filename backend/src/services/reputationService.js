const { query } = require('../config/database');
const logger = require('../utils/logger');

const REPUTATION_LIMITS = {
  daily_max: 50,
  min_score: -500
};

async function addPoints(userId, actorId, eventType, points, reason) {
  try {
    await query(
      `INSERT INTO reputation_events (user_id, actor_id, event_type, points, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, actorId, eventType, points, reason]
    );

    const newScore = await query(
      `UPDATE users 
       SET reputation_score = GREATEST(reputation_score + $1, $2)
       WHERE id = $3
       RETURNING reputation_score, reputation_level`,
      [points, REPUTATION_LIMITS.min_score, userId]
    );

    return newScore.rows[0];
  } catch (err) {
    logger.error('addPoints error:', err);
  }
}

async function getUserReputation(userId) {
  const result = await query(
    `SELECT reputation_score, reputation_level,
     (SELECT COUNT(*) FROM reputation_events WHERE user_id = $1 AND points > 0) as positive_events,
     (SELECT COUNT(*) FROM reputation_events WHERE user_id = $1 AND points < 0) as negative_events
     FROM users WHERE id = $1`,
    [userId]
  );
  return result.rows[0];
}

const LEVELS = [
  { name: 'Нарушитель', min: -Infinity, max: 0, color: '#ef4444' },
  { name: 'Новичок', min: 0, max: 50, color: '#6b7280' },
  { name: 'Активный', min: 50, max: 200, color: '#3b82f6' },
  { name: 'Надёжный', min: 200, max: 500, color: '#10b981' },
  { name: 'Опытный', min: 500, max: 1000, color: '#f59e0b' },
  { name: 'Эксперт', min: 1000, max: 5000, color: '#8b5cf6' },
  { name: 'Легенда', min: 5000, max: Infinity, color: '#f97316' }
];

function getLevelInfo(score) {
  return LEVELS.find(l => score >= l.min && score < l.max) || LEVELS[1];
}

module.exports = { addPoints, getUserReputation, getLevelInfo, LEVELS };
