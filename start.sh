#!/bin/bash
# Arranca el backend API y el dashboard en paralelo
# Uso: ./start.sh [STORE_ID] [ACCESS_TOKEN]

STORE_ID=${1:-""}
ACCESS_TOKEN=${2:-""}

echo "==================================="
echo " Tiendanube Dashboard"
echo "==================================="

if [ -z "$STORE_ID" ] || [ -z "$ACCESS_TOKEN" ]; then
  echo "⚠️  Sin credenciales — usando datos de prueba (mock)"
  echo "   Para datos reales: ./start.sh TU_STORE_ID TU_ACCESS_TOKEN"
else
  echo "✓  Conectado a Tiendanube (Store ID: $STORE_ID)"
fi

echo ""
echo "Iniciando backend en :3001 ..."
cd "$(dirname "$0")/backend"
STORE_ID="$STORE_ID" ACCESS_TOKEN="$ACCESS_TOKEN" node dist/api-server.js &
BACKEND_PID=$!

echo "Iniciando dashboard en :5173 ..."
cd "$(dirname "$0")/dashboard"
npm run dev &
DASHBOARD_PID=$!

echo ""
echo "Dashboard → http://localhost:5173"
echo "API REST  → http://localhost:3001/api/metrics"
echo ""
echo "Ctrl+C para detener todo"

trap "kill $BACKEND_PID $DASHBOARD_PID 2>/dev/null; exit 0" SIGINT SIGTERM
wait
