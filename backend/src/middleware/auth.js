const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'gmessage-secret-key-change-in-production';

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const result = await query(
      'SELECT id, username, email, is_banned, is_admin FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!result.rows.length || result.rows[0].is_banned) {
      return res.status(401).json({ error: 'Доступ запрещён' });
    }

    req.userId = decoded.userId;
    req.username = result.rows[0].username;
    req.userEmail = result.rows[0].email;
    req.isAdmin = result.rows[0].is_admin;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Недействительный токен' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.isAdmin) return res.status(403).json({ error: 'Требуются права администратора' });
  next();
}

module.exports = { authenticate, requireAdmin };
