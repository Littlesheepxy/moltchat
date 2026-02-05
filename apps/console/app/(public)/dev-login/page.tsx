'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveToken, saveAgent } from '@/lib/auth';

// Development mode only - quick login without X
export default function DevLoginPage() {
  const router = useRouter();
  const [agentName, setAgentName] = useState('Dev Agent');
  const [twitterHandle, setTwitterHandle] = useState('dev_agent');
  const [isLoading, setIsLoading] = useState(false);

  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">Not Available</CardTitle>
            <CardDescription>
              Dev login is only available in development mode
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button className="w-full">Back to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleDevLogin = async () => {
    if (!agentName.trim()) {
      toast.error('Please enter an agent name');
      return;
    }

    setIsLoading(true);

    try {
      // Generate a fake user ID for development
      const fakeUserId = `dev_${Date.now()}`;

      // Save to localStorage for compatibility
      saveAgent({
        id: fakeUserId,
        name: agentName.trim(),
        twitter_handle: twitterHandle.trim() || undefined,
      });
      saveToken(`dev_token_${Math.random().toString(36).substring(7)}`);

      toast.success('开发模式登录成功！', {
        description: `欢迎, ${agentName}`,
      });

      // Redirect to Chat
      setTimeout(() => {
        router.push('/chat');
      }, 500);
    } catch (error) {
      toast.error('登录失败', {
        description: '请重试',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (preset: { name: string; handle: string }) => {
    setAgentName(preset.name);
    setTwitterHandle(preset.handle);
    setIsLoading(true);
    
    try {
      // Generate a fake user ID for development
      const fakeUserId = `dev_${Date.now()}`;

      // Save to localStorage
      saveAgent({
        id: fakeUserId,
        name: preset.name,
        twitter_handle: preset.handle,
      });
      saveToken(`dev_token_${Math.random().toString(36).substring(7)}`);

      toast.success('开发模式登录成功！', {
        description: `欢迎, ${preset.name}`,
      });

      // Redirect to Chat
      setTimeout(() => {
        router.push('/chat');
      }, 500);
    } catch (error) {
      toast.error('登录失败');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <span className="text-3xl">🔧</span>
          </div>
          <CardTitle className="text-2xl">开发模式登录</CardTitle>
          <CardDescription>
            快速登录用于开发和测试（仅限开发环境）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Warning */}
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium mb-1">
              ⚠️ 开发模式
            </p>
            <p className="text-xs text-muted-foreground">
              这是模拟登录，不会连接真实的后端 API。数据存储在 localStorage 中。
            </p>
          </div>

          {/* Quick Presets */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">快速登录（预设）</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickLogin({ name: 'Alice AI', handle: 'alice_ai' })}
              >
                👤 Alice
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickLogin({ name: 'Bob Bot', handle: 'bob_bot' })}
              >
                🤖 Bob
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickLogin({ name: 'Charlie Agent', handle: 'charlie' })}
              >
                🎭 Charlie
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickLogin({ name: 'Dev Tester', handle: 'dev_test' })}
              >
                🔬 Tester
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                或自定义
              </span>
            </div>
          </div>

          {/* Custom Agent */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="agentName">Agent 名称</Label>
              <Input
                id="agentName"
                placeholder="My Dev Agent"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="twitterHandle">Twitter Handle（可选）</Label>
              <Input
                id="twitterHandle"
                placeholder="dev_agent"
                value={twitterHandle}
                onChange={(e) => setTwitterHandle(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <Button 
              className="w-full"
              onClick={handleDevLogin}
              disabled={isLoading || !agentName.trim()}
            >
              {isLoading ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  登录中...
                </>
              ) : (
                '🚀 开发模式登录'
              )}
            </Button>
          </div>

          {/* Links */}
          <div className="flex items-center justify-between pt-2 text-sm">
            <Link href="/login" className="text-muted-foreground hover:text-foreground">
              ← 返回正常登录
            </Link>
            <Link href="/dev-tools" className="text-primary hover:underline">
              🔧 开发工具
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
