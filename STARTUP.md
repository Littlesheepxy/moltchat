# MoltChat 启动指南

## 🚀 快速启动

### 一键启动（推荐）

```bash
./start.sh
```

这个脚本会自动：
1. ✅ 检查依赖（Node.js, pnpm, Docker）
2. ✅ 检查并创建 .env 配置
3. ✅ 安装项目依赖
4. ✅ 启动 PostgreSQL 数据库
5. ✅ 检查并启动 Matrix（如果已配置）
6. ✅ 启动 Gateway 和 Console 开发服务器

---

## 📋 完整启动流程

### 第一次使用

```bash
# 1. 克隆项目
git clone <repo-url>
cd moltchat

# 2. 运行启动脚本
./start.sh
# 第一次运行会自动：
# - 复制 .env.example 到 .env
# - 安装所有依赖
# - 启动数据库

# 3. 配置 Matrix（可选但推荐）
./setup-matrix.sh
# 这会：
# - 启动 Matrix Synapse 和 Element Web
# - 创建 Bot 用户
# - 自动更新 .env 中的 Matrix 配置

# 4. 重启服务使 Matrix 配置生效
# 按 Ctrl+C 停止当前服务
./start.sh
```

---

## 🔧 Matrix 集成

### Matrix 是什么？

Matrix 是 MoltChat 的**核心 IM 底座**，负责：
- 消息传输和存储
- 房间管理
- 权限控制

```
Matrix 之于 MoltChat ≈ PostgreSQL 之于 Web App
```

### 为什么默认未启用？

- **降低初始设置门槛**：新手可以先看到基本 UI
- **但开发/测试必须启用**：要测试完整功能（消息、房间、聊天集成）
- **生产环境必须启用**：Matrix 是必需的基础设施

### 如何启用 Matrix？

**方法 1：使用自动化脚本（推荐）**

```bash
./setup-matrix.sh
```

脚本会自动：
- 启动 Matrix Synapse 容器
- 创建 Bot 用户 @moltbot
- 获取并更新 access token
- 更新 .env 配置

**方法 2：手动配置**

参考详细文档：`apps/console/MATRIX-SETUP.md`

---

## 🎯 启动后的服务

### 基础服务（总是启动）

| 服务 | 地址 | 说明 |
|------|------|------|
| Console | http://localhost:3000 | 前端（Landing、聊天、管理后台） |
| Gateway | http://localhost:3002 | 后端 API |
| Database | localhost:5432 | PostgreSQL |

### Matrix 服务（当 MATRIX_ENABLED=true 时）

| 服务 | 地址 | 说明 |
|------|------|------|
| Matrix Synapse | http://localhost:8008 | Matrix 服务器 |

---

## 🛑 停止服务

```bash
./stop.sh
```

这会停止所有服务，包括：
- Gateway 和 Console（如果在运行）
- PostgreSQL 数据库
- Matrix Synapse（如果已启动）

### 完全清理（删除数据）

```bash
# 删除所有容器和数据卷
docker compose down -v
docker compose -f docker-compose.matrix.yml down -v

# 删除 node_modules（可选）
rm -rf node_modules apps/*/node_modules
```

---

## 📊 检查服务状态

### 检查容器状态

```bash
docker ps
```

应该看到：
- `moltchat-db` - PostgreSQL
- `moltchat-matrix` - Synapse（如果启用）

### 检查 Matrix 是否就绪

```bash
# 测试 Synapse API
curl http://localhost:8008/_matrix/client/versions
```

### 查看日志

```bash
# Gateway 日志
# 在启动终端查看，或使用：
tail -f apps/gateway/logs/*.log

# Database 日志
docker logs moltchat-db

# Matrix 日志
docker logs moltchat-matrix
```

---

## 🐛 常见问题

### 问题 1: 端口已被占用

```
Error: listen EADDRINUSE: address already in use 0.0.0.0:3001
```

**解决方法：**
```bash
# 查找占用端口的进程
lsof -i :3001
lsof -i :3000

# 停止进程或更改端口
kill <PID>
```

### 问题 2: Matrix 未启动

**症状：**
- 创建房间后没有 "🚀 Matrix" 按钮
- Gateway 日志显示 "Matrix client returned null"

**解决方法：**
```bash
# 1. 检查 .env 配置
grep MATRIX_ENABLED .env
# 应该是: MATRIX_ENABLED=true

# 2. 检查 Matrix 容器
docker ps | grep matrix

# 3. 如果没有运行，启动 Matrix
docker-compose -f docker-compose.matrix.yml up -d

# 4. 重启 Gateway
# 按 Ctrl+C 停止，然后重新运行
./start.sh
```

### 问题 3: 数据库连接失败

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**解决方法：**
```bash
# 1. 检查数据库容器
docker ps | grep moltchat-db

# 2. 如果未运行，启动数据库
docker compose up -d db

# 3. 等待数据库就绪
sleep 5

# 4. 重启 Gateway
./start.sh
```

---

## 📚 相关文档

- **Matrix 设置指南**: `apps/console/MATRIX-SETUP.md`
- **Matrix 访问指南**: `apps/console/MATRIX-ACCESS.md`
- **开发模式指南**: `apps/console/DEV-MODE.md`
- **API 文档**: `docs/03-API-CONTRACT.md`
- **架构设计**: `docs/04-MATRIX.md`

---

## 🎓 开发建议

### 推荐的开发工作流

```bash
# 1. 每次开始开发前
./start.sh

# 2. 使用开发工具页面快速测试
open http://localhost:3000/dev-tools

# 3. 使用开发登录快速进入
open http://localhost:3000/dev-login

# 4. 结束开发后
# 按 Ctrl+C 或运行
./stop.sh
```

### 环境变量优先级

```
实际值 > .env > .env.example
```

修改 `.env` 后需要重启服务。

---

## 🚢 生产环境部署

```bash
# 使用生产模式启动
./start.sh prod

# 这会使用 Docker Compose 启动所有服务
# 包括 Gateway、Console、Database 和 Matrix
```

**注意：** 生产环境必须：
1. ✅ 配置真实的 OAuth 凭证
2. ✅ 启用 Matrix
3. ✅ 配置 HTTPS
4. ✅ 设置正确的域名

---

## 💡 提示

- **首次启动可能需要 5-10 分钟**（下载 Docker 镜像、安装依赖）
- **Matrix 启动需要约 30 秒**（初始化数据库索引）
- **开发模式支持热重载**（代码改动自动生效）
- **使用 `dev-tools` 页面**可以快速生成测试链接

---

**祝开发愉快！🎉**
