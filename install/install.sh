#!/bin/sh
set -e

echo "==>Installing Docktor..."

# ====== DEFAULTS ======
BACKEND_PORT="${DOKKTOR_BACKEND_PORT:-3001}"
FRONTEND_PORT="${DOKKTOR_FRONTEND_PORT:-3002}"

# ====== CHECK DOCKER ======
if ! command -v docker >/dev/null 2>&1; then
  echo "==>Docker is not installed. Please install Docker first."
  exit 1
fi

# ====== CHECK PORTS ======
check_port() {
  if ss -lnt | awk '{print $4}' | grep -q ":$1$"; then
    echo "==>Port $1 is already in use."
    exit 1
  fi
}

check_port "$BACKEND_PORT"
check_port "$FRONTEND_PORT"

# ====== DETECT DOCKER GID ======
if [ -z "$DOCKER_GID" ]; then
  if [ -S /var/run/docker.sock ]; then
    DOCKER_GID=$(stat -c '%g' /var/run/docker.sock)
  else
    echo "==>Docker socket not found."
    exit 1
  fi
fi

echo "++ Docker GID: $DOCKER_GID"
echo "++ Backend port: $BACKEND_PORT"
echo "++ Frontend port: $FRONTEND_PORT"

# ====== INSTALL DIR ======
INSTALL_DIR="/var/app/dokktor"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# ====== WRITE ENV ======
cat > .env <<EOF
BACKEND_PORT=$BACKEND_PORT
FRONTEND_PORT=$FRONTEND_PORT
DOCKER_GID=$DOCKER_GID
EOF

# ====== DOWNLOAD COMPOSE ======
curl -sSL https://raw.githubusercontent.com/lix033/docktor/master/install/docker-compose.yml -o docker-compose.yml

# ====== RUN ======
docker compose pull
docker compose up -d

echo ""
echo "==>Dokktor installed successfully!"
echo "==>Frontend: http://vpsIP:$FRONTEND_PORT"
