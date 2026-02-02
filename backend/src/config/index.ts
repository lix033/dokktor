/**
 * Configuration centralisée de l'application
 * Toutes les valeurs sensibles et configurables sont ici
 */

import { z } from 'zod';
import { LoggerService } from '../logger/logger.service';

const logger = new LoggerService()
/**
 * Schéma de validation de la configuration
 * Zod permet de valider les variables d'environnement au démarrage
 */
const configSchema = z.object({
  // Serveur
  port: z.coerce.number().int().positive().default(3001),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  
  // Docker
  dockerSocketPath: z.string().default('/var/run/docker.sock'),
  
  // Timeouts (en millisecondes)
  dockerTimeout: z.coerce.number().int().positive().default(30000),
  
  // CORS
  corsOrigin: z.string().default('*'),
  
  // Logging
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

type Config = z.infer<typeof configSchema>;

/**
 * Charge et valide la configuration depuis les variables d'environnement
 * Lance une erreur explicite si la configuration est invalide
 */
function loadConfig(): Config {
  const rawConfig = {
    port: process.env['PORT'],
    nodeEnv: process.env['NODE_ENV'],
    dockerSocketPath: process.env['DOCKER_SOCKET_PATH'],
    dockerTimeout: process.env['DOCKER_TIMEOUT'],
    corsOrigin: process.env['CORS_ORIGIN'],
    logLevel: process.env['LOG_LEVEL'],
  };

  const result = configSchema.safeParse(rawConfig);

  if (!result.success) {
    logger.error('Configuration invalide:');
    logger.error(`${result.error.format()}`);
    process.exit(1);
  }

  return result.data;
}

/** Configuration globale de l'application (singleton) */
export const config = loadConfig();

/** Helper pour savoir si on est en production */
export const isProduction = config.nodeEnv === 'production';

/** Helper pour savoir si on est en développement */
export const isDevelopment = config.nodeEnv === 'development';
