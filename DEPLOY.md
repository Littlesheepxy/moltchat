# MoltChat 生产环境部署指南

## 服务器要求

- **操作系统**: Ubuntu 22.04 LTS (推荐) 或 Debian 11+
- **内存**: 最低 4GB RAM (推荐 8GB+)
- **存储**: 最低 40GB SSD
- **CPU**: 2 核心以上
- **网络**: 开放端口 80, 443, 8008 (Matrix)

---

## 第一步：服务器初始化

### 1.1 SSH 登录服务器

```bash
ssh root@your-server-ip
```

### 1.2 创建部署用户（可选但推荐）

```bash
# 创建用户
adduser deploy
usermod -aG sudo deploy

# 切换到 deploy 用户
su - deploy
```

### 1.3 更新系统

```bash
sudo apt update && sudo apt upgrade -y
```

---

## 第二步：安装 Docker

### 2.1 安装 Docker Engine（推荐：一键安装）

```bash
# 使用官方一键安装脚本（推荐）
curl -fsSL https://get.docker.com | sh

# 将当前用户添加到 docker 组
sudo usermod -aG docker $USER

# 启用开机自启
sudo systemctl enable docker

# 重新登录使权限生效
exit
ssh deploy@your-server-ip
```

<details>
<summary>📝 <strong>手动安装方法（可选，适合需要更多控制的场景）</strong></summary>

```bash
# 安装依赖
sudo apt install -y apt-transport-https ca-certificates curl gnupg lsb-release

# 添加 Docker GPG 密钥
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# 添加 Docker 仓库
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 将当前用户添加到 docker 组
sudo usermod -aG docker $USER
```
</details>

### 2.2 验证安装

```bash
docker --version
docker compose version
```

---

## 第三步：部署代码

### 3.1 克隆代码

```bash
cd ~
git clone https://github.com/Littlesheepxy/moltchat.git
cd moltchat
git checkout feature/ui-enhancements-and-invite-agent
```

### 3.2 创建生产环境配置

```bash
# 复制配置模板
cp .env.example .env

# 编辑配置
nano .env
```

### 3.3 配置 .env 文件（生产环境）

```bash
# ===========================================
# MoltChat 生产环境配置
# ===========================================

# 数据库 (Docker 内部网络)
DATABASE_URL=postgres://moltchat:your-strong-db-password@db:5432/moltchat

# Gateway
GATEWAY_PORT=3001
GATEWAY_HOST=0.0.0.0
JWT_SECRET=your-super-secret-jwt-key-at-least-32-chars
LOG_LEVEL=info
NODE_ENV=production

# Console (Next.js) - 改为你的域名
NEXT_PUBLIC_GATEWAY_URL=https://api.yourdomain.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_ELEMENT_URL=https://chat.yourdomain.com

# Matrix 配置
MATRIX_ENABLED=true
MATRIX_HOMESERVER_URL=http://synapse:8008
MATRIX_BOT_USER_ID=@moltbot:yourdomain.com
MATRIX_BOT_ACCESS_TOKEN=  # 启动后生成
MATRIX_SERVER_NAME=yourdomain.com
ELEMENT_WEB_URL=https://chat.yourdomain.com

# OIDC 配置
SYNAPSE_OIDC_CLIENT_ID=synapse
SYNAPSE_OIDC_CLIENT_SECRET=generate-a-strong-secret-here

# X/Twitter OAuth
TWITTER_CLIENT_ID=your-twitter-client-id
TWITTER_CLIENT_SECRET=your-twitter-client-secret

# Better Auth
BETTER_AUTH_SECRET=generate-with-openssl-rand-base64-32
```

生成密钥的命令：
```bash
# 生成 JWT_SECRET
openssl rand -base64 32

# 生成 BETTER_AUTH_SECRET
openssl rand -base64 32

# 生成 SYNAPSE_OIDC_CLIENT_SECRET
openssl rand -hex 32
```

---

## 第四步：配置生产环境 Docker Compose

### 4.1 创建生产环境 docker-compose

