/**
 * Routes des containers
 * Définit les endpoints REST pour la gestion des containers
 */

import { Router } from 'express';
import {
  listContainers,
  getContainer,
  stopContainer,
  restartContainer,
  startContainer,
  getContainerLogs,
  streamContainerLogs,
} from '../controllers';
import { asyncHandler, validateContainerId } from '../middleware';

const router = Router();

/**
 * GET /api/containers
 * Liste tous les containers (actifs et arrêtés)
 */
router.get('/', asyncHandler(listContainers));

/**
 * GET /api/containers/:id
 * Récupère les détails d'un container spécifique
 */
router.get('/:id', validateContainerId, asyncHandler(getContainer));

/**
 * GET /api/containers/:id/logs
 * Récupère les logs d'un container
 * Query params: tail, since, until, timestamps, stdout, stderr
 */
router.get('/:id/logs', validateContainerId, asyncHandler(getContainerLogs));

/**
 * GET /api/containers/:id/logs/stream
 * Stream SSE des logs en temps réel
 * Query params: tail, timestamps, stdout, stderr
 */
router.get('/:id/logs/stream', validateContainerId, streamContainerLogs);

/**
 * POST /api/containers/:id/stop
 * Arrête un container en cours d'exécution
 */
router.post('/:id/stop', validateContainerId, asyncHandler(stopContainer));

/**
 * POST /api/containers/:id/restart
 * Redémarre un container (qu'il soit running ou stopped)
 */
router.post('/:id/restart', validateContainerId, asyncHandler(restartContainer));

/**
 * POST /api/containers/:id/start
 * Démarre un container arrêté
 */
router.post('/:id/start', validateContainerId, asyncHandler(startContainer));

export { router as containerRouter };
