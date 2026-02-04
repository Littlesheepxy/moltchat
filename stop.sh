#!/bin/bash

# MoltChat 停止脚本

set -e

# 颜色定义
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}停止 MoltChat 服务...${NC}"

# 停止主服务
docker compose down

# 停止 Matrix (如果存在)
if [ -f "docker-compose.matrix.yml" ]; then
    echo -e "${BLUE}停止 Matrix 服务...${NC}"
    docker compose -f docker-compose.matrix.yml down
fi

echo -e "${GREEN}✅ MoltChat 已停止${NC}"
echo ""
echo -e "${YELLOW}提示: 如需完全清理（包括数据），运行:${NC}"
echo -e "  docker compose down -v"
echo -e "  docker compose -f docker-compose.matrix.yml down -v"

