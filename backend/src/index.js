require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const { connectDB } = require('./config/database');
const { connectRedis } = require('./config/redis');
const { initSocketHandlers } = require('./websocket/socketHandlers');
const logger = require('./utils/logger');
const rateLimiter = require('./middleware/rateLimiter');

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const chatRoutes = require('./routes/chats');
const messageRoutes = require('./routes/messages');
const channelRoutes = require('./routes/channels');
const contactRoutes = require('./routes/contacts');
const callRoutes = require('./routes/calls');
const adminRoutes = require('./routes/admin');
const uploadRoutes = require('./routes/uploads');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));

// Rate limiting
app.use('/api/', rateLimiter.general);
app.use('/api/auth/', rateLimiter.auth);

// Make io accessible in routes
app.set('io', io);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/uploads', uploadRoutes);

// Swagger docs
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// Initialize WebSocket handlers
initSocketHandlers(io);

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  await connectRedis();
  server.listen(PORT, () => {
    logger.info(`GMessage server running on port ${PORT}`);
    logger.info(`Swagger docs: http://localhost:${PORT}/api/docs`);
  });
}

start().catch(err => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = { app, server, io };
