# 💬 GMessage — Production-Ready Messenger

Полноценный мессенджер с реальным временем, видеозвонками, группами и системой репутации.

## 🏗 Архитектура

```
                    ┌─────────────┐
         Users ───▶ │    Nginx    │ ◀─── Load Balancer
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │                         │
       ┌──────▼──────┐          ┌───────▼──────┐
       │   Frontend  │          │    Backend   │
       │  React/Vite │          │  Node.js +   │
       │   Port 3000 │          │  Express     │
       └─────────────┘          │  Port 5000   │
                                │  Socket.io   │
                                └──────┬───────┘
                                       │
                         ┌─────────────┼─────────────┐
                         │             │             │
                  ┌──────▼──┐   ┌──────▼──┐   ┌──────▼──┐
                  │PostgreSQL│   │  Redis  │   │ Uploads │
                  │  DB      │   │ Cache   │   │  Files  │
                  └──────────┘   └─────────┘   └─────────┘
```

## ✨ Функционал

### 🔐 Аутентификация
- Регистрация / Авторизация с JWT + Refresh tokens
- Хеширование паролей bcrypt (12 rounds)
- Подтверждение email через ссылку
- Сброс пароля
- 2FA (TOTP через Google Authenticator)
- Защита от brute-force (блокировка аккаунта)

### 👤 Профиль
- Уникальный username, аватар, имя, bio
- Тёмная / светлая тема
- Статус (онлайн, отошёл, не беспокоить, невидимый)
- Система репутации (Новичок → Легенда)

### 💬 Мессенджер
- Личные чаты, группы, каналы
- Текст, изображения, файлы, голосовые сообщения
- Редактирование и удаление сообщений
- Реакции на сообщения
- Ответы на сообщения
- Индикатор "печатает..."
- Статус прочтения ✓✓
- Поиск по сообщениям

### 📞 Звонки (WebRTC)
- Голосовые и видео-звонки 1:1
- Групповые звонки
- Демонстрация экрана
- Управление камерой и микрофоном
- WebRTC с ICE/STUN/TURN

### 📇 Контакты
- Добавление / удаление контактов
- Блокировка пользователей
- Поиск по username

### ⭐ Репутация
| Уровень | Очки |
|---------|------|
| Нарушитель | < 0 |
| Новичок | 0–50 |
| Активный | 50–200 |
| Надёжный | 200–500 |
| Опытный | 500–1000 |
| Эксперт | 1000–5000 |
| Легенда | 5000+ |

### 🛡 Безопасность
- Helmet.js security headers
- Rate limiting (300 req/15min general, 20 auth)
- SQL injection protection (parameterized queries)
- Input validation (express-validator)
- CORS protection
- JWT token rotation

## 🚀 Быстрый старт

### Docker (рекомендуется)
```bash
# 1. Клонировать репозиторий
git clone https://github.com/yourname/gmessage.git
cd gmessage

# 2. Настроить окружение
cp .env.example .env
# Отредактировать .env (особенно JWT_SECRET и SMTP настройки)

# 3. Запустить
docker compose up -d

# 4. Открыть
# Frontend: http://localhost:80
# API Docs: http://localhost:5000/api/docs
```

### Разработка без Docker

