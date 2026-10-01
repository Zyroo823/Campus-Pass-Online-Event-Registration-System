/**
 * Health Check Routes
 * NFR-005 Availability: GET /api/health reports API and DB status
 */

import { Router } from 'express';
import { isDbConnected, getDbMode } from '../db/connection.ts';

const router = Router();

router.get('/', (_req, res) => {
  const dbUp = isDbConnected();
  const dbMode = getDbMode();

  const status = {
    status: dbUp ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    school_name: process.env.SCHOOL_NAME || 'University of Cebu - Mandaue',
    demo_mode: process.env.DEMO_MODE === 'true' || process.env.VITE_DEMO_MODE === 'true',
    services: {
      api: 'up',
      database: dbUp ? 'up' : 'down',
      db_mode: dbMode, // 'connected' (MySQL 8) | 'emulated' (In-Memory Engine) | 'disconnected'
    },
    version: '1.0.0',
  };

  const statusCode = dbUp ? 200 : 503;
  res.status(statusCode).json(status);
});

export default router;
