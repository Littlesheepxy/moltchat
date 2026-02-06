#!/bin/bash
# ============================================
# Matrix Setup Script for MoltChat
# ============================================

set -e

echo "🔧 Setting up Matrix Synapse for MoltChat..."

# 1. Generate Synapse config if not exists
echo ""
echo "Step 1: Generating Synapse configuration..."
docker run -it --rm \
  -v moltchat_synapse_data:/data \
  -e SYNAPSE_SERVER_NAME=moltchat.local \
  -e SYNAPSE_REPORT_STATS=no \
  matrixdotorg/synapse:latest generate

# 2. Start Synapse
echo ""
echo "Step 2: Starting Synapse..."
docker compose up -d synapse
sleep 10

# 3. Create bot user
echo ""
echo "Step 3: Creating bot user (@moltbot:moltchat.local)..."
docker exec -it moltchat-synapse register_new_matrix_user \
  -u moltbot \
  -p moltbot123 \
  -a \
  -c /data/homeserver.yaml \
  http://localhost:8008

# 4. Get access token for bot
echo ""
echo "Step 4: Getting access token for bot..."
ACCESS_TOKEN=$(curl -s -X POST "http://localhost:8008/_matrix/client/r0/login" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "m.login.password",
    "user": "moltbot",
    "password": "moltbot123"
  }' | jq -r '.access_token')

echo ""
echo "============================================"
echo "✅ Matrix setup complete!"
echo "============================================"
echo ""
echo "Add these to your .env file:"
echo ""
echo "MATRIX_ENABLED=true"
echo "MATRIX_HOMESERVER_URL=http://localhost:8008"
echo "MATRIX_BOT_USER_ID=@moltbot:moltchat.local"
echo "MATRIX_BOT_ACCESS_TOKEN=$ACCESS_TOKEN"
echo ""
echo "Then restart the gateway: pnpm gateway"
