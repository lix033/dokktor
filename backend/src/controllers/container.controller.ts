/**
 * Contrôleur des containers
 * Gère les requêtes HTTP et délègue au service Docker
 */

import { Request, Response } from 'express';
import { dockerService, ContainerNotFoundError } from '../services';
import { ActionResponse } from '../types';

/**
 * GET /containers
 * Récupère la liste de tous les containers
 */
export async function listContainers(
  _req: Request,
  res: Response
): Promise<void> {
  const containers = await dockerService.listContainers(true);

  res.json({
    success: true,
    data: containers,
    count: containers.length,
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /containers/:id
 * Récupère les informations d'un container spécifique
 */
export async function getContainer(
  req: Request,
  res: Response
): Promise<void> {
  const { id } = req.params;

  // id est toujours défini grâce à la validation middleware
  const containerId = id as string;
  const container = await dockerService.getContainer(containerId);

  if (container === null) {
    throw new ContainerNotFoundError(containerId);
  }

  res.json({
    success: true,
    data: container,
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST /containers/:id/stop
 * Arrête un container en cours d'exécution
 */
export async function stopContainer(
  req: Request,
  res: Response
): Promise<void> {
  const { id } = req.params;
  const containerId = id as string;

  // Vérifie d'abord que le container existe
  const container = await dockerService.getContainer(containerId);
  if (container === null) {
    throw new ContainerNotFoundError(containerId);
  }

  await dockerService.stopContainer(containerId);

  const response: ActionResponse = {
    success: true,
    message: `Container '${container.name}' arrêté avec succès`,
    containerId: container.id,
    timestamp: new Date().toISOString(),
  };

  res.json(response);
}

/**
 * POST /containers/:id/restart
 * Redémarre un container
 */
export async function restartContainer(
  req: Request,
  res: Response
): Promise<void> {
  const { id } = req.params;
  const containerId = id as string;

  // Vérifie d'abord que le container existe
  const container = await dockerService.getContainer(containerId);
  if (container === null) {
    throw new ContainerNotFoundError(containerId);
  }

  await dockerService.restartContainer(containerId);

  const response: ActionResponse = {
    success: true,
    message: `Container '${container.name}' redémarré avec succès`,
    containerId: container.id,
    timestamp: new Date().toISOString(),
  };

  res.json(response);
}

/**
 * POST /containers/:id/start
 * Démarre un container arrêté
 */
export async function startContainer(
  req: Request,
  res: Response
): Promise<void> {
  const { id } = req.params;
  const containerId = id as string;

  // Vérifie d'abord que le container existe
  const container = await dockerService.getContainer(containerId);
  if (container === null) {
    throw new ContainerNotFoundError(containerId);
  }

  await dockerService.startContainer(containerId);

  const response: ActionResponse = {
    success: true,
    message: `Container '${container.name}' démarré avec succès`,
    containerId: container.id,
    timestamp: new Date().toISOString(),
  };

  res.json(response);
}