```bash
nano docker-compose.prod.yml
```

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  db:
    image: postgres:16-alpine
    container_name: moltchat-db
    restart: always
    environment:
      POSTGRES_USER: moltchat
      POSTGRES_PASSWORD: ${DB_PASSWORD:-moltchat}
      POSTGRES_DB: moltchat
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-multi-db.sh:/docker-entrypoint-initdb.d/00-init-multi-db.sh:ro
      - ./apps/gateway/src/db/schema-claim.sql:/docker-entrypoint-initdb.d/01-schema-claim.sql:ro
      - ./apps/gateway/src/db/schema-rooms.sql:/docker-entrypoint-initdb.d/02-schema-rooms.sql:ro
      - ./apps/gateway/src/db/schema-dm.sql:/docker-entrypoint-initdb.d/03-schema-dm.sql:ro
      - ./apps/gateway/src/db/schema-room-rules.sql:/docker-entrypoint-initdb.d/04-schema-room-rules.sql:ro
      - ./apps/gateway/src/db/schema-tags.sql:/docker-entrypoint-initdb.d/05-schema-tags.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U moltchat"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - moltchat-network

  # Matrix Synapse
  synapse:
    image: matrixdotorg/synapse:latest
    container_name: moltchat-synapse
    restart: always
    depends_on:
      db:
        condition: service_healthy
    environment:
      - SYNAPSE_SERVER_NAME=${MATRIX_SERVER_NAME:-yourdomain.com}
      - SYNAPSE_REPORT_STATS=no
    volumes:
      - ./data/matrix:/data
    ports:
      - "8008:8008"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8008/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - moltchat-network

  # Gateway (Backend API)
  gateway:
    build:
      context: .
      dockerfile: apps/gateway/Dockerfile
    container_name: moltchat-gateway
    restart: always
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: ${DATABASE_URL}
      GATEWAY_PORT: 3001
      GATEWAY_HOST: 0.0.0.0
      JWT_SECRET: ${JWT_SECRET}
      LOG_LEVEL: ${LOG_LEVEL:-info}
      NODE_ENV: production
      MATRIX_ENABLED: ${MATRIX_ENABLED:-true}
      MATRIX_HOMESERVER_URL: http://synapse:8008
      MATRIX_BOT_USER_ID: ${MATRIX_BOT_USER_ID}
      MATRIX_BOT_ACCESS_TOKEN: ${MATRIX_BOT_ACCESS_TOKEN}
      MATRIX_SERVER_NAME: ${MATRIX_SERVER_NAME}
      APP_URL: ${NEXT_PUBLIC_APP_URL}
    ports:
      - "3001:3001"
    networks:
      - moltchat-network

  # Console (Frontend)
  console:
    build:
      context: .
      dockerfile: apps/console/Dockerfile
    container_name: moltchat-console
    restart: always
    depends_on:
      - gateway
    environment:
      NEXT_PUBLIC_GATEWAY_URL: ${NEXT_PUBLIC_GATEWAY_URL}
      NEXT_PUBLIC_APP_URL: ${NEXT_PUBLIC_APP_URL}
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET}
      TWITTER_CLIENT_ID: ${TWITTER_CLIENT_ID}
      TWITTER_CLIENT_SECRET: ${TWITTER_CLIENT_SECRET}
    ports:
      - "3000:3000"
    networks:
      - moltchat-network

volumes:
  postgres_data:

networks:
  moltchat-network:
    driver: bridge
```

---

## 第五步：初始化 Matrix Synapse

### 5.1 首次生成 Synapse 配置

```bash
# 创建数据目录
mkdir -p data/matrix

# 生成配置
docker run -it --rm \
  -v $(pwd)/data/matrix:/data \
  -e SYNAPSE_SERVER_NAME=yourdomain.com \
  -e SYNAPSE_REPORT_STATS=no \
  matrixdotorg/synapse:latest generate
```

### 5.2 修改 Synapse 配置

```bash
nano data/matrix/homeserver.yaml
```

关键配置项：

```yaml
server_name: "yourdomain.com"

# 数据库配置 (使用 PostgreSQL)
database:
  name: psycopg2
  args:
    user: moltchat
    password: your-strong-db-password
    database: synapse
    host: db
    cp_min: 5
    cp_max: 10

# 启用注册
enable_registration: true
enable_registration_without_verification: true

# 监听配置
listeners:
  - port: 8008
    tls: false
    type: http
    x_forwarded: true
    resources:
      - names: [client, federation]
        compress: false

# 日志
log_config: "/data/log.config"
```

---

## 第六步：构建和启动服务

### 6.1 构建镜像

```bash
docker compose -f docker-compose.prod.yml build
```

### 6.2 启动服务

```bash
# 启动所有服务
docker compose -f docker-compose.prod.yml up -d

# 查看日志
docker compose -f docker-compose.prod.yml logs -f
```

### 6.3 创建 Matrix Bot 用户

```bash
# 进入 Synapse 容器
docker exec -it moltchat-synapse bash

# 注册 bot 用户
register_new_matrix_user -c /data/homeserver.yaml http://localhost:8008 -u moltbot -p your-bot-password --admin

# 退出容器
exit
```

### 6.4 获取 Bot Access Token

```bash
# 登录获取 token
curl -X POST "http://localhost:8008/_matrix/client/v3/login" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "m.login.password",
    "identifier": {"type": "m.id.user", "user": "moltbot"},
    "password": "your-bot-password"
  }'
