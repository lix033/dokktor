/**
 * Service de monitoring systeme
 * Collecte les metriques du serveur VPS via systeminformation
 */

import si from 'systeminformation';
import {
  CpuInfo,
  CpuUsage,
  MemoryInfo,
  SwapInfo,
  DiskInfo,
  DiskIO,
  NetworkInterface,
  NetworkStats,
  NetworkConnections,
  SystemInfo,
  ProcessInfo,
  ProcessStats,
  DockerInfo,
  DockerStorageInfo,
} from '../types';

/**
 * Service de monitoring du systeme
 * Utilise systeminformation pour collecter les metriques
 */
class SystemMonitorService {
  private static instance: SystemMonitorService | null = null;

  // Cache pour eviter les appels trop frequents
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 1000; // 1 seconde de cache

  private constructor() {}

  /**
   * Recupere l'instance unique du service
   */
  static getInstance(): SystemMonitorService {
    if (SystemMonitorService.instance === null) {
      SystemMonitorService.instance = new SystemMonitorService();
    }
    return SystemMonitorService.instance;
  }

  /**
   * Recupere une valeur du cache ou execute la fonction
   */
  private async getFromCache<T>(
    key: string,
    fetchFn: () => Promise<T>
  ): Promise<T> {
    const cached = this.cache.get(key);
    const now = Date.now();

    if (cached !== undefined && now - cached.timestamp < this.CACHE_TTL) {
      return cached.data as T;
    }

    const data = await fetchFn();
    this.cache.set(key, { data, timestamp: now });
    return data;
  }

  // ============================================
  // Informations systeme
  // ============================================

  /**
   * Recupere les informations generales du systeme
   */
  async getSystemInfo(): Promise<SystemInfo> {
    return this.getFromCache('systemInfo', async () => {
      const [osInfo, time] = await Promise.all([
        si.osInfo(),
        si.time(),
      ]);

      return {
        hostname: osInfo.hostname,
        platform: osInfo.platform,
        distro: osInfo.distro,
        release: osInfo.release,
        kernel: osInfo.kernel,
        arch: osInfo.arch,
        uptime: time.uptime,
      };
    });
  }

  // ============================================
  // CPU
  // ============================================

  /**
   * Recupere les informations du CPU
   */
  async getCpuInfo(): Promise<CpuInfo> {
    return this.getFromCache('cpuInfo', async () => {
      const cpu = await si.cpu();

      return {
        manufacturer: cpu.manufacturer,
        brand: cpu.brand,
        speed: cpu.speed,
        speedMax: cpu.speedMax,
        cores: cpu.cores,
        physicalCores: cpu.physicalCores,
        architecture: process.arch,
      };
    });
  }

  /**
   * Recupere l'utilisation actuelle du CPU
   */
  async getCpuUsage(): Promise<CpuUsage> {
    const [load, currentLoad] = await Promise.all([
      si.currentLoad(),
      si.fullLoad(),
    ]);

    const loadAvg = await si.currentLoad();

    return {
      overall: Math.round(load.currentLoad * 100) / 100,
      perCore: load.cpus.map((cpu) => Math.round(cpu.load * 100) / 100),
      user: Math.round(load.currentLoadUser * 100) / 100,
      system: Math.round(load.currentLoadSystem * 100) / 100,
      idle: Math.round(load.currentLoadIdle * 100) / 100,
      loadAverage: [
        Math.round(loadAvg.avgLoad * 100) / 100,
        Math.round((loadAvg.avgLoad || 0) * 100) / 100,
        Math.round((loadAvg.avgLoad || 0) * 100) / 100,
      ],
    };
  }

  // ============================================
  // Memoire
  // ============================================

  /**
   * Recupere les informations de la memoire RAM
   */
  async getMemoryInfo(): Promise<MemoryInfo> {
    const mem = await si.mem();

    return {
      total: mem.total,
      used: mem.used,
      free: mem.free,
      available: mem.available,
      usedPercent: Math.round((mem.used / mem.total) * 10000) / 100,
      cached: mem.cached,
      buffers: mem.buffers,
    };
  }

  /**
   * Recupere les informations du swap
   */
  async getSwapInfo(): Promise<SwapInfo> {
    const mem = await si.mem();

    const usedPercent =
      mem.swaptotal > 0
        ? Math.round((mem.swapused / mem.swaptotal) * 10000) / 100
        : 0;

    return {
      total: mem.swaptotal,
      used: mem.swapused,
      free: mem.swapfree,
      usedPercent,
    };
  }

  // ============================================
  // Stockage
  // ============================================

  /**
   * Recupere les informations des disques
   */
  async getDisksInfo(): Promise<DiskInfo[]> {
    const fsSize = await si.fsSize();

    return fsSize
      .filter((fs) => fs.mount !== '' && !fs.mount.startsWith('/snap'))
      .map((fs) => ({
        mount: fs.mount,
        filesystem: fs.fs,
        type: fs.type,
        size: fs.size,
        used: fs.used,
        available: fs.available,
        usedPercent: Math.round(fs.use * 100) / 100,
      }));
  }

