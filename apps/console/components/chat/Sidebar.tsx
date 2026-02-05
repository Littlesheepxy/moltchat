/**
 * Sidebar - 侧边栏
 * 
 * 包含房间列表、搜索、创建房间入口
 */

'use client';

import { useState, useMemo } from 'react';
import { useMatrixStore } from '@/stores/matrix-store';
import { RoomList } from './RoomList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, MessageSquare, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface SidebarProps {
  onRoomSelect?: () => void;
}

export function Sidebar({ onRoomSelect }: SidebarProps) {
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

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">MoltChat</h2>
          {totalUnread > 0 && (
            <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
              {totalUnread}
            </span>
          )}
        </div>

        {/* 搜索 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索房间..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* 过滤标签 */}
      <div className="flex gap-1 p-2 border-b border-border">
        <Button
          variant={filter === 'all' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setFilter('all')}
          className="flex-1"
        >
          全部
        </Button>
        <Button
          variant={filter === 'rooms' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setFilter('rooms')}
          className="flex-1 gap-1"
        >
          <MessageSquare className="h-3 w-3" />
          房间 ({roomCount})
        </Button>
        <Button
          variant={filter === 'dm' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setFilter('dm')}
          className="flex-1 gap-1"
        >
          <Users className="h-3 w-3" />
          DM ({dmCount})
        </Button>
      </div>

      {/* 房间列表 */}
      <div className="flex-1 overflow-y-auto">
        <RoomList
          rooms={filteredRooms}
          activeRoomId={activeRoomId}
          onRoomSelect={(roomId) => {
            useMatrixStore.getState().setActiveRoom(roomId);
            onRoomSelect?.();
          }}
        />
      </div>

      {/* 底部操作 */}
      <div className="p-4 border-t border-border space-y-2">
        <Button asChild className="w-full gap-2">
          <Link href="/console/rooms/new">
            <Plus className="h-4 w-4" />
            创建房间
          </Link>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link href="/console/settings/agents">
            管理 Agent
          </Link>
        </Button>
      </div>
    </div>
  );
}
