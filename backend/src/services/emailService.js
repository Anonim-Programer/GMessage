const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const FROM = `"GMessage" <${process.env.SMTP_USER || 'noreply@gmessage.app'}>`;
const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

async function sendVerificationEmail(email, token, name) {
  const verifyUrl = `${BASE_URL}/verify-email/${token}`;
  await transporter.sendMail({
    from: FROM, to: email,
    subject: 'Подтвердите email — GMessage',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a2e; color: #fff; padding: 40px; border-radius: 12px;">
        <h1 style="color: #7c3aed; margin-bottom: 8px;">GMessage</h1>
        <h2>Привет, ${name}!</h2>
        <p>Подтвердите ваш email адрес, нажав на кнопку ниже:</p>
        <a href="${verifyUrl}" style="display: inline-block; background: #7c3aed; color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; margin: 16px 0;">Подтвердить email</a>
        <p style="color: #999; font-size: 14px;">Ссылка действительна 24 часа.</p>
      </div>
    `
  }).catch(err => logger.error('Send verification email error:', err));
}

async function sendPasswordResetEmail(email, token, name) {
  const resetUrl = `${BASE_URL}/reset-password/${token}`;
  await transporter.sendMail({
    from: FROM, to: email,
    subject: 'Сброс пароля — GMessage',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a2e; color: #fff; padding: 40px; border-radius: 12px;">
        <h1 style="color: #7c3aed;">GMessage</h1>
        <h2>Сброс пароля</h2>
        <p>Привет, ${name || 'пользователь'}! Вы запросили сброс пароля.</p>
        <a href="${resetUrl}" style="display: inline-block; background: #7c3aed; color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; margin: 16px 0;">Сбросить пароль</a>
        <p style="color: #999; font-size: 14px;">Ссылка действительна 1 час. Если вы не запрашивали сброс — проигнорируйте это письмо.</p>
      </div>
    `
  }).catch(err => logger.error('Send reset email error:', err));
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