**Backend:**
```bash
cd backend
npm install
cp .env.example .env.local
# Настроить PostgreSQL и Redis
node src/db/migrate.js  # Применить схему БД
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## 📁 Структура проекта

```
gmessage/
├── backend/
│   ├── src/
│   │   ├── controllers/    # Бизнес-логика
│   │   │   ├── authController.js
│   │   │   ├── chatController.js
│   │   │   └── messageController.js
│   │   ├── routes/         # Express роуты
│   │   ├── middleware/      # Auth, validation, rate-limit
│   │   ├── services/        # Email, reputation
│   │   ├── websocket/       # Socket.io handlers
│   │   ├── config/          # DB, Redis, Swagger
│   │   ├── utils/           # Logger
│   │   └── db/
│   │       └── schema.sql   # Полная схема БД
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/           # Страницы
│   │   ├── components/      # React компоненты
│   │   │   ├── chat/        # Чат, сообщения
│   │   │   ├── calls/       # Звонки (WebRTC)
│   │   │   ├── common/      # Avatar и др.
│   │   │   └── modals/      # Модальные окна
│   │   ├── store/           # Zustand stores
│   │   │   ├── authStore.js
│   │   │   ├── chatStore.js
│   │   │   ├── socketStore.js
│   │   │   └── callStore.js
│   │   └── utils/api.js     # Axios с interceptors
│   └── Dockerfile
├── nginx/
│   └── nginx.conf
├── docker-compose.yml
└── .env.example
```

## 🗄 База данных

**Таблицы:**
- `users` — пользователи
- `sessions` — сессии и refresh tokens
- `chats` — чаты (личные, группы, каналы)
- `chat_members` — участники с ролями
- `messages` — сообщения
- `message_reactions` — реакции
- `message_reads` — статус прочтения
- `contacts` — контакты и блокировки
- `channels` — каналы
- `calls` — история звонков
- `call_participants` — участники звонков
- `reputation_events` — события репутации
- `reports` — жалобы
- `notifications` — уведомления
- `audit_log` — лог действий

## 🔌 WebSocket события

| Событие | Направление | Описание |
|---------|------------|---------|
| `message:send` | Client→Server | Отправить сообщение |
| `message:new` | Server→Client | Новое сообщение |
| `message:edited` | Server→Client | Сообщение отредактировано |
| `message:deleted` | Server→Client | Сообщение удалено |
| `message:reaction` | Client→Server | Реакция на сообщение |
| `typing:start/stop` | Client→Server | Статус печатания |
| `typing:started/stopped` | Server→Client | Кто-то печатает |
| `call:initiate` | Client→Server | Начать звонок |
| `call:incoming` | Server→Client | Входящий звонок |
| `call:accept/decline` | Client→Server | Принять/отклонить |
| `webrtc:offer/answer/ice_candidate` | Peer→Peer | WebRTC сигнализация |

## 📊 API Endpoints

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
GET    /api/auth/verify-email/:token
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
POST   /api/auth/2fa/setup
POST   /api/auth/2fa/enable

GET    /api/users/me
PUT    /api/users/me
GET    /api/users/search?q=
GET    /api/users/:userId

GET    /api/chats
POST   /api/chats/personal
POST   /api/chats/group
GET    /api/chats/:chatId

GET    /api/messages/chat/:chatId
GET    /api/messages/chat/:chatId/search?q=
POST   /api/messages/:messageId/pin

GET    /api/contacts
POST   /api/contacts
PUT    /api/contacts/:id/accept
PUT    /api/contacts/:id/block
DELETE /api/contacts/:id

GET    /api/calls/history

POST   /api/channels
GET    /api/channels/explore

POST   /api/uploads/avatar
POST   /api/uploads/file

GET    /api/admin/stats (admin only)
GET    /api/admin/reports (admin only)
```

Swagger UI: **http://localhost:5000/api/docs**

## 🔧 Настройка для production

1. **TURN-сервер** для WebRTC (обязателен вне локальной сети):
   - Использовать coturn: `apt install coturn`
   - Или облачный: Twilio, Metered.ca

2. **SSL**: Настроить Let's Encrypt через nginx

3. **Масштабирование**: Для нескольких инстанций backend использовать `socket.io-redis-adapter`

4. **CDN**: Для файлов использовать S3 + CloudFront

## 🧪 Тесты

```bash
cd backend
npm test
```

## 📈 Мониторинг

- Логи: `/app/logs/combined.log`, `/app/logs/error.log`
- Health check: `GET /health`
- Slow query monitoring встроен (> 1s)
