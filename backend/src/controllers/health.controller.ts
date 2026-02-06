/**
 * Controleur de sante de l'API
 * Endpoints pour le monitoring de l'API elle-meme
 */

import { Request, Response } from 'express';
import { dockerService, systemMonitorService } from '../services';
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
    system: {
      status: 'ok' | 'error';
      message: string;
    };
  };
  system?: {
    hostname: string;
    platform: string;
    cpuUsage: number;
    memoryUsage: number;
  };
}

/**
 * GET /health
 * Verifie l'etat de sante de l'API et de ses dependances
 */
export async function healthCheck(
  _req: Request,
  res: Response
): Promise<void> {
  const dockerConnected = await dockerService.ping();

  let systemInfo: HealthCheckResponse['system'];
  let systemOk = true;

  try {
    const overview = await systemMonitorService.getOverview();
    systemInfo = {
      hostname: overview.hostname,
      platform: overview.platform,
      cpuUsage: overview.cpu.usage,
      memoryUsage: overview.memory.usedPercent,
    };
  } catch {
    systemOk = false;
  }

  const allOk = dockerConnected && systemOk;

  const response: HealthCheckResponse = {
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '2.0.0',
    checks: {
      docker: {
        status: dockerConnected ? 'ok' : 'error',
        message: dockerConnected
          ? 'Connexion Docker etablie'
          : 'Impossible de se connecter au socket Docker',
      },
      system: {
        status: systemOk ? 'ok' : 'error',
        message: systemOk
          ? 'Monitoring systeme operationnel'
          : 'Erreur lors de la collecte des metriques systeme',
      },
    },
    ...(systemInfo !== undefined ? { system: systemInfo } : {}),
  };

  const statusCode = allOk ? 200 : 503;
  res.status(statusCode).json(response);
}

/**
 * GET /
 * Point d'entree racine - informations basiques de l'API
 */
export function apiInfo(_req: Request, res: Response): void {
  res.json({
    name: 'Docktor API',
    version: '2.0.0',
    description: 'API de monitoring Docker et VPS',
    environment: config.nodeEnv,
    endpoints: {
      health: 'GET /health',
      containers: {
        list: 'GET /api/containers',
        get: 'GET /api/containers/:id',
        logs: 'GET /api/containers/:id/logs',
        logsStream: 'GET /api/containers/:id/logs/stream',
        stop: 'POST /api/containers/:id/stop',
        restart: 'POST /api/containers/:id/restart',
        start: 'POST /api/containers/:id/start',
      },
      system: {
        overview: 'GET /api/system/overview',
        metrics: 'GET /api/system/metrics',
        info: 'GET /api/system/info',
        cpu: 'GET /api/system/cpu',
        memory: 'GET /api/system/memory',
        disks: 'GET /api/system/disks',
        network: 'GET /api/system/network',
        processes: 'GET /api/system/processes',
        docker: 'GET /api/system/docker',
      },
    },
  });
}
