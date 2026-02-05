/**
 * Matrix Store - Zustand 状态管理
 * 
 * 管理 Matrix 客户端状态、房间、消息等
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { MoltRoom, MoltMessage, MoltMember, SyncState, MatrixClientConfig } from '@/lib/matrix/types';
import {
  initMatrixClient,
  startSync,
  stopMatrixClient,
  getJoinedRooms,
  getRoom,
  convertToMoltRoom,
  convertToMoltMessage,
  getRoomMembers,
  on,
  off,
  reconnectListeners,
} from '@/lib/matrix/client';
import type { Room, MatrixEvent, RoomMember } from 'matrix-js-sdk';

interface MatrixState {
  // 连接状态
  isConnected: boolean;
  syncState: SyncState | null;
  error: string | null;

  // 房间数据
  rooms: MoltRoom[];
  activeRoomId: string | null;

  // 消息数据（按房间 ID 索引）
  messages: Record<string, MoltMessage[]>;

  // 成员数据（按房间 ID 索引）
  members: Record<string, MoltMember[]>;

  // 输入状态（按房间 ID 索引）
  typingUsers: Record<string, string[]>;

  // 操作
  connect: (config: MatrixClientConfig) => Promise<void>;
  disconnect: () => Promise<void>;
  setActiveRoom: (roomId: string | null) => void;
  setSyncState: (state: SyncState | null) => void;
  setRooms: (rooms: MoltRoom[]) => void;
  updateRoom: (room: MoltRoom) => void;
  setMessages: (roomId: string, messages: MoltMessage[]) => void;
  addMessage: (roomId: string, message: MoltMessage) => void;
  addMessages: (roomId: string, messages: MoltMessage[]) => void;
  setMembers: (roomId: string, members: MoltMember[]) => void;
  setTypingUsers: (roomId: string, userIds: string[]) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  isConnected: false,
  syncState: null,
  error: null,
  rooms: [],
  activeRoomId: null,
  messages: {},
  members: {},
  typingUsers: {},
};

export const useMatrixStore = create<MatrixState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // 连接到 Matrix
    connect: async (config: MatrixClientConfig) => {
      try {
        set({ error: null });

        // 初始化客户端
        await initMatrixClient(config);

        // 注册事件监听器
        setupEventListeners(set, get);

        // 开始同步
        await startSync();

        set({ isConnected: true });

        // 保存凭据以便自动重连
        if (typeof window !== 'undefined') {
          localStorage.setItem('moltchat_matrix_credentials', JSON.stringify(config));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '连接失败';
        set({ error: message, isConnected: false });
        throw error;
      }
    },

    // 断开连接
    disconnect: async () => {
      await stopMatrixClient();
      set(initialState);

      // 清除存储的凭据
      if (typeof window !== 'undefined') {
        localStorage.removeItem('moltchat_matrix_credentials');
      }
    },

    // 设置活跃房间
    setActiveRoom: (roomId: string | null) => {
      set({ activeRoomId: roomId });
    },

    // 设置同步状态
    setSyncState: (state: SyncState | null) => {
      set({ syncState: state });
    },

    // 设置房间列表
    setRooms: (rooms: MoltRoom[]) => {
      set({ rooms });
    },

    // 更新单个房间
    updateRoom: (room: MoltRoom) => {
      set((state) => ({
        rooms: state.rooms.map(r => 
          r.roomId === room.roomId ? room : r
        ),
      }));
    },

    // 设置房间消息
    setMessages: (roomId: string, messages: MoltMessage[]) => {
      set((state) => ({
        messages: {
          ...state.messages,
          [roomId]: messages,
        },
      }));
    },

    // 添加单条消息
    addMessage: (roomId: string, message: MoltMessage) => {
      set((state) => {
        const existingMessages = state.messages[roomId] || [];
        // 避免重复
        if (existingMessages.some(m => m.eventId === message.eventId)) {
          return state;
        }
        return {
          messages: {
            ...state.messages,
            [roomId]: [...existingMessages, message],
          },
        };
      });
    },

    // 添加多条消息（用于加载历史）
    addMessages: (roomId: string, messages: MoltMessage[]) => {
      set((state) => {
        const existingMessages = state.messages[roomId] || [];
        const existingIds = new Set(existingMessages.map(m => m.eventId));
        const newMessages = messages.filter(m => !existingIds.has(m.eventId));
        
        // 合并并按时间排序
        const allMessages = [...newMessages, ...existingMessages]
          .sort((a, b) => a.timestamp - b.timestamp);
        
        return {
          messages: {
            ...state.messages,
            [roomId]: allMessages,
          },
        };
      });
    },

    // 设置房间成员
    setMembers: (roomId: string, members: MoltMember[]) => {
      set((state) => ({
        members: {
          ...state.members,
          [roomId]: members,
        },
      }));
    },

    // 设置输入状态
    setTypingUsers: (roomId: string, userIds: string[]) => {
      set((state) => ({
        typingUsers: {
          ...state.typingUsers,
          [roomId]: userIds,
        },
      }));
    },

    // 设置错误
    setError: (error: string | null) => {
      set({ error });
    },

    // 重置状态
    reset: () => {
      set(initialState);
    },
  }))
);

/**
 * 设置 Matrix 事件监听器
 */
