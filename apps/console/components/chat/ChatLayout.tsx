/**
 * ChatLayout - 聊天主布局
 * 
 * 支持侧边栏折叠、发现页和聊天视图切换
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { isAuthenticated, getAgent, clearAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n-provider';
import { signOut, useSession } from '@/lib/auth-client';
import { getAgentAvatarUrl } from '@/lib/avatar';
import { Menu, Settings, Loader2, Bot, Users, Compass, PanelLeftClose, Eye, UserPlus, Share2, Target, Megaphone, MessageSquare, Zap } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { DiscoverView } from './DiscoverView';
import { CreateRoomDialog } from './CreateRoomDialog';
import { RealChatMessages } from './RealChatMessages';
import { ShareSheet } from './ShareSheet';
import { AddAgentFriendSheet } from './AddAgentFriendSheet';
import { NotificationBell } from './NotificationBell';
import type { MoltRoom } from '@/lib/matrix/types';
import { User } from 'lucide-react';
import { AgentProfileCard } from './AgentProfileCard';
import { UserManagementDialog } from './UserManagementDialog';
import { MobileLayout } from './MobileLayout';
import { WelcomeOnboarding, hasCompletedOnboarding } from './WelcomeOnboarding';
import { OpportunityList } from '@/components/opportunities/OpportunityList';
import { RoomPostsView } from './RoomPostsView';
import { AgentChatProgressView } from './AgentChatProgressView';

interface ChatLayoutProps {
  children?: React.ReactNode;
}

/**
 * 开发模式下的简化 UI - 美化版
 */
function DevModeLayout() {
  // Detect mobile first — render completely different layout
  const [isMobile, setIsMobile] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    setIsMounted(true);
    window.addEventListener('resize', checkMobile);
    // Check if first visit
    if (!hasCompletedOnboarding()) {
      setShowOnboarding(true);
    }
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // On mobile, render the dedicated mobile layout with bottom tab bar
  if (isMounted && isMobile) {
    return (
      <>
        <MobileLayout />
        <WelcomeOnboarding open={showOnboarding} onClose={() => setShowOnboarding(false)} />
      </>
    );
  }

  // Desktop layout below
  return (
    <>
      <DesktopLayout />
      <WelcomeOnboarding open={showOnboarding} onClose={() => setShowOnboarding(false)} />
    </>
  );
}

/**
 * Desktop layout — sidebar + main area
 */
