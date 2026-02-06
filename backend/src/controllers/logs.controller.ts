/**
 * Contrôleur des logs
 * Gère les requêtes HTTP pour la récupération et le streaming des logs
 */

import { Request, Response } from 'express';
import { Readable } from 'stream';
import { dockerService, ContainerNotFoundError } from '../services';
import { LogsResponse, LogsOptions } from '../types';

/** Valeurs par défaut pour les options de logs */
const DEFAULT_TAIL = 100;
const DEFAULT_STREAM_TAIL = 50;
const MAX_TAIL = 10000;

/**
 * Parse les query params pour les options de logs
 */
function parseLogsOptions(query: Request['query']): LogsOptions {
  const tail = Math.min(
    Math.max(1, parseInt(query['tail'] as string, 10) || DEFAULT_TAIL),
    MAX_TAIL
  );

  const since = parseInt(query['since'] as string, 10) || 0;
  const until = parseInt(query['until'] as string, 10) || 0;
  const timestamps = query['timestamps'] !== 'false';
  const stdout = query['stdout'] !== 'false';
  const stderr = query['stderr'] !== 'false';

  return { tail, since, until, timestamps, stdout, stderr };
}

/**
 * GET /api/containers/:id/logs
 * Récupère les logs d'un container
 * 
 * Query params:
 * - tail: nombre de lignes (défaut: 100, max: 10000)
 * - since: timestamp Unix de début
 * - until: timestamp Unix de fin
 * - timestamps: inclure les timestamps (défaut: true)
 * - stdout: inclure stdout (défaut: true)
 * - stderr: inclure stderr (défaut: true)
 */
export async function getContainerLogs(
  req: Request,
  res: Response
): Promise<void> {
  const { id } = req.params;
  const containerId = id as string;

  // Vérifie que le container existe
  const container = await dockerService.getContainer(containerId);
  if (container === null) {
    throw new ContainerNotFoundError(containerId);
  }

  const options = parseLogsOptions(req.query);
  const logs = await dockerService.getContainerLogs(containerId, options);

  const response: LogsResponse = {
    success: true,
    containerId: container.id,
    containerName: container.name,
    logs,
    count: logs.length,
    timestamp: new Date().toISOString(),
  };

  res.json(response);
}

/**
 * GET /api/containers/:id/logs/stream
 * Stream SSE des logs en temps réel
 * 
 * Query params:
 * - tail: nombre de lignes initiales (défaut: 50)
 * - timestamps: inclure les timestamps (défaut: true)
 * - stdout: inclure stdout (défaut: true)
 * - stderr: inclure stderr (défaut: true)
 */
export async function streamContainerLogs(
  req: Request,
  res: Response
): Promise<void> {
  const { id } = req.params;
  const containerId = id as string;

  // Vérifie que le container existe
  const container = await dockerService.getContainer(containerId);
  if (container === null) {
    throw new ContainerNotFoundError(containerId);
  }

  // Configuration SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Désactive le buffering nginx
  res.flushHeaders();

  // Envoie un événement de connexion
  res.write(`event: connected\ndata: ${JSON.stringify({
    containerId: container.id,
    containerName: container.name,
    timestamp: new Date().toISOString(),
  })}\n\n`);

  // Options du stream
  const options: LogsOptions = {
    tail: Math.min(
      parseInt(req.query['tail'] as string, 10) || DEFAULT_STREAM_TAIL,
      MAX_TAIL
    ),
    timestamps: req.query['timestamps'] !== 'false',
    stdout: req.query['stdout'] !== 'false',
    stderr: req.query['stderr'] !== 'false',
    since: Math.floor(Date.now() / 1000) - 60, // Dernière minute
  };

  let stream: Readable | null = null;
  let isClientConnected = true;

  try {
    stream = await dockerService.getContainerLogsStream(containerId, options);

    // Buffer pour accumuler les chunks partiels
    let buffer = Buffer.alloc(0);

    stream.on('data', (chunk: Buffer) => {
      if (!isClientConnected) return;

      // Accumule les chunks
      buffer = Buffer.concat([buffer, chunk]);

      // Parse les logs complets du buffer
      const logs = dockerService.demultiplexDockerStream(buffer);
      
      // Réinitialise le buffer (simplifié - en production, gérer les chunks partiels)
      buffer = Buffer.alloc(0);

      // Envoie chaque entrée de log
      for (const log of logs) {
        if (!isClientConnected) break;
        res.write(`event: log\ndata: ${JSON.stringify(log)}\n\n`);
      }
    });

    stream.on('error', (error: Error) => {
      console.error(`[LOGS STREAM ERROR] ${containerId}:`, error.message);
      if (isClientConnected) {
        res.write(`event: error\ndata: ${JSON.stringify({
          error: error.message,
          timestamp: new Date().toISOString(),
        })}\n\n`);
      }
    });

    stream.on('end', () => {
      if (isClientConnected) {
        res.write(`event: end\ndata: ${JSON.stringify({
          message: 'Stream terminé',
          timestamp: new Date().toISOString(),
        })}\n\n`);
        res.end();
      }
    });

    // Gestion de la déconnexion du client
    req.on('close', () => {
      isClientConnected = false;
      if (stream !== null) {
        stream.destroy();
      }
    });

    // Heartbeat pour maintenir la connexion
    const heartbeatInterval = setInterval(() => {
      if (!isClientConnected) {
        clearInterval(heartbeatInterval);
        return;
      }
      res.write(`event: heartbeat\ndata: ${JSON.stringify({
        timestamp: new Date().toISOString(),
      })}\n\n`);
    }, 30000); // Toutes les 30 secondes

    // Cleanup à la fermeture
    res.on('close', () => {
      clearInterval(heartbeatInterval);
      isClientConnected = false;
    });

  } catch (error) {
    console.error(`[LOGS STREAM SETUP ERROR] ${containerId}:`, error);
    if (isClientConnected) {
      res.write(`event: error\ndata: ${JSON.stringify({
        error: 'Erreur lors de l\'initialisation du stream',
        timestamp: new Date().toISOString(),
      })}\n\n`);
      res.end();
    }
  }
}
