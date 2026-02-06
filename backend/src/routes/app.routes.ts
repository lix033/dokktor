/**
 * Routes de gestion des applications
 * Endpoints pour creer, deployer et gerer les applications
 */

import { Router } from 'express';
import {
  listApps,
  getApp,
  createApp,
  updateApp,
  deleteApp,
  deployApp,
  stopApp,
  startApp,
  restartApp,
  getAppLogs,
  getAppDeployments,
  getDeployment,
  getTemplates,
  getPorts,
  syncApps,
  validateGitConfig,
} from '../controllers';
import { asyncHandler } from '../middleware';

const router = Router();

/**
 * GET /api/apps/templates
 * Liste des templates disponibles
 */
router.get('/templates', asyncHandler(getTemplates));

/**
 * GET /api/apps/ports
 * Informations sur les ports
 */
router.get('/ports', asyncHandler(getPorts));

/**
 * POST /api/apps/sync
 * Synchronise les statuts des applications
 */
router.post('/sync', asyncHandler(syncApps));

/**
 * POST /api/apps/validate-git
 * Valide une configuration Git
 */
router.post('/validate-git', asyncHandler(validateGitConfig));

/**
 * GET /api/apps/deployments/:deploymentId
 * Recupere un deploiement specifique
 */
router.get('/deployments/:deploymentId', asyncHandler(getDeployment));

/**
 * GET /api/apps
 * Liste toutes les applications
 */
router.get('/', asyncHandler(listApps));

/**
 * POST /api/apps
 * Cree une nouvelle application
 */
router.post('/', asyncHandler(createApp));

/**
 * GET /api/apps/:id
 * Recupere une application
 */
router.get('/:id', asyncHandler(getApp));

/**
 * PUT /api/apps/:id
 * Met a jour une application
 */
router.put('/:id', asyncHandler(updateApp));

/**
 * DELETE /api/apps/:id
 * Supprime une application
 */
router.delete('/:id', asyncHandler(deleteApp));

/**
 * POST /api/apps/:id/deploy
 * Lance le deploiement
 */
router.post('/:id/deploy', asyncHandler(deployApp));

/**
 * POST /api/apps/:id/stop
 * Arrete l'application
 */
router.post('/:id/stop', asyncHandler(stopApp));

/**
 * POST /api/apps/:id/start
 * Demarre l'application
 */
router.post('/:id/start', asyncHandler(startApp));

/**
 * POST /api/apps/:id/restart
 * Redemarre l'application
 */
router.post('/:id/restart', asyncHandler(restartApp));

/**
 * GET /api/apps/:id/logs
 * Logs de l'application
 */
router.get('/:id/logs', asyncHandler(getAppLogs));

/**
 * GET /api/apps/:id/deployments
 * Historique des deploiements
 */
router.get('/:id/deployments', asyncHandler(getAppDeployments));

export { router as appRouter };