  /**
   * Recupere les statistiques IO des disques
   */
  async getDiskIO(): Promise<DiskIO> {
    const disksIO = await si.disksIO();

    return {
      readBytes: (disksIO as any).rIO_bytes ?? 0,
      writeBytes: (disksIO as any).wIO_bytes ?? 0,
      readOps: disksIO.rIO || 0,
      writeOps: disksIO.wIO || 0,
      totalIOTime: disksIO.tIO || 0,
    };
  }

  // ============================================
  // Reseau
  // ============================================

  /**
   * Recupere les interfaces reseau
   */
  async getNetworkInterfaces(): Promise<NetworkInterface[]> {
    const interfaces = await si.networkInterfaces();

    // systeminformation peut retourner un objet ou un tableau
    const interfaceList = Array.isArray(interfaces) ? interfaces : [interfaces];

    return interfaceList
      .filter((iface) => iface.ip4 !== '' || iface.ip6 !== '')
      .map((iface) => ({
        name: iface.iface,
        ip4: iface.ip4,
        ip6: iface.ip6,
        mac: iface.mac,
        isUp: iface.operstate === 'up',
        speed: iface.speed || 0,
        type: iface.type,
      }));
  }

  /**
   * Recupere les statistiques reseau
   */
  async getNetworkStats(): Promise<NetworkStats[]> {
    const stats = await si.networkStats();

    return stats.map((stat) => ({
      interface: stat.iface,
      rxBytes: stat.rx_bytes,
      txBytes: stat.tx_bytes,
      rxPackets: (stat as any).rx_packets ?? 0,
      txPackets: (stat as any).tx_packets ?? 0,
      rxErrors: stat.rx_errors || 0,
      txErrors: stat.tx_errors || 0,
      rxDropped: stat.rx_dropped || 0,
      txDropped: stat.tx_dropped || 0,
    }));
  }

  /**
   * Recupere les connexions reseau
   */
  async getNetworkConnections(): Promise<NetworkConnections> {
    const connections = await si.networkConnections();

    let established = 0;
    let listening = 0;
    let timeWait = 0;
    let closeWait = 0;

    for (const conn of connections) {
      switch (conn.state?.toUpperCase()) {
        case 'ESTABLISHED':
          established++;
          break;
        case 'LISTEN':
          listening++;
          break;
        case 'TIME_WAIT':
          timeWait++;
          break;
        case 'CLOSE_WAIT':
          closeWait++;
          break;
      }
    }

    return {
      established,
      listening,
      timeWait,
      closeWait,
      total: connections.length,
    };
  }

  // ============================================
  // Processus
  // ============================================

  /**
   * Recupere les statistiques des processus
   */
  async getProcessStats(): Promise<ProcessStats> {
    const processes = await si.processes();

    return {
      total: processes.all,
      running: processes.running,
      sleeping: processes.sleeping,
      blocked: processes.blocked,
      zombie: processes.unknown,
    };
  }

  /**
   * Recupere la liste des processus (top N par CPU/memoire)
   */
  async getTopProcesses(limit = 10, sortBy: 'cpu' | 'memory' = 'cpu'): Promise<ProcessInfo[]> {
    const processes = await si.processes();

    const sorted = processes.list
      .sort((a, b) => {
        if (sortBy === 'cpu') {
          return b.cpu - a.cpu;
        }
        return b.mem - a.mem;
      })
      .slice(0, limit);

    return sorted.map((proc) => ({
      pid: proc.pid,
      name: proc.name,
      user: proc.user,
      cpu: Math.round(proc.cpu * 100) / 100,
      memory: Math.round(proc.mem * 100) / 100,
      memoryUsed: proc.memRss,
      state: proc.state,
      command: proc.command,
      started: proc.started,
    }));
  }

  // ============================================
  // Docker
  // ============================================

  /**
   * Recupere les informations Docker
   */
  async getDockerInfo(): Promise<DockerInfo | null> {
    try {
      const dockerInfo = await si.dockerInfo();

      if (!dockerInfo || dockerInfo.id === '') {
        return null;
      }

      return {
        version: dockerInfo.serverVersion || 'unknown',
        apiVersion: (dockerInfo as any).apiVersion || 'unknown',
        containers: dockerInfo.containers,
        containersRunning: dockerInfo.containersRunning,
        containersPaused: dockerInfo.containersPaused,
        containersStopped: dockerInfo.containersStopped,
        images: dockerInfo.images,
        storageDriver: dockerInfo.driver || 'unknown',
        dockerRootDir: dockerInfo.dockerRootDir || '/var/lib/docker',
        memTotal: dockerInfo.memTotal,
      };
    } catch {
      return null;
    }
  }

