const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { getChats, createPersonalChat, createGroupChat, getChatInfo } = require('../controllers/chatController');

router.use(authenticate);
router.get('/', getChats);
router.get('/:chatId', getChatInfo);
router.post('/personal', [body('targetUserId').isUUID(), validate], createPersonalChat);
router.post('/group', [body('name').trim().isLength({ min: 1, max: 128 }), validate], createGroupChat);
module.exports = router;
