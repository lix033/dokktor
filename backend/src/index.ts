/**
 * Point d'entrée principal de l'API Docker Monitor
 * Configure Express et démarre le serveur
 */

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { config, isDevelopment } from './config';
import { containerRouter } from './routes';
import { errorHandler, notFoundHandler } from './middleware';
import { healthCheck, apiInfo } from './controllers';
import { dockerService } from './services';
import { LoggerService } from './logger/logger.service';
const logger = new LoggerService()

/**
 * Crée et configure l'application Express
 */
function createApp(): Application {
  const app = express();

  // ====================================
  // Middlewares de sécurité
  // ====================================
  
  // Helmet ajoute des headers de sécurité HTTP
  app.use(helmet());

  // Configuration CORS
  app.use(
    cors({
      origin: config.corsOrigin,
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    })
  );

  // ====================================
  // Middlewares utilitaires
  // ====================================

  // Parsing JSON
  app.use(express.json());

  // Logging des requêtes (format dev en développement, combined en production)
  app.use(morgan(isDevelopment ? 'dev' : 'combined'));

  // ====================================
  // Routes
  // ====================================

  // Route racine - informations API
  app.get('/', apiInfo);

  // Healthcheck
  app.get('/health', healthCheck);

  // Routes API containers
  app.use('/api/containers', containerRouter);

  // ====================================
  // Gestion d'erreurs
  // ====================================

  // 404 pour les routes non trouvées
  app.use(notFoundHandler);

  // Gestionnaire d'erreurs global
  app.use(errorHandler);

  return app;
}

/**
 * Démarre le serveur HTTP
 */
async function startServer(): Promise<void> {
  const app = createApp();

  // Vérifie la connexion Docker avant de démarrer
  logger.info('==>Vérification de la connexion Docker...');
  const dockerConnected = await dockerService.ping();

  if (!dockerConnected) {
    console.warn('==>Impossible de se connecter au socket Docker');
    console.warn(`==>Chemin configuré: ${config.dockerSocketPath}`);
    console.warn('==>L\'API démarrera mais les opérations Docker échoueront');
  } else {
    logger.info('==>Connexion Docker établie');
  }

  // Démarrage du serveur
  const server = app.listen(config.port, () => {
    logger.info('');
    logger.info('Docker Monitor API');
    logger.info(`==>Serveur démarré sur le port ${config.port}`);
    logger.info(`==>Environnement: ${config.nodeEnv}`);
    logger.info(`==>URL: http://localhost:${config.port}`);
    logger.info(`==>Health: http://localhost:${config.port}/health`);
    logger.info('');
  });

  // ====================================
  // Graceful Shutdown
  // ====================================

  /**
   * Gère l'arrêt propre du serveur
   */
  function gracefulShutdown(signal: string): void {
    logger.info(`\nSignal ${signal} reçu, arrêt en cours...`);

    server.close((err) => {
      if (err !== undefined) {
        logger.error(`Erreur lors de l\'arrêt: ${err}`);
        process.exit(1);
      }

      logger.info('Serveur arrêté proprement');
      process.exit(0);
    });

    // Force l'arrêt après 10 secondes si le graceful shutdown échoue
    setTimeout(() => {
      logger.error('Timeout - arrêt forcé');
      process.exit(1);
    }, 10000);
  }

  // Écoute des signaux d'arrêt
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Gestion des erreurs non capturées
  process.on('uncaughtException', (error) => {
    logger.error(`Exception non capturée: ${error}`);
    gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    logger.error(`Promise rejetée non gérée: ${reason}`);
    gracefulShutdown('unhandledRejection');
  });
}

// Démarrage
startServer().catch((error: unknown) => {
  logger.error(`Erreur fatale au démarrage: ${error}` );
  process.exit(1);
});
