/**
 * Types pour le deploiement d'applications
 */

// ============================================
// Types d'applications supportees
// ============================================

export type AppType = 
  | 'php'
  | 'laravel'
  | 'nodejs'
  | 'nodejs-typescript'
  | 'nextjs'
  | 'static'
  | 'python'
  | 'custom';

export type AppStatus = 
  | 'pending'
  | 'building'
  | 'deploying'
  | 'running'
  | 'stopped'
  | 'failed'
  | 'error';

export type DeploymentStatus =
  | 'pending'
  | 'cloning'
  | 'building'
  | 'starting'
  | 'success'
  | 'failed';

// ============================================
// Configuration Git
// ============================================

/** Fournisseur Git */
export type GitProvider = 'github' | 'gitlab' | 'bitbucket' | 'other';

/** Methode d'authentification Git */
export type GitAuthMethod = 'none' | 'token' | 'ssh' | 'username_password';

/** Configuration Git pour une application */
export interface GitConfig {
  /** URL du repository */
  url: string;
  
  /** Branche a deployer */
  branch: string;
  
  /** Fournisseur Git detecte */
  provider: GitProvider;
  
  /** Le repo est-il prive? */
  isPrivate: boolean;
  
  /** Methode d'authentification */
  authMethod: GitAuthMethod;
  
  /** Token d'acces (pour repos prives) */
  accessToken?: string;
  
  /** Nom d'utilisateur (pour auth username/password) */
  username?: string;
  
  /** Mot de passe (pour auth username/password) */
  password?: string;
  
  /** Chemin de la cle SSH (pour auth SSH) */
  sshKeyPath?: string;
  
  /** Cle SSH privee (contenu) */
  sshPrivateKey?: string;
}

// ============================================
// Configuration d'une application
// ============================================

export interface AppConfig {
  /** Identifiant unique de l'application */
  id: string;
  
  /** Nom de l'application */
  name: string;
  
  /** Type d'application */
  type: AppType;
  
  /** Port interne de l'application */
  internalPort: number;
  
  /** Port externe expose */
  externalPort: number;
  
  /** Chemin du repertoire de l'application */
  path: string;
  
  /** Configuration Git complete (nouveau) */
  git?: GitConfig;
  
  /** URL du repository Git (legacy - conserve pour compatibilite) */
  gitUrl?: string;
  
  /** Branche Git (legacy) */
  gitBranch?: string;
  
  /** Variables d'environnement */
  envVariables: EnvVariable[];
  
  /** Dockerfile personnalise */
  dockerfile?: string;
  
  /** Docker Compose personnalise */
  dockerCompose?: string;
  
  /** Commande de build */
  buildCommand?: string;
  
  /** Commande de demarrage */
  startCommand?: string;
  
  /** Statut actuel */
  status: AppStatus;
  
  /** Message d'erreur detaille (si echec) */
  lastError?: string;
  
  /** Date de creation */
  createdAt: string;
  
  /** Date de derniere mise a jour */
  updatedAt: string;
  
  /** ID du container Docker */
  containerId?: string;
  
  /** Nom du container Docker */
  containerName?: string;
  
  /** Domaine personnalise */
  domain?: string;
}

export interface EnvVariable {
  key: string;
  value: string;
  isSecret?: boolean;
}

// ============================================
// Templates predefinies
// ============================================

export interface AppTemplate {
  type: AppType;
  name: string;
  description: string;
  dockerfile: string;
  dockerCompose: string;
  defaultEnvVariables: EnvVariable[];
  defaultInternalPort: number;
  buildCommand?: string;
  startCommand?: string;
}

// ============================================
// Deploiement
// ============================================

export interface DeploymentLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  step?: string;
}

export interface Deployment {
  id: string;
  appId: string;
  status: DeploymentStatus;
  startedAt: string;
  finishedAt?: string;
  logs: DeploymentLog[];
  error?: string;
}

export interface DeploymentHistory {
  deployments: Deployment[];
  total: number;
}

// ============================================
// Gestion des ports
// ============================================

export interface PortAllocation {
  port: number;
  appId: string;
  appName: string;
  allocatedAt: string;
}

export interface PortRange {
  start: number;
  end: number;
}

// ============================================
// Requetes API
// ============================================

export interface CreateAppRequest {
  name: string;
  type: AppType;
  
  /** Configuration Git (nouvelle methode recommandee) */
  git?: {
    url: string;
    branch?: string;
    isPrivate?: boolean;
    authMethod?: GitAuthMethod;
    accessToken?: string;
    username?: string;
    password?: string;
    sshPrivateKey?: string;
  };
  
  /** URL Git (legacy - utiliser git.url de preference) */
  gitUrl?: string;
  gitBranch?: string;
  
  envVariables?: EnvVariable[];
  dockerfile?: string;
  dockerCompose?: string;
  buildCommand?: string;
  startCommand?: string;
  domain?: string;
}

export interface UpdateAppRequest {
  name?: string;
  git?: {
    url?: string;
    branch?: string;
    isPrivate?: boolean;
    authMethod?: GitAuthMethod;
    accessToken?: string;
    username?: string;
    password?: string;
    sshPrivateKey?: string;
  };
  envVariables?: EnvVariable[];
  dockerfile?: string;
  dockerCompose?: string;
  buildCommand?: string;
  startCommand?: string;
  domain?: string;
}

export interface DeployAppRequest {
  appId: string;
  force?: boolean;
}

// ============================================
// Reponses API
// ============================================

export interface AppResponse {
  success: boolean;
  data: AppConfig;
  timestamp: string;
}

export interface AppsListResponse {
  success: boolean;
  data: AppConfig[];
  count: number;
  timestamp: string;
}

export interface TemplatesResponse {
  success: boolean;
  data: AppTemplate[];
  timestamp: string;
}

export interface DeploymentResponse {
  success: boolean;
  data: Deployment;
  timestamp: string;
}

export interface PortsResponse {
  success: boolean;
  data: {
    allocated: PortAllocation[];
    available: number[];
    range: PortRange;
  };
  timestamp: string;
}
