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

WORKDIR /app

# Créer un user non-root (sans UID/GID hardcodé)
RUN addgroup -S app && adduser -S app -G app

# Copier uniquement le nécessaire
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Variables d'environnement
ENV NODE_ENV=production
ENV PORT=3001

# Port exposé
EXPOSE 3001

# Healthcheck léger (curl est présent sur alpine récente)
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# User final
USER app

# Lancement
CMD ["node", "dist/index.js"]
