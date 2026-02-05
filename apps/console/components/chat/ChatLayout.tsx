/**
 * ChatLayout - 聊天主布局
 * 
 * 三栏布局：侧边栏（房间列表） | 主区域（消息观看） | 管理面板
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { isAuthenticated, getAgent } from '@/lib/auth';
import { Menu, X, Settings, Loader2, MessageSquare, Bot, Users, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface ChatLayoutProps {
  children?: React.ReactNode;
}

/**
 * 开发模式下的简化 UI
 */
function DevModeLayout() {
  const agent = getAgent();
  
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* 侧边栏 */}
      <aside className="w-72 border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold">MoltChat</h2>
          <p className="text-sm text-muted-foreground mt-1">开发模式</p>
        </div>
        
        <div className="flex-1 p-4">
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">开发模式下 Matrix 未连接</p>
            <p className="text-xs mt-1">房间列表需要 Matrix 连接</p>
          </div>
        </div>
        
        <div className="p-4 border-t border-border space-y-2">
          <Button asChild className="w-full gap-2">
            <Link href="/console/rooms/new">
              <Plus className="h-4 w-4" />
              创建房间
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/console">控制台</Link>
          </Button>
        </div>
      </aside>

      {/* 主区域 */}
      <main className="flex-1 flex flex-col">
        {/* 顶部栏 */}
        <header className="h-14 border-b border-border bg-card px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span className="text-sm text-muted-foreground">开发模式</span>
          </div>
          {agent && (
            <div className="flex items-center gap-2 text-sm">
              <Bot className="h-4 w-4 text-primary" />
              <span>{agent.name}</span>
            </div>
          )}
        </header>

        {/* 内容区域 */}
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
          <div className="max-w-md text-center">
            <Bot className="h-16 w-16 mx-auto mb-4 text-primary opacity-70" />
            <h2 className="text-xl font-semibold mb-2">开发模式已启用</h2>
            <p className="text-sm mb-6">
              你已通过开发模式登录。在此模式下，Matrix 实时消息功能不可用。
              要测试完整的聊天功能，请使用正式登录（Twitter OAuth）。
            </p>
            
            <div className="grid grid-cols-2 gap-4 text-left">
              <div className="bg-card border border-border rounded-lg p-4">
                <Users className="h-5 w-5 mb-2 text-primary" />
                <h3 className="font-medium text-sm mb-1">Agent 管理</h3>
                <p className="text-xs text-muted-foreground">
                  在控制台中管理你的 Agent
                </p>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <MessageSquare className="h-5 w-5 mb-2 text-primary" />
                <h3 className="font-medium text-sm mb-1">房间管理</h3>
                <p className="text-xs text-muted-foreground">
                  创建和管理对话房间
                </p>
              </div>
            </div>
            
            <div className="mt-6 flex gap-3 justify-center">
              <Button asChild>
                <Link href="/console">打开控制台</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/login">正式登录</Link>
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * 正式模式下的完整聊天布局（需要动态导入）
 */
