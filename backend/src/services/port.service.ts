/**
 * Service de gestion des ports
 * Allocation dynamique des ports pour les applications
 */

import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import { PortAllocation, PortRange } from '../types';

/** 
 * Repertoire de configuration Docktor
 * Par defaut /var/app/.docktor, configurable via env
 */
const CONFIG_DIR = process.env.DOCKTOR_CONFIG_DIR || '/var/app/.docktor';

/** Fichier de stockage des allocations de ports */
const PORTS_FILE = path.join(CONFIG_DIR, 'ports.json');

/** Plage de ports par defaut */
const DEFAULT_PORT_RANGE: PortRange = {
  start: 10000,
  end: 20000,
};

/**
 * Cree un repertoire de maniere securisee
 */
function ensureDirectoryExists(dirPath: string): boolean {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 });
    }
    return true;
  } catch (error: any) {
    if (error.code === 'EEXIST') {
      return true;
    }
    console.error(`[PortManager] Impossible de creer ${dirPath}:`, error.message);
    return false;
  }
}

/**
 * Service de gestion des ports
 */
class PortManagerService {
  private static instance: PortManagerService | null = null;
  private allocations: Map<number, PortAllocation> = new Map();
  private portRange: PortRange = DEFAULT_PORT_RANGE;

  private constructor() {
    this.loadAllocations();
  }

  /**
   * Recupere l'instance unique du service
   */
  static getInstance(): PortManagerService {
    if (PortManagerService.instance === null) {
      PortManagerService.instance = new PortManagerService();
    }
    return PortManagerService.instance;
  }

  /**
   * Charge les allocations depuis le fichier
   */
  private loadAllocations(): void {
    try {
      if (fs.existsSync(PORTS_FILE)) {
        const data = JSON.parse(fs.readFileSync(PORTS_FILE, 'utf-8'));
        this.allocations = new Map(
          data.allocations.map((a: PortAllocation) => [a.port, a])
        );
        if (data.portRange) {
          this.portRange = data.portRange;
        }
        console.log(`[PortManager] ${this.allocations.size} allocation(s) chargee(s)`);
      }
    } catch (error: any) {
      console.error('[PortManager] Erreur chargement allocations:', error.message);
    }
  }

  /**
   * Sauvegarde les allocations dans le fichier
   */
  private saveAllocations(): void {
    try {
      // S'assurer que le repertoire existe
      ensureDirectoryExists(CONFIG_DIR);

      const data = {
        allocations: Array.from(this.allocations.values()),
        portRange: this.portRange,
      };
      fs.writeFileSync(PORTS_FILE, JSON.stringify(data, null, 2));
    } catch (error: any) {
      console.error('[PortManager] Erreur sauvegarde allocations:', error.message);
    }
  }

  /**
   * Verifie si un port est disponible sur le systeme
   */
  async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.once('error', () => {
        resolve(false);
      });

      server.once('listening', () => {
        server.close();
        resolve(true);
      });

      server.listen(port, '0.0.0.0');
    });
  }

  /**
   * Trouve le prochain port disponible
   */
  async findAvailablePort(): Promise<number> {
    // D'abord, verifier les ports precedemment alloues mais liberes
    for (let port = this.portRange.start; port <= this.portRange.end; port++) {
      if (!this.allocations.has(port)) {
        const available = await this.isPortAvailable(port);
        if (available) {
          return port;
        }
      }
    }

    throw new Error('Aucun port disponible dans la plage configuree');
  }

  /**
   * Alloue un port pour une application
   */
  async allocatePort(appId: string, appName: string, preferredPort?: number): Promise<number> {
    // Si un port prefere est specifie, verifier s'il est disponible
    if (preferredPort !== undefined) {
      const existingAllocation = this.allocations.get(preferredPort);
      
      // Si le port est deja alloue a cette application, le retourner
      if (existingAllocation?.appId === appId) {
        return preferredPort;
      }

      // Si le port est dans la plage et disponible
      if (
        preferredPort >= this.portRange.start &&
        preferredPort <= this.portRange.end &&
        !existingAllocation
      ) {
        const available = await this.isPortAvailable(preferredPort);
        if (available) {
          this.allocations.set(preferredPort, {
            port: preferredPort,
            appId,
            appName,
            allocatedAt: new Date().toISOString(),
          });
          this.saveAllocations();
          return preferredPort;
        }
      }
    }

    // Rechercher l'allocation existante pour cette application
    for (const [port, allocation] of this.allocations) {
      if (allocation.appId === appId) {
        const available = await this.isPortAvailable(port);
        if (available) {
          return port;
        }
        // Le port n'est plus disponible, le liberer
        this.allocations.delete(port);
      }
    }

    // Trouver un nouveau port disponible
    const port = await this.findAvailablePort();

    this.allocations.set(port, {
      port,
      appId,
      appName,
      allocatedAt: new Date().toISOString(),
    });

    this.saveAllocations();
    return port;
  }

  /**
   * Libere le port d'une application
   */
  releasePort(appId: string): void {
    for (const [port, allocation] of this.allocations) {
      if (allocation.appId === appId) {
        this.allocations.delete(port);
        break;
      }
    }
    this.saveAllocations();
  }

  /**
   * Recupere le port alloue a une application
   */
  getPortForApp(appId: string): number | undefined {
    for (const [port, allocation] of this.allocations) {
      if (allocation.appId === appId) {
        return port;
      }
    }
    return undefined;
  }

  /**
   * Recupere toutes les allocations
   */
  getAllAllocations(): PortAllocation[] {
    return Array.from(this.allocations.values());
  }

  /**
   * Recupere les ports disponibles (echantillon)
   */
  async getAvailablePorts(count = 10): Promise<number[]> {
    const available: number[] = [];
    
    for (let port = this.portRange.start; port <= this.portRange.end && available.length < count; port++) {
      if (!this.allocations.has(port)) {
        const isAvailable = await this.isPortAvailable(port);
        if (isAvailable) {
          available.push(port);
        }
      }
    }

    return available;
  }

  /**
   * Recupere la plage de ports configuree
   */
  getPortRange(): PortRange {
    return this.portRange;
  }

  /**
   * Configure la plage de ports
   */
  setPortRange(range: PortRange): void {
    this.portRange = range;
    this.saveAllocations();
  }

  /**
   * Nettoie les allocations pour les applications supprimees
   */
  async cleanupAllocations(existingAppIds: string[]): Promise<void> {
    const idsSet = new Set(existingAppIds);
    
    for (const [port, allocation] of this.allocations) {
      if (!idsSet.has(allocation.appId)) {
        this.allocations.delete(port);
      }
    }

    this.saveAllocations();
  }
}

export const portManagerService = PortManagerService.getInstance();