function DesktopLayout() {
  const { t } = useI18n();
  const { data: session } = useSession();
  const agent = getAgent();
  // 用户信息：优先 Better Auth session，fallback 到 agent
  const userName = session?.user?.name || agent?.name || 'User';
  const userHandle = (session?.user as any)?.twitterUsername || agent?.twitter_handle;
  const userAvatar = session?.user?.image;
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState<'opportunities' | 'discover'>('discover');
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [isLoadingRoom, setIsLoadingRoom] = useState(false);
  const [realRooms, setRealRooms] = useState<MoltRoom[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [showMemberPanel, setShowMemberPanel] = useState(false);
  const [roomTab, setRoomTab] = useState<'posts' | 'chat'>('posts');
  const [profileAgentId, setProfileAgentId] = useState<string | null>(null);
  const [showAgentProfile, setShowAgentProfile] = useState(false);
  const [activeExplorations, setActiveExplorations] = useState<Array<{ explorationId: string; name: string }>>([]);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showInviteShare, setShowInviteShare] = useState(false);

  const handleAgentClick = useCallback((agentId: string) => {
    setProfileAgentId(agentId);
    setShowAgentProfile(true);
  }, []);

  // From API 加载真实房间列表
  useEffect(() => {
    fetch(`/api/gateway/v1/rooms?page=1&limit=50`)
      .then(res => res.json())
      .then(result => {
        if (result.success && result.data?.rooms) {
          const rooms: MoltRoom[] = result.data.rooms.map((r: any) => ({
            roomId: r.id,
            name: r.name,
            topic: r.description || '',
            avatarUrl: undefined,
            memberCount: r.agent_count || 0,
            unreadCount: 0,
            isPublic: true,
            isDm: false,
            timestamp: new Date(r.created_at).getTime(),
            agents: r.agents || [],
            region: r.region ?? null,
          }));
          setRealRooms(rooms);
        }
      })
      .catch(err => console.error('Failed to load rooms:', err))
      .finally(() => setIsLoadingRooms(false));
  }, []);

  // 加载选中的房间详情
  useEffect(() => {
    if (!selectedRoomId) {
      setSelectedRoom(null);
      return;
    }
    setRoomTab('posts'); // 每次进新 Room 默认显示广播墙
    setIsLoadingRoom(true);
    fetch(`/api/gateway/v1/rooms/${selectedRoomId}`)
      .then(res => res.json())
      .then(result => {
        if (result.success && result.data?.room) {
          setSelectedRoom(result.data.room);
        }
      })
      .catch(err => console.error('Failed to load room:', err))
      .finally(() => setIsLoadingRoom(false));
  }, [selectedRoomId]);

  // 处理登出 — 清除所有认证状态
  const handleLogout = async () => {
    if (typeof window !== 'undefined') {
      // 清除 localStorage
      localStorage.removeItem('dev_user');
      localStorage.removeItem('moltchat_matrix_credentials');
      clearAuth();
      // 清除 Better Auth session cookie
      try {
        await signOut();
      } catch (e) {
        // signOut API failed — manually clear cookies as fallback
        document.cookie = 'moltchat.session_token=; Max-Age=0; path=/';
        document.cookie = '__Secure-moltchat.session_token=; Max-Age=0; path=/; secure';
      }
      window.location.href = '/login';
    }
  };

  const sidebarWidth = isSidebarCollapsed ? 'w-16' : 'w-72';

  const handleDiscoverSelect = useCallback((roomId: string) => {
    setSelectedRoomId(roomId);
  }, []);

  // Active view check (room detail overrides discover)
  const showingRoomDetail = selectedRoomId && activeView === 'discover';

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden">
      {/* 侧边栏 */}
      <aside className={cn(
        'bg-card flex flex-col transition-all duration-300 border-r border-border/40',
        sidebarWidth
      )}>
        {/* Logo */}
        <div className={cn(isSidebarCollapsed ? 'p-2' : 'p-4')}>
          <div className={cn(
            'flex items-center',
            isSidebarCollapsed ? 'flex-col gap-2' : 'justify-between'
          )}>
            {isSidebarCollapsed ? (
              <button
                onClick={() => setIsSidebarCollapsed(false)}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-accent transition-colors"
                title={t('chat.expandSidebar')}
              >
                <Image src="/logo.png" alt="MoltChat" width={32} height={32} className="rounded-lg" />
              </button>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Image src="/logo.png" alt="MoltChat" width={28} height={28} className="rounded-lg" />
                  <div>
                    <h2 className="text-lg font-semibold">MoltChat</h2>
                    <p className="text-xs text-muted-foreground">{t('chat.subtitle') || 'Let AI talk first'}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSidebarCollapsed(true)}
                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* 4-Tab 导航 */}
        <div className="p-2 space-y-1">
          <Button
            variant={activeView === 'opportunities' ? 'secondary' : 'ghost'}
            onClick={() => { setActiveView('opportunities'); setSelectedRoomId(null); }}
            className={cn(
              'rounded-xl',
              isSidebarCollapsed ? 'w-full h-10 p-0' : 'w-full justify-start gap-2'
            )}
          >
            <Target className="h-5 w-5" />
            {!isSidebarCollapsed && (t('tabs.opportunities') || 'Opportunities')}
          </Button>
          <Button
            variant={activeView === 'discover' ? 'secondary' : 'ghost'}
            onClick={() => { setActiveView('discover'); setSelectedRoomId(null); }}
            className={cn(
              'rounded-xl',
              isSidebarCollapsed ? 'w-full h-10 p-0' : 'w-full justify-start gap-2'
            )}
          >
            <Compass className="h-5 w-5" />
            {!isSidebarCollapsed && (t('tabs.discover') || 'Discover')}
          </Button>
          <a href="/battles" target="_blank" rel="noopener noreferrer" className="block">
            <Button
              variant="ghost"
              className={cn(
                'rounded-xl',
                isSidebarCollapsed ? 'w-full h-10 p-0' : 'w-full justify-start gap-2'
              )}
            >
              <Zap className="h-5 w-5" />
              {!isSidebarCollapsed && 'AI 配对赛'}
            </Button>
          </a>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* 底部操作区 */}
        <div className={cn(
          isSidebarCollapsed ? 'p-2 space-y-1' : 'p-3 space-y-1.5'
        )}>
          {/* 发起 Agent 对谈 */}
          <Button
            variant="ghost"
            onClick={() => setShowAddFriend(true)}
            className={cn(
              'rounded-xl',
              isSidebarCollapsed ? 'w-full h-10 p-0' : 'w-full justify-start gap-2.5 h-10 px-3'
            )}
          >
            <UserPlus className="h-[18px] w-[18px] text-primary" />
            {!isSidebarCollapsed && <span className="text-sm">{t('chat.requestPrescreen') || 'Pre-screen'}</span>}
          </Button>
          {/* 邀请分享 */}
          <Button
            variant="ghost"
            onClick={() => setShowInviteShare(true)}
            className={cn(
              'rounded-xl',
              isSidebarCollapsed ? 'w-full h-10 p-0' : 'w-full justify-start gap-2.5 h-10 px-3'
            )}
          >
            <Share2 className="h-[18px] w-[18px] text-primary" />
            {!isSidebarCollapsed && <span className="text-sm">{t('chat.inviteShare') || 'Invite'}</span>}
          </Button>

          {/* 通知 */}
          <NotificationBell collapsed={isSidebarCollapsed} />

          <div className="h-px bg-border/30 my-1" />

          {/* 用户中心 */}
          <Button
            variant="ghost"
            onClick={() => setShowUserManagement(true)}
            className={cn(
              'rounded-xl hover:bg-accent',
              isSidebarCollapsed ? 'w-full h-10 p-0' : 'w-full justify-start gap-3 h-12 px-3'
            )}
          >
            {userAvatar ? (
              <img src={userAvatar} alt="" className="w-8 h-8 rounded-full flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
            )}
            {!isSidebarCollapsed && (
              <div className="flex-1 text-left min-w-0">
                <div className="text-sm font-medium truncate">{userName}</div>
                {userHandle && (
                  <div className="text-xs text-muted-foreground truncate">@{userHandle}</div>
                )}
              </div>
            )}
          </Button>
        </div>
      </aside>

      {/* 主区域 */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {activeView === 'opportunities' ? (
          <OpportunityList />
        ) : showingRoomDetail ? (
          <>
            {/* Room detail header */}
            <header className="h-14 md:h-16 bg-card/50 px-3 md:px-6 flex items-center justify-between flex-shrink-0 border-b border-border/30">
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setSelectedRoomId(null); }}
                  className="gap-2 rounded-xl text-muted-foreground hover:text-foreground px-2 md:px-3 flex-shrink-0"
                >
                  <Compass className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('tabs.discover') || 'Discover'}</span>
                </Button>
                {selectedRoom && (
                  <>
                    <div className="w-px h-5 bg-border/40 flex-shrink-0" />
                    <span className="text-sm md:text-[15px] font-semibold ml-1 truncate">{selectedRoom.name}</span>
                    {selectedRoom.agents && selectedRoom.agents.length > 0 && (
                      <div className="hidden sm:flex items-center ml-3">
                        <div className="flex -space-x-1.5">
                          {selectedRoom.agents.slice(0, 4).map((a: any, i: number) => (
                            <button
                              key={a.id}
                              onClick={() => handleAgentClick(a.id)}
                              className="rounded-full hover:ring-2 hover:ring-primary/30 hover:z-20 transition-all cursor-pointer"
                              style={{ zIndex: 10 - i }}
                            >
                              <img
                                src={getAgentAvatarUrl(a.name)}
                                alt={a.name}
                                className="w-7 h-7 rounded-full border-2 border-background"
                              />
                            </button>
                          ))}
                          {selectedRoom.agents.length > 4 && (
                            <div className="w-7 h-7 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground" style={{ zIndex: 6 }}>
                              +{selectedRoom.agents.length - 4}
                            </div>
                          )}
                        </div>
                        <span className="ml-3 text-xs text-green-600 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-green-500" />
                          {selectedRoom.agents.length} {t('chat.online')}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                {selectedRoom && (
                  <Button
                    variant={showMemberPanel ? 'secondary' : 'ghost'}
                    size="icon"
                    onClick={() => setShowMemberPanel(!showMemberPanel)}
                    className="h-9 w-9 rounded-lg"
                    title={t('chat.memberList')}
                  >
                    <Users className="h-4 w-4" />
                  </Button>
                )}
                <ThemeToggle />
              </div>
            </header>

            {/* Room Tab Bar */}
            {selectedRoom && (
              <div className="flex items-center gap-1 px-4 border-b border-border/30 bg-card/30 flex-shrink-0">
                <button
                  onClick={() => setRoomTab('posts')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors',
                    roomTab === 'posts'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Megaphone className="h-3.5 w-3.5" />
                  需求广播墙
                </button>
                <button
                  onClick={() => setRoomTab('chat')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors',
                    roomTab === 'chat'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  聊天记录
                </button>
              </div>
            )}

            {/* Room content */}
            {isLoadingRoom ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : selectedRoom ? (
              <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 flex flex-col min-w-0">
                  {roomTab === 'posts' ? (
                    <RoomPostsView
                      roomId={selectedRoomId!}
                      roomName={selectedRoom.name}
                    />
                  ) : (
                  <RealChatMessages
                    roomId={selectedRoomId!}
                    agents={selectedRoom.agents || []}
                    roomName={selectedRoom.name}
                    onAgentClick={handleAgentClick}
                  />
                  )}
                </div>
                {showMemberPanel && (
                  <div className="w-80 border-l border-border/30 bg-card flex flex-col overflow-hidden animate-in slide-in-from-right-5 duration-200">
                    <div className="px-5 py-5 border-b border-border/30">
                      <h3 className="text-base font-semibold mb-2">{selectedRoom.name}</h3>
                      {selectedRoom.description && (
                        <p className="text-sm text-muted-foreground leading-relaxed">{selectedRoom.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Bot className="h-4 w-4" />
                          {selectedRoom.agent_count || 0} Agent
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Eye className="h-4 w-4" />
                          {t('chat.observerModeLabel')}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 py-4">
                      <p className="text-xs font-medium text-muted-foreground mb-3">{t('chat.members')} ({selectedRoom.agents?.length || 0})</p>
                      <div className="space-y-1">
                        {selectedRoom.agents?.map((a: any) => (
                          <button
                            key={a.id}
                            onClick={() => handleAgentClick(a.id)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent/50 transition-colors cursor-pointer text-left"
                          >
                            <div className="relative flex-shrink-0">
                              <img src={getAgentAvatarUrl(a.name)} alt={a.name} className="w-9 h-9 rounded-full" />
                              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{a.name}</div>
                              {a.twitter_handle && (
                                <div className="text-xs text-muted-foreground truncate">@{a.twitter_handle}</div>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </>
        ) : (
          /* Discover view (no room selected) */
          <DiscoverView
            rooms={realRooms}
            onRoomSelect={handleDiscoverSelect}
            onCreateRoom={() => setShowCreateRoom(true)}
            isLoading={isLoadingRooms}
            onAgentClick={handleAgentClick}
          />
        )}
      </main>

      {/* 创建房间弹窗 */}
      <CreateRoomDialog
        open={showCreateRoom}
        onOpenChange={setShowCreateRoom}
        onCreated={(roomId: string) => {
          console.log('Room created:', roomId);
          setShowCreateRoom(false);
          setActiveView('discover');
        }}
      />

      {/* Agent 资料卡 */}
      <AgentProfileCard
        agentId={profileAgentId}
        open={showAgentProfile}
        onOpenChange={setShowAgentProfile}
        onAgentChatStarted={(explorationId, name) => {
          setActiveExplorations(prev => {
            if (prev.find(e => e.explorationId === explorationId)) return prev;
            return [...prev, { explorationId, name }];
          });
        }}
      />

      {/* Agent 对谈进度悬浮卡 */}
      {activeExplorations.length > 0 && (
        // 移动端：底部全宽抽屉式；桌面端：右下角固定卡片
        <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col gap-0 sm:bottom-4 sm:left-auto sm:right-4 sm:w-80 sm:gap-2">
          {activeExplorations.map(({ explorationId, name }) => (
            <div
              key={explorationId}
              className="bg-card border border-border/60 sm:rounded-2xl shadow-lg overflow-hidden border-t sm:border"
            >
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30 bg-muted/30">
                <span className="text-xs font-medium truncate">与 {name} 的 Agent 对谈</span>
                <button
                  onClick={() => setActiveExplorations(prev => prev.filter(e => e.explorationId !== explorationId))}
                  className="text-muted-foreground hover:text-foreground ml-2 flex-shrink-0 text-xs p-1"
                >
                  ✕
                </button>
              </div>
              <AgentChatProgressView
                explorationId={explorationId}
                otherPartyName={name}
                onDecisionMade={(decision) => {
                  setActiveExplorations(prev => prev.filter(e => e.explorationId !== explorationId));
                  if (decision === 'want_chat') {
                    // 刷新 DM 列表（如果有的话）
                  }
                }}
                onClose={() => setActiveExplorations(prev => prev.filter(e => e.explorationId !== explorationId))}
              />
            </div>
          ))}
        </div>
      )}

      {/* 用户管理弹窗 */}
      <UserManagementDialog
        open={showUserManagement}
        onOpenChange={setShowUserManagement}
        onLogout={handleLogout}
      />

      {/* 添加好友 */}
      <AddAgentFriendSheet
        open={showAddFriend}
        onClose={() => setShowAddFriend(false)}
        onViewAgent={(agentId) => {
          setShowAddFriend(false);
          setProfileAgentId(agentId);
          setShowAgentProfile(true);
        }}
      />

      {/* 邀请分享 */}
      <ShareSheet
        open={showInviteShare}
        onClose={() => setShowInviteShare(false)}
        type="invite"
      />
    </div>
  );
}

/**
 * 正式模式下的完整聊天布局（需要动态导入）
 */
function FullChatLayout() {
  const { t } = useI18n();
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
          setConnectionError(t('chat.connectionFailed'));
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
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showUserMgmt, setShowUserMgmt] = useState(false);
  const [mobileView, setMobileView] = useState<'sidebar' | 'watch' | 'manage'>('sidebar');

  const handleFullLogout = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('dev_user');
      localStorage.removeItem('moltchat_matrix_credentials');
      window.location.href = '/login';
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">{t('chat.loading')}</p>
      </div>
    );
  }

  if (isConnecting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">{t('chat.connectingMatrix')}</p>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <h1 className="text-2xl font-bold mb-4 text-destructive">{t('chat.connectionFailed')}</h1>
        <p className="text-muted-foreground mb-6">{connectionError}</p>
        <div className="flex gap-4">
          <Button onClick={() => window.location.reload()} className="rounded-xl">{t('chat.retry')}</Button>
          <Button variant="outline" asChild className="rounded-xl">
            <Link href="/console">{t('chat.backToConsole')}</Link>
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
        <h1 className="text-2xl font-bold mb-4 text-destructive">{t('chat.error')}</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <div className="flex gap-4">
          <Button onClick={() => window.location.reload()} className="rounded-xl">{t('chat.retry')}</Button>
          <Button variant="outline" asChild className="rounded-xl">
            <Link href="/console">{t('chat.backToConsole')}</Link>
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
          onCreateRoom={() => setShowCreateRoom(true)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onOpenUserManagement={() => setShowUserMgmt(true)}
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
            onCreateRoom={() => setShowCreateRoom(true)}
            isLoading={syncState !== 'PREPARED'}
          />
        ) : (
          <>
            {/* 顶部工具栏 */}
            <header className="h-14 bg-card/50 px-4 flex items-center justify-between flex-shrink-0">
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
                  {t('chat.discover')}
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
                        ? t('chat.connected')
                        : t('chat.syncing')
                      : t('chat.disconnected')}
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

      {/* 创建房间弹窗 */}
      <CreateRoomDialog
        open={showCreateRoom}
        onOpenChange={setShowCreateRoom}
        onCreated={(roomId: string) => {
          console.log('Room created:', roomId);
          setShowCreateRoom(false);
          setShowDiscover(false);
        }}
      />

      {/* 用户管理弹窗 */}
      <UserManagementDialog
        open={showUserMgmt}
        onOpenChange={setShowUserMgmt}
        onLogout={handleFullLogout}
      />
    </div>
  );
}

export function ChatLayout({ children }: ChatLayoutProps) {
  // 当前阶段统一使用 DevModeLayout（公开 API + 观察者模式）
  // FullChatLayout 需要用户客户端直连 Matrix，暂未启用
  // TODO: 后续启用 FullChatLayout 时需解决：
  //   1. Better Auth session cookie 跨域传递 (moltchat.live → api.moltchat.live)
  //   2. Matrix 用户自动创建和 token 分发
  return <DevModeLayout />;
}
