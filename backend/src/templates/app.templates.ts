/**
 * Templates Docker predefinies pour les differents types d'applications
 */

import { AppTemplate, AppType } from '../types';

/**
 * Template PHP standard
 */
const phpTemplate: AppTemplate = {
  type: 'php',
  name: 'PHP Application',
  description: 'Application PHP avec Apache',
  defaultInternalPort: 80,
  defaultEnvVariables: [
    { key: 'PHP_MEMORY_LIMIT', value: '256M' },
    { key: 'PHP_MAX_EXECUTION_TIME', value: '60' },
  ],
  dockerfile: `FROM php:8.2-apache

# Installation des extensions PHP courantes
RUN apt-get update && apt-get install -y \\
    libpng-dev \\
    libjpeg-dev \\
    libfreetype6-dev \\
    zip \\
    unzip \\
    git \\
    && docker-php-ext-configure gd --with-freetype --with-jpeg \\
    && docker-php-ext-install -j$(nproc) gd pdo pdo_mysql mysqli

# Installation de Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Configuration Apache
RUN a2enmod rewrite

# Copie des fichiers de l'application
WORKDIR /var/www/html
COPY . .

# Permissions
RUN chown -R www-data:www-data /var/www/html

EXPOSE 80

CMD ["apache2-foreground"]
`,
  dockerCompose: `version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: \${APP_NAME}
    restart: unless-stopped
    ports:
      - "\${EXTERNAL_PORT}:80"
    volumes:
      - ./:/var/www/html
    environment:
      - PHP_MEMORY_LIMIT=\${PHP_MEMORY_LIMIT:-256M}
    networks:
      - docktor-network

networks:
  docktor-network:
    external: true
`,
};

/**
 * Template Laravel
 */
const laravelTemplate: AppTemplate = {
  type: 'laravel',
  name: 'Laravel Application',
  description: 'Application Laravel avec PHP-FPM et Nginx',
  defaultInternalPort: 80,
  defaultEnvVariables: [
    { key: 'APP_ENV', value: 'production' },
    { key: 'APP_DEBUG', value: 'false' },
    { key: 'APP_KEY', value: '' },
    { key: 'DB_CONNECTION', value: 'mysql' },
    { key: 'DB_HOST', value: 'localhost' },
    { key: 'DB_PORT', value: '3306' },
    { key: 'DB_DATABASE', value: 'laravel' },
    { key: 'DB_USERNAME', value: 'root' },
    { key: 'DB_PASSWORD', value: '', isSecret: true },
  ],
  buildCommand: 'composer install --no-dev --optimize-autoloader && php artisan config:cache && php artisan route:cache && php artisan view:cache',
  dockerfile: `FROM php:8.2-fpm

# Installation des dependances
RUN apt-get update && apt-get install -y \\
    libpng-dev \\
    libjpeg-dev \\
    libfreetype6-dev \\
    libonig-dev \\
    libxml2-dev \\
    zip \\
    unzip \\
    git \\
    curl \\
    nginx \\
    supervisor \\
    && docker-php-ext-configure gd --with-freetype --with-jpeg \\
    && docker-php-ext-install -j$(nproc) gd pdo pdo_mysql mbstring exif pcntl bcmath

# Installation de Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Configuration Nginx
COPY docker/nginx.conf /etc/nginx/sites-available/default

# Configuration Supervisor
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

WORKDIR /var/www/html
COPY . .

# Installation des dependances
RUN composer install --no-dev --optimize-autoloader

# Permissions
RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache

EXPOSE 80

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
`,
  dockerCompose: `version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: \${APP_NAME}
    restart: unless-stopped
    ports:
      - "\${EXTERNAL_PORT}:80"
    volumes:
      - ./storage:/var/www/html/storage
    env_file:
      - .env
    networks:
      - docktor-network
    depends_on:
      - redis

  redis:
    image: redis:alpine
    container_name: \${APP_NAME}-redis
    restart: unless-stopped
    networks:
      - docktor-network

networks:
  docktor-network:
    external: true
`,
};

/**
 * Template Node.js
 */
const nodejsTemplate: AppTemplate = {
  type: 'nodejs',
  name: 'Node.js Application',
  description: 'Application Node.js standard',
  defaultInternalPort: 3000,
  defaultEnvVariables: [
    { key: 'NODE_ENV', value: 'production' },
    { key: 'PORT', value: '3000' },
  ],
  buildCommand: 'npm ci --only=production',
  startCommand: 'npm start',
  dockerfile: `FROM node:20-alpine

WORKDIR /app

# Copie des fichiers de dependances
COPY package*.json ./

# Installation des dependances
RUN npm ci --only=production

# Copie du code source
COPY . .

# Utilisateur non-root
RUN addgroup -g 1001 -S nodejs && \\
    adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3000

CMD ["npm", "start"]
`,
  dockerCompose: `version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: \${APP_NAME}
    restart: unless-stopped
    ports:
      - "\${EXTERNAL_PORT}:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    env_file:
      - .env
    networks:
      - docktor-network

networks:
  docktor-network:
    external: true
`,
};

