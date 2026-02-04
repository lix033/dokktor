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

/** Evenement SSE pour le stream de logs */
export interface LogStreamEvent {
  type: 'connected' | 'log' | 'error' | 'heartbeat' | 'end';
  data: LogEntry | { error?: string; message?: string; timestamp: string };
}

// ============================================
// Types Monitoring Systeme
// ============================================

/** Apercu rapide du systeme */
export interface SystemOverview {
  hostname: string;
  platform: string;
  uptime: number;
  cpu: {
    model: string;
    cores: number;
    usage: number;
    loadAverage: [number, number, number];
  };
  memory: {
    total: number;
    used: number;
    usedPercent: number;
  };
  disk: {
    total: number;
    used: number;
    usedPercent: number;
  };
  network: {
    rxBytes: number;
    txBytes: number;
  };
  docker: {
    containers: number;
    containersRunning: number;
    images: number;
  } | null;
}

/** Reponse de l'endpoint overview */
export interface SystemOverviewResponse {
  success: boolean;
  data: SystemOverview;
  timestamp: string;
}

/** Informations CPU */
export interface CpuInfo {
  manufacturer: string;
  brand: string;
  speed: number;
  speedMax: number;
  cores: number;
  physicalCores: number;
  architecture: string;
}

/** Utilisation CPU */
export interface CpuUsage {
  overall: number;
  perCore: number[];
  user: number;
  system: number;
  idle: number;
  loadAverage: [number, number, number];
}

/** Informations memoire */
export interface MemoryInfo {
  total: number;
  used: number;
  free: number;
  available: number;
  usedPercent: number;
  cached: number;
  buffers: number;
}

/** Informations swap */
export interface SwapInfo {
  total: number;
  used: number;
  free: number;
  usedPercent: number;
}

/** Informations disque */
export interface DiskInfo {
  mount: string;
  filesystem: string;
  type: string;
  size: number;
  used: number;
  available: number;
  usedPercent: number;
}

/** IO disque */
export interface DiskIO {
  readBytes: number;
  writeBytes: number;
  readOps: number;
  writeOps: number;
  totalIOTime: number;
}

/** Interface reseau */
export interface NetworkInterface {
  name: string;
  ip4: string;
  ip6: string;
  mac: string;
  isUp: boolean;
  speed: number;
  type: string;
}

/** Stats reseau */
export interface NetworkStats {
  interface: string;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
  rxErrors: number;
  txErrors: number;
  rxDropped: number;
  txDropped: number;
}

/** Connexions reseau */
export interface NetworkConnections {
  established: number;
  listening: number;
  timeWait: number;
  closeWait: number;
  total: number;
}

/** Informations processus */
export interface ProcessInfo {
  pid: number;
  name: string;
  user: string;
  cpu: number;
  memory: number;
  memoryUsed: number;
  state: string;
  command: string;
  started: string;
}

/** Stats processus */
export interface ProcessStats {
  total: number;
  running: number;
  sleeping: number;
  blocked: number;
  zombie: number;
}

/** Infos Docker */
export interface DockerInfo {
  version: string;
  apiVersion: string;
  containers: number;
  containersRunning: number;
  containersPaused: number;
  containersStopped: number;
  images: number;
  storageDriver: string;
  dockerRootDir: string;
  memTotal: number;
}

/** Stockage Docker */
export interface DockerStorageInfo {
  imagesSize: number;
  containersSize: number;
  volumesSize: number;
  buildCacheSize: number;
  totalSize: number;
  reclaimableSize: number;
}

/** Metriques completes */
export interface SystemMetrics {
  system: {
    hostname: string;
    platform: string;
    distro: string;
    release: string;
    kernel: string;
    arch: string;
    uptime: number;
  };
  cpu: {
    info: CpuInfo;
    usage: CpuUsage;
  };
  memory: {
    ram: MemoryInfo;
    swap: SwapInfo;
  };
  disks: DiskInfo[];
  network: {
    interfaces: NetworkInterface[];
    stats: NetworkStats[];
    connections: NetworkConnections;
  };
  docker: DockerInfo | null;
}

/** Reponse metriques completes */
export interface SystemMetricsResponse {
  success: boolean;
  data: SystemMetrics;
  timestamp: string;
}

/** Reponse processus */
export interface ProcessesResponse {
  success: boolean;
  data: {
    stats: ProcessStats;
    processes: ProcessInfo[];
  };
  count: number;
  timestamp: string;
}

/** Reponse Docker stats */
export interface DockerStatsResponse {
  success: boolean;
  data: {
    info: DockerInfo;
    storage: DockerStorageInfo;
  };
  timestamp: string;
}
