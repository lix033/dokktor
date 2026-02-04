/**
 * Routes de monitoring systeme
 * Definit les endpoints REST pour les metriques du serveur
 */

import { Router } from 'express';
import {
  getSystemOverview,
  getSystemMetrics,
  getCpuInfo,
  getMemoryInfo,
  getDisksInfo,
  getNetworkInfo,
  getProcesses,
  getDockerStats,
  getSystemInfo,
} from '../controllers';
import { asyncHandler } from '../middleware';

const router = Router();

/**
 * GET /api/system/overview
 * Apercu rapide du systeme (ideal pour le dashboard)
 */
router.get('/overview', asyncHandler(getSystemOverview));

/**
 * GET /api/system/metrics
 * Toutes les metriques detaillees
 */
router.get('/metrics', asyncHandler(getSystemMetrics));

/**
 * GET /api/system/info
 * Informations generales du systeme
 */
router.get('/info', asyncHandler(getSystemInfo));

/**
 * GET /api/system/cpu
 * Informations et utilisation du CPU
 */
router.get('/cpu', asyncHandler(getCpuInfo));

/**
 * GET /api/system/memory
 * Informations de la memoire (RAM et Swap)
 */
router.get('/memory', asyncHandler(getMemoryInfo));

/**
 * GET /api/system/disks
 * Informations des disques et IO
 */
router.get('/disks', asyncHandler(getDisksInfo));

/**
 * GET /api/system/network
 * Informations reseau (interfaces, stats, connexions)
 */
router.get('/network', asyncHandler(getNetworkInfo));

/**
 * GET /api/system/processes
 * Liste des processus avec statistiques
 * Query: limit (defaut: 10), sort (cpu|memory)
 */
router.get('/processes', asyncHandler(getProcesses));

/**
 * GET /api/system/docker
 * Informations Docker detaillees (info + stockage)
 */
router.get('/docker', asyncHandler(getDockerStats));

export { router as systemRouter };