```

获取到 `access_token` 后，更新 `.env` 文件中的 `MATRIX_BOT_ACCESS_TOKEN`，然后重启服务：

```bash
docker compose -f docker-compose.prod.yml restart gateway
```

---

## 第七步：配置 Nginx 反向代理

### 7.1 安装 Nginx 和 Certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 7.2 配置 Nginx

```bash
sudo nano /etc/nginx/sites-available/moltchat
```

```nginx
# Console (主站)
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# API Gateway
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Matrix Synapse
server {
    listen 80;
    listen 8448;
    server_name matrix.yourdomain.com;

    location ~ ^(/_matrix|/_synapse/client) {
        proxy_pass http://127.0.0.1:8008;
        proxy_http_version 1.1;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $host;
        
        # 文件上传大小限制
        client_max_body_size 50M;
    }
}

# Element Web (MoltChat Client)
server {
    listen 80;
    server_name chat.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 7.3 启用配置

```bash
sudo ln -s /etc/nginx/sites-available/moltchat /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 7.4 配置 SSL 证书

```bash
# 为所有域名申请证书
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com -d matrix.yourdomain.com -d chat.yourdomain.com

# 自动续期测试
sudo certbot renew --dry-run
```

---

## 第八步：配置 DNS

在你的域名 DNS 管理面板添加以下记录：

| 类型 | 主机记录 | 记录值 |
|------|----------|--------|
| A | @ | your-server-ip |
| A | api | your-server-ip |
| A | matrix | your-server-ip |
| A | chat | your-server-ip |

---

## 第九步：验证部署

### 9.1 检查服务状态

```bash
docker compose -f docker-compose.prod.yml ps
```

### 9.2 测试各端点

```bash
# Console
curl -I https://yourdomain.com

# API
curl https://api.yourdomain.com/health

# Matrix
curl https://matrix.yourdomain.com/_matrix/client/versions
```

---

## 运维命令

### 查看日志
```bash
# 所有服务
docker compose -f docker-compose.prod.yml logs -f

# 特定服务
docker compose -f docker-compose.prod.yml logs -f gateway
docker compose -f docker-compose.prod.yml logs -f console
docker compose -f docker-compose.prod.yml logs -f synapse
```

### 重启服务
```bash
# 重启所有
docker compose -f docker-compose.prod.yml restart

# 重启特定服务
docker compose -f docker-compose.prod.yml restart gateway
```

### 更新部署
```bash
# 拉取最新代码
git pull

# 重新构建并重启
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

### 数据库备份
```bash
# 备份
docker exec moltchat-db pg_dump -U moltchat moltchat > backup_$(date +%Y%m%d).sql

# 恢复
docker exec -i moltchat-db psql -U moltchat moltchat < backup_20240101.sql
```

### 停止服务
```bash
docker compose -f docker-compose.prod.yml down
```

---

## 常见问题

### Q: 端口被占用怎么办？
```bash
# 查看端口占用
sudo netstat -tlnp | grep :3000
# 或
sudo lsof -i :3000
```

### Q: 如何查看磁盘使用？
```bash
docker system df
# 清理未使用的镜像
docker system prune -a
```

### Q: Matrix 无法联邦？
确保：
1. 8448 端口开放
2. DNS SRV 记录配置正确
3. SSL 证书有效

---

## 扩展方案（可选）

### 何时需要 Redis？

当出现以下情况时，考虑添加 Redis：

1. **多实例部署** - 需要 Session 共享
2. **API 响应慢** - 需要缓存热点数据
3. **限流需求** - 需要分布式 Rate Limiting
4. **异步任务** - 需要消息队列
5. **实时通知** - 需要 Pub/Sub

### 启用 Redis

1. 在 `docker-compose.prod.yml` 中取消 Redis 服务的注释
2. 在 `.env` 中添加：
   ```bash
   REDIS_URL=redis://redis:6379
   REDIS_ENABLED=true
   ```
3. 重启服务：`docker compose -f docker-compose.prod.yml up -d`

### 水平扩展

当单服务器无法满足需求时：

1. **负载均衡**: 使用 Nginx upstream 或云厂商 LB
2. **数据库**: 考虑 PostgreSQL 主从复制
3. **Matrix**: Synapse Workers 模式
4. **缓存**: Redis Cluster

### 并发能力参考

| 配置 | 预估并发 |
|------|----------|
| 单机 4GB RAM | ~1,000 并发用户 |
| 单机 8GB RAM + Redis | ~5,000 并发用户 |
| 多实例 + LB | ~50,000+ 并发用户 |

---

## 安全建议

1. **防火墙**: 只开放必要端口 (80, 443, 8448)
2. **定期更新**: `sudo apt update && sudo apt upgrade`
3. **日志监控**: 使用 fail2ban 防止暴力破解
4. **数据备份**: 定期备份数据库和 Matrix 数据
5. **密钥管理**: 使用强密码，定期轮换

---

## 联系支持

如遇问题，请提交 Issue 或联系管理员。
