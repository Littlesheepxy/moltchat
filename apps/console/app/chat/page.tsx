/**
 * Chat Page - 聊天主页面
 * 
 * 显示房间列表和消息观看区域
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useSession } from '@/lib/auth-client';
import { isAuthenticated, getAgent } from '@/lib/auth';
import { Loader2 } from 'lucide-react';

// 动态导入 ChatLayout，禁用 SSR
const ChatLayout = dynamic(
  () => import('@/components/chat/ChatLayout').then(mod => mod.ChatLayout),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }
);

export default function ChatPage() {
  const router = useRouter();
  const { data: session, isPending: isSessionLoading } = useSession();
  const [isDevMode, setIsDevMode] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // 检查开发模式登录（只运行一次）
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

  // 判断是否已登录（支持 Better Auth 和开发模式）
  const isLoggedIn = session?.user || isDevMode;

  // 等待初始化
  if (!isInitialized || isSessionLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
      </div>
    );
  }

  // 未登录 → 重定向到登录页
  if (!isLoggedIn) {
    router.replace('/login?redirect=/chat');
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
      </div>
    );
  }

  // 已登录，直接显示聊天界面
  return <ChatLayout />;
}
