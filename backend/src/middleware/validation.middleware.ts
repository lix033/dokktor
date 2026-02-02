/**
 * Middleware de validation des paramètres
 * Valide les IDs de container pour éviter les injections
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { HttpError } from './error.middleware';

/**
 * Schéma de validation pour un ID de container Docker
 * Un ID Docker valide est soit:
 * - Un ID complet (64 caractères hex)
 * - Un ID court (12 caractères hex minimum)
 * - Un nom de container (alphanumérique avec tirets et underscores)
 */
const containerIdSchema = z.string()
  .min(1, 'ID de container requis')
  .max(64, 'ID de container invalide')
  .regex(
    /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/,
    'ID de container contient des caractères invalides'
  );

/**
 * Middleware de validation de l'ID de container
 * Valide le paramètre :id dans les routes
 */
export function validateContainerId(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const { id } = req.params;

  const result = containerIdSchema.safeParse(id);

  if (!result.success) {
    const errorMessage = result.error.errors[0]?.message ?? 'ID invalide';
    throw new HttpError(400, errorMessage, 'INVALID_CONTAINER_ID');
  }

  next();
}

/**
 * Middleware de logging des requêtes (debug)
 */
export function requestLogger(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
}
