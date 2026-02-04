/**
 * Point d'entree principal de l'API Docktor
 * Configure Express et demarre le serveur
 */

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { config, isDevelopment } from './config';
import { containerRouter, systemRouter } from './routes';
import { errorHandler, notFoundHandler } from './middleware';
import { healthCheck, apiInfo } from './controllers';
import { dockerService } from './services';

/**
 * Cree et configure l'application Express
 */
function createApp(): Application {
  const app = express();

  // ====================================
  // Middlewares de securite
  // ====================================
  
  // Helmet ajoute des headers de securite HTTP
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

  // Logging des requetes (format dev en developpement, combined en production)
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

  // Routes API monitoring systeme
  app.use('/api/system', systemRouter);

  // ====================================
  // Gestion d'erreurs
  // ====================================

  // 404 pour les routes non trouvees
  app.use(notFoundHandler);

  // Gestionnaire d'erreurs global
  app.use(errorHandler);

  return app;
}

/**
 * Demarre le serveur HTTP
 */
async function startServer(): Promise<void> {
  const app = createApp();

  // Verifie la connexion Docker avant de demarrer
  console.log('[Docktor] Verification de la connexion Docker...');
  const dockerConnected = await dockerService.ping();

  if (!dockerConnected) {
    console.warn('[Docktor] Impossible de se connecter au socket Docker');
    console.warn(`[Docktor] Chemin configure: ${config.dockerSocketPath}`);
    console.warn('[Docktor] L\'API demarrera mais les operations Docker echoueront');
  } else {
    console.log('[Docktor] Connexion Docker etablie');
  }

  // Demarrage du serveur
  const server = app.listen(config.port, () => {
    console.log('');
    console.log('===========================================');
    console.log('  Docktor API v2.0.0');
    console.log('  Monitoring Docker & VPS');
    console.log('===========================================');
    console.log(`  Port:        ${config.port}`);
    console.log(`  Environment: ${config.nodeEnv}`);
    console.log(`  URL:         http://localhost:${config.port}`);
    console.log('-------------------------------------------');
    console.log('  Endpoints:');
    console.log('    GET  /health              Health check');
    console.log('    GET  /api/containers      List containers');
    console.log('    GET  /api/system/overview System overview');
    console.log('    GET  /api/system/metrics  Full metrics');
    console.log('===========================================');
    console.log('');
  });

  // ====================================
  // Graceful Shutdown
  // ====================================

  /**
   * Gere l'arret propre du serveur
   */
  function gracefulShutdown(signal: string): void {
    console.log(`[Docktor] Signal ${signal} recu, arret en cours...`);

    server.close((err) => {
      if (err !== undefined) {
        console.error('[Docktor] Erreur lors de l\'arret:', err);
        process.exit(1);
      }

      console.log('[Docktor] Serveur arrete proprement');
      process.exit(0);
    });

    // Force l'arret apres 10 secondes si le graceful shutdown echoue
    setTimeout(() => {
      console.error('[Docktor] Timeout - arret force');
      process.exit(1);
    }, 10000);
  }

  // Ecoute des signaux d'arret
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Gestion des erreurs non capturees
  process.on('uncaughtException', (error) => {
    console.error('[Docktor] Exception non capturee:', error);
    gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[Docktor] Promise rejetee non geree:', reason);
    gracefulShutdown('unhandledRejection');
  });
}

// Demarrage
startServer().catch((error: unknown) => {
  console.error('[Docktor] Erreur fatale au demarrage:', error);
  process.exit(1);
});
