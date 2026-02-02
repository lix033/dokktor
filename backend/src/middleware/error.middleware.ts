/**
 * Middleware de gestion d'erreurs centralisé
 * Capture toutes les erreurs et les formate de manière cohérente
 */

import { Request, Response, NextFunction } from 'express';
import { ErrorResponse } from '../types';
import { config, isDevelopment } from '../config';
import {
  ContainerNotFoundError,
  ContainerNotRunningError,
  ContainerAlreadyRunningError,
} from '../services';

/**
 * Erreur HTTP personnalisée avec code de statut
 */
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * Crée une réponse d'erreur formatée
 */
function createErrorResponse(
  error: string,
  code: string,
  details?: unknown
): ErrorResponse {
  return {
    success: false,
    error,
    code,
    timestamp: new Date().toISOString(),
    ...(isDevelopment && details !== undefined ? { details } : {}),
  };
}

/**
 * Type guard pour les erreurs Docker
 */
function isDockerError(error: unknown): error is { statusCode: number; message: string; reason?: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof (error as { statusCode: unknown }).statusCode === 'number'
  );
}

/**
 * Middleware principal de gestion d'erreurs
 * Doit être enregistré en dernier dans la chaîne de middlewares
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error(`[ERROR] ${err.name}: ${err.message}`);

  // Erreurs HTTP explicites
  if (err instanceof HttpError) {
    res.status(err.statusCode).json(
      createErrorResponse(err.message, err.code)
    );
    return;
  }

  // Erreurs métier Docker - Container non trouvé
  if (err instanceof ContainerNotFoundError) {
    res.status(404).json(
      createErrorResponse(err.message, 'CONTAINER_NOT_FOUND')
    );
    return;
  }

  // Erreurs métier Docker - Container non en cours d'exécution
  if (err instanceof ContainerNotRunningError) {
    res.status(400).json(
      createErrorResponse(err.message, 'CONTAINER_NOT_RUNNING')
    );
    return;
  }

  // Erreurs métier Docker - Container déjà en cours d'exécution
  if (err instanceof ContainerAlreadyRunningError) {
    res.status(400).json(
      createErrorResponse(err.message, 'CONTAINER_ALREADY_RUNNING')
    );
    return;
  }

  // Erreurs Docker API
  if (isDockerError(err)) {
    const statusCode = err.statusCode === 404 ? 404 : 
                       err.statusCode === 409 ? 409 : 500;
    
    res.status(statusCode).json(
      createErrorResponse(
        err.message,
        `DOCKER_ERROR_${err.statusCode}`,
        isDevelopment ? { reason: err.reason } : undefined
      )
    );
    return;
  }

  // Erreurs de validation Zod
  if (err.name === 'ZodError') {
    res.status(400).json(
      createErrorResponse(
        'Données de requête invalides',
        'VALIDATION_ERROR',
        isDevelopment ? err : undefined
      )
    );
    return;
  }

  // Erreur générique (500)
  res.status(500).json(
    createErrorResponse(
      isDevelopment ? err.message : 'Une erreur interne est survenue',
      'INTERNAL_ERROR',
      isDevelopment ? { stack: err.stack } : undefined
    )
  );
}

/**
 * Middleware pour les routes non trouvées (404)
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  res.status(404).json(
    createErrorResponse(
      `Route ${req.method} ${req.path} non trouvée`,
      'ROUTE_NOT_FOUND'
    )
  );
}

/**
 * Wrapper async pour les contrôleurs
 * Permet d'utiliser async/await sans try/catch explicite
 */
export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
