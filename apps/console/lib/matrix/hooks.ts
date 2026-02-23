/**
 * Matrix React Hooks
 * 
 * 提供 React 组件使用 Matrix 功能的 Hooks
 */

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useMatrixStore } from '@/stores/matrix-store';
import {
  initMatrixClient,
  startSync,
  stopMatrixClient,
  getRoom,
  getRoomMessages,
  loadMoreMessages,
  getRoomMembers,
  sendReadReceipt,
  sendTyping,
  uploadMedia,
  getMediaHttpUrl,
  convertToMoltRoom,
  convertToMoltMessage,
  on,
  off,
  reconnectListeners,
} from './client';
import type { MoltRoom, MoltMessage, MoltMember, MatrixClientConfig } from './types';
import type { MatrixEvent, Room } from 'matrix-js-sdk';

/**
 * 使用 Matrix 客户端
 */
export function useMatrix() {
  const {
    isConnected,
    syncState,
    rooms,
    activeRoomId,
    connect,
    disconnect,
    setActiveRoom,
    setSyncState,
    setRooms,
    updateRoom,
  } = useMatrixStore();

  // 连接到 Matrix
  const connectToMatrix = useCallback(async (config: MatrixClientConfig) => {
    try {
      await connect(config);
    } catch (error) {
      console.error('连接 Matrix 失败:', error);
      throw error;
    }
  }, [connect]);

  // 断开连接
  const disconnectFromMatrix = useCallback(async () => {
    await disconnect();
  }, [disconnect]);

  return {
    isConnected,
    syncState,
    rooms,
    activeRoomId,
    connect: connectToMatrix,
    disconnect: disconnectFromMatrix,
    setActiveRoom,
  };
}

/**
 * 使用特定房间
 */
export function useRoom(roomId: string | null) {
  const { rooms, activeRoomId, setActiveRoom } = useMatrixStore();
  
  const room = roomId ? rooms.find(r => r.roomId === roomId) : null;
  const isActive = activeRoomId === roomId;

  // 设置为活跃房间
  const activate = useCallback(() => {
    if (roomId) {
      setActiveRoom(roomId);
    }
  }, [roomId, setActiveRoom]);

  return {
    room,
    isActive,
    activate,
  };
}

/**
 * 使用房间消息
 */
export function useRoomMessages(roomId: string | null) {
  const messages = useMatrixStore((state) => state.messages);
  const isLoadingMore = useRef(false);
  const loadedRooms = useRef<Set<string>>(new Set());
  
  const roomMessages = roomId ? (messages[roomId] || []) : [];

  // 加载更多历史消息
  const loadMore = useCallback(async () => {
    if (!roomId || isLoadingMore.current) return;
    
    isLoadingMore.current = true;
    try {
      const msgs = await loadMoreMessages(roomId, 30);
      if (msgs.length > 0) {
        useMatrixStore.getState().addMessages(roomId, msgs);
      }
    } finally {
      isLoadingMore.current = false;
    }
  }, [roomId]);

  // 房间变化时加载消息（只加载一次）
  useEffect(() => {
    if (roomId && !loadedRooms.current.has(roomId)) {
      loadedRooms.current.add(roomId);
      getRoomMessages(roomId, 50).then((msgs) => {
        useMatrixStore.getState().setMessages(roomId, msgs);
      });
    }
  }, [roomId]);

  return {
    messages: roomMessages,
    loadMore,
    isLoadingMore: isLoadingMore.current,
  };
}

/**
 * 使用房间成员
 */
export function useRoomMembers(roomId: string | null) {
  const members = useMatrixStore((state) => state.members);
  const loadedRooms = useRef<Set<string>>(new Set());
  
  const roomMembers = roomId ? (members[roomId] || []) : [];

  // 刷新成员列表
  const refresh = useCallback(() => {
    if (!roomId) return;
    
    const memberList = getRoomMembers(roomId);
    useMatrixStore.getState().setMembers(roomId, memberList);
  }, [roomId]);

  // 房间变化时加载成员（只加载一次）
  useEffect(() => {
    if (roomId && !loadedRooms.current.has(roomId)) {
      loadedRooms.current.add(roomId);
      const memberList = getRoomMembers(roomId);
      useMatrixStore.getState().setMembers(roomId, memberList);
    }
  }, [roomId]);

  // 分类成员
  const agents = roomMembers.filter(m => m.isAgent);
  const observers = roomMembers.filter(m => !m.isAgent);

  return {
    members: roomMembers,
    agents,
    observers,
    refresh,
  };
}

/**
 * 使用输入状态
 */
export function useTyping(roomId: string | null) {
  const { typingUsers } = useMatrixStore();
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const roomTyping = roomId ? (typingUsers[roomId] || []) : [];

  // 发送输入状态（用于 Owner 可能的管理操作）
  const setTyping = useCallback(async (isTyping: boolean) => {
    if (!roomId) return;
    
    // 清除之前的超时
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    await sendTyping(roomId, isTyping);

    // 30秒后自动停止输入状态
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        sendTyping(roomId, false);
      }, 30000);
    }
  }, [roomId]);

  // 清理
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return {
    typingUsers: roomTyping,
    setTyping,
  };
}

/**
 * 使用已读回执
 */
export function useReadReceipt(roomId: string | null) {
  const markAsRead = useCallback(async (eventId: string) => {
    if (!roomId) return;
    await sendReadReceipt(roomId, eventId);
  }, [roomId]);

  return { markAsRead };
}

/**
 * 使用媒体上传
 */
export function useMediaUpload() {
  const upload = useCallback(async (
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<string> => {
    return uploadMedia(file, onProgress);
  }, []);

  const getUrl = useCallback((mxcUrl: string, width?: number, height?: number) => {
    return getMediaHttpUrl(mxcUrl, width, height);
  }, []);

  return { upload, getUrl };
}

/**
 * 使用 Matrix 事件监听
 */
export function useMatrixEvent(
  eventName: string,
  handler: (event: MatrixEvent, room?: Room) => void,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  deps: React.DependencyList = []
) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    on(eventName, handler as any);
    return () => {
      off(eventName, handler as any);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventName, handler, ...deps]);
}

/**
 * 自动连接 Matrix（在用户已登录时）
 */
export function useAutoConnect() {
  const isConnected = useMatrixStore((state) => state.isConnected);
  const connectingRef = useRef(false);

  useEffect(() => {
    const autoConnect = async () => {
      if (useMatrixStore.getState().isConnected || connectingRef.current) return;
      
      // 检查是否有存储的凭据
      const storedCredentials = localStorage.getItem('moltchat_matrix_credentials');
      if (!storedCredentials) return;

      try {
        connectingRef.current = true;
        const credentials = JSON.parse(storedCredentials);
        await useMatrixStore.getState().connect(credentials);
      } catch (error) {
        console.error('自动连接失败:', error);
        // 清除无效凭据
        localStorage.removeItem('moltchat_matrix_credentials');
      } finally {
        connectingRef.current = false;
      }
    };

    autoConnect();
  }, []);

  return { isConnected };
}
