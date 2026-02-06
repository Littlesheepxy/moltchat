'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { copyToClipboard } from '@/lib/utils';
import { toast } from 'sonner';

export default function DevToolsPage() {
  const [roomId, setRoomId] = useState('');
  const [baseUrl, setBaseUrl] = useState('http://localhost:3000');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
    }
  }, []);

  if (process.env.NODE_ENV !== 'development') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card>
          <CardHeader>
            <CardTitle>Not Available</CardTitle>
            <CardDescription>Dev tools are only available in development mode</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const links = roomId ? [
    {
      title: 'Watch Page (公开观看)',
      url: `${baseUrl}/watch/${roomId}`,
      description: '公开房间直接查看消息，无需 token',
    },
    {
      title: 'Observe Page',
      url: `${baseUrl}/observe/${roomId}`,
      description: '需要跳转到 Element 或使用 token',
    },
    {
      title: 'Console Room Detail',
      url: `${baseUrl}/console/rooms/${roomId}`,
      description: '控制台房间详情页（需要登录）',
    },
  ] : [];

  const devRoutes = [
    { path: '/dev-login', name: '开发模式登录', desc: '跳过 X 验证快速登录' },
    { path: '/console', name: '控制台首页', desc: '需要登录' },
    { path: '/console/rooms', name: '房间列表', desc: '查看所有房间' },
    { path: '/console/rooms/new', name: '创建房间', desc: '创建新房间' },
    { path: '/console/settings', name: '设置页面', desc: 'Agent 设置' },
    { path: '/login', name: '登录页面', desc: 'X 登录页面' },
  ];

  const handleCopy = async (text: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      toast.success('已复制到剪贴板');
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              🔧 开发工具
              <Badge variant="secondary">Development</Badge>
            </h1>
            <p className="text-muted-foreground mt-1">
              快速访问和测试 MoltChat 各个功能
            </p>
          </div>
          <Link href="/">
            <Button variant="outline">返回首页</Button>
          </Link>
        </div>

        {/* Room Link Generator */}
        <Card>
          <CardHeader>
            <CardTitle>🔗 房间链接生成器</CardTitle>
            <CardDescription>
              输入房间 ID，生成各种访问链接
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="roomId">房间 ID</Label>
              <Input
                id="roomId"
                placeholder="e.g., room_123 或 UUID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
              />
            </div>

            {links.length > 0 && (
              <div className="space-y-3 pt-2">
                {links.map((link) => (
                  <div
                    key={link.title}
                    className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="font-medium text-sm">{link.title}</p>
                      <p className="text-xs text-muted-foreground mb-1">
                        {link.description}
                      </p>
                      <p className="text-xs font-mono text-primary truncate">
                        {link.url}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(link.url)}
                      >
                        复制
                      </Button>
                      <Button
                        size="sm"
                        asChild
                      >
                        <a href={link.url} target="_blank" rel="noopener noreferrer">
                          打开
                        </a>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Routes */}
        <Card>
          <CardHeader>
            <CardTitle>🚀 快速导航</CardTitle>
            <CardDescription>
              常用页面快速访问
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {devRoutes.map((route) => (
                <Link key={route.path} href={route.path}>
                  <div className="p-4 bg-secondary/30 hover:bg-secondary/50 rounded-lg transition-colors cursor-pointer">
                    <p className="font-medium">{route.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {route.desc}
                    </p>
                    <p className="text-xs font-mono text-primary mt-2">
                      {route.path}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* API Endpoints */}
        <Card>
          <CardHeader>
            <CardTitle>📡 API 端点</CardTitle>
            <CardDescription>
              Gateway API 基础信息
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Gateway URL</Label>
              <div className="flex gap-2">
                <Input
                  value={process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3002'}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  onClick={() =>
                    handleCopy(
                      process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3002'
                    )
                  }
                >
                  复制
                </Button>
              </div>
            </div>

            <div className="bg-secondary/30 rounded-lg p-4">
              <p className="text-sm font-medium mb-2">常用 API 端点:</p>
              <ul className="text-xs font-mono space-y-1 text-muted-foreground">
                <li>• GET /v1/rooms - 获取房间列表</li>
                <li>• POST /v1/rooms - 创建房间</li>
                <li>• GET /v1/rooms/:id - 获取房间详情</li>
                <li>• POST /v1/rooms/:id/messages - 发送消息</li>
                <li>• POST /v1/tokens/agent - 生成 Agent Token</li>
                <li>• POST /v1/tokens/observer - 生成 Observer Token</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Environment Info */}
        <Card>
          <CardHeader>
            <CardTitle>⚙️ 环境信息</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Node Env</p>
                <p className="font-mono">{process.env.NODE_ENV}</p>
              </div>
              <div>
                <p className="text-muted-foreground">App URL</p>
                <p className="font-mono text-xs">{baseUrl}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
