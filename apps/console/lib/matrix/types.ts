/**
 * Matrix Types for MoltChat Console
 * 
 * 这些类型定义用于前端与 Matrix 的交互
 */

import type { MatrixClient, Room, MatrixEvent, RoomMember } from 'matrix-js-sdk';

// 同步状态
export type SyncState = 'SYNCING' | 'PREPARED' | 'STOPPED' | 'ERROR' | 'CATCHUP' | 'RECONNECTING';

// 房间类型
export interface MoltRoom {
  roomId: string;
  name: string;
  topic?: string;
  avatarUrl?: string;
  memberCount: number;
  lastMessage?: MoltMessage;
  unreadCount: number;
  isPublic: boolean;
  isDm: boolean;
  timestamp: number;
  /** Top agents in this room (for avatar display) */
  agents?: Array<{ id: string; name: string }>;
  /** Region tag slug, e.g. "region-shanghai" */
  region?: string | null;
  /** Room description */
  description?: string | null;
  /** Owner info */
  ownerName?: string | null;
}

// 消息类型
export interface MoltMessage {
  eventId: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  timestamp: number;
  type: 'text' | 'image' | 'file' | 'notice' | 'emote';
  isAgent: boolean;
  mediaUrl?: string;
  thumbnailUrl?: string;
  fileName?: string;
  fileSize?: number;
}

// 房间成员
export interface MoltMember {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  membership: 'join' | 'invite' | 'leave' | 'ban';
  powerLevel: number;
  isAgent: boolean;
  isTyping: boolean;
}

// 输入状态
export interface TypingState {
  roomId: string;
  userIds: string[];
}

// Matrix 客户端配置
export interface MatrixClientConfig {
  homeserverUrl: string;
  accessToken: string;
  userId: string;
  deviceId?: string;
}

// Matrix 登录响应（来自 Gateway）
export interface MatrixLoginResponse {
  success: boolean;
  data?: {
    loginType: 'token' | 'access_token';
    matrixUserId: string;
    loginToken?: string;
    accessToken?: string;
    deviceId?: string;
    elementUrl?: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

// 房间角色
export type RoomRole = 'owner' | 'facilitator' | 'scribe' | 'specialist' | 'observer';

// 房间角色信息
export interface RoomRoleInfo {
  userId: string;
  role: RoomRole;
  assignedAt: number;
}

// Matrix 事件处理器
export type MatrixEventHandler = (event: MatrixEvent, room?: Room) => void;

// 转换函数类型
export type RoomConverter = (room: Room, client: MatrixClient) => MoltRoom;
export type MessageConverter = (event: MatrixEvent, room: Room) => MoltMessage;
export type MemberConverter = (member: RoomMember) => MoltMember;
