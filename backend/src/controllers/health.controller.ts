/**
 * Contrôleur de santé de l'API
 * Endpoints pour le monitoring de l'API elle-même
 */

import { Request, Response } from 'express';
import { dockerService } from '../services';
import { config } from '../config';

interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    docker: {
      status: 'ok' | 'error';
      message: string;
    };
  };
}

/**
 * GET /health
 * Vérifie l'état de santé de l'API et de ses dépendances
 */
export async function healthCheck(
  _req: Request,
  res: Response
): Promise<void> {
  const dockerConnected = await dockerService.ping();

  const response: HealthCheckResponse = {
    status: dockerConnected ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    checks: {
      docker: {
        status: dockerConnected ? 'ok' : 'error',
        message: dockerConnected
          ? 'Connexion Docker établie'
          : 'Impossible de se connecter au socket Docker',
      },
    },
  };

  const statusCode = dockerConnected ? 200 : 503;
  res.status(statusCode).json(response);
}

/**
 * GET /
 * Point d'entrée racine - informations basiques de l'API
 */
export function apiInfo(_req: Request, res: Response): void {
  res.status(200).json({
    name: 'Docker Monitor API',
    version: '1.0.0',
    description: 'API de monitoring et contrôle Docker',
    environment: config.nodeEnv,
    endpoints: {
      health: 'GET /health',
      containers: 'GET /api/containers',
      container: 'GET /api/containers/:id',
      stop: 'POST /api/containers/:id/stop',
      restart: 'POST /api/containers/:id/restart',
      start: 'POST /api/containers/:id/start',
    },
  });
}
