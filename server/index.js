/**
 * Express Server Entry Point
 * Plain JavaScript
 * NFR-002, NFR-004, NFR-005, NFR-007
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { initDb, getDbStatus } from './db.js';
import authRoutes from './routes/auth.js';
import eventRoutes from './routes/events.js';
import registrationRoutes from './routes/registrations.js';
import userRoutes from './routes/users.js';
import notificationRoutes from './routes/notifications.js';
import { errorHandler, globalApiLimiter } from './middleware.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const app = express();
const PORT = 3000;
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

// Trust proxy for container/preview environments
app.set('trust proxy', 1);

// Security: Helmet
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// CORS: Reflect requesting origin with credentials allowed (NFR-002)
app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, origin || true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  })
);

// Body and cookie parsers
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(cookieParser());

// Global API Rate Limiter: 120 req/min (NFR-002)
app.use('/api', globalApiLimiter);

// Health check endpoint (NFR-005)
app.get('/api/health', (_req, res) => {
  const dbMode = getDbStatus();
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    school_name: process.env.SCHOOL_NAME || 'University of Cebu - Mandaue',
    demo_mode: process.env.DEMO_MODE === 'true',
    services: {
      api: 'up',
      database: dbMode !== 'disconnected' ? 'up' : 'down',
      db_mode: dbMode,
    },
    version: '1.0.0',
  });
});

// Mount application API routes
app.use('/api/auth', authRoutes);
app.use('/api/events', registrationRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);

// Central error handler for API routes (NFR-004)
app.use('/api', errorHandler);

// Start server and mount Vite frontend
async function bootstrap() {
  await initDb();

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(rootDir, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CampusPass] Server started on ${APP_URL}`);
  });
}

bootstrap().catch(err => {
  console.error('[CampusPass] Fatal server startup error:', err);
  process.exit(1);
});

export default app;
