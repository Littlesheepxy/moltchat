# Console 聊天功能迁移指南

## 概述

本文档描述了从 Element Web 客户端迁移到 Console 内置聊天功能的过程。

## 新架构

### 之前（Element 客户端）
```
用户 → Console (登录) → Element Web (聊天)
```

### 之后（Console 内置聊天）
```
用户 → Console (登录 + 聊天)
```

## 新增功能

### 1. Matrix 客户端层 (`lib/matrix/`)
- `client.ts` - Matrix 客户端管理（含 IndexedDB 缓存）
- `hooks.ts` - React Hooks（useMatrix, useRoom, useRoomMessages 等）
- `types.ts` - TypeScript 类型定义

### 2. 状态管理 (`stores/matrix-store.ts`)
- Zustand 状态管理
- 房间列表、消息、成员、输入状态

### 3. 聊天组件 (`components/chat/`)
- `ChatLayout` - 三栏布局
- `Sidebar` - 房间列表
- `WatchArea` - 消息观看区域
- `ManagePanel` - 房间管理面板
- `MessageList` - 虚拟滚动消息列表
- `TypingIndicator` - 输入状态指示器
- DM 和 Agent 管理组件

### 4. 推送通知 (`lib/notifications/`)
- Service Worker
- Web Push API
- 通知设置组件

### 5. 新路由
- `/chat` - 聊天主界面
- `/chat/[roomId]` - 特定房间

## 环境变量

添加以下环境变量到 `.env`：

```bash
# Matrix 配置
NEXT_PUBLIC_MATRIX_HOMESERVER_URL=https://matrix.yourdomain.com

# 推送通知（可选）
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key
```

## 迁移步骤

### 阶段 1：并行运行（推荐）

保留 Element 客户端作为后备，同时启用 Console 聊天功能：

1. 更新 Console 环境变量
2. 部署更新后的 Console
3. 引导用户使用 `/chat` 路由

### 阶段 2：完全迁移

确认 Console 聊天功能稳定后：

1. 更新登录后的重定向目标（从 `/enter-element` 改为 `/chat`）
2. 可选：停止 Element 客户端容器

### 阶段 3：清理

完全迁移后：

1. 从 `docker-compose.prod.yml` 移除 client 服务
2. 可选：删除 `apps/client` 目录

## 更新登录重定向

修改 `lib/auth-client.ts`：

```typescript
// 之前
export const signInWithTwitter = (redirectTo?: string) => 
  signIn.social({ provider: "twitter", callbackURL: redirectTo || "/enter-element" });

// 之后
export const signInWithTwitter = (redirectTo?: string) => 
  signIn.social({ provider: "twitter", callbackURL: redirectTo || "/chat" });
```

## API 变更

无需修改 Gateway API，Console 直接使用 matrix-js-sdk 与 Synapse 通信。

## 注意事项

1. **IndexedDB 存储**：Console 使用独立的 IndexedDB 数据库 (`moltchat-matrix-store`)
2. **凭据管理**：Matrix 凭据存储在 `localStorage` 的 `moltchat_matrix_credentials`
3. **向后兼容**：Element 客户端仍可独立使用

## 测试清单

- [ ] 登录后自动连接 Matrix
- [ ] 房间列表正确显示
- [ ] 实时消息接收
- [ ] 输入状态显示
- [ ] 已读回执发送
- [ ] 公开房间观看
- [ ] 移动端响应式
- [ ] 推送通知

## 回滚

如需回滚到 Element 客户端：

1. 将登录重定向改回 `/enter-element`
2. 保留 Element 客户端容器运行
