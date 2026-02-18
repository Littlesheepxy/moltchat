#!/bin/bash

# MoltChat 一键启动脚本
# 用法: ./start.sh [dev|prod]
#
# 架构说明:
# - MoltChat Console (Next.js): 前端（Landing、聊天界面、管理后台）
# - MoltChat Gateway (Fastify): API 服务
# - Matrix Synapse: 聊天服务器
# - PostgreSQL: Docker 容器数据库（MoltChat + Synapse 共用）

set -e

# 增加文件描述符限制 (macOS 需要)
ulimit -n 65536 2>/dev/null || ulimit -n 10240 2>/dev/null || true

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

MODE="${1:-dev}"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     🤖 MoltChat 启动脚本 v4.1         ║${NC}"
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

# 检查 brew PostgreSQL 是否占用 5432 端口（会和 Docker PG 冲突）
if command -v brew &> /dev/null; then
    if brew services list 2>/dev/null | grep -q "postgresql.*started"; then
        echo -e "${YELLOW}⚠️  检测到 brew PostgreSQL 正在运行，关闭以避免端口冲突...${NC}"
        brew services stop postgresql@17 2>/dev/null || brew services stop postgresql 2>/dev/null || true
        sleep 1
    fi
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
    echo -e "${GREEN}✅ pnpm 依赖已安装${NC}"
fi
echo ""

# 启动数据库和 Matrix
echo -e "${YELLOW}[4/5] 启动数据库和 Matrix...${NC}"
docker compose up -d db synapse

# 等待数据库就绪
echo -e "${BLUE}等待数据库启动...${NC}"
CONTAINER_NAME="moltchat-db"
for i in {1..15}; do
    if docker exec $CONTAINER_NAME pg_isready -U moltchat > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 数据库已就绪${NC}"
        break
    fi
    echo -n "."
    sleep 1
done
echo ""

# 运行数据库迁移（基础 schema + 所有迁移文件）
echo -e "${BLUE}运行数据库迁移...${NC}"

# 基础 schema 文件
for schema_file in \
    apps/gateway/src/db/schema.sql \
    apps/gateway/src/db/schema-agent-availability.sql \
    apps/gateway/src/db/schema-owner.sql \
    apps/gateway/src/db/schema-auth.sql \
    apps/gateway/src/db/schema-claim.sql \
    apps/gateway/src/db/schema-dm.sql \
    apps/gateway/src/db/schema-rooms.sql \
    apps/gateway/src/db/schema-room-rules.sql \
    apps/gateway/src/db/schema-tags.sql; do
    if [ -f "$schema_file" ]; then
        docker exec -i $CONTAINER_NAME psql -U moltchat -d moltchat < "$schema_file" 2>/dev/null || true
    fi
done

# 增量迁移文件（按编号排序）
for migration_file in $(ls apps/gateway/src/db/migrations/*.sql 2>/dev/null | sort); do
    echo -e "  ${BLUE}迁移: $(basename $migration_file)${NC}"
    docker exec -i $CONTAINER_NAME psql -U moltchat -d moltchat < "$migration_file" 2>/dev/null || true
done

echo -e "${GREEN}✅ 数据库迁移完成${NC}"
echo ""

# 等待 Matrix 启动
echo -e "${YELLOW}等待 Matrix Synapse 启动...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:8008/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Matrix Synapse 已就绪${NC}"
        break
    fi
    echo -n "."
    sleep 2
done
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
    echo -e "${BLUE}📱 Console:       ${NC}http://localhost:3000"
    echo -e "${BLUE}🔌 Gateway API:   ${NC}http://localhost:3002"
    echo -e "${BLUE}💬 Matrix API:    ${NC}http://localhost:8008"
    echo -e "${BLUE}🗄️  Database:      ${NC}localhost:5432"
    echo ""
    echo -e "${YELLOW}查看日志: ${NC}docker compose logs -f"
    echo -e "${YELLOW}停止服务: ${NC}./stop.sh"
else
    echo -e "${YELLOW}[5/5] 启动开发环境...${NC}"
    echo ""

    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅ MoltChat 开发环境启动中...        ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}=== 服务地址 ===${NC}"
    echo -e "${BLUE}📱 MoltChat Console:  ${NC}http://localhost:3000"
    echo -e "${BLUE}🔌 Gateway API:       ${NC}http://localhost:3002"
    echo -e "${BLUE}💬 Matrix API:        ${NC}http://localhost:8008"
    echo -e "${BLUE}🗄️  Database:          ${NC}localhost:5432"
    echo ""
    echo -e "${YELLOW}提示: 按 Ctrl+C 停止服务${NC}"
    echo ""

    # 保存当前目录
    PROJECT_ROOT=$(pwd)

    # 后台启动 Gateway
    echo -e "${BLUE}启动 Gateway...${NC}"
    (cd "$PROJECT_ROOT/apps/gateway" && pnpm dev) &
    GATEWAY_PID=$!

    # 前台启动 Console
    echo -e "${BLUE}启动 Console...${NC}"
    cd "$PROJECT_ROOT/apps/console" && pnpm dev

    # 当 Console 退出时，停止 Gateway
    kill $GATEWAY_PID 2>/dev/null || true
fi
