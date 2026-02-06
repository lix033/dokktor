/**
 * Service de deploiement d'applications
 * Gestion complete du cycle de vie des applications
 * Support des repos Git prives (GitHub, GitLab, Bitbucket)
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import {
  AppConfig,
  AppStatus,
  CreateAppRequest,
  UpdateAppRequest,
  Deployment,
  DeploymentLog,
  EnvVariable,
  GitConfig,
  GitProvider,
  GitAuthMethod,
} from '../types';
import { getTemplate, getAllTemplates } from '../templates/app.templates';
import { portManagerService } from './port.service';

const execAsync = promisify(exec);

// ============================================
// Configuration
// ============================================

const APPS_ROOT = process.env.APPS_ROOT || '/var/app/apps';
const CONFIG_DIR = process.env.DOCKTOR_CONFIG_DIR || '/var/app/.docktor';
const APPS_CONFIG_FILE = path.join(CONFIG_DIR, 'apps.json');
const DOCKER_NETWORK = 'docktor-network';

// ============================================
// Detection Docker Compose
// ============================================

let DOCKER_COMPOSE_CMD: { cmd: string; args: string[] } | null = null;

async function detectDockerCompose(): Promise<{ cmd: string; args: string[] }> {
  if (DOCKER_COMPOSE_CMD) return DOCKER_COMPOSE_CMD;

  // Essayer docker-compose (standalone)
  try {
    await execAsync('docker-compose --version');
    console.log('[AppDeployment] Docker Compose: docker-compose (standalone)');
    DOCKER_COMPOSE_CMD = { cmd: 'docker-compose', args: [] };
    return DOCKER_COMPOSE_CMD;
  } catch {}

  // Essayer docker compose (plugin)
  try {
    await execAsync('docker compose version');
    console.log('[AppDeployment] Docker Compose: docker compose (plugin)');
    DOCKER_COMPOSE_CMD = { cmd: 'docker', args: ['compose'] };
    return DOCKER_COMPOSE_CMD;
  } catch {}

  throw new Error('Docker Compose non installe. Installez docker-compose ou le plugin docker compose.');
}

async function execDockerCompose(args: string[], options: { cwd: string }): Promise<{ stdout: string; stderr: string }> {
  const compose = await detectDockerCompose();
  const cmd = `${compose.cmd} ${[...compose.args, ...args].join(' ')}`;
  console.log(`[DockerCompose] ${cmd}`);
  return execAsync(cmd, options);
}

// ============================================
// Utilitaires Git
// ============================================

/**
 * Detecte le provider Git a partir de l'URL
 */
function detectGitProvider(url: string): GitProvider {
  const lower = url.toLowerCase();
  if (lower.includes('github.com') || lower.includes('github.')) return 'github';
  if (lower.includes('gitlab.com') || lower.includes('gitlab.')) return 'gitlab';
  if (lower.includes('bitbucket.org') || lower.includes('bitbucket.')) return 'bitbucket';
  return 'other';
}

/**
 * Construit l'URL Git avec authentification
 */
function buildGitCloneUrl(git: GitConfig): string {
  if (!git.isPrivate || git.authMethod === 'none') {
    return git.url;
  }

  // Pour SSH, on utilise l'URL directement
  if (git.authMethod === 'ssh') {
    // Convertir HTTPS en SSH si necessaire
    if (git.url.startsWith('https://')) {
      const match = git.url.match(/https:\/\/([^\/]+)\/(.+)/);
      if (match) {
        return `git@${match[1]}:${match[2]}`;
      }
    }
    return git.url;
  }

  // Pour token ou username/password
  try {
    const urlObj = new URL(git.url);
    
    if (git.authMethod === 'token' && git.accessToken) {
      // Format: https://token@host/path ou https://oauth2:token@host/path
      if (git.provider === 'gitlab') {
        urlObj.username = 'oauth2';
        urlObj.password = git.accessToken;
      } else if (git.provider === 'github') {
        urlObj.username = git.accessToken;
        urlObj.password = 'x-oauth-basic';
      } else if (git.provider === 'bitbucket') {
        urlObj.username = 'x-token-auth';
        urlObj.password = git.accessToken;
      } else {
        urlObj.username = git.accessToken;
      }
    } else if (git.authMethod === 'username_password' && git.username && git.password) {
      urlObj.username = encodeURIComponent(git.username);
      urlObj.password = encodeURIComponent(git.password);
    }
    
    return urlObj.toString();
  } catch {
    return git.url;
  }
}

