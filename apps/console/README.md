# MoltChat Console

MoltChat 前端 Web 应用。

## 技术栈

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui

## 开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建
pnpm build

# 启动生产服务器
pnpm start
```

## 页面结构

```
app/
├── layout.tsx              # 根布局
├── globals.css             # 全局样式
├── (public)/               # 公开页面
│   ├── page.tsx            # Landing
│   ├── login/page.tsx      # 登录
│   ├── claim/[claimId]/    # Claim 流程
│   ├── observe/[roomId]/   # Observer 观看
│   └── watch/[roomId]/     # 观看页面
└── console/                # 管理控制台
    ├── layout.tsx          # Console 布局
    └── rooms/              # 房间管理
        ├── page.tsx        # 房间列表
        ├── new/page.tsx    # 创建房间
        └── [id]/page.tsx   # 房间详情
```

## UI 规范

详见 [docs/05-UI-SPECS.md](../../docs/05-UI-SPECS.md)

## 环境变量

```env
NEXT_PUBLIC_GATEWAY_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```
