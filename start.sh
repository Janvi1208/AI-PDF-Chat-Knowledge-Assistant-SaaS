#!/bin/bash
# ╔══════════════════════════════════════════════════════════╗
# ║          DocuMind AI — One-Command Startup              ║
# ╚══════════════════════════════════════════════════════════╝
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
info() { echo -e "${BLUE}[→]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        DocuMind AI — PDF Chat SaaS      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── Check dependencies ─────────────────────────────────────
info "Checking dependencies..."
command -v docker   >/dev/null 2>&1 || err "Docker not found. Install from https://docs.docker.com/get-docker/"
command -v docker compose version >/dev/null 2>&1 || \
  command -v docker-compose >/dev/null 2>&1 || \
  err "Docker Compose not found."
log "Docker found: $(docker --version)"

# ── Check .env file ────────────────────────────────────────
if [ ! -f ".env" ]; then
  info "Creating .env from template..."
  cp .env.example .env
  warn "IMPORTANT: Edit .env and add your GEMINI_API_KEY before continuing!"
  warn "  nano .env   (or any text editor)"
  echo ""
  read -p "Press ENTER after you've set your API key in .env... "
fi

# Load env to check key
set -a; source .env; set +a

if [ -z "$GEMINI_API_KEY" ] || [ "$GEMINI_API_KEY" = "your_gemini_api_key_here" ]; then
  err "GEMINI_API_KEY is not set in .env! Get your key at https://aistudio.google.com/app/apikey"
fi

log "API key found ✓"

# ── Start services ─────────────────────────────────────────
info "Building and starting all services (this takes ~2 min first time)..."
echo ""

# Use docker compose or docker-compose depending on version
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
else
  DC="docker-compose"
fi

$DC -f docker/docker-compose.yml up --build -d

# ── Wait for services ──────────────────────────────────────
echo ""
info "Waiting for services to be healthy..."

wait_for() {
  local name=$1 url=$2 tries=0
  printf "  Waiting for $name"
  until curl -sf "$url" >/dev/null 2>&1; do
    sleep 2; printf "."; tries=$((tries+1))
    [ $tries -gt 30 ] && err "\n$name failed to start. Run: docker compose logs $name"
  done
  echo -e " ${GREEN}ready${NC}"
}

wait_for "Backend"  "http://localhost:8000/health"
wait_for "Frontend" "http://localhost:3000"

# ── Done ───────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           🚀 App is running!             ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BLUE}Frontend:${NC}   http://localhost:3000"
echo -e "  ${BLUE}API:${NC}        http://localhost:8000"
echo -e "  ${BLUE}API Docs:${NC}   http://localhost:8000/docs"
echo ""
echo -e "  ${YELLOW}Logs:${NC}    $DC -f docker/docker-compose.yml logs -f"
echo -e "  ${YELLOW}Stop:${NC}    $DC -f docker/docker-compose.yml down"
echo ""