/**
 * Configure SSH pour le clone
 */
async function setupSshForClone(git: GitConfig, appPath: string): Promise<string | null> {
  if (git.authMethod !== 'ssh' || !git.sshPrivateKey) {
    return null;
  }

  const sshDir = path.join(appPath, '.ssh');
  const keyPath = path.join(sshDir, 'id_rsa');
  
  // Creer le repertoire SSH
  if (!fs.existsSync(sshDir)) {
    fs.mkdirSync(sshDir, { recursive: true, mode: 0o700 });
  }
  
  // Ecrire la cle privee
  fs.writeFileSync(keyPath, git.sshPrivateKey, { mode: 0o600 });
  
  // Creer le fichier de config SSH pour desactiver la verification du host
  const configPath = path.join(sshDir, 'config');
  fs.writeFileSync(configPath, `Host *\n  StrictHostKeyChecking no\n  UserKnownHostsFile=/dev/null\n`, { mode: 0o600 });
  
  return keyPath;
}

/**
 * Nettoie les fichiers SSH apres le clone
 */
function cleanupSshFiles(appPath: string): void {
  const sshDir = path.join(appPath, '.ssh');
  if (fs.existsSync(sshDir)) {
    fs.rmSync(sshDir, { recursive: true, force: true });
  }
}

/**
 * Valide la configuration Git
 */
function validateGitConfig(git: Partial<GitConfig>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!git.url) {
    errors.push('URL du repository requise');
  } else {
    try {
      // Verifier que c'est une URL valide ou un format SSH
      if (!git.url.startsWith('git@') && !git.url.startsWith('ssh://')) {
        new URL(git.url);
      }
    } catch {
      errors.push('URL du repository invalide');
    }
  }

  if (git.isPrivate) {
    if (!git.authMethod || git.authMethod === 'none') {
      errors.push('Methode d\'authentification requise pour un repo prive');
    } else if (git.authMethod === 'token' && !git.accessToken) {
      errors.push('Token d\'acces requis pour l\'authentification par token');
    } else if (git.authMethod === 'username_password') {
      if (!git.username) errors.push('Nom d\'utilisateur requis');
      if (!git.password) errors.push('Mot de passe requis');
    } else if (git.authMethod === 'ssh' && !git.sshPrivateKey) {
      errors.push('Cle SSH privee requise pour l\'authentification SSH');
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================
// Utilitaires
// ============================================

function ensureDirectoryExists(dirPath: string): boolean {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 });
    }
    return true;
  } catch (error: any) {
    if (error.code === 'EEXIST') return true;
    console.error(`[AppDeployment] Erreur creation ${dirPath}:`, error.message);
    return false;
  }
}

