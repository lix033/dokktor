/**
 * Controleur de monitoring systeme
 * Gere les requetes HTTP pour les metriques du serveur VPS
 */

import { Request, Response } from 'express';
// import {
//   SystemMetricsResponse,
//   // SystemOverviewResponse,
//   ProcessListResponse,
//   DockerStatsResponse,
// } from '../types';
import { systemMonitorService } from '../services/system.service';
import { DockerStatsResponse, ProcessListResponse, SystemMetricsResponse, SystemOverviewResponse } from '../types/system.types';

/**
 * GET /api/system/overview
 * Recupere un apercu rapide du systeme
 */
export async function getSystemOverview(
  _req: Request,
  res: Response
): Promise<void> {
  const overview = await systemMonitorService.getOverview();

  const response: SystemOverviewResponse = {
    success: true,
    data: overview,
    timestamp: new Date().toISOString(),
  };

  res.json(response);
}

/**
 * GET /api/system/metrics
 * Recupere toutes les metriques detaillees du systeme
 */
export async function getSystemMetrics(
  _req: Request,
  res: Response
): Promise<void> {
  const metrics = await systemMonitorService.getAllMetrics();

  const response: SystemMetricsResponse = {
    success: true,
    data: metrics,
    timestamp: new Date().toISOString(),
  };

  res.json(response);
}

/**
 * GET /api/system/cpu
 * Recupere les informations et l'utilisation du CPU
 */
export async function getCpuInfo(
  _req: Request,
  res: Response
): Promise<void> {
  const [info, usage] = await Promise.all([
    systemMonitorService.getCpuInfo(),
    systemMonitorService.getCpuUsage(),
  ]);

  res.json({
    success: true,
    data: { info, usage },
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /api/system/memory
 * Recupere les informations de la memoire
 */
export async function getMemoryInfo(
  _req: Request,
  res: Response
): Promise<void> {
  const [ram, swap] = await Promise.all([
    systemMonitorService.getMemoryInfo(),
    systemMonitorService.getSwapInfo(),
  ]);

  res.json({
    success: true,
    data: { ram, swap },
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /api/system/disks
 * Recupere les informations des disques
 */
export async function getDisksInfo(
  _req: Request,
  res: Response
): Promise<void> {
  const [disks, io] = await Promise.all([
    systemMonitorService.getDisksInfo(),
    systemMonitorService.getDiskIO(),
  ]);

  res.json({
    success: true,
    data: { disks, io },
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /api/system/network
 * Recupere les informations reseau
 */
export async function getNetworkInfo(
  _req: Request,
  res: Response
): Promise<void> {
  const [interfaces, stats, connections] = await Promise.all([
    systemMonitorService.getNetworkInterfaces(),
    systemMonitorService.getNetworkStats(),
    systemMonitorService.getNetworkConnections(),
  ]);

  res.json({
    success: true,
    data: { interfaces, stats, connections },
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /api/system/processes
 * Recupere la liste des processus
 * Query params:
 * - limit: nombre de processus (defaut: 10)
 * - sort: critere de tri (cpu ou memory, defaut: cpu)
 */
export async function getProcesses(
  req: Request,
  res: Response
): Promise<void> {
  const limit = Math.min(
    Math.max(1, parseInt(req.query['limit'] as string, 10) || 10),
    100
  );
  const sortBy = (req.query['sort'] as string) === 'memory' ? 'memory' : 'cpu';

  const [stats, processes] = await Promise.all([
    systemMonitorService.getProcessStats(),
    systemMonitorService.getTopProcesses(limit, sortBy),
  ]);

  const response: ProcessListResponse = {
    success: true,
    data: { stats, processes },
    count: processes.length,
    timestamp: new Date().toISOString(),
  };

  res.json(response);
}

/**
 * GET /api/system/docker
 * Recupere les informations Docker detaillees
 */
export async function getDockerStats(
  _req: Request,
  res: Response
): Promise<void> {
  const [info, storage] = await Promise.all([
    systemMonitorService.getDockerInfo(),
    systemMonitorService.getDockerStorageInfo(),
  ]);

  if (info === null) {
    res.status(503).json({
      success: false,
      error: 'Docker non disponible',
      code: 'DOCKER_UNAVAILABLE',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const response: DockerStatsResponse = {
    success: true,
    data: {
      info,
      storage: storage || {
        imagesSize: 0,
        containersSize: 0,
        volumesSize: 0,
        buildCacheSize: 0,
        totalSize: 0,
        reclaimableSize: 0,
      },
    },
    timestamp: new Date().toISOString(),
  };

  res.json(response);
}

/**
 * GET /api/system/info
 * Recupere les informations generales du systeme
 */
export async function getSystemInfo(
  _req: Request,
  res: Response
): Promise<void> {
  const system = await systemMonitorService.getSystemInfo();

  res.json({
    success: true,
    data: system,
    timestamp: new Date().toISOString(),
  });
}
