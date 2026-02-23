const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getChatMessages, searchMessages, pinMessage } = require('../controllers/messageController');

router.use(authenticate);
router.get('/chat/:chatId', getChatMessages);
router.get('/chat/:chatId/search', searchMessages);
router.post('/:messageId/pin', pinMessage);
module.exports = router;
