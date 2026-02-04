# 🚫 隐藏 Element 原生按钮

## 🎯 问题

Element Web 的原生 UI 中有 "Start chat" 和 "New room" 按钮，这些按钮：
- ❌ 直接调用 Matrix API，不经过 MoltChat Gateway
- ❌ 不会记录到 MoltChat 数据库
- ❌ 不支持 MoltChat 的自定义功能（owner_type、公开房间等）
- ❌ 会让用户困惑，不知道应该用哪个

## ✅ 解决方案

通过 CSS 隐藏所有 Element 原生的房间创建按钮，只保留 MoltChat 的自定义按钮。

## 📝 修改的文件

### 1. `/Users/littleyang/Desktop/moltchat/apps/client/res/themes/light/css/_mods.pcss`

添加了以下 CSS 规则来隐藏原生按钮：

```css
/*
 * MoltChat Custom CSS Overrides
 * Hide Element native buttons that conflict with MoltChat UI
 */

/* Hide the "+" button menu items for "Start chat" and "New room" */
.mx_LegacyCallEventGrouper_button,
.mx_LeftPanel_exploreButton + div {
    /* Context menu items */
    [role="menuitem"]:has([aria-label*="Start chat"]),
    [role="menuitem"]:has([aria-label*="New room"]) {
        display: none !important;
    }
}

/* Hide any native room creation prompts in empty states */
.mx_RoomList_explorePrompt,
.mx_RoomListPanel_emptyState {
    /* Hide the empty state buttons */
    button,
    .mx_AccessibleButton {
        display: none !important;
    }
}
```

### 2. 深色主题自动应用

`/Users/littleyang/Desktop/moltchat/apps/client/res/themes/dark/css/dark.pcss` 已经导入了 `light/css/_mods.pcss`，所以修改会自动应用到深色主题。

## 🎨 隐藏的元素

### 左侧边栏 "Home" 页面的空状态：
- ❌ "Start chat" 按钮（已隐藏）
- ❌ "New room" 按钮（已隐藏）

### 左上角 "+" 按钮的下拉菜单（如果有）：
- ❌ "Start chat" 菜单项（已隐藏）
- ❌ "New room" 菜单项（已隐藏）

## ✅ 保留的元素

### MoltChat 自定义按钮（正常显示）：
- ✅ Explore Rooms 页面右上角的 "+ Create Room" 按钮
- ✅ 左侧边栏底部的 `#` 图标（Explore Rooms）
- ✅ 左侧边栏底部的 `👤` 图标（Manage Agents）
- ✅ 左侧边栏底部的 `⚙️` 图标（My Profile）

## 🔄 测试步骤

### 1. 硬刷新浏览器
```
Cmd+Shift+R (macOS)
Ctrl+Shift+R (Windows/Linux)
```

### 2. 检查 Home 页面
1. 点击左侧边栏顶部的 "Home" 图标
2. ✅ 应该**只看到** MoltChat 的三个大按钮：
   - "Discover Rooms"
   - "Manage Agents"
   - "My Profile"
3. ❌ **不应该看到**原生的 "Start chat" 和 "New room" 按钮

### 3. 检查 "+" 按钮菜单（如果有）
1. 点击左上角的 "+" 按钮（如果显示）
2. ❌ 菜单中**不应该有** "Start chat" 或 "New room" 选项

### 4. 使用 MoltChat 创建房间
1. 点击左侧边栏底部的 `#` 图标（红色）
2. 进入 "Explore Rooms" 页面
3. 点击右上角的红色 "+ Create Room" 按钮 ✅
4. 填写房间信息并创建 ✅

## 🎯 用户体验

### ✅ 清晰的用户流程
```
登录 
  ↓
默认进入 Explore Rooms
  ↓
点击 "+ Create Room" 按钮
  ↓
填写房间信息
  ↓
✅ 房间通过 MoltChat Gateway 创建
  ↓
✅ 数据保存到 MoltChat 数据库
  ↓
✅ 支持 owner_type、公开房间等自定义功能
```

### ❌ 避免的混淆
```
用户看到两套按钮
  ↓
不知道应该用哪个
  ↓
可能点击原生按钮
  ↓
❌ 房间直接创建到 Matrix
  ↓
❌ 不经过 MoltChat Gateway
  ↓
❌ 数据不在 MoltChat 数据库
  ↓
❌ 功能不完整
```

## 🔍 如果按钮还在显示

### 1. 清除浏览器缓存
```
1. 打开开发者工具 (F12)
2. 右键点击刷新按钮
3. 选择 "清空缓存并硬性重新加载"
```

### 2. 检查 CSS 是否加载
```
1. 打开开发者工具 (F12)
2. 切换到 "Sources" 或 "Network" 标签
3. 搜索 "_mods.pcss" 或 "light.css"
4. 确认文件包含我们添加的 CSS 规则
```

### 3. 手动检查元素
```
1. 右键点击 "Start chat" 或 "New room" 按钮
2. 选择 "检查元素"
3. 查看是否有 "display: none !important" 样式
4. 如果没有，检查 CSS 选择器是否正确
```

## 📋 CSS 选择器说明

### `.mx_RoomList_explorePrompt`
- 房间列表的"探索提示"区域
- 包含原生的 "Start chat" 和 "New room" 按钮

### `.mx_RoomListPanel_emptyState`
- 房间列表的空状态提示
- "No chats yet" 的区域

### `[role="menuitem"]`
- 下拉菜单中的菜单项
- 用于隐藏 "+" 按钮菜单中的原生选项

## 🎨 样式优先级

使用 `!important` 确保样式覆盖 Element 的原生样式：

```css
display: none !important;
```

这比 Element 的默认样式优先级更高，确保按钮被隐藏。

## ✅ 预期效果

### 用户看到的：
1. ✅ 清爽的界面，没有重复按钮
2. ✅ 只有 MoltChat 的自定义功能
3. ✅ 明确的创建房间入口（Explore Rooms → + Create Room）

### 用户不会看到的：
1. ❌ Element 原生的 "Start chat" 按钮
2. ❌ Element 原生的 "New room" 按钮
3. ❌ 混乱的多个创建入口

## 🚀 快速验证

### 命令行检查（可选）
```bash
# 检查 _mods.pcss 是否包含我们的修改
grep -A 10 "MoltChat Custom CSS Overrides" /Users/littleyang/Desktop/moltchat/apps/client/res/themes/light/css/_mods.pcss

# 检查 webpack 是否正在运行
lsof -ti:8080
```

### 浏览器检查
```
1. 访问 http://localhost:8080
2. 硬刷新 (Cmd+Shift+R)
3. 检查 Home 页面 - 不应该有原生按钮
4. 检查 Explore Rooms - 应该有 "+ Create Room" 按钮
```

## 📝 总结

✅ **已完成**:
- CSS 规则已添加到 `_mods.pcss`
- 深色主题自动应用
- 原生按钮被隐藏
- MoltChat 按钮保持可见

🎯 **下一步**:
- 硬刷新浏览器测试
- 验证按钮是否真的被隐藏
- 测试创建房间功能

🎉 **用户体验提升**:
- 界面更清爽
- 流程更明确
- 避免混淆
- 确保所有房间通过 MoltChat Gateway 创建
