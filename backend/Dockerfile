####################################
# 1️⃣ Builder
####################################
FROM node:20-alpine AS builder
WORKDIR /app

# Installer deps
COPY package*.json ./
RUN npm ci

# Copier le code
COPY . .

# Build (tsc, vite, etc.)
RUN npm run build

####################################
# 2️⃣ Production
####################################
FROM node:20-alpine

# Installer docker-cli, docker-compose (standalone) et git
# docker-compose est le package standalone, pas le plugin
RUN apk add --no-cache docker-cli docker-compose git

WORKDIR /app

# Créer un user non-root
RUN addgroup -S app && adduser -S app -G app

# Créer le répertoire /var/app avec les bonnes permissions
RUN mkdir -p /var/app/.docktor && \
    mkdir -p /var/app/apps && \
    chown -R app:app /var/app

# Copier uniquement le nécessaire
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY --from=builder /app/dist ./dist

# Donner les permissions à l'utilisateur app
RUN chown -R app:app /app

# Variables d'environnement
ENV NODE_ENV=production
ENV PORT=3001
ENV APPS_ROOT=/var/app/apps
ENV DOCKTOR_CONFIG_DIR=/var/app/.docktor

# Port exposé
EXPOSE 3001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# User final
USER app

# Lancement
CMD ["node", "dist/index.js"]
