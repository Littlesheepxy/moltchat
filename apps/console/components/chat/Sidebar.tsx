/**
 * Sidebar - 侧边栏
 * 
 * 可折叠侧边栏，包含房间列表、搜索、用户中心
 * 折叠模式下显示图标，展开模式下显示完整内容
 */

'use client';

import { useState, useMemo } from 'react';
import { useMatrixStore } from '@/stores/matrix-store';
import { RoomList } from './RoomList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Search, 
  MessageSquare, 
  Users, 
  ChevronLeft, 
  ChevronRight,
  Compass,
  Settings,
  LogOut,
  User,
  Home
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SidebarProps {
  onRoomSelect?: () => void;
  onNavigateToDiscover?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  userName?: string;
  userHandle?: string;
}

export function Sidebar({ 
  onRoomSelect, 
  onNavigateToDiscover,
  isCollapsed = false,
  onToggleCollapse,
  userName = 'User',
  userHandle
}: SidebarProps) {
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
        'flex flex-col h-full bg-card border-r border-border transition-all duration-300',
        sidebarWidth
      )}>
        {/* 头部 */}
        <div className={cn(
          'border-b border-border',
          isCollapsed ? 'p-2' : 'p-4'
        )}>
          <div className={cn(
            'flex items-center',
            isCollapsed ? 'flex-col gap-2' : 'justify-between mb-4'
          )}>
            {isCollapsed ? (
              <>
                {/* 折叠按钮 - 折叠模式 */}
                {onToggleCollapse && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={onToggleCollapse}
                        className="w-10 h-10 rounded-xl"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">展开侧边栏</TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href="/chat" className="flex items-center justify-center w-10 h-10">
                      <Image 
                        src="/logo.png" 
                        alt="MoltChat" 
                        width={32} 
                        height={32} 
                        className="rounded-lg"
                      />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">MoltChat</TooltipContent>
                </Tooltip>
              </>
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
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>折叠侧边栏</TooltipContent>
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
                placeholder="搜索房间..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl"
              />
            </div>
          )}
        </div>

        {/* 导航按钮 */}
        <div className={cn(
          'border-b border-border',
          isCollapsed ? 'p-2 space-y-1' : 'p-2 flex gap-1'
        )}>
          {isCollapsed ? (
            // 折叠模式 - 图标按钮
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
                <TooltipContent side="right">发现</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={filter === 'rooms' ? 'secondary' : 'ghost'}
                    size="icon"
                    onClick={() => setFilter(filter === 'rooms' ? 'all' : 'rooms')}
                    className="w-full h-10 rounded-xl"
                  >
                    <MessageSquare className="h-5 w-5" />
                    {roomCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs w-4 h-4 rounded-full flex items-center justify-center">
                        {roomCount}
                      </span>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">房间 ({roomCount})</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={filter === 'dm' ? 'secondary' : 'ghost'}
                    size="icon"
                    onClick={() => setFilter(filter === 'dm' ? 'all' : 'dm')}
                    className="w-full h-10 rounded-xl"
                  >
                    <Users className="h-5 w-5" />
                    {dmCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs w-4 h-4 rounded-full flex items-center justify-center">
                        {dmCount}
                      </span>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">DM ({dmCount})</TooltipContent>
              </Tooltip>
            </>
          ) : (
            // 展开模式 - 文字按钮
            <>
              <Button
                variant={filter === 'all' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilter('all')}
                className="flex-1 rounded-xl"
              >
                全部
              </Button>
              <Button
                variant={filter === 'rooms' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilter('rooms')}
                className="flex-1 gap-1 rounded-xl"
              >
                <MessageSquare className="h-3 w-3" />
                房间 ({roomCount})
              </Button>
              <Button
                variant={filter === 'dm' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilter('dm')}
                className="flex-1 gap-1 rounded-xl"
              >
                <Users className="h-3 w-3" />
                DM ({dmCount})
              </Button>
            </>
          )}
        </div>

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
          'border-t border-border',
          isCollapsed ? 'p-2 space-y-1' : 'p-3 space-y-2'
        )}>
          {isCollapsed ? (
            // 折叠模式 - 图标按钮
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onNavigateToDiscover}
                    className="w-full h-10 rounded-xl"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">创建房间</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <Button 
              onClick={onNavigateToDiscover}
              className="w-full gap-2 rounded-xl"
            >
              <Compass className="h-4 w-4" />
              发现
            </Button>
          )}

          {/* 用户中心 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  'rounded-xl hover:bg-accent',
                  isCollapsed ? 'w-full h-10 p-0' : 'w-full justify-start gap-3 h-12 px-3'
                )}
              >
                <div className={cn(
                  'rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center',
                  isCollapsed ? 'w-8 h-8' : 'w-8 h-8'
                )}>
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
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              side={isCollapsed ? 'right' : 'top'} 
              align={isCollapsed ? 'start' : 'center'}
              className="w-56 rounded-xl"
            >
              <div className="px-3 py-2">
                <div className="text-sm font-medium">{userName}</div>
                {userHandle && (
                  <div className="text-xs text-muted-foreground">@{userHandle}</div>
                )}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/console/settings" className="cursor-pointer">
                  <Settings className="h-4 w-4 mr-2" />
                  设置
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
      </div>
    </TooltipProvider>
  );
}
