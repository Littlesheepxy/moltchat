#!/bin/bash

# MoltChat 本地启动脚本（无需 Docker）
# 用法: ./start-local.sh

set -e

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🤖 MoltChat 本地启动（无 Docker）  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# 检查依赖
echo -e "${YELLOW}[1/4] 检查依赖...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js 未安装${NC}"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}⚠️  pnpm 未安装，正在安装...${NC}"
    npm install -g pnpm
fi

if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠️  PostgreSQL 客户端未找到${NC}"
    echo -e "${YELLOW}请确保 PostgreSQL 服务正在运行${NC}"
    echo -e "${YELLOW}如需安装: brew install postgresql@16${NC}"
fi

echo -e "${GREEN}✅ 依赖检查完成${NC}"
echo ""

# 检查配置
echo -e "${YELLOW}[2/4] 检查配置...${NC}"

if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}✅ 已创建 .env 文件${NC}"
    fi
fi

# 检查数据库连接
echo -e "${YELLOW}提示: 请确保你的 PostgreSQL 正在运行${NC}"
echo -e "${YELLOW}默认连接: postgresql://moltchat:moltchat@localhost:5432/moltchat${NC}"
echo ""

# 提示用户确认
read -p "PostgreSQL 是否已启动？[y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}请先启动 PostgreSQL 数据库${NC}"
    echo ""
    echo -e "${BLUE}macOS 启动命令:${NC}"
    echo -e "  brew services start postgresql@16"
    echo ""
    echo -e "${BLUE}或使用 Docker:${NC}"
    echo -e "  docker run -d -p 5432:5432 -e POSTGRES_USER=moltchat -e POSTGRES_PASSWORD=moltchat -e POSTGRES_DB=moltchat postgres:16-alpine"
    exit 1
fi

echo ""

# 安装依赖
echo -e "${YELLOW}[3/4] 安装项目依赖...${NC}"
if [ ! -d "node_modules" ]; then
    pnpm install
else
    echo -e "${GREEN}✅ 依赖已安装${NC}"
fi
echo ""

# 启动服务
echo -e "${YELLOW}[4/4] 启动开发服务器...${NC}"
echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ MoltChat 已启动                   ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📱 Console:  ${NC}http://localhost:3000"
echo -e "${BLUE}🔌 Gateway:  ${NC}http://localhost:3001"
echo -e "${BLUE}🗄️  Database: ${NC}localhost:5432"
echo ""
echo -e "${YELLOW}提示: 按 Ctrl+C 停止服务${NC}"
echo ""

# 启动开发服务器
pnpm dev
