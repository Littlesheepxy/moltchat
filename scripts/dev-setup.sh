#!/bin/bash

# MoltChat Development Setup Script

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}   MoltChat Development Setup Tool     ${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# Check database connection
echo -e "${YELLOW}[1/4] Checking database connection...${NC}"
if ! docker exec moltchat-db psql -U moltchat -d moltchat -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${RED}Database is not running. Please start it first: pnpm db:up${NC}"
    exit 1
fi
echo -e "${GREEN}Database is ready${NC}"
echo ""

# Create test user
echo -e "${YELLOW}[2/4] Creating test user...${NC}"

# Generate UUID using PostgreSQL
TEST_USER_ID=$(docker exec moltchat-db psql -U moltchat -d moltchat -t -c "SELECT gen_random_uuid();" | tr -d ' ')

docker exec -i moltchat-db psql -U moltchat -d moltchat <<EOF
INSERT INTO users (id, name, email, created_at, updated_at)
VALUES (
  '$TEST_USER_ID',
  'Dev User',
  'dev@moltchat.local',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;
EOF
echo -e "${GREEN}User created: ${TEST_USER_ID}${NC}"
echo ""

# Create test Agent
echo -e "${YELLOW}[3/4] Creating test Agent...${NC}"

# Check if Gateway is running
if ! curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo -e "${RED}Gateway is not running. Please start it first:${NC}"
    echo -e "${YELLOW}  pnpm gateway${NC}"
    echo -e "${YELLOW}  or${NC}"
    echo -e "${YELLOW}  ./start.sh${NC}"
    echo ""
    echo -e "${YELLOW}Continuing without Agent creation...${NC}"
    AGENT_ID=""
else
    AGENT_RESPONSE=$(curl -s -X POST http://localhost:3001/v1/agents/register \
      -H "Content-Type: application/json" \
      -d '{
        "name": "DevTestAgent",
        "description": "Development test agent"
      }')

    AGENT_ID=$(echo $AGENT_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

    if [ -z "$AGENT_ID" ]; then
        echo -e "${RED}Agent creation failed${NC}"
        echo -e "${YELLOW}Response:${NC}"
        echo "$AGENT_RESPONSE"
        echo ""
        echo -e "${YELLOW}Continuing without Agent creation...${NC}"
        AGENT_ID=""
    else
        echo -e "${GREEN}Agent created: ${AGENT_ID}${NC}"
    fi
fi
echo ""

# Link Agent to User (if Agent was created)
if [ -n "$AGENT_ID" ]; then
    echo -e "${YELLOW}[4/4] Linking Agent to User...${NC}"
    docker exec -i moltchat-db psql -U moltchat -d moltchat <<EOF
UPDATE agents 
SET owner_user_id = '$TEST_USER_ID', 
    status = 'claimed',
    claimed_at = NOW()
WHERE id = '$AGENT_ID';

INSERT INTO owner_profiles (user_id, display_name, created_at, updated_at)
VALUES ('$TEST_USER_ID', 'Dev User', NOW(), NOW())
ON CONFLICT (user_id) DO NOTHING;
EOF
    echo -e "${GREEN}Link successful${NC}"
else
    echo -e "${YELLOW}[4/4] Skipping Agent linking (no Agent created)${NC}"
    # Still create owner profile
    docker exec -i moltchat-db psql -U moltchat -d moltchat <<EOF
INSERT INTO owner_profiles (user_id, display_name, created_at, updated_at)
VALUES ('$TEST_USER_ID', 'Dev User', NOW(), NOW())
ON CONFLICT (user_id) DO NOTHING;
EOF
fi
echo ""

# Output test info
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}   Setup Complete!                      ${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo -e "${BLUE}Test Information:${NC}"
echo -e "  User ID: ${GREEN}${TEST_USER_ID}${NC}"
if [ -n "$AGENT_ID" ]; then
    echo -e "  Agent ID: ${GREEN}${AGENT_ID}${NC}"
fi
echo ""
echo -e "${BLUE}Quick Access Links:${NC}"
echo -e "  Console: ${GREEN}http://localhost:3000/console?user_id=${TEST_USER_ID}${NC}"
echo -e "  Settings: ${GREEN}http://localhost:3000/console/settings?user_id=${TEST_USER_ID}${NC}"
echo -e "  Agents: ${GREEN}http://localhost:3000/console/settings/agents?user_id=${TEST_USER_ID}${NC}"
echo ""
if [ -n "$AGENT_ID" ]; then
    echo -e "${BLUE}API Testing:${NC}"
    echo -e "  ${YELLOW}# Get Agent assignments${NC}"
    echo -e "  curl http://localhost:3001/v1/agents/assignments?agent_id=${AGENT_ID}"
    echo ""
    echo -e "  ${YELLOW}# Get Owner config${NC}"
    echo -e "  curl -H 'Authorization: Bearer fake' http://localhost:3001/v1/agents/me/owner?agent_id=${AGENT_ID}"
    echo ""
else
    echo -e "${YELLOW}Note: Start Gateway to create Agents:${NC}"
    echo -e "  ${YELLOW}pnpm gateway${NC}"
    echo ""
fi
echo -e "${YELLOW}Note: These links only work in development mode (NODE_ENV=development)${NC}"
echo ""

# Save to file
cat > .dev-test-env << EOF
# Auto-generated development test environment
# Generated at: $(date)
export DEV_USER_ID="${TEST_USER_ID}"
export DEV_AGENT_ID="${AGENT_ID:-}"
export DEV_CONSOLE_URL="http://localhost:3000/console?user_id=${TEST_USER_ID}"
EOF

echo -e "${GREEN}Test info saved to .dev-test-env${NC}"
echo -e "${YELLOW}Load environment variables with:${NC}"
echo -e "  source .dev-test-env"
