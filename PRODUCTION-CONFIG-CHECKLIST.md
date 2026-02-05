# MoltChat 生产环境配置清单

## 必须修改的配置项 ⚠️

在部署到生产环境前，**必须**修改以下配置项，否则系统不安全或无法正常运行。

---

## 1. 数据库配置

### 📍 位置：`.env`

```bash
# ❌ 开发环境（不安全）
DATABASE_URL=postgres://moltchat:moltchat@localhost:5432/moltchat

# ✅ 生产环境
DATABASE_URL=postgres://moltchat:YOUR_STRONG_DB_PASSWORD@db:5432/moltchat
```

**生成强密码：**
```bash
openssl rand -base64 24
# 输出示例: xK2m9Pq3vN8wR5tY7uZ1aB4cD6eF
```

**注意**：
- 必须使用强密码（至少 16 位，包含大小写字母、数字）
- Docker 内部使用 `@db:5432`（服务名），不是 `@localhost:5432`

---

## 2. JWT 密钥

### 📍 位置：`.env`

```bash
# ❌ 开发环境（不安全）
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# ✅ 生产环境
JWT_SECRET=YOUR_GENERATED_SECRET_AT_LEAST_32_CHARS
```

**生成密钥：**
```bash
openssl rand -base64 32
# 输出示例: Z9y8X7w6V5u4T3s2R1q0P9o8N7m6L5k4J3i2H1g0F9e8=
```

---

## 3. Better Auth 密钥

### 📍 位置：`.env`

```bash
# ❌ 开发环境（不安全）
BETTER_AUTH_SECRET=your-better-auth-secret-change-in-production

# ✅ 生产环境
BETTER_AUTH_SECRET=YOUR_GENERATED_SECRET
```

**生成密钥：**
```bash
openssl rand -base64 32
```

---

## 4. 域名配置

### 📍 位置：`.env`

```bash
# ❌ 开发环境
NEXT_PUBLIC_GATEWAY_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ELEMENT_URL=http://localhost:8080

# ✅ 生产环境（替换为你的实际域名）
NEXT_PUBLIC_GATEWAY_URL=https://api.yourdomain.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_ELEMENT_URL=https://chat.yourdomain.com
```

**注意**：
- 生产环境必须使用 HTTPS
- 确保 DNS 已正确解析
- 需要配置 SSL 证书

---

## 5. Matrix 配置

### 📍 位置：`.env`

```bash
# ✅ 生产环境配置
MATRIX_ENABLED=true
MATRIX_HOMESERVER_URL=http://synapse:8008  # Docker 内部用服务名
MATRIX_BOT_USER_ID=@moltbot:yourdomain.com  # 替换为你的域名
MATRIX_BOT_ACCESS_TOKEN=syt_xxx...  # 启动后获取
MATRIX_SERVER_NAME=yourdomain.com  # 替换为你的域名
ELEMENT_WEB_URL=https://chat.yourdomain.com
```

**获取 Bot Token 的步骤：**
1. 启动服务后，创建 bot 用户
2. 登录获取 access_token
3. 更新 `.env` 配置
4. 重启 gateway 服务

详见 `DEPLOY.md` 第六步。

---

## 6. OIDC 配置

### 📍 位置：`.env`

```bash
# ❌ 开发环境
SYNAPSE_OIDC_CLIENT_SECRET=synapse-oidc-secret-change-me

# ✅ 生产环境
SYNAPSE_OIDC_CLIENT_SECRET=YOUR_GENERATED_SECRET
```

**生成密钥：**
```bash
openssl rand -hex 32
# 输出示例: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

---

## 7. Twitter OAuth（可选）

### 📍 位置：`.env`

如果需要 Twitter 登录功能，需要配置：

```bash
TWITTER_CLIENT_ID=your-twitter-client-id
TWITTER_CLIENT_SECRET=your-twitter-client-secret
```

**获取步骤：**
1. 访问 https://developer.twitter.com/en/portal/dashboard
2. 创建应用
3. 配置 Callback URL: `https://yourdomain.com/api/auth/callback/twitter`
4. 获取 Client ID 和 Secret

**注意**：初期可以不配置，用户可以通过其他方式注册。

---

## 8. Node 环境

### 📍 位置：`.env`

```bash
# ❌ 开发环境
NODE_ENV=development
LOG_LEVEL=debug

# ✅ 生产环境
NODE_ENV=production
LOG_LEVEL=info
```

---

## 9. Docker Compose 配置

### 📍 位置：`docker-compose.prod.yml`

检查并确认以下配置：

```yaml
services:
  db:
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD:-moltchat}  # 应与 .env 中一致

  synapse:
    environment:
      SYNAPSE_SERVER_NAME: ${MATRIX_SERVER_NAME:-yourdomain.com}

  gateway:
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://moltchat:${DB_PASSWORD:-moltchat}@db:5432/moltchat
```

**注意**：通常不需要手动修改 `docker-compose.prod.yml`，它会自动读取 `.env` 文件。

---

## 10. Matrix Synapse 配置

### 📍 位置：`data/matrix/homeserver.yaml`

首次部署时需要生成和修改：

```yaml
# 必须修改
server_name: "yourdomain.com"  # 替换为你的域名

# 数据库配置
database:
  name: psycopg2
  args:
    user: moltchat
    password: YOUR_STRONG_DB_PASSWORD  # 与 .env 中一致
    database: synapse
    host: db
    cp_min: 5
    cp_max: 10

# 启用注册
enable_registration: true
enable_registration_without_verification: true
```

详细配置见 `DEPLOY.md` 第五步。

