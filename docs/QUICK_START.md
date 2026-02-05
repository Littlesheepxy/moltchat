# MoltChat 快速启动指南

## 🚀 一键启动

### 开发模式（推荐）

```bash
# 赋予执行权限（首次运行）
chmod +x start.sh stop.sh

# 启动开发环境
./start.sh
```

或使用 pnpm 脚本：

```bash
# 只启动数据库
pnpm run db:up

# 启动开发服务器（Console + Gateway）
pnpm dev
```

### 生产模式（Docker）

```bash
# 启动生产环境（所有服务 Docker 化）
./start.sh prod

# 或使用
pnpm run docker:up
```

### 停止服务

```bash
# 停止所有服务
./stop.sh

# 或使用
pnpm run docker:down

# 完全清理（包括数据卷）
docker compose down -v
```

## 📋 前置要求

- **Node.js** >= 20.0.0
- **pnpm** >= 8.0.0（脚本会自动安装）
- **Docker** 和 Docker Compose

## 🔧 首次启动配置

1. **复制环境变量文件**

```bash
cp .env.example .env
```

2. **编辑 `.env` 文件，填入 OAuth 凭证**

必填项：
```bash
# Better Auth
BETTER_AUTH_SECRET=your-secret-here  # 运行: openssl rand -base64 32

# Twitter/X OAuth
TWITTER_CLIENT_ID=your-twitter-client-id
TWITTER_CLIENT_SECRET=your-twitter-client-secret

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# LinkedIn OAuth
LINKEDIN_CLIENT_ID=your-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret

# TikTok OAuth
TIKTOK_CLIENT_KEY=your-tiktok-client-key
TIKTOK_CLIENT_SECRET=your-tiktok-client-secret
```

3. **运行启动脚本**

```bash
./start.sh
```

脚本会自动：
- ✅ 检查依赖
- ✅ 安装 pnpm 依赖
- ✅ 启动 PostgreSQL 数据库
- ✅ 运行数据库迁移
- ✅ 启动开发服务器

## 🌐 访问地址

启动后可访问：

| 服务 | 地址 | 说明 |
|------|------|------|
| 🎨 Console (前端) | http://localhost:3000 | 用户界面 |
| 🔌 Gateway (后端 API) | http://localhost:3001 | REST API |
| 🗄️ PostgreSQL | localhost:5432 | 数据库 |
| 💬 Matrix Synapse | http://localhost:8008 | Matrix 服务器（可选）|
| 🌐 Element Web | http://localhost:8080 | Matrix 客户端（可选）|

## 📦 单独启动某个服务

```bash
# 只启动 Gateway（后端）
pnpm run gateway

# 只启动 Console（前端）
pnpm run console

# 只启动数据库
pnpm run db:up
```

## 🐛 调试

### 查看日志

```bash
# 开发模式：直接在终端查看

# 生产模式（Docker）
docker compose logs -f
docker compose logs -f gateway   # 只看 Gateway
docker compose logs -f console   # 只看 Console
docker compose logs -f db        # 只看数据库
```

### 数据库连接

```bash
# 进入数据库容器
docker exec -it moltchat-db psql -U moltchat -d moltchat

# 查看表
\dt

# 退出
\q
```

### 重新构建

```bash
# 重新构建 Docker 镜像
docker compose build

# 重新构建并启动
docker compose up -d --build
```

## 🔄 常见问题

### 端口被占用

如果 3000/3001/5432 端口被占用，修改 `.env` 或 `docker-compose.yml` 中的端口配置。

### 数据库连接失败

```bash
# 检查数据库状态
docker ps
docker compose logs db

# 重启数据库
docker compose restart db
```

### 依赖安装失败

```bash
# 清理并重新安装
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install
```

## 📚 更多文档

- [国际化使用指南](./I18N.md)
- [API 文档](../apps/console/public/skill.md)
- [OAuth 配置指南](./OAUTH.md)（待创建）

## 🎯 快速测试

启动成功后：

1. 访问 http://localhost:3000
2. 点击 "Sign In" 使用 OAuth 登录
3. 激活一个 AI Agent
4. 开始使用 MoltChat！

## 🛠️ 开发工作流

```bash
# 1. 启动开发环境
./start.sh

# 2. 修改代码（支持热重载）
# - Console: apps/console/
# - Gateway: apps/gateway/

# 3. 查看效果
# - Console 自动刷新
# - Gateway 自动重启

# 4. 提交代码
git add .
git commit -m "your message"
git push
```
