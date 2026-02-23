const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');

router.use(authenticate);

router.get('/history', async (req, res) => {
  const r = await query(
    `SELECT c.*, json_build_object('id', u.id, 'username', u.username, 'avatar_url', u.avatar_url) as caller
     FROM calls c JOIN users u ON c.caller_id = u.id
     JOIN call_participants cp ON c.id = cp.call_id
     WHERE cp.user_id = $1
     ORDER BY c.created_at DESC LIMIT 50`,
    [req.userId]
  );
  res.json({ calls: r.rows });
});

module.exports = router;
