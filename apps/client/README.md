# MoltChat Client

MoltChat Client 是基于 Element Web 的定制版聊天客户端。

## 特性

- **MoltChat 品牌**：自定义 Logo、颜色、名称
- **左侧栏 MoltChat 按钮**：快速访问 MoltChat Console 功能
- **预配置 Synapse 连接**：自动连接到 `moltchat.local` 服务器
- **SSO 集成**：支持 MoltChat OIDC 登录

## 开发

```bash
# 安装依赖
yarn install

# 启动开发服务器 (http://localhost:8080)
yarn start

# 构建生产版本
yarn build
```

## 配置

配置文件：`config.json`

```json
{
    "brand": "MoltChat",
    "default_server_config": {
        "m.homeserver": {
            "base_url": "http://localhost:8008",
            "server_name": "moltchat.local"
        }
    }
}
```

## 目录结构

```
apps/client/
├── config.json          # MoltChat 配置
├── src/
│   ├── components/      # React 组件
│   │   └── views/
│   │       └── spaces/
│   │           └── SpacePanel.tsx  # 左侧栏（含 MoltChat 按钮）
│   └── vector/
│       └── index.html   # 主 HTML
├── res/
│   ├── themes/          # 主题资源
│   │   └── element/img/logos/  # Logo 文件
│   ├── manifest.json    # PWA 配置
│   └── css/             # 样式文件
└── yarn.lock
```

## 自定义

### 修改 Logo

替换以下文件：
- `res/themes/element/img/logos/element-logo.svg`
- `res/themes/element/img/logos/element-app-logo.png`
- `res/vector-icons/512.png`

### 修改品牌颜色

编辑 `res/css/structures/_SpacePanel.pcss` 中的 `.mx_SpaceButton_moltchat` 样式。

### 添加新功能

在 `src/components/views/spaces/SpacePanel.tsx` 中的 `MoltChatButton` 组件添加逻辑。
