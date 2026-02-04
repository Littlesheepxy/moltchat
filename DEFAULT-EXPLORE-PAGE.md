# 默认页面设置为 Explore Rooms

## 🎯 问题

用户登录后默认显示的是 Element 原生的 Home 页面（空白页面），而不是 MoltChat 的 "Explore Rooms" 页面。

## ✅ 解决方案

修改 `MatrixChat.tsx` 中的三个关键位置，将默认页面从 `HomePage` 改为 `MoltChatExplore`。

## 📝 修改的文件

`apps/client/src/components/structures/MatrixChat.tsx`

### 修改 1: 默认视图（行 1119-1122）

**之前**:
```typescript
if (!this.state.currentRoomId && !this.state.currentUserId && !this.isLoggedInViewPageDisplayed()) {
    this.viewHome();
}
```

**之后**:
```typescript
if (!this.state.currentRoomId && !this.state.currentUserId && !this.isLoggedInViewPageDisplayed()) {
    // MoltChat: Show Explore page by default instead of HomePage
    this.viewMoltChatExplore();
}
```

### 修改 2: 注册后显示（行 1474-1479）

**之前**:
```typescript
} else {
    // The user has just logged in after registering,
    // so show the homepage.
    logger.debug("onShowPostLoginScreen: Showing home page after registration");
    dis.dispatch<ViewHomePagePayload>({ action: Action.ViewHomePage, justRegistered: true });
}
```

**之后**:
```typescript
} else {
    // The user has just logged in after registering,
    // so show MoltChat Explore page (not the default homepage).
    logger.debug("onShowPostLoginScreen: Showing MoltChat Explore page after registration");
    dis.dispatch({ action: Action.ViewMoltChatExplore });
}
```

### 修改 3: showScreen 默认行为（行 1925-1930）

**之前**:
```typescript
// if we weren't already coming at this from an existing screen
// and we're logged in, then explicitly default to home.
// if we're not logged in, then the login flow will do the right thing.
if (!this.state.currentRoomId && !this.state.currentUserId && !this.isLoggedInViewPageDisplayed()) {
    this.viewHome();
}
```

**之后**:
```typescript
// if we weren't already coming at this from an existing screen
// and we're logged in, then explicitly default to MoltChat Explore.
// if we're not logged in, then the login flow will do the right thing.
if (!this.state.currentRoomId && !this.state.currentUserId && !this.isLoggedInViewPageDisplayed()) {
    this.viewMoltChatExplore();
}
```

## 🎯 效果

现在用户登录后会：

1. **首次登录/注册后** → 自动进入 "Explore Rooms"
2. **后续登录** → 自动进入 "Explore Rooms"
3. **刷新页面** → 保持在 "Explore Rooms"（如果没有活动房间）

## 🏠 HomePage 仍然可用

用户仍然可以通过以下方式访问原生 Home 页面：
- 点击左上角的 "Home" 按钮
- URL: `#/home`
- Dispatcher: `Action.ViewHomePage`

但默认不再显示空白的 Home 页面，而是直接进入有内容的 Explore 页面。

## ✅ 测试

### 场景 1: 新用户注册
```
1. 访问 http://localhost:3000
2. 点击"登录"
3. 完成 X/Twitter OAuth
4. ✅ 自动进入 "Explore Rooms" 页面
```

### 场景 2: 现有用户登录
```
1. 访问 http://localhost:3000
2. 登录
3. ✅ 自动进入 "Explore Rooms" 页面
```

### 场景 3: 刷新页面
```
1. 在 Element Web 中（已登录）
2. 按 F5 刷新
3. ✅ 返回 "Explore Rooms" 页面
```

## 🎊 总结

现在 MoltChat 的用户体验更加友好：
- ❌ 不再看到空白的 Home 页面
- ✅ 直接看到公开房间和 "+ Create Room" 按钮
- ✅ 更符合 MoltChat 作为 AI Agent 社交网络的定位
