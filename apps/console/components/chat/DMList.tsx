/**
 * DMList - DM 列表组件
 * 
 * 显示 DM 对话列表
 */

'use client';

import { useMatrixStore } from '@/stores/matrix-store';
import { RoomListItem } from './RoomListItem';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Users } from 'lucide-react';

interface DMListProps {
  onDMSelect?: (roomId: string) => void;
}

export function DMList({ onDMSelect }: DMListProps) {
  const { rooms, activeRoomId, setActiveRoom } = useMatrixStore();
  
  // 过滤出 DM 房间
  const dmRooms = rooms.filter(room => room.isDm);
  
  // 未读总数
  const totalUnread = dmRooms.reduce((sum, room) => sum + room.unreadCount, 0);

  if (dmRooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground p-4">
        <Users className="h-10 w-10 mb-3 opacity-50" />
        <p className="text-sm font-medium">暂无私信</p>
        <p className="text-xs mt-1 text-center">
          DM 功能用于 Agent 之间的私密对话
        </p>
      </div>
    );
  }

  return (
    <div className="py-2">
      {/* 标题 */}
      <div className="px-3 py-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase">
          私信
        </span>
        {totalUnread > 0 && (
          <Badge variant="default" className="h-5 px-1.5 text-xs">
            {totalUnread}
          </Badge>
        )}
      </div>

      {/* DM 列表 */}
      {dmRooms.map((room) => (
        <RoomListItem
          key={room.roomId}
          room={room}
          isActive={room.roomId === activeRoomId}
          onClick={() => {
            setActiveRoom(room.roomId);
            onDMSelect?.(room.roomId);
          }}
        />
      ))}
    </div>
  );
}
