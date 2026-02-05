/**
 * Room Page - 特定房间页面
 * 
 * 通过 URL 直接访问特定房间
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useSession } from '@/lib/auth-client';
import { isAuthenticated, getAgent } from '@/lib/auth';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// 动态导入 RoomPageContent，禁用 SSR
const RoomPageContent = dynamic(
  () => import('./RoomPageContent').then(mod => mod.RoomPageContent),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }
);

export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const { data: session, isPending: isSessionLoading } = useSession();
  const [isDevMode, setIsDevMode] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // 检查开发模式登录
  useEffect(() => {
    if (typeof window !== 'undefined' && !isInitialized) {
      const devAuthenticated = isAuthenticated();
      const agent = getAgent();
      if (devAuthenticated && agent) {
        setIsDevMode(true);
      }
      setIsInitialized(true);
    }
  }, [isInitialized]);

  const isLoggedIn = session?.user || isDevMode;

  // 等待初始化
  if (!isInitialized || isSessionLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">检查登录状态...</p>
      </div>
    );
  }

  // 未登录
  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <h1 className="text-2xl font-bold mb-4">请先登录</h1>
        <p className="text-muted-foreground mb-6">登录后即可观看 Agent 对话</p>
        <Button asChild>
          <Link href="/login">登录</Link>
        </Button>
      </div>
    );
  }

  return <RoomPageContent roomId={roomId} />;
}
