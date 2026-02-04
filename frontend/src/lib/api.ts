/**
 * Client API pour communiquer avec le backend Docktor
 * Gere les appels HTTP et le parsing des reponses
 */

import type {
  ContainerInfo,
  ContainersResponse,
  ActionResponse,
  ErrorResponse,
  LogsResponse,
  LogEntry,
  LogsOptions,
  SystemOverview,
  SystemOverviewResponse,
  SystemMetrics,
  SystemMetricsResponse,
  ProcessesResponse,
  DockerStatsResponse,
  CpuInfo,
  CpuUsage,
  MemoryInfo,
  SwapInfo,
  DiskInfo,
  DiskIO,
  NetworkInterface,
  NetworkStats,
  NetworkConnections,
} from '@/types';

/** URL de base de l'API */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Classe d'erreur API personnalisee
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
 * Effectue une requete HTTP vers l'API
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

// ============================================
// API Containers
// ============================================

/**
 * Recupere la liste de tous les containers
 */
export async function getContainers(): Promise<ContainerInfo[]> {
  const response = await fetchApi<ContainersResponse>('/api/containers');
  return response.data;
}

/**
 * Arrete un container
 */
export async function stopContainer(containerId: string): Promise<ActionResponse> {
  return fetchApi<ActionResponse>(`/api/containers/${containerId}/stop`, {
    method: 'POST',
  });
}

/**
 * Redemarre un container
 */
export async function restartContainer(containerId: string): Promise<ActionResponse> {
  return fetchApi<ActionResponse>(`/api/containers/${containerId}/restart`, {
    method: 'POST',
  });
}

/**
 * Demarre un container arrete
 */
export async function startContainer(containerId: string): Promise<ActionResponse> {
  return fetchApi<ActionResponse>(`/api/containers/${containerId}/start`, {
    method: 'POST',
  });
}

/**
 * Recupere les logs d'un container
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
 * Cree une connexion SSE pour le streaming des logs
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

  return () => {
    eventSource.close();
    callbacks.onDisconnected?.();
  };
}

// ============================================
// API Monitoring Systeme
// ============================================

/**
 * Recupere l'apercu rapide du systeme
 */
export async function getSystemOverview(): Promise<SystemOverview> {
  const response = await fetchApi<SystemOverviewResponse>('/api/system/overview');
  return response.data;
}

/**
 * Recupere toutes les metriques detaillees
 */
export async function getSystemMetrics(): Promise<SystemMetrics> {
  const response = await fetchApi<SystemMetricsResponse>('/api/system/metrics');
  return response.data;
}

/**
 * Recupere les informations CPU
 */
export async function getCpuInfo(): Promise<{ info: CpuInfo; usage: CpuUsage }> {
  const response = await fetchApi<{ success: boolean; data: { info: CpuInfo; usage: CpuUsage } }>(
    '/api/system/cpu'
  );
  return response.data;
}

/**
 * Recupere les informations memoire
 */
export async function getMemoryInfo(): Promise<{ ram: MemoryInfo; swap: SwapInfo }> {
  const response = await fetchApi<{ success: boolean; data: { ram: MemoryInfo; swap: SwapInfo } }>(
    '/api/system/memory'
  );
  return response.data;
}

/**
 * Recupere les informations des disques
 */
export async function getDisksInfo(): Promise<{ disks: DiskInfo[]; io: DiskIO }> {
  const response = await fetchApi<{ success: boolean; data: { disks: DiskInfo[]; io: DiskIO } }>(
    '/api/system/disks'
  );
  return response.data;
}

/**
 * Recupere les informations reseau
 */
export async function getNetworkInfo(): Promise<{
  interfaces: NetworkInterface[];
  stats: NetworkStats[];
  connections: NetworkConnections;
}> {
  const response = await fetchApi<{
    success: boolean;
    data: {
      interfaces: NetworkInterface[];
      stats: NetworkStats[];
      connections: NetworkConnections;
    };
  }>('/api/system/network');
  return response.data;
}

/**
 * Recupere la liste des processus
 */
export async function getProcesses(
  limit = 10,
  sortBy: 'cpu' | 'memory' = 'cpu'
): Promise<ProcessesResponse['data']> {
  const response = await fetchApi<ProcessesResponse>(
    `/api/system/processes?limit=${limit}&sort=${sortBy}`
  );
  return response.data;
}

/**
 * Recupere les stats Docker detaillees
 */
export async function getDockerStats(): Promise<DockerStatsResponse['data']> {
  const response = await fetchApi<DockerStatsResponse>('/api/system/docker');
  return response.data;
}
