/**
 * Types métier pour le monitoring Docker
 * Ces types représentent les données exposées par l'API
 */

/** États possibles d'un container Docker */
export type ContainerState = 'running' | 'exited' | 'paused' | 'restarting' | 'dead' | 'created';

/** États de santé d'un container (healthcheck) */
export type HealthStatus = 'healthy' | 'unhealthy' | 'starting' | 'none';

/**
 * Représentation simplifiée d'un container pour l'API
 * Contient uniquement les informations nécessaires au dashboard
 */
export interface ContainerInfo {
  /** ID unique du container (12 premiers caractères) */
  id: string;
  
  /** Nom du container sans le slash initial */
  name: string;
  
  /** Image utilisée par le container */
  image: string;
  
  /** État actuel du container */
  state: ContainerState;
  
  /** Statut détaillé (ex: "Up 2 hours", "Exited (0) 3 days ago") */
  status: string;
  
  /** État de santé si healthcheck configuré */
  health: HealthStatus;
  
  /** Date de création du container */
  created: string;
  
  /** Ports exposés */
  ports: PortMapping[];
}

/** Mapping de ports */
export interface PortMapping {
  /** Port privé dans le container */
  privatePort: number;
  
  /** Port public sur l'hôte (optionnel) */
  publicPort?: number;
  
  /** Type de protocole */
  type: 'tcp' | 'udp';
}

/** Réponse standard de l'API pour les actions */
export interface ActionResponse {
  success: boolean;
  message: string;
  containerId: string;
  timestamp: string;
}

/** Réponse d'erreur de l'API */
export interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  timestamp: string;
  details?: unknown;
}

/** Options pour la récupération des logs */
export interface LogsOptions {
  /** Nombre de lignes à récupérer (défaut: 100) */
  tail?: number;
  
  /** Inclure les timestamps Docker */
  timestamps?: boolean;
  
  /** Timestamp de début (Unix timestamp) */
  since?: number;
  
  /** Timestamp de fin (Unix timestamp) */
  until?: number;
  
  /** Inclure stdout */
  stdout?: boolean;
  
  /** Inclure stderr */
  stderr?: boolean;
}

/** Une ligne de log */
export interface LogEntry {
  /** Timestamp de la ligne */
  timestamp: string;
  
  /** Contenu de la ligne */
  message: string;
  
  /** Source: stdout ou stderr */
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

/** Configuration du stream de logs */
export interface LogStreamConfig {
  /** Intervalle de rafraîchissement en ms (défaut: 1000) */
  refreshInterval: number;
  
  /** Nombre de lignes initiales (défaut: 50) */
  initialTail: number;
}
