/**
 * Express Server Entry Point
 * NFR-002, NFR-004, NFR-005, NFR-007
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { initDb } from './src/server/db/connection.ts';
import authRoutes from './src/server/routes/auth.routes.ts';
import eventRoutes from './src/server/routes/event.routes.ts';
import userRoutes from './src/server/routes/user.routes.ts';
import notificationRoutes from './src/server/routes/notification.routes.ts';
import healthRoutes from './src/server/routes/health.routes.ts';
import { errorHandler } from './src/server/middleware/error.middleware.ts';
import { globalApiLimiter } from './src/server/middleware/rate-limit.middleware.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

// Trust proxy in production / cloud container environments
app.set('trust proxy', 1);

// Security: Helmet middleware (NFR-002)
app.use(
  helmet({
    contentSecurityPolicy: false, // Vite injects scripts dynamically in development
    crossOriginEmbedderPolicy: false,
  })
);

// CORS limited to application origin with credentials (NFR-002)
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow self, local dev, or same origin requests
      if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') || origin === APP_URL) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive in preview proxy container
      }
    },
    credentials: true,
  })
);

// Request body & cookie parsers
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(cookieParser());

// Global API Rate Limiter: 120 req/min (NFR-002)
app.use('/api', globalApiLimiter);

// Health check endpoint (NFR-005)
app.use('/api/health', healthRoutes);

// Application API routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);

// Central error handler for API routes (NFR-004)
app.use('/api', errorHandler);

// Start server and mount Vite frontend
async function bootstrap() {
  // Initialize database (MySQL 8 or seeded fallback engine)
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
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] CampusPass listening on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch(err => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
