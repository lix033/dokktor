/**
 * Types pour le monitoring systeme du VPS
 * Metriques CPU, memoire, disque, reseau et processus
 */

// ============================================
// Types CPU
// ============================================

export interface CpuInfo {
  /** Fabricant du CPU */
  manufacturer: string;
  /** Modele du CPU */
  brand: string;
  /** Vitesse en GHz */
  speed: number;
  /** Vitesse maximale en GHz */
  speedMax: number;
  /** Nombre de coeurs physiques */
  cores: number;
  /** Nombre de coeurs logiques (threads) */
  physicalCores: number;
  /** Architecture (x64, arm64, etc.) */
  architecture: string;
}

export interface CpuUsage {
  /** Pourcentage d'utilisation globale */
  overall: number;
  /** Utilisation par coeur */
  perCore: number[];
  /** Pourcentage en mode utilisateur */
  user: number;
  /** Pourcentage en mode systeme */
  system: number;
  /** Pourcentage en idle */
  idle: number;
  /** Load average (1, 5, 15 minutes) */
  loadAverage: [number, number, number];
}

// ============================================
// Types Memoire
// ============================================

export interface MemoryInfo {
  /** Memoire totale en bytes */
  total: number;
  /** Memoire utilisee en bytes */
  used: number;
  /** Memoire libre en bytes */
  free: number;
  /** Memoire disponible en bytes */
  available: number;
  /** Pourcentage d'utilisation */
  usedPercent: number;
  /** Memoire en cache en bytes */
  cached: number;
  /** Buffers en bytes */
  buffers: number;
}

export interface SwapInfo {
  /** Swap total en bytes */
  total: number;
  /** Swap utilise en bytes */
  used: number;
  /** Swap libre en bytes */
  free: number;
  /** Pourcentage d'utilisation */
  usedPercent: number;
}

// ============================================
// Types Stockage
// ============================================

export interface DiskInfo {
  /** Point de montage */
  mount: string;
  /** Systeme de fichiers */
  filesystem: string;
  /** Type (ext4, xfs, etc.) */
  type: string;
  /** Taille totale en bytes */
  size: number;
  /** Espace utilise en bytes */
  used: number;
  /** Espace disponible en bytes */
  available: number;
  /** Pourcentage d'utilisation */
  usedPercent: number;
}

export interface DiskIO {
  /** Bytes lus */
  readBytes: number;
  /** Bytes ecrits */
  writeBytes: number;
  /** Operations de lecture */
  readOps: number;
  /** Operations d'ecriture */
  writeOps: number;
  /** Temps total IO en ms */
  totalIOTime: number;
}

// ============================================
// Types Reseau
// ============================================

export interface NetworkInterface {
  /** Nom de l'interface */
  name: string;
  /** Adresse IP v4 */
  ip4: string;
  /** Adresse IP v6 */
  ip6: string;
  /** Adresse MAC */
  mac: string;
  /** Interface active */
  isUp: boolean;
  /** Vitesse en Mbps */
  speed: number;
  /** Type (wired, wireless, virtual) */
  type: string;
}

export interface NetworkStats {
  /** Nom de l'interface */
  interface: string;
  /** Bytes recus */
  rxBytes: number;
  /** Bytes envoyes */
  txBytes: number;
  /** Paquets recus */
  rxPackets: number;
  /** Paquets envoyes */
  txPackets: number;
  /** Erreurs de reception */
  rxErrors: number;
  /** Erreurs d'envoi */
  txErrors: number;
  /** Paquets droppes en reception */
  rxDropped: number;
  /** Paquets droppes en envoi */
  txDropped: number;
}

export interface NetworkConnections {
  /** Nombre de connexions etablies */
  established: number;
  /** Nombre de connexions en attente */
  listening: number;
  /** Nombre de connexions TIME_WAIT */
  timeWait: number;
  /** Nombre de connexions CLOSE_WAIT */
  closeWait: number;
  /** Total des connexions */
  total: number;
}

// ============================================
// Types Systeme
// ============================================

export interface SystemInfo {
  /** Nom de l'hote */
  hostname: string;
  /** Plateforme (linux, darwin, win32) */
  platform: string;
  /** Distribution */
  distro: string;
  /** Version du systeme */
  release: string;
  /** Version du kernel */
  kernel: string;
  /** Architecture */
  arch: string;
  /** Uptime en secondes */
  uptime: number;
}

export interface OsInfo {
  /** Plateforme */
  platform: string;
  /** Distribution */
  distro: string;
  /** Version */
  release: string;
  /** Codename */
  codename: string;
  /** Kernel */
  kernel: string;
  /** Architecture */
  arch: string;
  /** Hostname */
  hostname: string;
  /** FQDN */
  fqdn: string;
}

// ============================================
// Types Processus
// ============================================

export interface ProcessInfo {
  /** PID */
  pid: number;
  /** Nom du processus */
  name: string;
  /** Utilisateur */
  user: string;
  /** Pourcentage CPU */
  cpu: number;
  /** Pourcentage memoire */
  memory: number;
  /** Memoire utilisee en bytes */
  memoryUsed: number;
  /** Etat du processus */
  state: string;
  /** Commande */
  command: string;
  /** Temps de demarrage */
  started: string;
}

export interface ProcessStats {
  /** Nombre total de processus */
  total: number;
  /** Processus en cours d'execution */
  running: number;
  /** Processus en veille */
  sleeping: number;
  /** Processus bloques */
  blocked: number;
  /** Processus zombies */
  zombie: number;
}

// ============================================
// Types Docker specifiques
// ============================================

export interface DockerInfo {
  /** Version de Docker */
  version: string;
  /** Version de l'API */
  apiVersion: string;
  /** Nombre de containers */
  containers: number;
  /** Containers en cours d'execution */
  containersRunning: number;
  /** Containers en pause */
  containersPaused: number;
  /** Containers arretes */
  containersStopped: number;
  /** Nombre d'images */
  images: number;
  /** Driver de stockage */
  storageDriver: string;
  /** Repertoire racine Docker */
  dockerRootDir: string;
  /** Memoire totale */
  memTotal: number;
}

export interface DockerStorageInfo {
  /** Espace utilise par les images */
  imagesSize: number;
  /** Espace utilise par les containers */
  containersSize: number;
  /** Espace utilise par les volumes */
  volumesSize: number;
  /** Espace utilise par le cache de build */
  buildCacheSize: number;
  /** Espace total utilise */
  totalSize: number;
  /** Espace recuperable */
  reclaimableSize: number;
}

// ============================================
// Types de reponse API
// ============================================

export interface SystemMetricsResponse {
  success: boolean;
  data: {
    system: SystemInfo;
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
  };
  timestamp: string;
}

export interface SystemOverviewResponse {
  success: boolean;
  data: {
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
  };
  timestamp: string;
}

export interface ProcessListResponse {
  success: boolean;
  data: {
    stats: ProcessStats;
    processes: ProcessInfo[];
  };
  count: number;
  timestamp: string;
}

export interface DockerStatsResponse {
  success: boolean;
  data: {
    info: DockerInfo;
    storage: DockerStorageInfo;
  };
  timestamp: string;
}