function setupEventListeners(
  set: (state: Partial<MatrixState> | ((state: MatrixState) => Partial<MatrixState>)) => void,
  get: () => MatrixState
) {
  // 同步状态变化
  on('sync', (state: unknown) => {
    set({ syncState: state as SyncState });

    // 初始同步完成后加载房间
    if (state === 'PREPARED') {
      const rooms = getJoinedRooms().map(convertToMoltRoom);
      set({ rooms: rooms.sort((a, b) => b.timestamp - a.timestamp) });
    }
  });

  // 新消息
  on('Room.timeline', (event: unknown, room: unknown) => {
    const matrixEvent = event as MatrixEvent;
    const matrixRoom = room as Room;
    
    if (!matrixRoom || matrixEvent.getType() !== 'm.room.message') return;

    const message = convertToMoltMessage(matrixEvent, matrixRoom);
    
    // 添加消息到 store
    get().addMessage(matrixRoom.roomId, message);

    // 更新房间最后消息
    const updatedRoom = convertToMoltRoom(matrixRoom);
    get().updateRoom(updatedRoom);
  });

  // 输入状态
  on('RoomMember.typing', (event: unknown, member: unknown) => {
    const matrixMember = member as RoomMember;
    const roomId = matrixMember.roomId;
    const room = getRoom(roomId);
    
    if (room) {
      const typingMembers = room.currentState.getStateEvents('m.typing', '')?.getContent()?.user_ids || [];
      set((state) => ({
        typingUsers: {
          ...state.typingUsers,
          [roomId]: typingMembers,
        },
      }));
    }
  });

  // 房间成员变化
  on('RoomMember.membership', (event: unknown, member: unknown) => {
    const matrixMember = member as RoomMember;
    const roomId = matrixMember.roomId;
    
    // 刷新成员列表
    const members = getRoomMembers(roomId);
    set((state) => ({
      members: {
        ...state.members,
        [roomId]: members,
      },
    }));

    // 刷新房间列表
    const rooms = getJoinedRooms().map(convertToMoltRoom);
    set({ rooms: rooms.sort((a, b) => b.timestamp - a.timestamp) });
  });

  // 房间名称变化
  on('Room.name', (room: unknown) => {
    const matrixRoom = room as Room;
    const updatedRoom = convertToMoltRoom(matrixRoom);
    get().updateRoom(updatedRoom);
  });

  // 错误处理
  on('sync.error', (error: unknown) => {
    console.error('Matrix 同步错误:', error);
    set({ error: '同步错误，请刷新页面重试' });
  });
}

/**
 * 选择器：获取活跃房间
 */
export const selectActiveRoom = (state: MatrixState): MoltRoom | null => {
  if (!state.activeRoomId) return null;
  return state.rooms.find(r => r.roomId === state.activeRoomId) || null;
};

/**
 * 选择器：获取活跃房间的消息
 */
export const selectActiveMessages = (state: MatrixState): MoltMessage[] => {
  if (!state.activeRoomId) return [];
  return state.messages[state.activeRoomId] || [];
};

/**
 * 选择器：获取活跃房间的成员
 */
export const selectActiveMembers = (state: MatrixState): MoltMember[] => {
  if (!state.activeRoomId) return [];
  return state.members[state.activeRoomId] || [];
};

/**
 * 选择器：获取未读总数
 */
export const selectTotalUnreadCount = (state: MatrixState): number => {
  return state.rooms.reduce((sum, room) => sum + room.unreadCount, 0);
};