/**
 * Template Node.js TypeScript
 */
const nodejsTypescriptTemplate: AppTemplate = {
  type: 'nodejs-typescript',
  name: 'Node.js TypeScript Application',
  description: 'Application Node.js avec TypeScript',
  defaultInternalPort: 3000,
  defaultEnvVariables: [
    { key: 'NODE_ENV', value: 'production' },
    { key: 'PORT', value: '3000' },
  ],
  buildCommand: 'npm ci && npm run build',
  startCommand: 'npm start',
  dockerfile: `FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig*.json ./

RUN npm ci

COPY . .
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

RUN addgroup -g 1001 -S nodejs && \\
    adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3000

CMD ["node", "dist/index.js"]
`,
  dockerCompose: `version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: \${APP_NAME}
    restart: unless-stopped
    ports:
      - "\${EXTERNAL_PORT}:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    env_file:
      - .env
    networks:
      - docktor-network

networks:
  docktor-network:
    external: true
`,
};

/**
 * Template Next.js
 */
const nextjsTemplate: AppTemplate = {
  type: 'nextjs',
  name: 'Next.js Application',
  description: 'Application Next.js avec build optimise',
  defaultInternalPort: 3000,
  defaultEnvVariables: [
    { key: 'NODE_ENV', value: 'production' },
    { key: 'NEXT_TELEMETRY_DISABLED', value: '1' },
  ],
  buildCommand: 'npm ci && npm run build',
  startCommand: 'npm start',
  dockerfile: `FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
`,
  dockerCompose: `version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: \${APP_NAME}
    restart: unless-stopped
    ports:
      - "\${EXTERNAL_PORT}:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    networks:
      - docktor-network

networks:
  docktor-network:
    external: true
`,
};

/**
 * Template Static (HTML/CSS/JS)
 */
const staticTemplate: AppTemplate = {
  type: 'static',
  name: 'Static Website',
  description: 'Site statique avec Nginx',
  defaultInternalPort: 80,
  defaultEnvVariables: [],
  dockerfile: `FROM nginx:alpine

COPY . /usr/share/nginx/html

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
`,
  dockerCompose: `version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: \${APP_NAME}
    restart: unless-stopped
    ports:
      - "\${EXTERNAL_PORT}:80"
    networks:
      - docktor-network

networks:
  docktor-network:
    external: true
`,
};

/**
 * Template Python
 */
const pythonTemplate: AppTemplate = {
  type: 'python',
  name: 'Python Application',
  description: 'Application Python avec Flask/FastAPI',
  defaultInternalPort: 8000,
  defaultEnvVariables: [
    { key: 'PYTHON_ENV', value: 'production' },
  ],
  buildCommand: 'pip install -r requirements.txt',
  startCommand: 'python main.py',
  dockerfile: `FROM python:3.11-slim

WORKDIR /app

# Installation des dependances systeme
RUN apt-get update && apt-get install -y --no-install-recommends \\
    gcc \\
    && rm -rf /var/lib/apt/lists/*

# Copie des dependances
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copie du code source
COPY . .

# Utilisateur non-root
RUN useradd -m -u 1001 appuser
USER appuser

EXPOSE 8000

CMD ["python", "main.py"]
`,
  dockerCompose: `version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: \${APP_NAME}
    restart: unless-stopped
    ports:
      - "\${EXTERNAL_PORT}:8000"
    environment:
      - PYTHON_ENV=production
    env_file:
      - .env
    networks:
      - docktor-network

networks:
  docktor-network:
    external: true
`,
};

/**
 * Template Custom
 */
const customTemplate: AppTemplate = {
  type: 'custom',
  name: 'Custom Application',
  description: 'Application personnalisee - definissez votre propre Dockerfile',
  defaultInternalPort: 3000,
  defaultEnvVariables: [],
  dockerfile: `# Dockerfile personnalise
# Modifiez ce fichier selon vos besoins

FROM ubuntu:22.04

WORKDIR /app

COPY . .

EXPOSE 3000

CMD ["echo", "Configure your start command"]
`,
  dockerCompose: `version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: \${APP_NAME}
    restart: unless-stopped
    ports:
      - "\${EXTERNAL_PORT}:\${INTERNAL_PORT}"
    env_file:
      - .env
    networks:
      - docktor-network

networks:
  docktor-network:
    external: true
`,
};

/**
 * Map des templates par type
 */
export const appTemplates: Map<AppType, AppTemplate> = new Map([
  ['php', phpTemplate],
  ['laravel', laravelTemplate],
  ['nodejs', nodejsTemplate],
  ['nodejs-typescript', nodejsTypescriptTemplate],
  ['nextjs', nextjsTemplate],
  ['static', staticTemplate],
  ['python', pythonTemplate],
  ['custom', customTemplate],
]);

/**
 * Recupere un template par type
 */
export function getTemplate(type: AppType): AppTemplate | undefined {
  return appTemplates.get(type);
}

/**
 * Recupere tous les templates
 */
export function getAllTemplates(): AppTemplate[] {
  return Array.from(appTemplates.values());
}
