# 🐛 开发模式登录问题修复

## 问题：创建房间后跳转回登录页

### 原因

开发模式使用 URL 参数 `?user_id=xxx` 来模拟登录，但：
1. 创建房间后跳转的 URL 没有保留这个参数
2. Console layout 检测不到 `user_id`，认为未登录
3. 自动重定向到登录页

### 解决方案

已经创建了 `lib/dev-url.ts` helper 来自动保留 URL 参数。

---

## ✅ 现在的正确流程

### 1. 开发登录（会自动带上 user_id）

```bash
# 访问开发登录页
open http://localhost:3000/dev-login

# 点击快速登录（如 Alice）
# 自动跳转到：
http://localhost:3000/console?user_id=dev_1707123456
```

### 2. 所有页面自动保留 user_id

```bash
# 点击 "Rooms" 导航
http://localhost:3000/console/rooms?user_id=dev_1707123456

# 点击 "Create Room"
http://localhost:3000/console/rooms/new?user_id=dev_1707123456

# 创建后跳转到房间详情
http://localhost:3000/console/rooms/[roomId]?user_id=dev_1707123456
```

### 3. 不会再跳转回登录页 ✅

---

## 🎯 快速测试

### 完整测试流程

```bash
# 1. 开发登录
open http://localhost:3000/dev-login
# 点击 "Alice AI"

# 2. 等待跳转到控制台
# URL 应该是: http://localhost:3000/console?user_id=dev_xxx

# 3. 复制这个 URL（包含 user_id）
# 以后可以直接用这个 URL 访问，无需重新登录

# 4. 点击 "Create Room"
# URL 会自动带上 user_id

# 5. 填写房间信息并创建
# 创建后跳转的 URL 也会带上 user_id

# 6. 不会跳转回登录页 ✅
```

---

## 🔍 验证修复

### 检查点 1: 登录后的 URL

登录后应该看到：
```
http://localhost:3000/console?user_id=dev_1234567890
                                    ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑
                                    这个参数必须存在
```

### 检查点 2: 导航时 URL

所有控制台内的导航都应该保留 `user_id`：
```
/console?user_id=dev_xxx
/console/rooms?user_id=dev_xxx
/console/rooms/new?user_id=dev_xxx
/console/rooms/[id]?user_id=dev_xxx
/console/settings?user_id=dev_xxx
```

### 检查点 3: 不会重定向到登录页

只要 URL 中有 `user_id`，就不会跳转到登录页。

---

## 📝 代码修改说明

### 新增文件

- `apps/console/lib/dev-url.ts` - URL helper 工具

提供了：
- `useDevUrl()` hook - 在组件中使用
- `buildDevUrl()` 函数 - 在非组件中使用
- `getUserIdFromUrl()` - 获取 user_id

### 修改文件

- `apps/console/app/console/rooms/new/page.tsx`
  - 使用 `useDevUrl()` hook
  - 所有跳转都使用 `buildUrl()` 保留参数

---

## 🎉 现在可以正常使用了

刷新页面后试试：

1. 访问 http://localhost:3000/dev-login
2. 点击任意预设账号
3. 创建新房间
4. 不会再跳转回登录页！

---

## 💡 开发提示

### 保存有效的开发登录 URL

登录一次后，复制带 `user_id` 的 URL 并保存为书签：

```
http://localhost:3000/console?user_id=dev_1707123456
```

以后直接访问这个 URL，跳过登录步骤。

### 多用户测试

想测试多个用户，使用不同的 `user_id`：

```
# 用户 A
http://localhost:3000/console?user_id=dev_alice

# 用户 B
http://localhost:3000/console?user_id=dev_bob
```

---

刷新页面，问题应该解决了！🎊
