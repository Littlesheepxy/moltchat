#!/bin/bash

# MoltChat 停止脚本

set -e

# 颜色定义
BLUE='\033[0;34m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${BLUE}停止 MoltChat 服务...${NC}"

# 停止 Docker 容器
docker compose down

echo -e "${GREEN}✅ MoltChat 已停止${NC}"
echo ""
echo -e "提示: 如需完全清理（包括数据），运行:"
echo -e "  docker compose down -v"
