const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const sharp = require('sharp');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');
const rateLimiter = require('../middleware/rateLimiter');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/', 'video/', 'audio/', 'application/pdf', 'application/'];
    if (allowed.some(t => file.mimetype.startsWith(t))) cb(null, true);
    else cb(new Error('Неподдерживаемый тип файла'));
  }
});

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

router.post('/avatar', authenticate, rateLimiter.upload, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });

    const filename = `avatar_${req.userId}_${Date.now()}.webp`;
    const filepath = path.join(UPLOAD_DIR, 'avatars', filename);
    
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    
    await sharp(req.file.buffer)
      .resize(256, 256, { fit: 'cover' })
      .webp({ quality: 85 })
      .toFile(filepath);

    const avatarUrl = `/uploads/avatars/${filename}`;
    await query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatarUrl, req.userId]);

    res.json({ avatarUrl });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка загрузки аватара' });
  }
});

router.post('/file', authenticate, rateLimiter.upload, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });

    const ext = path.extname(req.file.originalname);
    const filename = `file_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    const filepath = path.join(UPLOAD_DIR, 'files', filename);
    
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(filepath, req.file.buffer);

    res.json({
      fileUrl: `/uploads/files/${filename}`,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileMimeType: req.file.mimetype
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка загрузки файла' });
  }
});

router.use('/uploads', express.static(UPLOAD_DIR));

module.exports = router;
