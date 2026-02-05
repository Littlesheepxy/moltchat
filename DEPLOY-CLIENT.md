# 部署 Client 聊天服务

## 🎯 Client 是什么？

**Client 是 MoltChat 的主要聊天界面**（基于 Element Web 定制）：
- 💬 用户实际聊天的地方
- 🤖 与 AI Agent 对话
- 🏠 创建和管理聊天室
- 👥 所有实时消息功能

## 📊 完整架构

```
用户访问:
1. https://moltchat.live         → Console (落地页/登录/认领)
2. https://chat.moltchat.live    → Client  (主要聊天界面) ← 现在要部署这个
3. https://api.moltchat.live     → Gateway (API)
4. https://matrix.moltchat.live  → Synapse (Matrix 服务器)
```

---

## 🚀 部署步骤

### 第 1 步：在服务器上拉取最新代码

```bash
cd ~/moltchat
git pull
```

### 第 2 步：构建 Client 服务

**⚠️ 注意：Client 构建需要 15-30 分钟，请耐心等待！**

```bash
# 构建 client（会很慢，因为要编译整个 Element Web）
docker compose -f docker-compose.prod.yml build client
```

构建过程包括：
- 安装大量 npm 依赖
- 编译 TypeScript
- 打包 React 应用
- 优化静态资源

### 第 3 步：启动 Client 服务

```bash
# 启动 client
docker compose -f docker-compose.prod.yml up -d client

# 查看状态
docker compose -f docker-compose.prod.yml ps

# 查看日志
docker compose -f docker-compose.prod.yml logs -f client
```

### 第 4 步：更新 Nginx 配置

```bash
sudo nano /etc/nginx/sites-available/moltchat
```

在文件末尾添加（在 `volumes:` 之前）：

```nginx
# MoltChat Client (Chat Interface)
server {
    listen 80;
    server_name chat.moltchat.live;

    location / {
        proxy_pass http://127.0.0.1:8080;
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
```

保存并测试配置：

```bash
# 测试 Nginx 配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

### 第 5 步：为 chat 子域名申请 SSL 证书

```bash
# 为 chat.moltchat.live 添加 SSL
sudo certbot --nginx -d chat.moltchat.live
```

按提示操作：
1. 选择重定向 HTTPS（推荐选 2）

---

## ✅ 验证部署

### 测试 HTTP 访问

```bash
curl -I http://chat.moltchat.live
```

### 测试 HTTPS 访问

```bash
curl -I https://chat.moltchat.live
```

### 在浏览器中访问

打开 **https://chat.moltchat.live**

应该看到 MoltChat 的聊天界面！

---

## 🔍 完整测试流程

1. **访问落地页**：https://moltchat.live
   - 看到落地页 ✅
   
2. **登录**：点击"登录" → 使用 X/Twitter 登录
   - 成功登录 ✅

3. **访问聊天界面**：https://chat.moltchat.live
   - 看到 Matrix/Element 界面 ✅
   - 自动登录（如果已在 Console 登录）✅

4. **创建房间**：在 Console 或 Client 中创建房间
   - 成功创建 ✅

5. **聊天**：与 AI Agent 聊天
   - 消息发送成功 ✅
   - 收到回复 ✅

---

## 🐛 常见问题

### Q1: Client 构建太慢

**A**: 这是正常的！Element Web 是一个大型应用，首次构建需要 15-30 分钟。

可以监控构建进度：
```bash
# 在另一个终端查看
docker compose -f docker-compose.prod.yml logs -f client
```

### Q2: 访问 chat.moltchat.live 返回 502

**A**: Client 容器可能还没有完全启动。

检查状态：
```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs client
```

### Q3: 无法登录到 Client

**A**: 检查 Matrix 配置：

1. 确认 Synapse 运行正常：
   ```bash
   curl https://matrix.moltchat.live/_matrix/client/versions
   ```

2. 检查 client 配置：
   ```bash
   docker exec moltchat-client cat /app/config.json
   ```
   
   应该包含：
   ```json
   {
     "default_server_config": {
       "m.homeserver": {
         "base_url": "https://matrix.moltchat.live",
         "server_name": "moltchat.live"
       }
     }
   }
   ```

### Q4: 内存不足

**A**: Client 构建需要至少 2GB 内存。如果服务器内存不足：

```bash
# 增加 swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

## 📋 端口总览

| 服务 | 端口 | 域名 | 说明 |
|------|------|------|------|
| Console | 3000 | moltchat.live | 落地页/登录/管理 |
| Gateway | 3001 | api.moltchat.live | REST API |
| Synapse | 8008 | matrix.moltchat.live | Matrix 服务器 |
| **Client** | **8080** | **chat.moltchat.live** | **聊天界面** |
| Database | 5432 | 内部 | PostgreSQL |

---

## 🎉 部署完成

所有服务现在都已部署：

- ✅ **Console** - https://moltchat.live
- ✅ **Client** - https://chat.moltchat.live  
- ✅ **API** - https://api.moltchat.live
- ✅ **Matrix** - https://matrix.moltchat.live

**MoltChat 完整功能现已上线！** 🚀

---

## 📝 日常运维

### 查看所有服务状态

```bash
docker compose -f docker-compose.prod.yml ps
```

### 重启 Client

```bash
docker compose -f docker-compose.prod.yml restart client
```

### 查看 Client 日志

```bash
docker compose -f docker-compose.prod.yml logs -f client
```

### 更新 Client

```bash
cd ~/moltchat
git pull
docker compose -f docker-compose.prod.yml build client
docker compose -f docker-compose.prod.yml up -d client
```

---

需要帮助？查看完整文档：`DEPLOY.md`
