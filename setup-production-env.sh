#!/bin/bash

# MoltChat 生产环境配置脚本
# 自动生成安全的密钥并配置 .env 文件

set -e

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     MoltChat 生产环境配置向导                        ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

# 检查是否在正确的目录
if [ ! -f ".env.example" ]; then
    echo -e "${RED}❌ 错误: 未找到 .env.example 文件${NC}"
    echo -e "${YELLOW}请在 moltchat 项目根目录下运行此脚本${NC}"
    exit 1
fi

# 检查是否已存在 .env
if [ -f ".env" ]; then
    echo -e "${YELLOW}⚠️  检测到已存在 .env 文件${NC}"
    read -p "是否备份并覆盖? (y/N): " OVERWRITE
    if [[ ! $OVERWRITE =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}已取消配置${NC}"
        exit 0
    fi
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    echo -e "${GREEN}✓ 已备份到 .env.backup.$(date +%Y%m%d_%H%M%S)${NC}"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}第 1 步: 域名配置${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "请输入你的域名信息："
echo ""

read -p "主域名 (例如 example.com): " DOMAIN
if [ -z "$DOMAIN" ]; then
    echo -e "${RED}❌ 域名不能为空${NC}"
    exit 1
fi

echo ""
echo "将使用以下子域名："
echo -e "  主站: ${GREEN}https://${DOMAIN}${NC}"
echo -e "  API:  ${GREEN}https://api.${DOMAIN}${NC}"
echo -e "  聊天: ${GREEN}https://chat.${DOMAIN}${NC}"
echo ""
read -p "确认无误? (Y/n): " CONFIRM
if [[ $CONFIRM =~ ^[Nn]$ ]]; then
    echo -e "${YELLOW}已取消配置${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}第 2 步: 生成安全密钥${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

# 生成密钥
echo -e "${YELLOW}正在生成安全密钥...${NC}"
DB_PASSWORD=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-24)
JWT_SECRET=$(openssl rand -base64 32)
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
OIDC_SECRET=$(openssl rand -hex 32)

echo -e "${GREEN}✓ 数据库密码已生成${NC}"
echo -e "${GREEN}✓ JWT 密钥已生成${NC}"
echo -e "${GREEN}✓ Auth 密钥已生成${NC}"
echo -e "${GREEN}✓ OIDC 密钥已生成${NC}"

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}第 3 步: Twitter OAuth 配置 (可选)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "如果需要 Twitter 登录，请输入 OAuth 凭证"
echo "（可以跳过，后续再配置）"
echo ""

read -p "Twitter Client ID (留空跳过): " TWITTER_CLIENT_ID
if [ -n "$TWITTER_CLIENT_ID" ]; then
    read -p "Twitter Client Secret: " TWITTER_CLIENT_SECRET
