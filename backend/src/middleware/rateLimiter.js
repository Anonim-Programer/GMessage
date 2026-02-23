const rateLimit = require('express-rate-limit');

const general = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Слишком много запросов. Попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false
});

const auth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Слишком много попыток входа. Попробуйте через 15 минут.' }
});

const upload = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  message: { error: 'Лимит загрузок превышен.' }
});

module.exports = { general, auth, upload };
