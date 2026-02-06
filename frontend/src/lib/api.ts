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

// ============================================
// API Applications
// ============================================

import type {
  AppConfig,
  AppTemplate,
  Deployment,
  CreateAppRequest,
  UpdateAppRequest,
  PortAllocation,
} from '@/types';

/**
 * Recupere la liste des applications
 */
export async function getApps(): Promise<AppConfig[]> {
  const response = await fetchApi<{ success: boolean; data: AppConfig[] }>('/api/apps');
  return response.data;
}

/**
 * Recupere une application par son ID
 */
export async function getApp(appId: string): Promise<AppConfig> {
  const response = await fetchApi<{ success: boolean; data: AppConfig }>(`/api/apps/${appId}`);
  return response.data;
}

/**
 * Cree une nouvelle application
 */
export async function createApp(request: CreateAppRequest): Promise<AppConfig> {
  const response = await fetchApi<{ success: boolean; data: AppConfig }>('/api/apps', {
    method: 'POST',
    body: JSON.stringify(request),
  });
  return response.data;
}

/**
 * Met a jour une application
 */
export async function updateApp(appId: string, request: UpdateAppRequest): Promise<AppConfig> {
  const response = await fetchApi<{ success: boolean; data: AppConfig }>(`/api/apps/${appId}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  });
  return response.data;
}

/**
 * Supprime une application
 */
export async function deleteApp(appId: string): Promise<void> {
  await fetchApi(`/api/apps/${appId}`, { method: 'DELETE' });
}

/**
 * Lance le deploiement d'une application
 */
export async function deployApp(appId: string, force = false): Promise<Deployment> {
  const response = await fetchApi<{ success: boolean; data: Deployment }>(
    `/api/apps/${appId}/deploy`,
    {
      method: 'POST',
      body: JSON.stringify({ force }),
    }
  );
  return response.data;
}

/**
 * Arrete une application
 */
export async function stopAppService(appId: string): Promise<void> {
  await fetchApi(`/api/apps/${appId}/stop`, { method: 'POST' });
}

/**
 * Demarre une application
 */
export async function startAppService(appId: string): Promise<void> {
  await fetchApi(`/api/apps/${appId}/start`, { method: 'POST' });
}

/**
 * Redemarre une application
 */
export async function restartAppService(appId: string): Promise<void> {
  await fetchApi(`/api/apps/${appId}/restart`, { method: 'POST' });
}

/**
 * Recupere les logs d'une application
 */
export async function getAppLogs(appId: string, tail = 100): Promise<string> {
  const response = await fetchApi<{ success: boolean; data: { logs: string } }>(
    `/api/apps/${appId}/logs?tail=${tail}`
  );
  return response.data.logs;
}

/**
 * Recupere l'historique des deploiements
 */
export async function getAppDeployments(appId: string): Promise<Deployment[]> {
  const response = await fetchApi<{ success: boolean; data: Deployment[] }>(
    `/api/apps/${appId}/deployments`
  );
  return response.data;
}

/**
 * Recupere un deploiement specifique
 */
export async function getDeployment(deploymentId: string): Promise<Deployment> {
  const response = await fetchApi<{ success: boolean; data: Deployment }>(
    `/api/apps/deployments/${deploymentId}`
  );
  return response.data;
}

/**
 * Recupere les templates disponibles
 */
export async function getAppTemplates(): Promise<AppTemplate[]> {
  const response = await fetchApi<{ success: boolean; data: AppTemplate[] }>('/api/apps/templates');
  return response.data;
}

/**
 * Recupere les informations sur les ports
 */
export async function getPortsInfo(): Promise<{
  allocated: PortAllocation[];
  available: number[];
  range: { start: number; end: number };
}> {
  const response = await fetchApi<{
    success: boolean;
    data: {
      allocated: PortAllocation[];
      available: number[];
      range: { start: number; end: number };
    };
  }>('/api/apps/ports');
  return response.data;
}

/**
 * Synchronise les statuts des applications
 */
export async function syncApps(): Promise<void> {
  await fetchApi('/api/apps/sync', { method: 'POST' });
}

/**
 * Valide une configuration Git
 */
export async function validateGitConfig(gitConfig: {
  url?: string;
  branch?: string;
  isPrivate?: boolean;
  authMethod?: string;
  accessToken?: string;
  username?: string;
  password?: string;
  sshPrivateKey?: string;
}): Promise<{ valid: boolean; errors: string[] }> {
  const response = await fetchApi<{
    success: boolean;
    data: { valid: boolean; errors: string[] };
  }>('/api/apps/validate-git', {
    method: 'POST',
    body: JSON.stringify(gitConfig),
  });
  return response.data;
}
