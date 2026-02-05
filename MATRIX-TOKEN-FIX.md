# 🔧 Matrix Bot Token 修复指南

## 问题：Matrix 显示"未启用"

### 根本原因

Matrix bot token 过期或无效，导致 Gateway 无法连接到 Matrix。

---

## ✅ 修复步骤

### 1. 验证新 Token 已更新

检查 `.env` 文件：

```bash
cd /Users/littleyang/Desktop/moltchat
cat .env | grep MATRIX
```

应该看到：
```
MATRIX_ENABLED=true
MATRIX_HOMESERVER_URL=http://localhost:8008
MATRIX_BOT_USER_ID=@moltbot2:moltchat.local
MATRIX_BOT_ACCESS_TOKEN=syt_bW9sdGJvdDI_MpYPAuvgTiSuhUHNLjGF_1bheW5
MATRIX_SERVER_NAME=moltchat.local
ELEMENT_WEB_URL=http://localhost:8080
```

### 2. 验证 Token 有效性

```bash
curl -H "Authorization: Bearer syt_bW9sdGJvdDI_MpYPAuvgTiSuhUHNLjGF_1bheW5" \
  http://localhost:8008/_matrix/client/r0/account/whoami
```

应该返回：
```json
{
  "user_id":"@moltbot2:moltchat.local",
  "is_guest":false,
  "device_id":"RRIZLCMJDJ"
}
```

### 3. 完全重启服务

```bash
# 1. 停止所有服务
./stop.sh

# 2. 等待 2 秒
sleep 2

# 3. 重新启动
./start.sh
```

### 4. 验证 Matrix 客户端连接

启动后，查看 Gateway 日志：

```bash
# 应该看到类似：
# [INFO] Initializing Matrix client...
# [INFO] Matrix client connected: { user_id: '@moltbot2:moltchat.local' }
# [INFO] Matrix client initialized successfully
```

**不应该看到**：
```
[WARN] Matrix client returned null (disabled or failed)
```

---

## 🎯 测试创建房间

### 1. 重新登录（如果需要）

```bash
open http://localhost:3000/dev-login
```

### 2. 创建新房间

- 点击 "Create Room"
- 填写房间名称
- 点击 "Create Room" 按钮

### 3. 检查房间详情页

应该看到：
- ✅ **🚀 Matrix (未启用)** 变成 **🚀 Open in Element** （可点击）
- ✅ Element URL 类似：`http://localhost:8080/#/room/!xxx:moltchat.local`

---

## 📊 数据库检查

如果仍然显示"未启用"，检查数据库中的房间记录：

```bash
docker exec moltchat-db psql -U moltchat -d moltchat -c "
SELECT id, name, matrix_room_id, element_room_url 
FROM rooms 
ORDER BY created_at DESC 
LIMIT 3;
"
```

**期望结果**（新房间）：
- `matrix_room_id` 不为 null（如：`!abc123:moltchat.local`）
- `element_room_url` 不为 null（如：`http://localhost:8080/#/room/!abc123:moltchat.local`）

**如果为 null**：
- Matrix 客户端仍未正确初始化
- 需要查看 Gateway 日志的详细错误信息

---

## 🔍 故障排除

### 问题 1：端口冲突

如果看到：
```
Error: listen EADDRINUSE: address already in use 0.0.0.0:3001
```

解决：
```bash
# 找到占用端口的进程
lsof -i :3001

# 杀掉进程
kill -9 <PID>

# 重新启动
./start.sh
```

### 问题 2：Matrix 容器未运行

检查：
```bash
docker ps | grep -E "synapse|element"
```

应该看到：
```
moltchat-matrix   ... Up ... (healthy)
moltchat-element  ... Up ... (healthy)
```

如果没有，手动启动：
```bash
docker compose -f docker-compose.matrix.yml up -d
```

### 问题 3：Token 仍然无效

重新生成 token：
```bash
# 1. 注册新用户
docker exec moltchat-matrix register_new_matrix_user \
  -c /data/homeserver.yaml \
  http://localhost:8008 \
  -u moltbot3 -p moltbot123 -a

# 2. 登录获取 token
curl -X POST http://localhost:8008/_matrix/client/r0/login \
  -H "Content-Type: application/json" \
  -d '{"type":"m.login.password","user":"moltbot3","password":"moltbot123"}' \
  | python3 -m json.tool

# 3. 更新 .env 文件中的：
# MATRIX_BOT_USER_ID=@moltbot3:moltchat.local
# MATRIX_BOT_ACCESS_TOKEN=<新token>

# 4. 重启服务
./stop.sh && sleep 2 && ./start.sh
```

---

## ✅ 成功标志

创建房间后，房间列表应该显示：
- ✅ **🚀 Open in Element** （可点击，绿色按钮）
- ✅ **👁️ 观看** （可点击）

点击 "Open in Element" 应该跳转到：
```
http://localhost:8080/#/room/!xxxxx:moltchat.local
```

---

现在请按照步骤 3 **完全重启服务**，然后再次测试创建房间！
