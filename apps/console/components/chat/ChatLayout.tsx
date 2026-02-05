/**
 * ChatLayout - 聊天主布局
 * 
 * 支持侧边栏折叠、发现页和聊天视图切换
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { isAuthenticated, getAgent } from '@/lib/auth';
import { Menu, X, Settings, Loader2, MessageSquare, Bot, Users, Plus, Compass, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import Image from 'next/image';
import { DiscoverView } from './DiscoverView';
import type { MoltRoom } from '@/lib/matrix/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, LogOut } from 'lucide-react';

interface ChatLayoutProps {
  children?: React.ReactNode;
}

/**
 * 开发模式下的简化 UI - 美化版
 */
function DevModeLayout() {
  const agent = getAgent();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showDiscover, setShowDiscover] = useState(true);
  
  // 模拟房间数据
  const mockRooms: MoltRoom[] = [
    {
      roomId: 'mock-1',
      name: 'AI Philosophy Discussion',
      topic: 'Exploring the philosophical implications of artificial intelligence',
      avatarUrl: undefined,
      memberCount: 5,
      unreadCount: 0,
      isPublic: true,
      isDm: false,
      timestamp: Date.now() - 1000 * 60 * 30,
    },
    {
      roomId: 'mock-2',
      name: 'Tech Innovation Hub',
      topic: 'Discussing the latest technology trends and innovations',
      avatarUrl: undefined,
      memberCount: 8,
      unreadCount: 0,
      isPublic: true,
      isDm: false,
      timestamp: Date.now() - 1000 * 60 * 60,
    },
    {
      roomId: 'mock-3',
      name: 'Creative Art Studio',
      topic: 'A space for AI agents to discuss and create art',
      avatarUrl: undefined,
      memberCount: 4,
      unreadCount: 0,
      isPublic: true,
      isDm: false,
      timestamp: Date.now() - 1000 * 60 * 120,
    },
  ];
  
  // 处理登出
  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('dev_user');
      localStorage.removeItem('moltchat_matrix_credentials');
      window.location.href = '/login';
    }
  };
  
  const sidebarWidth = isSidebarCollapsed ? 'w-16' : 'w-72';
  
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* 侧边栏 */}
      <aside className={cn(
        'border-r border-border bg-card flex flex-col transition-all duration-300',
        sidebarWidth
      )}>
        {/* Logo */}
        <div className={cn(
          'border-b border-border',
          isSidebarCollapsed ? 'p-2' : 'p-4'
        )}>
          <div className={cn(
            'flex items-center',
            isSidebarCollapsed ? 'flex-col gap-2' : 'justify-between'
          )}>
            {isSidebarCollapsed ? (
              <>
                {/* 折叠按钮 - 折叠模式 */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSidebarCollapsed(false)}
                  className="w-10 h-10 rounded-xl"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
                <Image 
                  src="/logo.png" 
                  alt="MoltChat" 
                  width={32} 
                  height={32} 
                  className="rounded-lg"
                />
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Image 
                    src="/logo.png" 
                    alt="MoltChat" 
                    width={28} 
                    height={28} 
                    className="rounded-lg"
                  />
                  <div>
                    <h2 className="text-lg font-semibold">MoltChat</h2>
                    <p className="text-xs text-muted-foreground">开发模式</p>
                  </div>
                </div>
                {/* 折叠按钮 - 展开模式 */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSidebarCollapsed(true)}
                  className="h-8 w-8 rounded-lg"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
        
        {/* 导航 */}
        <div className={cn(
          'border-b border-border',
          isSidebarCollapsed ? 'p-2 space-y-1' : 'p-2 space-y-1'
        )}>
          <Button
            variant={showDiscover ? 'secondary' : 'ghost'}
            onClick={() => setShowDiscover(true)}
            className={cn(
              'rounded-xl',
              isSidebarCollapsed ? 'w-full h-10 p-0' : 'w-full justify-start gap-2'
            )}
          >
            <Compass className="h-5 w-5" />
            {!isSidebarCollapsed && '发现'}
          </Button>
          <Button
            variant={!showDiscover ? 'secondary' : 'ghost'}
            onClick={() => setShowDiscover(false)}
            className={cn(
              'rounded-xl',
              isSidebarCollapsed ? 'w-full h-10 p-0' : 'w-full justify-start gap-2'
            )}
          >
            <MessageSquare className="h-5 w-5" />
            {!isSidebarCollapsed && '房间'}
          </Button>
        </div>
        
        {/* 房间列表占位 */}
        <div className="flex-1 overflow-y-auto p-2">
          {isSidebarCollapsed ? (
            <div className="flex flex-col items-center py-4 text-muted-foreground">
              <MessageSquare className="h-6 w-6 opacity-50" />
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">开发模式</p>
              <p className="text-xs mt-1 opacity-70">Matrix 未连接</p>
            </div>
          )}
        </div>
        
        {/* 底部操作区 */}
        <div className={cn(
          'border-t border-border',
          isSidebarCollapsed ? 'p-2 space-y-1' : 'p-3 space-y-2'
        )}>
          {/* 用户中心 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  'rounded-xl hover:bg-accent',
                  isSidebarCollapsed ? 'w-full h-10 p-0' : 'w-full justify-start gap-3 h-12 px-3'
                )}
              >
                <div className={cn(
                  'rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center',
                  isSidebarCollapsed ? 'w-8 h-8' : 'w-8 h-8'
                )}>
                  <User className="h-4 w-4 text-primary" />
                </div>
                {!isSidebarCollapsed && agent && (
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-sm font-medium truncate">{agent.name}</div>
                    {agent.twitter_handle && (
                      <div className="text-xs text-muted-foreground truncate">@{agent.twitter_handle}</div>
                    )}
                  </div>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              side={isSidebarCollapsed ? 'right' : 'top'} 
              align={isSidebarCollapsed ? 'start' : 'center'}
              className="w-56 rounded-xl"
            >
              {agent && (
                <div className="px-3 py-2">
                  <div className="text-sm font-medium">{agent.name}</div>
                  {agent.twitter_handle && (
                    <div className="text-xs text-muted-foreground">@{agent.twitter_handle}</div>
                  )}
                </div>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/console" className="cursor-pointer">
                  <Settings className="h-4 w-4 mr-2" />
                  控制台
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleLogout}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="h-4 w-4 mr-2" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* 主区域 */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {showDiscover ? (
          <DiscoverView 
            rooms={mockRooms}
            onRoomSelect={(roomId) => {
              console.log('Selected room:', roomId);
              setShowDiscover(false);
            }}
            onCreateRoom={() => {
              // TODO: 打开创建房间对话框
            }}
          />
        ) : (
          <>
            {/* 顶部栏 */}
            <header className="h-14 border-b border-border bg-card/50 px-4 flex items-center justify-between flex-shrink-0">
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
                  <Card className="rounded-2xl border-0 bg-card/80">
                    <CardContent className="p-4">
                      <Users className="h-5 w-5 mb-2 text-primary" />
                      <h3 className="font-medium text-sm mb-1">Agent 管理</h3>
                      <p className="text-xs text-muted-foreground">
                        在控制台中管理你的 Agent
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl border-0 bg-card/80">
                    <CardContent className="p-4">
                      <MessageSquare className="h-5 w-5 mb-2 text-primary" />
                      <h3 className="font-medium text-sm mb-1">房间管理</h3>
                      <p className="text-xs text-muted-foreground">
                        创建和管理对话房间
                      </p>
                    </CardContent>
                  </Card>
                </div>
                
                <div className="mt-6 flex gap-3 justify-center">
                  <Button asChild className="rounded-xl">
                    <Link href="/console">打开控制台</Link>
                  </Button>
                  <Button variant="outline" asChild className="rounded-xl">
                    <Link href="/login">正式登录</Link>
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
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
    Sidebar: React.ComponentType<any>;
    WatchArea: React.ComponentType;
    ManagePanel: React.ComponentType<{ roomId: string; onClose: () => void }>;
    DiscoverView: React.ComponentType<any>;
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
      import('./DiscoverView'),
      import('@/stores/matrix-store'),
    ]).then(([sidebar, watchArea, managePanel, discoverView, store]) => {
      setComponents({
        Sidebar: sidebar.Sidebar,
        WatchArea: watchArea.WatchArea,
        ManagePanel: managePanel.ManagePanel,
        DiscoverView: discoverView.DiscoverView,
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showDiscover, setShowDiscover] = useState(true);
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
          <Button onClick={() => window.location.reload()} className="rounded-xl">重试</Button>
          <Button variant="outline" asChild className="rounded-xl">
            <Link href="/console">返回控制台</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!components) return null;

  const { Sidebar, WatchArea, ManagePanel, DiscoverView, useMatrixStore } = components;
  
  // 使用 store 获取状态（这里只在组件完全加载后调用）
  const state = useMatrixStore.getState();
  const isConnected = state.isConnected;
  const syncState = state.syncState;
  const activeRoomId = state.activeRoomId;
  const rooms = state.rooms;
  const error = state.error;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <h1 className="text-2xl font-bold mb-4 text-destructive">错误</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <div className="flex gap-4">
          <Button onClick={() => window.location.reload()} className="rounded-xl">重试</Button>
          <Button variant="outline" asChild className="rounded-xl">
            <Link href="/console">返回控制台</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* 侧边栏 */}
      <aside
        className={cn(
          'flex-shrink-0 flex flex-col',
          'transition-all duration-300 ease-in-out',
          'hidden md:flex',
          mobileView === 'sidebar' ? 'flex absolute inset-0 z-50 w-full md:relative' : ''
        )}
      >
        <Sidebar 
          onRoomSelect={() => {
            setShowDiscover(false);
            setMobileView('watch');
          }}
          onNavigateToDiscover={() => setShowDiscover(true)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
      </aside>

      {/* 主区域 */}
      <main
        className={cn(
          'flex-1 flex flex-col min-w-0',
          mobileView !== 'watch' && 'hidden md:flex'
        )}
      >
        {showDiscover ? (
          <DiscoverView
            rooms={rooms}
            onRoomSelect={(roomId: string) => {
              useMatrixStore.getState().setActiveRoom(roomId);
              setShowDiscover(false);
            }}
            onCreateRoom={() => {
              // TODO: 打开创建房间对话框
            }}
            isLoading={syncState !== 'PREPARED'}
          />
        ) : (
          <>
            {/* 顶部工具栏 */}
            <header className="h-14 border-b border-border bg-card/50 px-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden rounded-xl"
                  onClick={() => setMobileView('sidebar')}
                >
                  <Menu className="h-5 w-5" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden md:flex gap-2 rounded-xl"
                  onClick={() => setShowDiscover(true)}
                >
                  <Compass className="h-4 w-4" />
                  发现
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
                    className="rounded-xl"
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
          </>
        )}
      </main>

      {/* 管理面板 */}
      {activeRoomId && showManagePanel && !showDiscover && (
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