else
    TWITTER_CLIENT_ID="your-twitter-client-id"
    TWITTER_CLIENT_SECRET="your-twitter-client-secret"
    echo -e "${YELLOW}⚠️  跳过 Twitter OAuth，请后续手动配置${NC}"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}第 4 步: 生成配置文件${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

# 复制模板
cp .env.example .env

# 应用配置
echo -e "${YELLOW}正在写入配置...${NC}"

# 数据库
sed -i.bak "s|postgres://moltchat:moltchat@localhost:5432/moltchat|postgres://moltchat:${DB_PASSWORD}@db:5432/moltchat|g" .env

# 密钥
sed -i.bak "s|your-super-secret-jwt-key-change-in-production|${JWT_SECRET}|g" .env
sed -i.bak "s|your-better-auth-secret-change-in-production|${BETTER_AUTH_SECRET}|g" .env
sed -i.bak "s|synapse-oidc-secret-change-me|${OIDC_SECRET}|g" .env

# 域名
sed -i.bak "s|http://localhost:3001|https://api.${DOMAIN}|g" .env
sed -i.bak "s|http://localhost:3000|https://${DOMAIN}|g" .env
sed -i.bak "s|http://localhost:8080|https://chat.${DOMAIN}|g" .env
sed -i.bak "s|http://localhost:8008|http://synapse:8008|g" .env

# Matrix
sed -i.bak "s|@moltbot:localhost|@moltbot:${DOMAIN}|g" .env
sed -i.bak "s|MATRIX_ENABLED=false|MATRIX_ENABLED=true|g" .env

# 环境
sed -i.bak "s|NODE_ENV=development|NODE_ENV=production|g" .env

# Twitter (如果提供了)
if [ -n "$TWITTER_CLIENT_ID" ] && [ "$TWITTER_CLIENT_ID" != "your-twitter-client-id" ]; then
    sed -i.bak "s|TWITTER_CLIENT_ID=your-twitter-client-id|TWITTER_CLIENT_ID=${TWITTER_CLIENT_ID}|g" .env
    sed -i.bak "s|TWITTER_CLIENT_SECRET=your-twitter-client-secret|TWITTER_CLIENT_SECRET=${TWITTER_CLIENT_SECRET}|g" .env
fi

# 清理备份文件
rm -f .env.bak

echo -e "${GREEN}✓ 配置文件已生成${NC}"

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                  🎉 配置完成！                       ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

# 显示配置摘要
echo -e "${YELLOW}配置摘要：${NC}"
echo ""
echo -e "  主域名:     ${GREEN}${DOMAIN}${NC}"
echo -e "  Console:    ${GREEN}https://${DOMAIN}${NC}"
echo -e "  API:        ${GREEN}https://api.${DOMAIN}${NC}"
echo -e "  Chat:       ${GREEN}https://chat.${DOMAIN}${NC}"
echo ""
echo -e "  数据库密码: ${GREEN}${DB_PASSWORD}${NC}"
echo -e "  JWT Secret: ${GREEN}${JWT_SECRET:0:20}...${NC}"
echo ""

# 保存密钥到文件
cat > .env.secrets << EOF
# MoltChat 生产环境密钥备份
# 生成时间: $(date)
# 请妥善保管此文件！

DOMAIN=${DOMAIN}
DB_PASSWORD=${DB_PASSWORD}
JWT_SECRET=${JWT_SECRET}
BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
OIDC_SECRET=${OIDC_SECRET}
EOF

chmod 600 .env.secrets

echo -e "${YELLOW}⚠️  重要：${NC}"
echo -e "  1. 密钥已保存到 ${GREEN}.env.secrets${NC}，请妥善保管"
echo -e "  2. ${RED}不要将 .env 和 .env.secrets 提交到 Git${NC}"
echo -e "  3. 确保 DNS 已正确解析到服务器 IP"
echo ""

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}下一步操作：${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "1. 初始化 Matrix Synapse:"
echo -e "   ${GREEN}mkdir -p data/matrix${NC}"
echo -e "   ${GREEN}docker run -it --rm -v \$(pwd)/data/matrix:/data \\${NC}"
echo -e "   ${GREEN}     -e SYNAPSE_SERVER_NAME=${DOMAIN} \\${NC}"
echo -e "   ${GREEN}     matrixdotorg/synapse:latest generate${NC}"
echo ""
echo "2. 修改 data/matrix/homeserver.yaml:"
echo -e "   - server_name: \"${DOMAIN}\""
echo -e "   - 数据库配置使用密码: ${DB_PASSWORD}"
echo ""
echo "3. 构建并启动服务:"
echo -e "   ${GREEN}docker compose -f docker-compose.prod.yml build${NC}"
echo -e "   ${GREEN}docker compose -f docker-compose.prod.yml up -d${NC}"
echo ""
echo "4. 创建 Matrix Bot 并获取 Token"
echo "   (详见 DEPLOY.md 第六步)"
echo ""
echo "5. 配置 Nginx 反向代理和 SSL 证书"
echo "   (详见 DEPLOY.md 第七步)"
echo ""
echo -e "${GREEN}完整部署指南请查看: DEPLOY.md${NC}"
echo ""