  /**
   * Recupere l'utilisation du stockage Docker
   */
  async getDockerStorageInfo(): Promise<DockerStorageInfo | null> {
    try {
      const [images, containers, volumes] = await Promise.all([
        si.dockerImages(),
        si.dockerContainers(true),
        si.dockerVolumes(),
      ]);

      const imagesSize = images.reduce((acc, img) => acc + (img.size || 0), 0);
      const containersSize = containers.reduce(
        (acc, c:any) => acc + (c.sizeRw ?? 0) + (c.sizeRootFs ?? 0),
        0
      );
      const volumesSize = volumes.reduce(
        (acc, v:any) => acc + (v.size ?? 0),
        0
      );

      // Estimation du cache de build (non disponible directement)
      const buildCacheSize = 0;

      const totalSize = imagesSize + containersSize + volumesSize + buildCacheSize;

      // Estimation de l'espace recuperable (images non utilisees)
      const usedImages = new Set(containers.map((c) => c.image));
      const reclaimableSize = images
        .filter((img) => !usedImages.has(img.id))
        .reduce((acc, img) => acc + (img.size || 0), 0);

      return {
        imagesSize,
        containersSize,
        volumesSize,
        buildCacheSize,
        totalSize,
        reclaimableSize,
      };
    } catch {
      return null;
    }
  }

  // ============================================
  // Methodes utilitaires
  // ============================================

  /**
   * Recupere toutes les metriques en une seule fois
   */
  async getAllMetrics(): Promise<{
    system: SystemInfo;
    cpu: { info: CpuInfo; usage: CpuUsage };
    memory: { ram: MemoryInfo; swap: SwapInfo };
    disks: DiskInfo[];
    network: {
      interfaces: NetworkInterface[];
      stats: NetworkStats[];
      connections: NetworkConnections;
    };
    docker: DockerInfo | null;
  }> {
    const [
      system,
      cpuInfo,
      cpuUsage,
      memoryInfo,
      swapInfo,
      disks,
      networkInterfaces,
      networkStats,
      networkConnections,
      docker,
    ] = await Promise.all([
      this.getSystemInfo(),
      this.getCpuInfo(),
      this.getCpuUsage(),
      this.getMemoryInfo(),
      this.getSwapInfo(),
      this.getDisksInfo(),
      this.getNetworkInterfaces(),
      this.getNetworkStats(),
      this.getNetworkConnections(),
      this.getDockerInfo(),
    ]);

    return {
      system,
      cpu: {
        info: cpuInfo,
        usage: cpuUsage,
      },
      memory: {
        ram: memoryInfo,
        swap: swapInfo,
      },
      disks,
      network: {
        interfaces: networkInterfaces,
        stats: networkStats,
        connections: networkConnections,
      },
      docker,
    };
  }

  /**
   * Recupere un apercu rapide du systeme
   */
  async getOverview(): Promise<{
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
  }> {
    const [system, cpuInfo, cpuUsage, memory, disks, networkStats, docker] =
      await Promise.all([
        this.getSystemInfo(),
        this.getCpuInfo(),
        this.getCpuUsage(),
        this.getMemoryInfo(),
        this.getDisksInfo(),
        this.getNetworkStats(),
        this.getDockerInfo(),
      ]);

    // Calculer le total des disques (seulement les partitions principales)
    const mainDisks = disks.filter(
      (d) => d.mount === '/' || d.mount.startsWith('/home')
    );
    const diskTotal = mainDisks.reduce((acc, d) => acc + d.size, 0);
    const diskUsed = mainDisks.reduce((acc, d) => acc + d.used, 0);

    // Total du trafic reseau
    const networkRx = networkStats.reduce((acc, s) => acc + s.rxBytes, 0);
    const networkTx = networkStats.reduce((acc, s) => acc + s.txBytes, 0);

    return {
      hostname: system.hostname,
      platform: `${system.distro} ${system.release}`,
      uptime: system.uptime,
      cpu: {
        model: `${cpuInfo.manufacturer} ${cpuInfo.brand}`,
        cores: cpuInfo.cores,
        usage: cpuUsage.overall,
        loadAverage: cpuUsage.loadAverage,
      },
      memory: {
        total: memory.total,
        used: memory.used,
        usedPercent: memory.usedPercent,
      },
      disk: {
        total: diskTotal || disks[0]?.size || 0,
        used: diskUsed || disks[0]?.used || 0,
        usedPercent:
          diskTotal > 0
            ? Math.round((diskUsed / diskTotal) * 10000) / 100
            : disks[0]?.usedPercent || 0,
      },
      network: {
        rxBytes: networkRx,
        txBytes: networkTx,
      },
      docker: docker
        ? {
            containers: docker.containers,
            containersRunning: docker.containersRunning,
            images: docker.images,
          }
        : null,
    };
  }

  /**
   * Nettoie le cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export de l'instance singleton
export const systemMonitorService = SystemMonitorService.getInstance();
