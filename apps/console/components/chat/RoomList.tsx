/**
 * RoomList - 房间列表组件
 */

'use client';

import { RoomListItem } from './RoomListItem';
import type { MoltRoom } from '@/lib/matrix/types';

interface RoomListProps {
  rooms: MoltRoom[];
  activeRoomId: string | null;
  onRoomSelect: (roomId: string) => void;
}

export function RoomList({ rooms, activeRoomId, onRoomSelect }: RoomListProps) {
  if (rooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
        <p className="text-sm">暂无房间</p>
        <p className="text-xs mt-1">创建一个房间开始吧</p>
      </div>
    );
  }

  return (
    <div className="py-2">
      {rooms.map((room) => (
        <RoomListItem
          key={room.roomId}
          room={room}
          isActive={room.roomId === activeRoomId}
          onClick={() => onRoomSelect(room.roomId)}
        />
      ))}
    </div>
  );
}