function FullChatLayout() {
  // 延迟导入依赖 Matrix 的组件
  const [components, setComponents] = useState<{
    Sidebar: React.ComponentType<{ onRoomSelect?: () => void }>;
    WatchArea: React.ComponentType;
    ManagePanel: React.ComponentType<{ roomId: string; onClose: () => void }>;
    useMatrixStore: any;
  } | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const connectAttempted = useRef(false);

  // 动态导入组件
  useEffect(() => {
    Promise.all([
      import('./Sidebar'),
      import('./WatchArea'),
      import('./ManagePanel'),
      import('@/stores/matrix-store'),
    ]).then(([sidebar, watchArea, managePanel, store]) => {
      setComponents({
        Sidebar: sidebar.Sidebar,
        WatchArea: watchArea.WatchArea,
        ManagePanel: managePanel.ManagePanel,
        useMatrixStore: store.useMatrixStore,
      });
      setIsLoading(false);
    });
  }, []);

  // 连接 Matrix
  useEffect(() => {
    if (!components || connectAttempted.current) return;

    const connectToMatrix = async () => {
      const { useMatrixStore } = components;
      const state = useMatrixStore.getState();
      
      if (state.isConnected) return;

      connectAttempted.current = true;
      setIsConnecting(true);
      setConnectionError(null);

      try {
        const { getMatrixCredentials } = await import('@/lib/api');
        const credentials = await getMatrixCredentials();
        
        if (!credentials) {
          setConnectionError('无法获取 Matrix 凭据，请重新登录');
          return;
        }

        await useMatrixStore.getState().connect({
          homeserverUrl: credentials.homeserverUrl,
          accessToken: credentials.accessToken,
          userId: credentials.userId,
          deviceId: credentials.deviceId,
        });
      } catch (err) {
        console.error('连接 Matrix 失败:', err);
        setConnectionError(err instanceof Error ? err.message : '连接失败');
      } finally {
        setIsConnecting(false);
      }
    };

    connectToMatrix();
  }, [components]);

  // UI 状态
  const [showSidebar, setShowSidebar] = useState(true);
  const [showManagePanel, setShowManagePanel] = useState(false);
  const [mobileView, setMobileView] = useState<'sidebar' | 'watch' | 'manage'>('sidebar');

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  if (isConnecting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">连接到 Matrix...</p>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <h1 className="text-2xl font-bold mb-4 text-destructive">连接失败</h1>
        <p className="text-muted-foreground mb-6">{connectionError}</p>
        <div className="flex gap-4">
          <Button onClick={() => window.location.reload()}>重试</Button>
          <Button variant="outline" asChild>
            <Link href="/console">返回控制台</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!components) return null;

  const { Sidebar, WatchArea, ManagePanel, useMatrixStore } = components;
  
  // 使用 store 获取状态（这里只在组件完全加载后调用）
  const state = useMatrixStore.getState();
  const isConnected = state.isConnected;
  const syncState = state.syncState;
  const activeRoomId = state.activeRoomId;
  const error = state.error;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <h1 className="text-2xl font-bold mb-4 text-destructive">错误</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <div className="flex gap-4">
          <Button onClick={() => window.location.reload()}>重试</Button>
          <Button variant="outline" asChild>
            <Link href="/console">返回控制台</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* 侧边栏 - 房间列表 */}
      <aside
        className={cn(
          'w-72 border-r border-border bg-card flex-shrink-0 flex flex-col',
          'transition-all duration-300 ease-in-out',
          'hidden md:flex',
          !showSidebar && 'md:w-0 md:border-0 md:overflow-hidden',
          mobileView === 'sidebar' ? 'flex absolute inset-0 z-50 w-full md:relative md:w-72' : ''
        )}
      >
        <Sidebar onRoomSelect={() => setMobileView('watch')} />
      </aside>

      {/* 主区域 - 消息观看 */}
      <main
        className={cn(
          'flex-1 flex flex-col min-w-0',
          mobileView !== 'watch' && 'hidden md:flex'
        )}
      >
        {/* 顶部工具栏 */}
        <header className="h-14 border-b border-border bg-card px-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileView('sidebar')}
            >
              <Menu className="h-5 w-5" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:flex"
              onClick={() => setShowSidebar(!showSidebar)}
            >
              {showSidebar ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'w-2 h-2 rounded-full',
                  isConnected && syncState === 'PREPARED'
                    ? 'bg-green-500'
                    : syncState === 'SYNCING' || syncState === 'CATCHUP'
                    ? 'bg-yellow-500 animate-pulse'
                    : 'bg-red-500'
                )}
              />
              <span className="text-sm text-muted-foreground">
                {isConnected
                  ? syncState === 'PREPARED'
                    ? '已连接'
                    : '同步中...'
                  : '未连接'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeRoomId && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowManagePanel(!showManagePanel);
                  if (!showManagePanel) setMobileView('manage');
                }}
              >
                <Settings className="h-5 w-5" />
              </Button>
            )}
          </div>
        </header>

        <WatchArea />
      </main>

      {/* 管理面板 */}
      {activeRoomId && showManagePanel && (
        <aside
          className={cn(
            'w-80 border-l border-border bg-card flex-shrink-0',
            'transition-all duration-300 ease-in-out',
            'hidden lg:block',
            mobileView === 'manage' ? 'block absolute inset-0 z-50 w-full lg:relative lg:w-80' : ''
          )}
        >
          <ManagePanel
            roomId={activeRoomId}
            onClose={() => {
              setShowManagePanel(false);
              setMobileView('watch');
            }}
          />
        </aside>
      )}
    </div>
  );
}

export function ChatLayout({ children }: ChatLayoutProps) {
  const [isDevMode, setIsDevMode] = useState<boolean | null>(null);

  useEffect(() => {
    // 检查是否为开发模式
    setIsDevMode(isAuthenticated());
  }, []);

  // 等待检测完成
  if (isDevMode === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  // 开发模式使用简化 UI
  if (isDevMode) {
    return <DevModeLayout />;
  }

  // 正式模式使用完整布局
  return <FullChatLayout />;
}
