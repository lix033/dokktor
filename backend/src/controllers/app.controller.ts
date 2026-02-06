/**
 * Controleur de gestion des applications
 * Endpoints pour creer, deployer et gerer les applications
 */

import { Request, Response } from 'express';
import { appDeploymentService, portManagerService } from '../services';
import {
  CreateAppRequest,
  UpdateAppRequest,
  AppsListResponse,
  AppResponse,
  TemplatesResponse,
  DeploymentResponse,
  PortsResponse,
} from '../types';

/**
 * GET /api/apps
 * Liste toutes les applications
 */
export async function listApps(_req: Request, res: Response): Promise<void> {
  const apps = appDeploymentService.getAllApps();

  const response: AppsListResponse = {
    success: true,
    data: apps,
    count: apps.length,
    timestamp: new Date().toISOString(),
  };

  res.json(response);
}

/**
 * GET /api/apps/:id
 * Recupere une application par son ID
 */
export async function getApp(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  if (!id) {
  return res.status(400).json({ error: 'id requis' });
}

  const app = appDeploymentService.getApp(id);

  if (!app) {
    res.status(404).json({
      success: false,
      error: 'Application non trouvee',
      code: 'APP_NOT_FOUND',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const response: AppResponse = {
    success: true,
    data: app,
    timestamp: new Date().toISOString(),
  };

  res.json(response);
}

/**
 * POST /api/apps
 * Cree une nouvelle application
 */
export async function createApp(req: Request, res: Response): Promise<void> {
  const request: CreateAppRequest = req.body;

  // Validation basique
  if (!request.name || !request.type) {
    res.status(400).json({
      success: false,
      error: 'Le nom et le type de l\'application sont requis',
      code: 'VALIDATION_ERROR',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  try {
    const app = await appDeploymentService.createApp(request);

    const response: AppResponse = {
      success: true,
      data: app,
      timestamp: new Date().toISOString(),
    };

    res.status(201).json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    res.status(400).json({
      success: false,
      error: message,
      code: 'CREATE_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * PUT /api/apps/:id
 * Met a jour une application
 */
export async function updateApp(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const request: UpdateAppRequest = req.body;

  try {
    if (!id) {
  return res.status(400).json({ error: 'id requis' });
}

    const app = await appDeploymentService.updateApp(id, request);

    const response: AppResponse = {
      success: true,
      data: app,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    res.status(400).json({
      success: false,
      error: message,
      code: 'UPDATE_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * DELETE /api/apps/:id
 * Supprime une application
 */
export async function deleteApp(req: Request, res: Response): Promise<any> {
  const { id } = req.params;

  if (!id) {
  return res.status(400).json({ error: 'id requis' });
}


  try {
    await appDeploymentService.deleteApp(id);

    res.json({
      success: true,
      message: 'Application supprimee avec succes',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    res.status(400).json({
      success: false,
      error: message,
      code: 'DELETE_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * POST /api/apps/:id/deploy
 * Lance le deploiement d'une application
 */
export async function deployApp(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  const { force } = req.body;
  if (!id) {
  return res.status(400).json({ error: 'id requis' });
}


  try {
    const deployment = await appDeploymentService.deployApp(id, force === true);

    const response: DeploymentResponse = {
      success: true,
      data: deployment,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    res.status(400).json({
      success: false,
      error: message,
      code: 'DEPLOY_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * POST /api/apps/:id/stop
 * Arrete une application
 */
export async function stopApp(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  if (!id) {
  return res.status(400).json({ error: 'id requis' });
}


  try {
    await appDeploymentService.stopApp(id);

    res.json({
      success: true,
      message: 'Application arretee avec succes',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    res.status(400).json({
      success: false,
      error: message,
      code: 'STOP_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * POST /api/apps/:id/start
 * Demarre une application
 */
export async function startApp(req: Request, res: Response): Promise<any> {
  const { id } = req.params;

  if (!id) {
  return res.status(400).json({ error: 'id requis' });
}


  try {
    await appDeploymentService.startApp(id);

    res.json({
      success: true,
      message: 'Application demarree avec succes',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    res.status(400).json({
      success: false,
      error: message,
      code: 'START_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * POST /api/apps/:id/restart
 * Redemarre une application
 */
export async function restartApp(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  if (!id) {
  return res.status(400).json({ error: 'id requis' });
}


  try {
    await appDeploymentService.restartApp(id);

    res.json({
      success: true,
      message: 'Application redemarree avec succes',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    res.status(400).json({
      success: false,
      error: message,
      code: 'RESTART_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * GET /api/apps/:id/logs
 * Recupere les logs d'une application
 */
export async function getAppLogs(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  if (!id) {
  return res.status(400).json({ error: 'id requis' });
}

  const tail = parseInt(req.query['tail'] as string, 10) || 100;

  try {
    const logs = await appDeploymentService.getAppLogs(id, tail);

    res.json({
      success: true,
      data: {
        logs,
        appId: id,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    res.status(400).json({
      success: false,
      error: message,
      code: 'LOGS_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * GET /api/apps/:id/deployments
 * Recupere l'historique des deploiements d'une application
 */
export async function getAppDeployments(req: Request, res: Response): Promise<any> {
  const { id } = req.params;
  if (!id) {
  return res.status(400).json({ error: 'id requis' });
}


  const deployments = appDeploymentService.getAppDeployments(id);

  res.json({
    success: true,
    data: deployments,
    count: deployments.length,
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /api/apps/deployments/:deploymentId
 * Recupere un deploiement specifique
 */
export async function getDeployment(req: Request, res: Response): Promise<any> {
  const { deploymentId } = req.params;
  if (!deploymentId) {
  return res.status(400).json({ error: 'id requis' });
}


  const deployment = appDeploymentService.getDeployment(deploymentId);

  if (!deployment) {
    res.status(404).json({
      success: false,
      error: 'Deploiement non trouve',
      code: 'DEPLOYMENT_NOT_FOUND',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const response: DeploymentResponse = {
    success: true,
    data: deployment,
    timestamp: new Date().toISOString(),
  };

  res.json(response);
}

/**
 * GET /api/apps/templates
 * Recupere tous les templates disponibles
 */
export async function getTemplates(_req: Request, res: Response): Promise<void> {
  const templates = appDeploymentService.getTemplates();

  const response: TemplatesResponse = {
    success: true,
    data: templates,
    timestamp: new Date().toISOString(),
  };

  res.json(response);
}

/**
 * GET /api/apps/ports
 * Recupere les informations sur les ports
 */
export async function getPorts(_req: Request, res: Response): Promise<void> {
  const allocated = portManagerService.getAllAllocations();
  const available = await portManagerService.getAvailablePorts(10);
  const range = portManagerService.getPortRange();

  const response: PortsResponse = {
    success: true,
    data: {
      allocated,
      available,
      range,
    },
    timestamp: new Date().toISOString(),
  };

  res.json(response);
}

/**
 * POST /api/apps/sync
 * Synchronise le statut des applications avec Docker
 */
export async function syncApps(_req: Request, res: Response): Promise<void> {
  await appDeploymentService.syncAppStatuses();

  res.json({
    success: true,
    message: 'Synchronisation terminee',
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST /api/apps/validate-git
 * Valide une configuration Git
 */
export async function validateGitConfig(req: Request, res: Response): Promise<void> {
  const gitConfig = req.body;

  const result = appDeploymentService.validateGitConfiguration(gitConfig);

  res.json({
    success: true,
    data: {
      valid: result.valid,
      errors: result.errors,
    },
    timestamp: new Date().toISOString(),
  });
}
