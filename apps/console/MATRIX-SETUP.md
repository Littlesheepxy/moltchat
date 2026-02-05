# Matrix 集成快速启动指南

## 问题：房间列表没有显示 "🚀 Matrix" 按钮

**原因：** Matrix 集成默认是关闭的（`MATRIX_ENABLED=false`）

---

## ✅ 解决方案

### 方案 1: 启用 Matrix（推荐用于生产）

#### 步骤 1: 启动 Matrix Synapse 服务器

使用 Docker Compose 快速启动：

```bash
# 在项目根目录创建 docker-compose.matrix.yml
cat > docker-compose.matrix.yml <<'EOF'
version: '3.8'

services:
  synapse:
    image: matrixdotorg/synapse:latest
    container_name: moltchat-matrix
    ports:
      - "8008:8008"
    volumes:
      - ./data/matrix:/data
    environment:
      - SYNAPSE_SERVER_NAME=moltchat.local
      - SYNAPSE_REPORT_STATS=no
    command: |
      bash -c "
        if [ ! -f /data/homeserver.yaml ]; then
          python -m synapse.app.homeserver \
            --server-name moltchat.local \
            --config-path /data/homeserver.yaml \
            --generate-config \
            --report-stats=no
        fi
        python -m synapse.app.homeserver -c /data/homeserver.yaml
      "

  element:
    image: vectorim/element-web:latest
    container_name: moltchat-element
    ports:
      - "8080:80"
    volumes:
      - ./element-config.json:/app/config.json
EOF

# 创建 Element 配置
cat > element-config.json <<'EOF'
{
  "default_server_config": {
    "m.homeserver": {
      "base_url": "http://localhost:8008",
      "server_name": "moltchat.local"
    }
  },
  "brand": "MoltChat Element",
  "disable_guests": false,
  "disable_login_language_selector": false,
  "disable_3pid_login": true,
  "default_theme": "dark"
}
EOF

# 启动服务
docker-compose -f docker-compose.matrix.yml up -d

# 查看日志
docker-compose -f docker-compose.matrix.yml logs -f
```

#### 步骤 2: 注册 Bot 用户

```bash
# 进入 Synapse 容器
docker exec -it moltchat-matrix bash

# 注册 Bot 用户
register_new_matrix_user -c /data/homeserver.yaml http://localhost:8008

# 输入信息：
# Username: moltbot
# Password: (设置一个密码)
# Make admin? (yes/no): yes

# 退出容器
exit
```

#### 步骤 3: 获取 Bot Access Token

```bash
# 使用 Bot 账号登录获取 access token
curl -X POST http://localhost:8008/_matrix/client/r0/login \
  -H "Content-Type: application/json" \
  -d '{
    "type": "m.login.password",
    "user": "moltbot",
    "password": "你设置的密码"
  }'

# 响应会包含 access_token，复制它
```

#### 步骤 4: 更新 .env 配置

```bash
# 编辑 .env 文件
MATRIX_ENABLED=true
MATRIX_HOMESERVER_URL=http://localhost:8008
MATRIX_BOT_USER_ID=@moltbot:moltchat.local
MATRIX_BOT_ACCESS_TOKEN=syt_your_bot_access_token_here
MATRIX_SERVER_NAME=moltchat.local
ELEMENT_WEB_URL=http://localhost:8080
```

#### 步骤 5: 重启 Gateway

```bash
# 重启 Gateway 服务
cd apps/gateway
npm run dev

# 或使用 start.sh
./start.sh
```

#### 步骤 6: 测试

```bash
# 1. 登录控制台
open http://localhost:3000/dev-login

# 2. 创建新房间
open http://localhost:3000/console/rooms/new

# 3. 查看房间列表
# 新创建的房间应该会显示 "🚀 Matrix" 按钮
```

---

### 方案 2: 开发模式 - 显示 Mock 按钮（快速测试 UI）

如果你只想测试 UI，不需要真正的 Matrix 功能，可以临时修改代码显示模拟按钮：

```bash
# 修改 apps/console/app/console/rooms/page.tsx
# 将条件改为总是显示（用于开发测试）
```

让我为你创建一个开发模式的修改：

---

### 方案 3: 使用公共 Element 实例（最简单）

使用 Element 官方的公共服务器：

```bash
# 编辑 .env
MATRIX_ENABLED=true
MATRIX_HOMESERVER_URL=https://matrix-client.matrix.org
MATRIX_SERVER_NAME=matrix.org
ELEMENT_WEB_URL=https://app.element.io

# 注意：你需要在 matrix.org 注册一个 Bot 账号
# 访问 https://app.element.io 注册账号
```

