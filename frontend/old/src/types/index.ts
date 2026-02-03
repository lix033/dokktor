/**
 * Types partagés pour le frontend
 * Miroir des types backend pour la cohérence
 */

/** États possibles d'un container Docker */
export type ContainerState = 'running' | 'exited' | 'paused' | 'restarting' | 'dead' | 'created';

/** États de santé d'un container */
export type HealthStatus = 'healthy' | 'unhealthy' | 'starting' | 'none';

/** Mapping de ports */
export interface PortMapping {
  privatePort: number;
  publicPort?: number;
  type: 'tcp' | 'udp';
}

/** Informations d'un container */
export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  state: ContainerState;
  status: string;
  health: HealthStatus;
  created: string;
  ports: PortMapping[];
}

/** Réponse de liste des containers */
export interface ContainersResponse {
  success: boolean;
  data: ContainerInfo[];
  count: number;
  timestamp: string;
}

/** Réponse d'action */
export interface ActionResponse {
  success: boolean;
  message: string;
  containerId: string;
  timestamp: string;
}

/** Réponse d'erreur */
export interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  timestamp: string;
}

/** Une ligne de log */
export interface LogEntry {
  timestamp: string;
  message: string;
  stream: 'stdout' | 'stderr';
}

/** Réponse de l'endpoint logs */
export interface LogsResponse {
  success: boolean;
  containerId: string;
  containerName: string;
  logs: LogEntry[];
  count: number;
  timestamp: string;
}

/** Options pour récupérer les logs */
export interface LogsOptions {
  tail?: number;
  since?: number;
  until?: number;
  timestamps?: boolean;
  stdout?: boolean;
  stderr?: boolean;
}

/** Événement SSE pour le stream de logs */
export interface LogStreamEvent {
  type: 'connected' | 'log' | 'error' | 'heartbeat' | 'end';
  data: LogEntry | { error?: string; message?: string; timestamp: string };
}
