#!/bin/bash
# ===========================================
# MoltChat 生产环境一键更新脚本
# 
# 适用于：已部署过旧版本，需要升级到最新版
# 包含：.env 清理 + Nginx 更新 + Docker 重建
#
# 使用：在服务器项目根目录运行
#   ./scripts/deploy-update.sh
# ===========================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   MoltChat 生产环境更新脚本 v2.0    ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
echo ""

# ===========================================
# 0. 前置检查
# ===========================================
echo -e "${YELLOW}[0/5] 前置检查...${NC}"

if [ ! -f "docker-compose.prod.yml" ]; then
  echo -e "${RED}❌ 请在 MoltChat 项目根目录运行此脚本${NC}"
  exit 1
fi

if ! command -v docker &> /dev/null; then
  echo -e "${RED}❌ Docker 未安装${NC}"
  exit 1
fi

echo -e "${GREEN}  ✅ 项目目录正确${NC}"
echo -e "${GREEN}  ✅ Docker 已安装${NC}"

# ===========================================
# 1. 拉取最新代码
# ===========================================
echo ""
echo -e "${YELLOW}[1/5] 拉取最新代码...${NC}"
git pull origin main
echo -e "${GREEN}  ✅ 代码已更新${NC}"

# ===========================================
# 2. 清理 .env
# ===========================================
echo ""
echo -e "${YELLOW}[2/5] 清理 .env 配置...${NC}"

if [ -f ".env" ]; then
  # 备份
  cp .env ".env.bak.$(date +%Y%m%d%H%M%S)"
  
  # 删除废弃变量
  REMOVED=0
  
  for VAR in NEXT_PUBLIC_ELEMENT_URL ELEMENT_WEB_URL SYNAPSE_OIDC_CLIENT_ID SYNAPSE_OIDC_CLIENT_SECRET SYNAPSE_OIDC_REDIRECT_URI; do
    if grep -q "^${VAR}=" .env 2>/dev/null; then
      # macOS / Linux 兼容的 sed
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "/^${VAR}=/d" .env
      else
        sed -i "/^${VAR}=/d" .env
      fi
      echo -e "  🗑️  移除 ${VAR}"
      REMOVED=$((REMOVED + 1))
    fi
  done
  
  # 删除 OIDC 注释段
  if grep -q "OIDC Configuration" .env 2>/dev/null; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' '/OIDC Configuration/,/SYNAPSE_OIDC_REDIRECT_URI/d' .env 2>/dev/null || true
    else
      sed -i '/OIDC Configuration/,/SYNAPSE_OIDC_REDIRECT_URI/d' .env 2>/dev/null || true
    fi
    echo -e "  🗑️  移除 OIDC 配置段"
  fi
  
  # 删除 Element 相关注释
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' '/定制版 Element/d' .env 2>/dev/null || true
    sed -i '' '/^#.*MoltChat Client/d' .env 2>/dev/null || true
  else
    sed -i '/定制版 Element/d' .env 2>/dev/null || true
    sed -i '/^#.*MoltChat Client/d' .env 2>/dev/null || true
  fi
  
  if [ $REMOVED -eq 0 ]; then
    echo -e "${GREEN}  ✅ .env 已是最新，无需清理${NC}"
  else
    echo -e "${GREEN}  ✅ 已清理 ${REMOVED} 个废弃变量${NC}"
  fi
else
  echo -e "${RED}  ⚠️  .env 文件不存在，请先创建（参考 .env.example）${NC}"
fi

# ===========================================
# 3. 更新 Nginx 配置
# ===========================================
echo ""
echo -e "${YELLOW}[3/5] 检查 Nginx 配置...${NC}"

NGINX_CONF="/etc/nginx/sites-available/moltchat"
NGINX_NEEDS_UPDATE=false

if [ -f "$NGINX_CONF" ]; then
  # 检查是否还有旧端口 3001
  if grep -q "127.0.0.1:3001" "$NGINX_CONF"; then
    NGINX_NEEDS_UPDATE=true
    echo -e "  ⚠️  发现旧端口 3001，需要更新为 3002"
  fi
  
  # 检查是否还有 chat.moltchat.live 的 Element 代理
  if grep -q "chat\\.moltchat" "$NGINX_CONF"; then
    NGINX_NEEDS_UPDATE=true
    echo -e "  ⚠️  发现 chat.moltchat.live 代理配置（Element 已移除）"
  fi
  
  if [ "$NGINX_NEEDS_UPDATE" = true ]; then
    echo ""
    echo -e "${BLUE}  📝 生成新的 Nginx 配置...${NC}"
    
    # 从 .env 读取域名
    DOMAIN=$(grep "^NEXT_PUBLIC_APP_URL=" .env 2>/dev/null | sed 's/.*:\/\///' | sed 's/\/.*//' || echo "moltchat.live")
    API_DOMAIN="api.${DOMAIN}"
    MATRIX_DOMAIN="matrix.${DOMAIN}"
    
    cat > /tmp/moltchat-nginx.conf << NGINXEOF
