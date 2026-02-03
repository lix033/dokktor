/**
 * Client API pour communiquer avec le backend Docker Monitor
 * Gère les appels HTTP et le parsing des réponses
 */

import type {
  ContainerInfo,
  ContainersResponse,
  ActionResponse,
  ErrorResponse,
  LogsResponse,
  LogEntry,
  LogsOptions,
} from '@/types';

/** URL de base de l'API */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Classe d'erreur API personnalisée
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Effectue une requête HTTP vers l'API
 */
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data: unknown = await response.json();

  if (!response.ok) {
    const errorData = data as ErrorResponse;
    throw new ApiError(
      errorData.error || 'Une erreur est survenue',
      errorData.code || 'UNKNOWN_ERROR',
      response.status
    );
  }

  return data as T;
}

/**
 * Récupère la liste de tous les containers
 */
export async function getContainers(): Promise<ContainerInfo[]> {
  const response = await fetchApi<ContainersResponse>('/api/containers');
  return response.data;
}

/**
 * Arrête un container
 * @param containerId - ID ou nom du container
 */
export async function stopContainer(containerId: string): Promise<ActionResponse> {
  return fetchApi<ActionResponse>(`/api/containers/${containerId}/stop`, {
    method: 'POST',
  });
}

/**
 * Redémarre un container
 * @param containerId - ID ou nom du container
 */
export async function restartContainer(containerId: string): Promise<ActionResponse> {
  return fetchApi<ActionResponse>(`/api/containers/${containerId}/restart`, {
    method: 'POST',
  });
}

/**
 * Démarre un container arrêté
 * @param containerId - ID ou nom du container
 */
export async function startContainer(containerId: string): Promise<ActionResponse> {
  return fetchApi<ActionResponse>(`/api/containers/${containerId}/start`, {
    method: 'POST',
  });
}

/**
 * Récupère les logs d'un container
 * @param containerId - ID ou nom du container
 * @param options - Options de récupération
 */
export async function getContainerLogs(
  containerId: string,
  options: LogsOptions = {}
): Promise<LogsResponse> {
  const params = new URLSearchParams();
  
  if (options.tail !== undefined) params.set('tail', options.tail.toString());
  if (options.since !== undefined) params.set('since', options.since.toString());
  if (options.until !== undefined) params.set('until', options.until.toString());
  if (options.timestamps !== undefined) params.set('timestamps', options.timestamps.toString());
  if (options.stdout !== undefined) params.set('stdout', options.stdout.toString());
  if (options.stderr !== undefined) params.set('stderr', options.stderr.toString());

  const queryString = params.toString();
  const endpoint = `/api/containers/${containerId}/logs${queryString ? `?${queryString}` : ''}`;
  
  return fetchApi<LogsResponse>(endpoint);
}

/**
 * Crée une connexion SSE pour le streaming des logs
 * @param containerId - ID ou nom du container
 * @param options - Options du stream
 * @param callbacks - Callbacks pour les événements
 * @returns Fonction pour fermer la connexion
 */
export function streamContainerLogs(
  containerId: string,
  options: LogsOptions = {},
  callbacks: {
    onLog: (log: LogEntry) => void;
    onError?: (error: string) => void;
    onConnected?: () => void;
    onDisconnected?: () => void;
  }
): () => void {
  const params = new URLSearchParams();
  
  if (options.tail !== undefined) params.set('tail', options.tail.toString());
  if (options.timestamps !== undefined) params.set('timestamps', options.timestamps.toString());
  if (options.stdout !== undefined) params.set('stdout', options.stdout.toString());
  if (options.stderr !== undefined) params.set('stderr', options.stderr.toString());

  const queryString = params.toString();
  const url = `${API_BASE_URL}/api/containers/${containerId}/logs/stream${queryString ? `?${queryString}` : ''}`;
  
  const eventSource = new EventSource(url);

  eventSource.addEventListener('connected', () => {
    callbacks.onConnected?.();
  });

  eventSource.addEventListener('log', (event) => {
    try {
      const log = JSON.parse(event.data) as LogEntry;
      callbacks.onLog(log);
    } catch (e) {
      console.error('Erreur parsing log:', e);
    }
  });

  eventSource.addEventListener('error', (event) => {
    if (event instanceof MessageEvent) {
      try {
        const data = JSON.parse(event.data) as { error: string };
        callbacks.onError?.(data.error);
      } catch {
        callbacks.onError?.('Erreur de connexion au stream');
      }
    } else {
      callbacks.onError?.('Connexion perdue');
    }
  });

  eventSource.addEventListener('end', () => {
    callbacks.onDisconnected?.();
    eventSource.close();
  });

  eventSource.onerror = () => {
    callbacks.onError?.('Connexion perdue');
    callbacks.onDisconnected?.();
  };

  // Retourne une fonction pour fermer la connexion
  return () => {
    eventSource.close();
    callbacks.onDisconnected?.();
  };
}
