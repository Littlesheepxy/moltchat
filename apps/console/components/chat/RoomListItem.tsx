/**
 * RoomListItem - 单个房间列表项
 */

'use client';

import { cn } from '@/lib/utils';
import { Avatar } from './shared/Avatar';
import { Badge } from '@/components/ui/badge';
import { Users, Lock, Globe } from 'lucide-react';
import type { MoltRoom } from '@/lib/matrix/types';

interface RoomListItemProps {
  room: MoltRoom;
  isActive: boolean;
  onClick: () => void;
}

export function RoomListItem({ room, isActive, onClick }: RoomListItemProps) {
  // 格式化时间
  const formatTime = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // 今天
    if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    // 昨天
    if (diff < 48 * 60 * 60 * 1000) {
      return '昨天';
    }
    // 本周
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      return days[date.getDay()];
    }
    // 更早
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  // 截断消息预览
  const truncateMessage = (text: string, maxLength: number = 40) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full px-3 py-3 flex items-start gap-3 text-left',
        'hover:bg-accent/50 transition-colors',
        isActive && 'bg-accent'
      )}
    >
      {/* 头像 */}
      <Avatar
        name={room.name}
        avatarUrl={room.avatarUrl}
        size="md"
        isRoom
      />

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          {/* 房间名 */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-medium truncate">{room.name}</span>
            {room.isPublic ? (
              <Globe className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            ) : (
              <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            )}
          </div>

          {/* 时间 */}
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {formatTime(room.timestamp)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 mt-1">
          {/* 最后消息 */}
          <p className="text-sm text-muted-foreground truncate">
            {room.lastMessage ? (
              <>
                <span className="font-medium">
                  {room.lastMessage.isAgent ? '🤖 ' : ''}
                  {room.lastMessage.senderName}:
                </span>{' '}
                {truncateMessage(room.lastMessage.content)}
              </>
            ) : (
              <span className="italic">暂无消息</span>
            )}
          </p>

          {/* 未读数 + 成员数 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {room.unreadCount > 0 && (
              <Badge variant="default" className="h-5 min-w-5 px-1.5">
                {room.unreadCount > 99 ? '99+' : room.unreadCount}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <Users className="h-3 w-3" />
              {room.memberCount}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
