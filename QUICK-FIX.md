# 🚨 紧急修复：Matrix 配置未加载

## 问题

Gateway 使用的是默认配置值，没有读取 `.env` 文件：
- `enabled: false` (应该是 true)
- `botUserId: "@moltbot:localhost"` (应该是 `@moltbot2:moltchat.local`)

## 根本原因

在 monorepo 中使用 `pnpm -r --parallel dev` 时，每个子项目的 `process.cwd()` 是**子项目目录**，而不是根目录。

已修复 `apps/gateway/src/lib/config.ts` 使用相对路径找到根目录的 `.env`。

## ✅ 立即修复

**手动启动 Gateway（绕过 pnpm workspace）：**

### 终端 1 - 启动基础服务

```bash
cd /Users/littleyang/Desktop/moltchat
./stop.sh
sleep 2

# 只启动 DB 和 Matrix
docker compose up -d
docker compose -f docker-compose.matrix.yml up -d

# 等待服务就绪
sleep 10
```

### 终端 2 - 手动启动 Gateway

```bash
cd /Users/littleyang/Desktop/moltchat/apps/gateway

# 直接运行，不通过 pnpm workspace
npx tsx watch src/index.ts
```

### 终端 3 - 启动 Console

```bash
cd /Users/littleyang/Desktop/moltchat/apps/console
pnpm dev
```

---

## 验证成功

Gateway 启动时应该看到：

```
[INFO] Starting Matrix client initialization...
[INFO] getMatrixClient called
    enabled: true              ← 应该是 true
    homeserver: "http://localhost:8008"
    botUserId: "@moltbot2:moltchat.local"  ← 新用户
    hasToken: true             ← 应该是 true
[INFO] Initializing Matrix client...
[INFO] Matrix client connected: { user_id: '@moltbot2:moltchat.local' }
[INFO] Matrix client initialized successfully  ← 成功！
```

**不应该看到：**
```
[WARN] Matrix client returned null (disabled or failed)
```

---

## 测试创建房间

1. 访问 http://localhost:3000/dev-login
2. 快速登录
3. 创建新房间
4. 应该看到 **🚀 Open in Element** 按钮（可点击）

---

现在请按照"立即修复"步骤操作！
