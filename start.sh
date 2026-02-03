#!/bin/bash

# MoltChat 一键启动脚本
# 用法: ./start.sh [dev|prod]

set -e

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

MODE="${1:-dev}"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     🤖 MoltChat 启动脚本              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# 检查依赖
echo -e "${YELLOW}[1/5] 检查依赖...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js 未安装，请先安装 Node.js >= 20.0.0${NC}"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ pnpm 未安装，正在安装...${NC}"
    npm install -g pnpm
fi

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker 未安装，请先安装 Docker${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 依赖检查完成${NC}"
echo ""

# 检查 .env 文件
echo -e "${YELLOW}[2/5] 检查配置文件...${NC}"

if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo -e "${YELLOW}⚠️  .env 文件不存在，从 .env.example 复制...${NC}"
        cp .env.example .env
        echo -e "${GREEN}✅ 已创建 .env 文件${NC}"
        echo -e "${YELLOW}⚠️  请编辑 .env 文件填入真实的 OAuth 凭证${NC}"
    else
        echo -e "${RED}❌ .env.example 文件不存在${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ .env 文件已存在${NC}"
fi

echo ""

# 安装依赖
echo -e "${YELLOW}[3/5] 安装项目依赖...${NC}"
if [ ! -d "node_modules" ]; then
    pnpm install
else
    echo -e "${GREEN}✅ 依赖已安装，跳过${NC}"
fi
echo ""

# 启动数据库
echo -e "${YELLOW}[4/5] 启动数据库...${NC}"
docker compose up -d db

# 等待数据库就绪
echo -e "${BLUE}等待数据库启动...${NC}"
sleep 3

# 检查数据库是否需要迁移
echo -e "${YELLOW}检查数据库 schema...${NC}"
CONTAINER_NAME="moltchat-db"

# 运行额外的迁移
echo -e "${BLUE}运行数据库迁移...${NC}"
docker exec -i $CONTAINER_NAME psql -U moltchat -d moltchat < apps/gateway/src/db/schema-agent-availability.sql 2>/dev/null || echo "schema-agent-availability.sql 已存在"
docker exec -i $CONTAINER_NAME psql -U moltchat -d moltchat < apps/gateway/src/db/schema-owner.sql 2>/dev/null || echo "schema-owner.sql 已存在"
docker exec -i $CONTAINER_NAME psql -U moltchat -d moltchat < apps/gateway/src/db/schema-auth.sql 2>/dev/null || echo "schema-auth.sql 已存在"

echo -e "${GREEN}✅ 数据库就绪${NC}"
echo ""

# 根据模式启动服务
if [ "$MODE" = "prod" ]; then
    echo -e "${YELLOW}[5/5] 启动生产环境 (Docker)...${NC}"
    docker compose up -d
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅ MoltChat 已启动 (生产模式)        ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}📱 Console:  ${NC}http://localhost:3000"
    echo -e "${BLUE}🔌 Gateway:  ${NC}http://localhost:3001"
    echo -e "${BLUE}🗄️  Database: ${NC}localhost:5432"
    echo -e "${BLUE}💬 Matrix:   ${NC}http://localhost:8008"
    echo -e "${BLUE}🌐 Element:  ${NC}http://localhost:8080"
    echo ""
    echo -e "${YELLOW}查看日志: ${NC}docker compose logs -f"
    echo -e "${YELLOW}停止服务: ${NC}./stop.sh 或 docker compose down"
else
    echo -e "${YELLOW}[5/5] 启动开发环境...${NC}"
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅ MoltChat 已启动 (开发模式)        ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}📱 Console:  ${NC}http://localhost:3000"
    echo -e "${BLUE}🔌 Gateway:  ${NC}http://localhost:3001"
    echo -e "${BLUE}🗄️  Database: ${NC}localhost:5432"
    echo ""
    echo -e "${YELLOW}提示: 按 Ctrl+C 停止服务${NC}"
    echo ""
    
    # 并行启动开发服务器
    pnpm dev
fi