# MoltChat Nginx 配置 (auto-generated)
# Console (主站 + 聊天)
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}

# API Gateway (端口已从 3001 改为 3002)
server {
    listen 80;
    server_name ${API_DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 50M;
    }
}

# Matrix Synapse
server {
    listen 80;
    listen 8448;
    server_name ${MATRIX_DOMAIN};

    location ~ ^(/_matrix|/_synapse/client) {
        proxy_pass http://127.0.0.1:8008;
        proxy_http_version 1.1;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Host \$host;
        client_max_body_size 50M;
    }
}
NGINXEOF

    echo ""
    echo -e "${YELLOW}  ⚠️  Nginx 配置已生成到 /tmp/moltchat-nginx.conf${NC}"
    echo -e "  请手动确认并应用："
    echo ""
    echo -e "  ${BLUE}# 1. 查看新配置${NC}"
    echo -e "  cat /tmp/moltchat-nginx.conf"
    echo ""
    echo -e "  ${BLUE}# 2. 备份并替换${NC}"
    echo -e "  sudo cp ${NGINX_CONF} ${NGINX_CONF}.bak"
    echo -e "  sudo cp /tmp/moltchat-nginx.conf ${NGINX_CONF}"
    echo ""
    echo -e "  ${BLUE}# 3. 测试并重载${NC}"
    echo -e "  sudo nginx -t && sudo systemctl reload nginx"
    echo ""
    echo -e "  ${BLUE}# 4. 重新申请 SSL（如果域名有变动）${NC}"
    echo -e "  sudo certbot --nginx -d ${DOMAIN} -d ${API_DOMAIN} -d ${MATRIX_DOMAIN}"
    echo ""
  else
    echo -e "${GREEN}  ✅ Nginx 配置无需更新${NC}"
  fi
else
  echo -e "  ℹ️  未找到 ${NGINX_CONF}，跳过（可能 Nginx 不在此服务器上）"
fi

# ===========================================
# 4. Docker 重建
# ===========================================
echo ""
echo -e "${YELLOW}[4/5] Docker 重建...${NC}"
echo -e "  正在停止旧容器..."
docker compose -f docker-compose.prod.yml down 2>/dev/null || true

echo -e "  正在构建新镜像（可能需要几分钟）..."
docker compose -f docker-compose.prod.yml build --no-cache

echo -e "  正在启动服务..."
docker compose -f docker-compose.prod.yml up -d

echo -e "${GREEN}  ✅ Docker 服务已重建${NC}"

# ===========================================
# 5. 验证
# ===========================================
echo ""
echo -e "${YELLOW}[5/5] 验证服务状态...${NC}"
sleep 5

echo ""
docker compose -f docker-compose.prod.yml ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

echo ""

# 健康检查
echo -e "  🔍 健康检查："

check_health() {
  local name=$1
  local url=$2
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")
  if [ "$status" = "200" ] || [ "$status" = "301" ] || [ "$status" = "302" ]; then
    echo -e "  ✅ ${name}: HTTP ${status}"
  else
    echo -e "  ❌ ${name}: HTTP ${status} (可能还在启动中，稍后重试)"
  fi
}

check_health "Console  (localhost:3000)" "http://localhost:3000"
check_health "Gateway  (localhost:3002)" "http://localhost:3002/health"
check_health "Synapse  (localhost:8008)" "http://localhost:8008/health"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         🎉 更新完成！               ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""

if [ "$NGINX_NEEDS_UPDATE" = true ]; then
  echo -e "${YELLOW}⚠️  别忘了手动更新 Nginx 配置（见上方步骤 3 的说明）${NC}"
  echo ""
fi

echo -e "📋 常用命令："
echo -e "  查看日志:  docker compose -f docker-compose.prod.yml logs -f"
echo -e "  重启服务:  docker compose -f docker-compose.prod.yml restart"
echo -e "  停止服务:  docker compose -f docker-compose.prod.yml down"
echo ""
