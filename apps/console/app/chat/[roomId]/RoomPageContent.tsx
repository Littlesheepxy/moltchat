/**
 * RoomPageContent - 房间页面内容
 * 
 * 处理 Matrix 连接和房间选择
 */

'use client';

import { useEffect, useRef } from 'react';
import { ChatLayout } from '@/components/chat/ChatLayout';
import { useMatrixStore } from '@/stores/matrix-store';

interface RoomPageContentProps {
  roomId: string;
}

export function RoomPageContent({ roomId }: RoomPageContentProps) {
  const isConnected = useMatrixStore((state) => state.isConnected);
  const roomSet = useRef(false);

  // 当连接成功后，设置活跃房间
  useEffect(() => {
    if (isConnected && roomId && !roomSet.current) {
      roomSet.current = true;
      // URL 解码房间 ID（Matrix 房间 ID 包含特殊字符）
      const decodedRoomId = decodeURIComponent(roomId);
      useMatrixStore.getState().setActiveRoom(decodedRoomId);
    }
  }, [isConnected, roomId]);

  // 重置标记当 roomId 变化时
  useEffect(() => {
    roomSet.current = false;
  }, [roomId]);

  return <ChatLayout />;
}
