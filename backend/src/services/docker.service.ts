/**
 * Service Docker
 * Encapsule toute la logique d'interaction avec l'API Docker
 * Ce service est le seul point de contact avec Dockerode
 */

import Docker from 'dockerode';
import { Readable } from 'stream';
import { config } from '../config';
import {
  ContainerInfo,
  ContainerState,
  HealthStatus,
  PortMapping,
  LogEntry,
  LogsOptions,
} from '../types';

/**
 * Type pour les bindings de ports Docker
 * Dockerode ne type pas correctement cette structure
 */
interface PortBinding {
  HostIp?: string;
  HostPort?: string;
}

type PortBindingsMap = Record<string, PortBinding[] | null | undefined>;

/**
 * Classe de service pour les opérations Docker
 * Utilise le pattern Singleton pour réutiliser la connexion
 */
class DockerService {
  private docker: Docker;
  private static instance: DockerService | null = null;

  private constructor() {
    // Connexion au socket Docker
    // En production sur VPS, le socket est monté dans le container
    this.docker = new Docker({
      socketPath: config.dockerSocketPath,
      timeout: config.dockerTimeout,
    });
  }

  /**
   * Récupère l'instance unique du service
   */
  static getInstance(): DockerService {
    if (DockerService.instance === null) {
      DockerService.instance = new DockerService();
    }
    return DockerService.instance;
  }

  /**
   * Vérifie la connexion Docker
   * Utilisé pour le healthcheck de l'API
   */
  async ping(): Promise<boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Récupère la liste de tous les containers
   * @param all - Si true, inclut les containers arrêtés
   */
  async listContainers(all = true): Promise<ContainerInfo[]> {
    const containers = await this.docker.listContainers({ all });

    return containers.map((container) => this.mapContainerInfo(container));
  }

