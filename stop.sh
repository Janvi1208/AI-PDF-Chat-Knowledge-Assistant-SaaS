#!/bin/bash
# Stop all DocuMind services
if docker compose version >/dev/null 2>&1; then
  docker compose -f docker/docker-compose.yml down
else
  docker-compose -f docker/docker-compose.yml down
fi
echo "✓ All services stopped"
