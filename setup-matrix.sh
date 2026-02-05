#!/bin/bash
# Quick Matrix Setup Script for Development

set -e

echo "🚀 MoltChat Matrix 快速启动脚本"
echo "================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. 检查 Docker
echo "📦 检查 Docker..."
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker 未安装${NC}"
    echo "请先安装 Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker 未运行${NC}"
    echo "请启动 Docker Desktop"
    exit 1
fi

echo -e "${GREEN}✅ Docker 已就绪${NC}"
echo ""

# 2. 启动 Matrix 服务
echo "🔧 启动 Matrix Synapse 和 Element Web..."
docker-compose -f docker-compose.matrix.yml up -d

echo ""
echo "⏳ 等待服务启动（约 30 秒）..."
sleep 5

# 等待 Synapse 启动
for i in {1..30}; do
    if curl -s http://localhost:8008/_matrix/client/versions > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Synapse 已启动${NC}"
        break
    fi
    echo -n "."
    sleep 1
done

echo ""

# 等待 Element 启动
for i in {1..10}; do
    if curl -s http://localhost:8080 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Element Web 已启动${NC}"
        break
    fi
    echo -n "."
    sleep 1
done

echo ""
echo ""

# 3. 检查是否已有 Bot 用户
echo "👤 检查 Bot 用户..."
BOT_EXISTS=$(docker exec moltchat-matrix cat /data/homeserver.db 2>/dev/null | grep -c "moltbot" || echo "0")

if [ "$BOT_EXISTS" -eq "0" ]; then
    echo "🔑 创建 Bot 用户 @moltbot..."
    
    # 使用 register_new_matrix_user 注册
    docker exec moltchat-matrix register_new_matrix_user \
        -c /data/homeserver.yaml \
        http://localhost:8008 \
        -u moltbot \
        -p moltbot123 \
        -a || echo -e "${YELLOW}⚠️  Bot 用户可能已存在${NC}"
    
    echo ""
    echo "🔐 获取 Bot Access Token..."
    
    # 登录获取 token
    TOKEN_RESPONSE=$(curl -s -X POST http://localhost:8008/_matrix/client/r0/login \
        -H "Content-Type: application/json" \
        -d '{
            "type": "m.login.password",
            "user": "moltbot",
            "password": "moltbot123"
        }')
    
    ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
    
    if [ -n "$ACCESS_TOKEN" ]; then
        echo -e "${GREEN}✅ Token 获取成功${NC}"
        echo ""
        echo "📝 请更新 .env 文件："
        echo -e "${YELLOW}MATRIX_BOT_ACCESS_TOKEN=$ACCESS_TOKEN${NC}"
        echo ""
        
        # 自动更新 .env
        if [ -f .env ]; then
            # 备份
            cp .env .env.backup
            
            # 更新 token
            if grep -q "MATRIX_BOT_ACCESS_TOKEN=" .env; then
                sed -i.bak "s/MATRIX_BOT_ACCESS_TOKEN=.*/MATRIX_BOT_ACCESS_TOKEN=$ACCESS_TOKEN/" .env
                echo -e "${GREEN}✅ .env 已自动更新（备份：.env.backup）${NC}"
            else
                echo "MATRIX_BOT_ACCESS_TOKEN=$ACCESS_TOKEN" >> .env
                echo -e "${GREEN}✅ Token 已添加到 .env${NC}"
            fi
        fi
    else
        echo -e "${RED}❌ 无法获取 Token${NC}"
        echo "响应: $TOKEN_RESPONSE"
    fi
else
    echo -e "${GREEN}✅ Bot 用户已存在${NC}"
fi

echo ""
echo ""
echo "🎉 Matrix 启动完成！"
echo "================================"
echo ""
echo "📍 访问地址："
echo "  • Synapse API: ${GREEN}http://localhost:8008${NC}"
echo "  • Element Web: ${GREEN}http://localhost:8080${NC}"
echo ""
echo "👤 Bot 账号信息："
echo "  • User ID: ${GREEN}@moltbot:moltchat.local${NC}"
echo "  • Password: ${GREEN}moltbot123${NC}"
echo ""
echo "🔧 下一步："
echo "  1. 确认 .env 中 MATRIX_ENABLED=true"
echo "  2. 确认 .env 中 MATRIX_BOT_ACCESS_TOKEN 已设置"
echo "  3. 重启 Gateway: ${YELLOW}./start.sh${NC}"
echo "  4. 访问控制台创建房间测试"
echo ""
echo "🐛 查看日志："
echo "  • docker-compose -f docker-compose.matrix.yml logs -f"
echo ""
echo "🛑 停止服务："
echo "  • docker-compose -f docker-compose.matrix.yml down"
echo ""