  /**
   * Récupère les informations d'un container spécifique
   * @param containerId - ID ou nom du container
   */
  async getContainer(containerId: string): Promise<ContainerInfo | null> {
    try {
      const container = this.docker.getContainer(containerId);
      const inspect = await container.inspect();

      return this.mapInspectToContainerInfo(inspect);
    } catch (error) {
      // Container non trouvé
      if (this.isDockerError(error) && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Arrête un container
   * @param containerId - ID ou nom du container
   * @param timeout - Timeout en secondes avant kill (défaut: 10s)
   */
  async stopContainer(containerId: string, timeout = 10): Promise<void> {
    const container = this.docker.getContainer(containerId);
    
    // Vérifie que le container existe et est en cours d'exécution
    const inspect = await container.inspect();
    if (!inspect.State.Running) {
      throw new ContainerNotRunningError(containerId);
    }

    await container.stop({ t: timeout });
  }

  /**
   * Redémarre un container
   * @param containerId - ID ou nom du container
   * @param timeout - Timeout en secondes avant kill (défaut: 10s)
   */
  async restartContainer(containerId: string, timeout = 10): Promise<void> {
    const container = this.docker.getContainer(containerId);
    
    // Vérifie que le container existe
    await container.inspect();

    await container.restart({ t: timeout });
  }

  /**
   * Démarre un container arrêté
   * @param containerId - ID ou nom du container
   */
  async startContainer(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    
    // Vérifie que le container existe et n'est pas déjà en cours d'exécution
    const inspect = await container.inspect();
    if (inspect.State.Running) {
      throw new ContainerAlreadyRunningError(containerId);
    }

    await container.start();
  }

  /**
   * Récupère les logs d'un container
   * @param containerId - ID ou nom du container
   * @param options - Options de récupération des logs
   */
  async getContainerLogs(
    containerId: string,
    options: LogsOptions = {}
  ): Promise<LogEntry[]> {
    const container = this.docker.getContainer(containerId);
    
    // Vérifie que le container existe
    await container.inspect();

    const {
      tail = 100,
      timestamps = true,
      since = 0,
      until = 0,
      stdout = true,
      stderr = true,
    } = options;

    const logsBuffer = await container.logs({
      follow: false,
      stdout,
      stderr,
      timestamps,
      tail,
      since,
      ...(until > 0 ? { until } : {}),
    });

    return this.parseDockerLogs(logsBuffer);
  }

  /**
   * Crée un stream de logs en temps réel
   * @param containerId - ID ou nom du container
   * @param options - Options du stream
   * @returns Stream de logs
   */
  async getContainerLogsStream(
    containerId: string,
    options: LogsOptions = {}
  ): Promise<Readable> {
    const container = this.docker.getContainer(containerId);
    
    // Vérifie que le container existe
    await container.inspect();

    const {
      tail = 50,
      timestamps = true,
      stdout = true,
      stderr = true,
      since = 0,
    } = options;

    const stream = await container.logs({
      follow: true,
      stdout,
      stderr,
      timestamps,
      tail,
      since,
    });

    // Dockerode retourne un stream multiplexé, on le démultiplexe
    return stream as unknown as Readable;
  }

  /**
   * Parse les logs Docker (format multiplexé)
   * Docker utilise un format avec un header de 8 bytes par ligne
   * Byte 0: Type (1=stdout, 2=stderr)
   * Bytes 4-7: Taille du message (big-endian)
   */
  private parseDockerLogs(buffer: Buffer | string): LogEntry[] {
    const logs: LogEntry[] = [];
    
    // Si c'est une string, on la parse directement
    if (typeof buffer === 'string') {
      return this.parseLogsString(buffer);
    }

    let offset = 0;
    
    while (offset < buffer.length) {
      // Vérifie qu'il reste assez de bytes pour le header
      if (offset + 8 > buffer.length) break;

      // Lecture du header
      const streamType = buffer[offset];
      const size = buffer.readUInt32BE(offset + 4);
      
      // Vérifie qu'il reste assez de bytes pour le message
      if (offset + 8 + size > buffer.length) break;

      // Extraction du message
      const message = buffer.slice(offset + 8, offset + 8 + size).toString('utf-8');
      
      // Parse le timestamp si présent (format: 2024-01-15T10:30:00.123456789Z message)
      const parsed = this.parseLogLine(message, streamType === 1 ? 'stdout' : 'stderr');
      if (parsed !== null) {
        logs.push(parsed);
      }

      offset += 8 + size;
    }

    return logs;
  }

  /**
   * Parse une string de logs (fallback si pas de buffer)
   */
  private parseLogsString(logsStr: string): LogEntry[] {
    const lines = logsStr.split('\n').filter(line => line.trim() !== '');
    return lines
      .map(line => this.parseLogLine(line, 'stdout'))
      .filter((entry): entry is LogEntry => entry !== null);
  }

  /**
   * Parse une ligne de log individuelle
   */
  private parseLogLine(line: string, defaultStream: 'stdout' | 'stderr'): LogEntry | null {
    const trimmedLine = line.trim();
    if (trimmedLine === '') return null;

    // Regex pour extraire le timestamp Docker (ISO 8601 avec nanosecondes)
    const timestampRegex = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)\s+(.*)$/;
    const match = timestampRegex.exec(trimmedLine);

    if (match !== null && match[1] !== undefined && match[2] !== undefined) {
      return {
        timestamp: match[1],
        message: match[2],
        stream: defaultStream,
      };
    }

    // Pas de timestamp, on utilise l'heure actuelle
    return {
      timestamp: new Date().toISOString(),
      message: trimmedLine,
      stream: defaultStream,
    };
  }

  /**
   * Démultiplexe un chunk de stream Docker
   * Utilisé pour le streaming en temps réel
   */
  demultiplexDockerStream(chunk: Buffer): LogEntry[] {
    return this.parseDockerLogs(chunk);
  }

  /**
   * Mappe les données Docker vers notre format ContainerInfo
   * Utilisé pour la liste des containers
   */
  private mapContainerInfo(container: Docker.ContainerInfo): ContainerInfo {
    // Extraction du nom (supprime le / initial)
    const name = container.Names[0]?.replace(/^\//, '') ?? 'unknown';

    // Mapping des ports
    const ports: PortMapping[] = container.Ports.map((port) => ({
      privatePort: port.PrivatePort,
      publicPort: port.PublicPort,
      type: port.Type as 'tcp' | 'udp',
    }));

    // Extraction du health status
    const health = this.extractHealthStatus(container.Status);

    return {
      id: container.Id.substring(0, 12),
      name,
      image: container.Image,
      state: container.State as ContainerState,
      status: container.Status,
      health,
      created: new Date(container.Created * 1000).toISOString(),
      ports,
    };
  }

  /**
   * Mappe les données d'inspection vers ContainerInfo
   * Utilisé pour un container spécifique
   */
  private mapInspectToContainerInfo(
    inspect: Docker.ContainerInspectInfo
  ): ContainerInfo {
    const name = inspect.Name.replace(/^\//, '');

    // Mapping des ports depuis la config réseau
    const ports: PortMapping[] = [];
    
    // Cast explicite car Dockerode type PortBindings comme {} au lieu du type réel
    const portBindings = inspect.HostConfig.PortBindings as PortBindingsMap | undefined;

    if (portBindings !== undefined && portBindings !== null) {
      for (const [containerPort, hostPorts] of Object.entries(portBindings)) {
        const [port, protocol] = containerPort.split('/');
        const portNum = parseInt(port ?? '0', 10);

        if (Array.isArray(hostPorts) && hostPorts.length > 0) {
          const hostPort = hostPorts[0];
          if (hostPort !== undefined) {
            ports.push({
              privatePort: portNum,
              publicPort: parseInt(hostPort.HostPort ?? '0', 10),
              type: (protocol ?? 'tcp') as 'tcp' | 'udp',
            });
          }
        } else {
          ports.push({
            privatePort: portNum,
            type: (protocol ?? 'tcp') as 'tcp' | 'udp',
          });
        }
      }
    }

    // Health status depuis l'inspection
    let health: HealthStatus = 'none';
    const healthState = inspect.State.Health;
    if (healthState !== undefined && healthState !== null) {
      health = healthState.Status as HealthStatus;
    }

    return {
      id: inspect.Id.substring(0, 12),
      name,
      image: inspect.Config.Image,
      state: (inspect.State.Running
        ? 'running'
        : inspect.State.Paused
        ? 'paused'
        : inspect.State.Restarting
        ? 'restarting'
        : inspect.State.Dead
        ? 'dead'
        : 'exited') as ContainerState,
      status: inspect.State.Status,
      health,
      created: inspect.Created,
      ports,
    };
  }

  /**
   * Extrait le statut de santé depuis la chaîne de statut
   * Ex: "Up 2 hours (healthy)" -> "healthy"
   */
  private extractHealthStatus(status: string): HealthStatus {
    if (status.includes('(healthy)')) return 'healthy';
    if (status.includes('(unhealthy)')) return 'unhealthy';
    if (status.includes('(health: starting)')) return 'starting';
    return 'none';
  }

  /**
   * Type guard pour les erreurs Docker
   */
  private isDockerError(error: unknown): error is { statusCode: number; message: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof (error as { statusCode: unknown }).statusCode === 'number'
    );
  }
}

/**
 * Erreurs métier personnalisées
 */
export class ContainerNotFoundError extends Error {
  constructor(containerId: string) {
    super(`Container '${containerId}' non trouvé`);
    this.name = 'ContainerNotFoundError';
  }
}

export class ContainerNotRunningError extends Error {
  constructor(containerId: string) {
    super(`Container '${containerId}' n'est pas en cours d'exécution`);
    this.name = 'ContainerNotRunningError';
  }
}

export class ContainerAlreadyRunningError extends Error {
  constructor(containerId: string) {
    super(`Container '${containerId}' est déjà en cours d'exécution`);
    this.name = 'ContainerAlreadyRunningError';
  }
}

// Export de l'instance singleton
export const dockerService = DockerService.getInstance();