function generateId(): string {
  return `app-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateContainerName(appName: string): string {
  return `docktor-${appName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
}

// ============================================
// Service Principal
// ============================================

class AppDeploymentService extends EventEmitter {
  private static instance: AppDeploymentService | null = null;
  private apps: Map<string, AppConfig> = new Map();
  private deployments: Map<string, Deployment> = new Map();

  private constructor() {
    super();
    this.initialize();
  }

  private initialize(): void {
    console.log(`[AppDeployment] Config: ${CONFIG_DIR}`);
    console.log(`[AppDeployment] Apps: ${APPS_ROOT}`);
    ensureDirectoryExists(CONFIG_DIR);
    ensureDirectoryExists(APPS_ROOT);
    this.loadApps();
    this.ensureNetworkExists();
  }

  static getInstance(): AppDeploymentService {
    if (!AppDeploymentService.instance) {
      AppDeploymentService.instance = new AppDeploymentService();
    }
    return AppDeploymentService.instance;
  }

  private loadApps(): void {
    try {
      if (fs.existsSync(APPS_CONFIG_FILE)) {
        const data = JSON.parse(fs.readFileSync(APPS_CONFIG_FILE, 'utf-8'));
        this.apps = new Map(data.apps.map((a: AppConfig) => [a.id, a]));
        console.log(`[AppDeployment] ${this.apps.size} application(s) chargee(s)`);
      }
    } catch (error: any) {
      console.error('[AppDeployment] Erreur chargement:', error.message);
    }
  }

  private saveApps(): void {
    try {
      ensureDirectoryExists(CONFIG_DIR);
      const data = { apps: Array.from(this.apps.values()), lastUpdated: new Date().toISOString() };
      fs.writeFileSync(APPS_CONFIG_FILE, JSON.stringify(data, null, 2));
    } catch (error: any) {
      console.error('[AppDeployment] Erreur sauvegarde:', error.message);
    }
  }

  private async ensureNetworkExists(): Promise<void> {
    try {
      await execAsync(`docker network inspect ${DOCKER_NETWORK} 2>/dev/null || docker network create ${DOCKER_NETWORK}`);
    } catch {}
  }

  // ============================================
  // CRUD Applications
  // ============================================

  async createApp(request: CreateAppRequest): Promise<AppConfig> {
    // Validation du nom
    if (!request.name || request.name.length < 2) {
      throw new Error('Le nom de l\'application doit contenir au moins 2 caracteres');
    }

    if (!/^[a-zA-Z0-9-_]+$/.test(request.name)) {
      throw new Error('Le nom ne peut contenir que des lettres, chiffres, tirets et underscores');
    }

    // Validation du type
    const template = getTemplate(request.type);
    if (!template) {
      throw new Error(`Type d'application non supporte: ${request.type}`);
    }

    // Construction de la config Git
    let gitConfig: GitConfig | undefined;
    
    if (request.git?.url || request.gitUrl) {
      const gitUrl = request.git?.url || request.gitUrl || '';
      const gitBranch = request.git?.branch || request.gitBranch || 'main';
      const isPrivate = request.git?.isPrivate ?? false;
      const authMethod = request.git?.authMethod || (isPrivate ? 'token' : 'none');


      gitConfig = {
  url: gitUrl,
  branch: gitBranch,
  provider: detectGitProvider(gitUrl),
  isPrivate,
  authMethod,
  ...(request.git?.accessToken && { accessToken: request.git.accessToken }),
  ...(request.git?.username && { username: request.git.username }),
  ...(request.git?.password && { password: request.git.password }),
  ...(request.git?.sshPrivateKey && { sshPrivateKey: request.git.sshPrivateKey }),
};

      // gitConfig = {
      //   url: gitUrl,
      //   branch: gitBranch,
      //   provider: detectGitProvider(gitUrl),
      //   isPrivate,
      //   authMethod,
      //   accessToken: request.git?.accessToken,
      //   username: request.git?.username,
      //   password: request.git?.password,
      //   sshPrivateKey: request.git?.sshPrivateKey,
      // };

      // Validation de la config Git
      if (isPrivate) {
        const validation = validateGitConfig(gitConfig);
        if (!validation.valid) {
          throw new Error(`Configuration Git invalide: ${validation.errors.join(', ')}`);
        }
      }
    }

    // Allocation du port
    const id = generateId();
    const externalPort = await portManagerService.allocatePort(id, request.name);
    const internalPort = template.defaultInternalPort;

    // Creation du repertoire
    const appDirName = request.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const appPath = path.join(APPS_ROOT, appDirName);

    // Verifier si le nom existe deja
    const existing = Array.from(this.apps.values()).find(
      a => a.name.toLowerCase() === request.name.toLowerCase()
    );
    if (existing) {
      throw new Error(`Une application avec le nom "${request.name}" existe deja`);
    }

    if (!ensureDirectoryExists(appPath)) {
      throw new Error(`Impossible de creer le repertoire: ${appPath}`);
    }

    // Merge des variables d'environnement
    const envVariables: EnvVariable[] = [
      ...template.defaultEnvVariables,
      ...(request.envVariables || []),
      { key: 'APP_NAME', value: generateContainerName(request.name) },
      { key: 'EXTERNAL_PORT', value: externalPort.toString() },
      { key: 'INTERNAL_PORT', value: internalPort.toString() },
    ];

    const app: AppConfig = {
  id,
  name: request.name,
  type: request.type,
  internalPort,
  externalPort,
  path: appPath,
  ...(gitConfig && { git: gitConfig }),
  ...(gitConfig && { gitUrl: gitConfig.url }),
  ...(gitConfig && { gitBranch: gitConfig.branch }),
  envVariables,
   ...(request.dockerfile || template.dockerfile
    ? { dockerfile: request.dockerfile ?? template.dockerfile }
    : {}),

  ...(request.dockerCompose || template.dockerCompose
    ? { dockerCompose: request.dockerCompose ?? template.dockerCompose }
    : {}),

  ...(request.buildCommand || template.buildCommand
    ? { buildCommand: request.buildCommand ?? template.buildCommand }
    : {}),

  ...(request.startCommand || template.startCommand
    ? { startCommand: request.startCommand ?? template.startCommand }
    : {}),
    
  status: 'pending',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  containerName: generateContainerName(request.name),
  ...(request.domain && { domain: request.domain }),
};

    // const app: AppConfig = {
    //   id,
    //   name: request.name,
    //   type: request.type,
    //   internalPort,
    //   externalPort,
    //   path: appPath,
    //   git: gitConfig,
    //   gitUrl: gitConfig?.url,
    //   gitBranch: gitConfig?.branch,
    //   envVariables,
    //   dockerfile: request.dockerfile || template.dockerfile,
    //   dockerCompose: request.dockerCompose || template.dockerCompose,
    //   buildCommand: request.buildCommand || template.buildCommand,
    //   startCommand: request.startCommand || template.startCommand,
    //   status: 'pending',
    //   createdAt: new Date().toISOString(),
    //   updatedAt: new Date().toISOString(),
    //   containerName: generateContainerName(request.name),
    //   domain: request.domain,
    // };

    // Ecriture des fichiers
    await this.writeAppFiles(app);

    this.apps.set(id, app);
    this.saveApps();

    console.log(`[AppDeployment] Application creee: ${app.name} (${app.id})`);
    return app;
  }

  private async writeAppFiles(app: AppConfig): Promise<void> {
    ensureDirectoryExists(app.path);

    if (app.dockerfile) {
      fs.writeFileSync(path.join(app.path, 'Dockerfile'), app.dockerfile);
    }

    if (app.dockerCompose) {
      // Remplacer les variables dans docker-compose
      let compose = app.dockerCompose
        .replace(/\$\{EXTERNAL_PORT\}/g, app.externalPort.toString())
        .replace(/\$\{INTERNAL_PORT\}/g, app.internalPort.toString())
        .replace(/\$\{APP_NAME\}/g, app.containerName || app.name);
      
      fs.writeFileSync(path.join(app.path, 'docker-compose.yml'), compose);
    }

    const envContent = app.envVariables.map(v => `${v.key}=${v.value}`).join('\n');
    fs.writeFileSync(path.join(app.path, '.env'), envContent);
  }

  async updateApp(appId: string, request: UpdateAppRequest): Promise<AppConfig> {
    const app = this.apps.get(appId);
    if (!app) throw new Error(`Application non trouvee: ${appId}`);

    if (request.name !== undefined) app.name = request.name;
    if (request.envVariables !== undefined) app.envVariables = request.envVariables;
    if (request.dockerfile !== undefined) app.dockerfile = request.dockerfile;
    if (request.dockerCompose !== undefined) app.dockerCompose = request.dockerCompose;
    if (request.buildCommand !== undefined) app.buildCommand = request.buildCommand;
    if (request.startCommand !== undefined) app.startCommand = request.startCommand;
    if (request.domain !== undefined) app.domain = request.domain;

    // Mise a jour Git
    if (request.git) {
      const currentGit = app.git || {} as GitConfig;
      app.git = {
  ...currentGit,
  url: request.git.url ?? currentGit.url,
  branch: request.git.branch ?? currentGit.branch ?? 'main',
  provider: request.git.url
    ? detectGitProvider(request.git.url)
    : currentGit.provider,
  isPrivate: request.git.isPrivate ?? currentGit.isPrivate ?? false,
  authMethod: request.git.authMethod ?? currentGit.authMethod ?? 'none',

  ...(request.git.accessToken !== undefined && {
    accessToken: request.git.accessToken,
  }),
  ...(request.git.username !== undefined && {
    username: request.git.username,
  }),
  ...(request.git.password !== undefined && {
    password: request.git.password,
  }),
  ...(request.git.sshPrivateKey !== undefined && {
    sshPrivateKey: request.git.sshPrivateKey,
  }),
};

      // app.git = {
      //   ...currentGit,
      //   url: request.git.url ?? currentGit.url,
      //   branch: request.git.branch ?? currentGit.branch ?? 'main',
      //   provider: request.git.url ? detectGitProvider(request.git.url) : currentGit.provider,
      //   isPrivate: request.git.isPrivate ?? currentGit.isPrivate ?? false,
      //   authMethod: request.git.authMethod ?? currentGit.authMethod ?? 'none',
      //   accessToken: request.git.accessToken ?? currentGit.accessToken,
      //   username: request.git.username ?? currentGit.username,
      //   password: request.git.password ?? currentGit.password,
      //   sshPrivateKey: request.git.sshPrivateKey ?? currentGit.sshPrivateKey,
      // };

      // Validation si prive
      if (app.git?.isPrivate) {
        
        const validation = validateGitConfig(app.git ?? {});
        if (!validation.valid) {
          throw new Error(`Configuration Git invalide: ${validation.errors.join(', ')}`);
        }
      }

      // Legacy
      app.gitUrl = app.git.url;
      app.gitBranch = app.git.branch;
    }

    app.updatedAt = new Date().toISOString();
    await this.writeAppFiles(app);
    this.saveApps();

    return app;
  }

  async deleteApp(appId: string): Promise<void> {
    const app = this.apps.get(appId);
    if (!app) throw new Error(`Application non trouvee: ${appId}`);

    if (app.status === 'running') {
      await this.stopApp(appId);
    }

    try {
      await execDockerCompose(['-f', path.join(app.path, 'docker-compose.yml'), 'down', '--rmi', 'local', '-v'], { cwd: app.path });
    } catch {}

    portManagerService.releasePort(appId);

    if (fs.existsSync(app.path)) {
      fs.rmSync(app.path, { recursive: true, force: true });
    }

    this.apps.delete(appId);
    this.saveApps();
    console.log(`[AppDeployment] Application supprimee: ${app.name}`);
  }

  // ============================================
  // Deploiement
  // ============================================

  async deployApp(appId: string, force = false): Promise<Deployment> {
    const app = this.apps.get(appId);
    if (!app) throw new Error(`Application non trouvee: ${appId}`);

    // Verifier que la config Git est valide si presente
    if (app.git?.isPrivate) {
      const validation = validateGitConfig(app.git);
      if (!validation.valid) {
        throw new Error(`Configuration Git invalide: ${validation.errors.join(', ')}`);
      }
    }

    const deployment: Deployment = {
      id: `deploy-${Date.now()}`,
      appId,
      status: 'pending',
      startedAt: new Date().toISOString(),
      logs: [],
    };

    this.deployments.set(deployment.id, deployment);
    app.status = 'building';
    // app.lastError = undefined;
    this.saveApps();


    this.executeDeployment(app, deployment, force);
    return deployment;
  }

  private async executeDeployment(app: AppConfig, deployment: Deployment, force: boolean): Promise<void> {
    const addLog = (level: DeploymentLog['level'], message: string, step: string) => {
      const log: DeploymentLog = { timestamp: new Date().toISOString(), level, message, step };
      deployment.logs.push(log);
      
      const prefix = `[Deploy:${app.name}]`;
      if (level === 'error') console.error(prefix, message);
      else if (level === 'warn') console.warn(prefix, message);
      else console.log(prefix, message);
      
      this.emit('deployment:log', { deploymentId: deployment.id, log });
    };

    const setError = (message: string) => {
      deployment.status = 'failed';
      deployment.finishedAt = new Date().toISOString();
      deployment.error = message;
      app.status = 'failed';
      app.lastError = message;
      this.saveApps();
      this.emit('deployment:failed', { deploymentId: deployment.id, error: message });
    };

    try {
      addLog('info', '═══════════════════════════════════════', 'init');
      addLog('info', `Deploiement: ${app.name}`, 'init');
      addLog('info', `Type: ${app.type} | Port: ${app.externalPort}`, 'init');
      addLog('info', '═══════════════════════════════════════', 'init');

      // ===== VERIFICATION DOCKER =====
      addLog('info', 'Verification de Docker...', 'init');
      try {
        const { stdout: dockerVersion } = await execAsync('docker --version');
        addLog('info', `✓ ${dockerVersion.trim()}`, 'init');
        
        const compose = await detectDockerCompose();
        addLog('info', `✓ Compose: ${compose.cmd}${compose.args.length ? ' ' + compose.args.join(' ') : ''}`, 'init');
      } catch (err: any) {
        addLog('error', `✗ Docker non accessible: ${err.message}`, 'init');
        setError('Docker n\'est pas accessible. Verifiez que le socket Docker est monte.');
        return;
      }

      // ===== CLONE GIT =====
      if (app.git?.url || app.gitUrl) {
        deployment.status = 'cloning';
        const gitUrl = app.git?.url || app.gitUrl || '';
        const gitBranch = app.git?.branch || app.gitBranch || 'main';
        const isPrivate = app.git?.isPrivate ?? false;

        addLog('info', '───────────────────────────────────────', 'clone');
        addLog('info', 'Clonage du repository', 'clone');
        addLog('info', `URL: ${gitUrl.replace(/\/\/[^@]+@/, '//***@')}`, 'clone'); // Masquer les credentials
        addLog('info', `Branche: ${gitBranch}`, 'clone');
        addLog('info', `Prive: ${isPrivate ? 'Oui' : 'Non'}`, 'clone');
        if (app.git?.provider) addLog('info', `Provider: ${app.git.provider}`, 'clone');

        // Nettoyage si force
        if (force && fs.existsSync(app.path)) {
          addLog('info', 'Nettoyage du repertoire (mode force)...', 'clone');
          const files = fs.readdirSync(app.path);
          for (const file of files) {
            if (!['Dockerfile', 'docker-compose.yml', '.env'].includes(file)) {
              fs.rmSync(path.join(app.path, file), { recursive: true, force: true });
            }
          }
        }

        try {
          // Configurer SSH si necessaire
          let sshKeyPath: string | null = null;
          let gitEnv = { ...process.env };

          if (app.git?.authMethod === 'ssh' && app.git.sshPrivateKey) {
            addLog('info', 'Configuration SSH...', 'clone');
            sshKeyPath = await setupSshForClone(app.git, app.path);
            if (sshKeyPath) {
              gitEnv.GIT_SSH_COMMAND = `ssh -i ${sshKeyPath} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`;
              addLog('info', '✓ Cle SSH configuree', 'clone');
            }
          }

          // Construire l'URL avec auth
          const cloneUrl = app.git ? buildGitCloneUrl(app.git) : gitUrl;
          const sourceDir = path.join(app.path, 'source');

          // Supprimer le dossier source s'il existe
          if (fs.existsSync(sourceDir)) {
            fs.rmSync(sourceDir, { recursive: true, force: true });
          }

          addLog('info', 'Clonage en cours...', 'clone');
          
          const cloneCmd = `git clone --depth 1 --branch ${gitBranch} "${cloneUrl}" "${sourceDir}"`;
          
          try {
            await execAsync(cloneCmd, { 
              timeout: 180000, // 3 minutes
              env: gitEnv,
              cwd: app.path
            });
          } catch (cloneErr: any) {
            // Analyser l'erreur
            const errMsg = cloneErr.message || cloneErr.stderr || '';
            
            if (errMsg.includes('Authentication failed') || errMsg.includes('could not read Username')) {
              throw new Error('Echec d\'authentification. Verifiez vos identifiants (token, username/password, ou cle SSH).');
            } else if (errMsg.includes('Repository not found') || errMsg.includes('does not exist')) {
              throw new Error('Repository non trouve. Verifiez l\'URL et vos permissions d\'acces.');
            } else if (errMsg.includes('Permission denied')) {
              throw new Error('Permission refusee. Verifiez que le token/credentials a les droits de lecture sur le repository.');
            } else if (errMsg.includes('Host key verification failed')) {
              throw new Error('Verification de la cle SSH echouee. Verifiez votre cle privee.');
            } else if (errMsg.includes('Could not resolve host')) {
              throw new Error(`Impossible de resoudre l'hote. Verifiez l'URL du repository.`);
            } else if (errMsg.includes('branch') && errMsg.includes('not found')) {
              throw new Error(`Branche "${gitBranch}" non trouvee dans le repository.`);
            }
            
            throw new Error(`Erreur de clonage: ${errMsg}`);
          }

          // Deplacer les fichiers
          if (fs.existsSync(sourceDir)) {
            const files = fs.readdirSync(sourceDir);
            addLog('info', `${files.length} fichiers clones`, 'clone');
            
            for (const file of files) {
              if (file !== '.git') {
                const src = path.join(sourceDir, file);
                const dest = path.join(app.path, file);
                if (fs.existsSync(dest)) {
                  fs.rmSync(dest, { recursive: true, force: true });
                }
                fs.renameSync(src, dest);
              }
            }
            fs.rmSync(sourceDir, { recursive: true, force: true });
          }

          // Nettoyer SSH
          if (sshKeyPath) {
            cleanupSshFiles(app.path);
          }

          addLog('success', '✓ Repository clone avec succes', 'clone');

        } catch (cloneError: any) {
          addLog('error', `✗ ${cloneError.message}`, 'clone');
          setError(cloneError.message);
          return;
        }
      }

      // Reecrire les fichiers Docker (peuvent etre ecrases par le clone)
      await this.writeAppFiles(app);

      // ===== VERIFICATION FICHIERS =====
      addLog('info', '───────────────────────────────────────', 'config');
      addLog('info', 'Verification des fichiers...', 'config');
      
      const composeFile = path.join(app.path, 'docker-compose.yml');
      const dockerFile = path.join(app.path, 'Dockerfile');

      if (!fs.existsSync(composeFile)) {
        addLog('error', '✗ docker-compose.yml manquant', 'config');
        setError('Fichier docker-compose.yml manquant');
        return;
      }
      addLog('info', '✓ docker-compose.yml', 'config');

      if (!fs.existsSync(dockerFile)) {
        addLog('error', '✗ Dockerfile manquant', 'config');
        setError('Fichier Dockerfile manquant');
        return;
      }
      addLog('info', '✓ Dockerfile', 'config');

      // ===== BUILD =====
      deployment.status = 'building';
      addLog('info', '───────────────────────────────────────', 'build');
      addLog('info', 'Construction de l\'image Docker...', 'build');

      const compose = await detectDockerCompose();
      const buildArgs = [...compose.args, '-f', composeFile, 'build', '--no-cache'];
      
      addLog('info', `Commande: ${compose.cmd} ${buildArgs.join(' ')}`, 'build');

      const buildProcess = spawn(compose.cmd, buildArgs, {
        cwd: app.path,
        env: { ...process.env, DOCKER_BUILDKIT: '1' }
      });

      let buildOutput = '';
      
      await new Promise<void>((resolve, reject) => {
        buildProcess.stdout?.on('data', (data) => {
          const lines = data.toString().split('\n').filter((l: string) => l.trim());
          lines.forEach((line: string) => {
            buildOutput += line + '\n';
            addLog('info', line, 'build');
          });
        });

        buildProcess.stderr?.on('data', (data) => {
          const lines = data.toString().split('\n').filter((l: string) => l.trim());
          lines.forEach((line: string) => {
            buildOutput += line + '\n';
            addLog('info', line, 'build');
          });
        });

        buildProcess.on('error', (err) => {
          reject(new Error(`Erreur d'execution: ${err.message}`));
        });

        buildProcess.on('close', (code) => {
          if (code === 0) {
            addLog('success', '✓ Image construite avec succes', 'build');
            resolve();
          } else {
            let errorMsg = `Build echoue (code ${code})`;
            
            // Analyser les erreurs courantes
            if (buildOutput.includes('no space left on device')) {
              errorMsg = 'Espace disque insuffisant sur le serveur';
            } else if (buildOutput.includes('permission denied')) {
              errorMsg = 'Permission refusee lors du build';
            } else if (buildOutput.includes('COPY failed') || buildOutput.includes('not found')) {
              errorMsg = 'Fichier source manquant dans le Dockerfile (verifiez les COPY)';
            }
            
            reject(new Error(errorMsg));
          }
        });
      });

      // ===== DEMARRAGE =====
      deployment.status = 'starting';
      addLog('info', '───────────────────────────────────────', 'start');
      addLog('info', 'Demarrage du container...', 'start');

      // Arreter l'ancien container
      try {
        addLog('info', 'Arret des anciens containers...', 'start');
        await execDockerCompose(['-f', composeFile, 'down'], { cwd: app.path });
      } catch {}

      // Demarrer
      addLog('info', 'Lancement du nouveau container...', 'start');
      await execDockerCompose(['-f', composeFile, 'up', '-d'], { cwd: app.path });

      // Recuperer l'ID
      const { stdout: containerId } = await execDockerCompose(['-f', composeFile, 'ps', '-q'], { cwd: app.path });
      app.containerId = containerId.trim();

      addLog('success', '✓ Container demarre', 'start');
      addLog('info', `Container ID: ${app.containerId || 'N/A'}`, 'start');
      addLog('info', `Accessible sur le port: ${app.externalPort}`, 'start');

      // ===== SUCCES =====
      addLog('info', '═══════════════════════════════════════', 'done');
      addLog('success', '✓ DEPLOIEMENT REUSSI', 'done');
      addLog('info', '═══════════════════════════════════════', 'done');

      deployment.status = 'success';
      deployment.finishedAt = new Date().toISOString();
      app.status = 'running';
      // app.lastError = undefined;
      this.saveApps();

      this.emit('deployment:success', { deploymentId: deployment.id, app });

    } catch (error: any) {
      addLog('error', `✗ Erreur: ${error.message}`, 'error');
      setError(error.message);
    }
  }

  // ============================================
  // Gestion du cycle de vie
  // ============================================

  async stopApp(appId: string): Promise<void> {
    const app = this.apps.get(appId);
    if (!app) throw new Error(`Application non trouvee: ${appId}`);

    await execDockerCompose(['-f', path.join(app.path, 'docker-compose.yml'), 'stop'], { cwd: app.path });
    app.status = 'stopped';
    this.saveApps();
  }

  async startApp(appId: string): Promise<void> {
    const app = this.apps.get(appId);
    if (!app) throw new Error(`Application non trouvee: ${appId}`);

    await execDockerCompose(['-f', path.join(app.path, 'docker-compose.yml'), 'start'], { cwd: app.path });
    app.status = 'running';
    this.saveApps();
  }

  async restartApp(appId: string): Promise<void> {
    const app = this.apps.get(appId);
    if (!app) throw new Error(`Application non trouvee: ${appId}`);

    await execDockerCompose(['-f', path.join(app.path, 'docker-compose.yml'), 'restart'], { cwd: app.path });
    app.status = 'running';
    this.saveApps();
  }

  async getAppLogs(appId: string, tail = 100): Promise<string> {
    const app = this.apps.get(appId);
    if (!app) throw new Error(`Application non trouvee: ${appId}`);

    const { stdout } = await execDockerCompose(
      ['-f', path.join(app.path, 'docker-compose.yml'), 'logs', `--tail=${tail}`],
      { cwd: app.path }
    );
    return stdout;
  }

  // ============================================
  // Getters
  // ============================================

  getApp(appId: string): AppConfig | undefined {
    return this.apps.get(appId);
  }

  getAllApps(): AppConfig[] {
    return Array.from(this.apps.values());
  }

  getDeployment(deploymentId: string): Deployment | undefined {
    return this.deployments.get(deploymentId);
  }

  getAppDeployments(appId: string): Deployment[] {
    return Array.from(this.deployments.values())
      .filter(d => d.appId === appId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  getTemplates() {
    return getAllTemplates();
  }

  async syncAppStatuses(): Promise<void> {
    for (const app of this.apps.values()) {
      try {
        const { stdout } = await execAsync(
          `docker inspect --format='{{.State.Running}}' ${app.containerName} 2>/dev/null || echo "false"`
        );
        app.status = stdout.trim() === 'true' ? 'running' : 'stopped';
      } catch {
        app.status = 'stopped';
      }
    }
    this.saveApps();
  }

  /**
   * Valide une configuration Git (utile pour le frontend)
   */
  validateGitConfiguration(git: Partial<GitConfig>): { valid: boolean; errors: string[] } {
    return validateGitConfig(git);
  }
}

export const appDeploymentService = AppDeploymentService.getInstance();