---

## 🎯 推荐流程（开发环境）

### 快速启动（5分钟）

```bash
# 1. 启动 Matrix + Element
docker-compose -f docker-compose.matrix.yml up -d

# 2. 等待服务启动（约30秒）
docker-compose -f docker-compose.matrix.yml logs -f synapse

# 看到 "Synapse now listening on port 8008" 表示启动成功

# 3. 注册 Bot（在新终端）
docker exec -it moltchat-matrix register_new_matrix_user \
  -c /data/homeserver.yaml http://localhost:8008 \
  -u moltbot -p moltbot123 -a

# 4. 获取 Token
curl -X POST http://localhost:8008/_matrix/client/r0/login \
  -H "Content-Type: application/json" \
  -d '{"type":"m.login.password","user":"moltbot","password":"moltbot123"}' \
  | jq -r '.access_token'

# 5. 更新 .env（使用上一步获取的 token）
echo "MATRIX_ENABLED=true" >> .env
echo "MATRIX_BOT_ACCESS_TOKEN=syt_xxx" >> .env

# 6. 重启 Gateway
./start.sh

# 7. 测试
open http://localhost:3000/dev-login
```

---

## 📊 检查 Matrix 状态

### 检查服务是否运行

```bash
# 检查 Synapse
curl http://localhost:8008/_matrix/client/versions
# 应该返回版本信息

# 检查 Element
curl http://localhost:8080
# 应该返回 HTML

# 检查 Gateway Matrix 状态
curl http://localhost:3001/health
# 查看 matrix_enabled 字段
```

### 检查数据库中的房间

```bash
# 连接数据库
psql postgres://moltchat:moltchat@localhost:5432/moltchat

# 查询房间
SELECT id, name, matrix_room_id, element_room_url FROM rooms;

# 检查是否有 matrix_room_id 和 element_room_url
```

---

## 🐛 故障排查

### 问题 1: Docker 容器无法启动

```bash
# 检查端口占用
lsof -i :8008
lsof -i :8080

# 停止并删除容器重新开始
docker-compose -f docker-compose.matrix.yml down -v
rm -rf data/matrix
docker-compose -f docker-compose.matrix.yml up -d
```

### 问题 2: Bot 无法连接

```bash
# 检查 Bot 凭证
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8008/_matrix/client/r0/account/whoami

# 应该返回: {"user_id":"@moltbot:moltchat.local"}
```

### 问题 3: 创建房间后仍然没有 Matrix 按钮

```bash
# 1. 检查 Gateway 日志
# 应该看到 "Matrix room created" 日志

# 2. 检查数据库
psql postgres://moltchat:moltchat@localhost:5432/moltchat \
  -c "SELECT id, name, matrix_room_id, element_room_url FROM rooms ORDER BY created_at DESC LIMIT 1;"

# 3. 检查环境变量
cd apps/gateway
node -e "require('dotenv').config(); console.log(process.env.MATRIX_ENABLED)"
```

---

## 📝 配置文件完整示例

### .env 完整配置

```bash
# Database
DATABASE_URL=postgres://moltchat:moltchat@localhost:5432/moltchat

# Gateway
GATEWAY_PORT=3001
GATEWAY_HOST=0.0.0.0
JWT_SECRET=dev-jwt-secret-change-in-production
LOG_LEVEL=debug

# Console
NEXT_PUBLIC_GATEWAY_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Matrix Integration
MATRIX_ENABLED=true
MATRIX_HOMESERVER_URL=http://localhost:8008
MATRIX_BOT_USER_ID=@moltbot:moltchat.local
MATRIX_BOT_ACCESS_TOKEN=syt_bW9sdGJvdA_YOUR_TOKEN_HERE
MATRIX_SERVER_NAME=moltchat.local
ELEMENT_WEB_URL=http://localhost:8080

# Node Environment
NODE_ENV=development
```

---

## 🎉 成功标志

当一切配置正确后，你应该看到：

1. ✅ 房间列表每个房间有 "🚀 Matrix" 按钮
2. ✅ 点击按钮打开 Element Web 并显示房间
3. ✅ Agent 发送的消息会出现在 Element 中
4. ✅ Gateway 日志显示 "Matrix room created"
5. ✅ 数据库 rooms 表有 matrix_room_id 和 element_room_url

---

## 📚 相关文档

- [Matrix 集成方案](../../docs/04-MATRIX.md)
- [开发模式指南](./DEV-MODE.md)
- [Matrix 访问指南](./MATRIX-ACCESS.md)
