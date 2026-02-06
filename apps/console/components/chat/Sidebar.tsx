/**
 * Sidebar - 侧边栏
 * 
 * 可折叠侧边栏，包含房间列表、搜索、用户中心
 * 折叠模式下显示图标，展开模式下显示完整内容
 */

'use client';

import { useState, useMemo } from 'react';
import { useMatrixStore } from '@/stores/matrix-store';
import { useI18n } from '@/lib/i18n-provider';
import { RoomList } from './RoomList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Search, 
  MessageSquare, 
  Users, 
  PanelLeftClose,
  Compass,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import Image from 'next/image';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SidebarProps {
  onRoomSelect?: () => void;
  onNavigateToDiscover?: () => void;
  onCreateRoom?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  userName?: string;
  userHandle?: string;
  onOpenUserManagement?: () => void;
}

export function Sidebar({ 
  onRoomSelect, 
  onNavigateToDiscover,
  onCreateRoom,
  isCollapsed = false,
  onToggleCollapse,
  userName = 'User',
  userHandle,
  onOpenUserManagement,
}: SidebarProps) {
  const { t } = useI18n();
  const rooms = useMatrixStore((state) => state.rooms);
  const activeRoomId = useMatrixStore((state) => state.activeRoomId);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'rooms' | 'dm'>('all');

  // 过滤房间
  const filteredRooms = useMemo(() => {
    let result = rooms;

    // 按类型过滤
    if (filter === 'rooms') {
      result = result.filter(r => !r.isDm);
    } else if (filter === 'dm') {
      result = result.filter(r => r.isDm);
    }

    // 按搜索过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(r => 
        r.name.toLowerCase().includes(query) ||
        r.topic?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [rooms, filter, searchQuery]);

  // 统计
  const totalUnread = rooms.reduce((sum, r) => sum + r.unreadCount, 0);
  const roomCount = rooms.filter(r => !r.isDm).length;
  const dmCount = rooms.filter(r => r.isDm).length;

  // 处理登出
  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('dev_user');
      localStorage.removeItem('moltchat_matrix_credentials');
      window.location.href = '/login';
    }
  };

  // 侧边栏宽度
  const sidebarWidth = isCollapsed ? 'w-16' : 'w-72';

  return (
    <TooltipProvider delayDuration={0}>
      <div className={cn(
        'flex flex-col h-full bg-card border-r border-border/40 transition-all duration-300',
        sidebarWidth
      )}>
        {/* 头部 */}
        <div className={cn(
          isCollapsed ? 'p-2' : 'p-4'
        )}>
          <div className={cn(
            'flex items-center',
            isCollapsed ? 'flex-col gap-2' : 'justify-between mb-4'
          )}>
            {isCollapsed ? (
              /* 折叠模式：Logo 即展开按钮 */
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onToggleCollapse}
                    className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-accent transition-colors"
                  >
                    <Image 
                      src="/logo.png" 
                      alt="MoltChat" 
                      width={32} 
                      height={32} 
                      className="rounded-lg"
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{t('chat.expandSidebar')}</TooltipContent>
              </Tooltip>
            ) : (
              <>
                <Link href="/chat" className="flex items-center gap-2">
                  <Image 
                    src="/logo.png" 
                    alt="MoltChat" 
                    width={28} 
                    height={28} 
                    className="rounded-lg"
                  />
                  <h2 className="text-lg font-semibold">MoltChat</h2>
                </Link>
                <div className="flex items-center gap-2">
                  {totalUnread > 0 && (
                    <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                      {totalUnread}
                    </span>
                  )}
                  {/* 折叠按钮 - 展开模式 */}
                  {onToggleCollapse && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={onToggleCollapse}
                          className="h-8 w-8 rounded-lg"
                        >
                          <PanelLeftClose className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('chat.collapseSidebar')}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </>
            )}
          </div>

          {/* 搜索 - 展开模式 */}
          {!isCollapsed && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('chat.searchRooms')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl"
              />
            </div>
          )}
        </div>

        {/* 导航按钮 */}
        <div className="p-2 space-y-1">
          {isCollapsed ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onNavigateToDiscover}
                    className="w-full h-10 rounded-xl"
                  >
                    <Compass className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">{t('chat.discover')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onCreateRoom}
                    className="w-full h-10 rounded-xl"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">{t('chat.createRoom')}</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={onNavigateToDiscover}
                className="rounded-xl w-full justify-start gap-2"
              >
                <Compass className="h-5 w-5" />
                {t('chat.discover')}
              </Button>
              <Button
                variant="ghost"
                onClick={onCreateRoom}
                className="rounded-xl w-full justify-start gap-2"
              >
                <Plus className="h-5 w-5" />
                {t('chat.createRoom')}
              </Button>
            </>
          )}
        </div>

        {/* 筛选 - 展开模式 */}
        {!isCollapsed && (
          <div className="px-2 flex gap-1">
            <Button
              variant={filter === 'all' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilter('all')}
              className="flex-1 rounded-xl"
            >
              {t('chat.filterAll')}
            </Button>
            <Button
              variant={filter === 'rooms' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilter('rooms')}
              className="flex-1 gap-1 rounded-xl"
            >
              <MessageSquare className="h-3 w-3" />
              {t('chat.filterRooms')} ({roomCount})
            </Button>
            <Button
              variant={filter === 'dm' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilter('dm')}
              className="flex-1 gap-1 rounded-xl"
            >
              <Users className="h-3 w-3" />
              {t('chat.filterDM')} ({dmCount})
            </Button>
          </div>
        )}

        {/* 房间列表 */}
        <div className="flex-1 overflow-y-auto">
          {isCollapsed ? (
            // 折叠模式 - 显示房间图标
            <div className="p-2 space-y-1">
              {filteredRooms.slice(0, 8).map((room) => (
                <Tooltip key={room.roomId}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={activeRoomId === room.roomId ? 'secondary' : 'ghost'}
                      size="icon"
                      onClick={() => {
                        useMatrixStore.getState().setActiveRoom(room.roomId);
                        onRoomSelect?.();
                      }}
                      className="w-full h-10 rounded-xl relative"
                    >
                      <span className="text-sm font-medium">
                        {room.name.charAt(0).toUpperCase()}
                      </span>
                      {room.unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs w-4 h-4 rounded-full flex items-center justify-center">
                          {room.unreadCount > 9 ? '9+' : room.unreadCount}
                        </span>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {room.name}
                    {room.unreadCount > 0 && ` (${room.unreadCount})`}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          ) : (
            <RoomList
              rooms={filteredRooms}
              activeRoomId={activeRoomId}
              onRoomSelect={(roomId: string) => {
                useMatrixStore.getState().setActiveRoom(roomId);
                onRoomSelect?.();
              }}
            />
          )}
        </div>

        {/* 底部操作区 */}
        <div className={cn(
          isCollapsed ? 'p-2' : 'p-3'
        )}>
          {/* 用户中心 */}
          <Button
            variant="ghost"
            onClick={() => onOpenUserManagement?.()}
            className={cn(
              'rounded-xl hover:bg-accent',
              isCollapsed ? 'w-full h-10 p-0' : 'w-full justify-start gap-3 h-12 px-3'
            )}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            {!isCollapsed && (
              <div className="flex-1 text-left min-w-0">
                <div className="text-sm font-medium truncate">{userName}</div>
                {userHandle && (
                  <div className="text-xs text-muted-foreground truncate">@{userHandle}</div>
                )}
              </div>
            )}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}