---

## 配置清单（按优先级）

### 🔴 P0 - 必须立即修改（安全相关）

- [ ] `DATABASE_URL` 数据库密码
- [ ] `JWT_SECRET`
- [ ] `BETTER_AUTH_SECRET`
- [ ] `SYNAPSE_OIDC_CLIENT_SECRET`
- [ ] `NODE_ENV=production`

### 🟡 P1 - 启动前必须修改（功能相关）

- [ ] `NEXT_PUBLIC_GATEWAY_URL` → 你的 API 域名
- [ ] `NEXT_PUBLIC_APP_URL` → 你的主域名
- [ ] `NEXT_PUBLIC_ELEMENT_URL` → 你的聊天域名
- [ ] `MATRIX_SERVER_NAME` → 你的域名
- [ ] `MATRIX_BOT_USER_ID` → @moltbot:你的域名
- [ ] `MATRIX_ENABLED=true`
- [ ] `data/matrix/homeserver.yaml` 中的 `server_name`

### 🟢 P2 - 启动后需要配置

- [ ] `MATRIX_BOT_ACCESS_TOKEN` - 创建 bot 后获取

### 🔵 P3 - 可选配置

- [ ] `TWITTER_CLIENT_ID` 和 `TWITTER_CLIENT_SECRET`
- [ ] `LOG_LEVEL` - 根据需要调整
- [ ] Redis 配置（用户量大时启用）

---

## 快速配置脚本

创建 `.env` 文件并一次性配置所有密钥：

```bash
#!/bin/bash
# 在服务器上运行

cd ~/moltchat

# 复制模板
cp .env.example .env

# 生成密钥
DB_PASSWORD=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-24)
JWT_SECRET=$(openssl rand -base64 32)
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
OIDC_SECRET=$(openssl rand -hex 32)

# 自动替换（需要手动确认域名）
read -p "输入你的域名（例如 example.com）: " DOMAIN

# 应用配置
sed -i "s|moltchat:moltchat@localhost|moltchat:${DB_PASSWORD}@db|g" .env
sed -i "s|your-super-secret-jwt-key-change-in-production|${JWT_SECRET}|g" .env
sed -i "s|your-better-auth-secret-change-in-production|${BETTER_AUTH_SECRET}|g" .env
sed -i "s|synapse-oidc-secret-change-me|${OIDC_SECRET}|g" .env
sed -i "s|localhost:3001|api.${DOMAIN}|g" .env
sed -i "s|localhost:3000|${DOMAIN}|g" .env
sed -i "s|localhost:8080|chat.${DOMAIN}|g" .env
sed -i "s|localhost|${DOMAIN}|g" .env
sed -i "s|NODE_ENV=development|NODE_ENV=production|g" .env
sed -i "s|MATRIX_ENABLED=false|MATRIX_ENABLED=true|g" .env

echo "✅ 配置已生成！请检查 .env 文件确认无误。"
echo ""
echo "数据库密码: ${DB_PASSWORD}"
echo "请妥善保存这些密钥！"
```

---

## 验证配置

部署前运行验证：

```bash
# 1. 检查必要的环境变量
grep -E "JWT_SECRET|BETTER_AUTH_SECRET|DATABASE_URL" .env

# 2. 检查域名配置
grep -E "NEXT_PUBLIC.*URL|MATRIX_SERVER_NAME" .env

# 3. 检查是否还有默认值
grep -E "change-in-production|your-|localhost" .env
```

如果第 3 步有输出，说明还有未修改的默认值！

---

## 部署后的配置

### 1. 配置 Nginx 反向代理

确保以下域名正确映射：
- `yourdomain.com` → `localhost:3000` (Console)
- `api.yourdomain.com` → `localhost:3001` (Gateway)
- `matrix.yourdomain.com` → `localhost:8008` (Synapse)
- `chat.yourdomain.com` → `localhost:8080` (Element Client)

### 2. 配置 SSL 证书

```bash
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com -d matrix.yourdomain.com -d chat.yourdomain.com
```

### 3. 配置防火墙

```bash
# 只开放必要端口
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 8448/tcp  # Matrix Federation（如需要）
sudo ufw enable
```

---

## 安全检查清单

部署后进行安全检查：

- [ ] 所有密钥都已修改为强随机值
- [ ] 数据库密码不是默认的 `moltchat`
- [ ] 所有域名都使用 HTTPS
- [ ] SSL 证书有效
- [ ] 防火墙已配置
- [ ] 定期备份已设置
- [ ] 日志监控已启用
- [ ] 更新通知已配置

---

## 常见错误

### 错误 1：使用了 localhost

```bash
# ❌ 错误
NEXT_PUBLIC_GATEWAY_URL=http://localhost:3001

# ✅ 正确
NEXT_PUBLIC_GATEWAY_URL=https://api.yourdomain.com
```

### 错误 2：数据库连接使用 localhost

```bash
# ❌ 错误（Docker 内部无法访问）
DATABASE_URL=postgres://moltchat:password@localhost:5432/moltchat

# ✅ 正确（使用 Docker 服务名）
DATABASE_URL=postgres://moltchat:password@db:5432/moltchat
```

### 错误 3：忘记修改 Matrix 域名

```bash
# ❌ 错误
MATRIX_BOT_USER_ID=@moltbot:localhost

# ✅ 正确
MATRIX_BOT_USER_ID=@moltbot:yourdomain.com
```

---

## 需要帮助？

遇到配置问题可以查看：
- `DEPLOY.md` - 完整部署指南
- `README.md` - 项目概述
- 或提交 Issue
