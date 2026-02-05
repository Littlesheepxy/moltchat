/**
 * Matrix Client Manager
 * 
 * 管理 Matrix 客户端的初始化、连接和生命周期
 */

import * as sdk from 'matrix-js-sdk';
import type { MatrixClient, Room, MatrixEvent, ICreateClientOpts } from 'matrix-js-sdk';
import type { MatrixClientConfig, MoltRoom, MoltMessage, MoltMember, SyncState } from './types';

// 全局客户端实例
let matrixClient: MatrixClient | null = null;

// 事件监听器
const eventListeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();

/**
 * 获取 Matrix 客户端实例
 */
export function getMatrixClient(): MatrixClient | null {
  return matrixClient;
}

/**
 * 检查是否已连接
 */
export function isConnected(): boolean {
  return matrixClient !== null && matrixClient.isLoggedIn();
}

/**
 * 初始化 Matrix 客户端
 */
export async function initMatrixClient(config: MatrixClientConfig): Promise<MatrixClient> {
  // 如果已有客户端，先停止
  if (matrixClient) {
    await stopMatrixClient();
  }

  const clientOpts: ICreateClientOpts = {
    baseUrl: config.homeserverUrl,
    accessToken: config.accessToken,
    userId: config.userId,
    deviceId: config.deviceId,
    timelineSupport: true,
    useAuthorizationHeader: true,
  };

  // 创建客户端
  matrixClient = sdk.createClient(clientOpts);

  // 配置 IndexedDB 存储（如果浏览器支持）
  if (typeof window !== 'undefined' && window.indexedDB) {
    try {
      const store = new sdk.IndexedDBStore({
        indexedDB: window.indexedDB,
        dbName: 'moltchat-matrix-store',
        localStorage: window.localStorage,
      });
      await store.startup();
      
      // 重新创建带存储的客户端
      matrixClient = sdk.createClient({
        ...clientOpts,
        store,
      });
    } catch (err) {
      console.warn('IndexedDB 存储初始化失败，使用内存存储:', err);
    }
  }

  return matrixClient;
}

/**
 * 启动客户端同步
 */
export async function startSync(initialSyncLimit: number = 20): Promise<void> {
  if (!matrixClient) {
    throw new Error('Matrix 客户端未初始化');
  }

  await matrixClient.startClient({
    initialSyncLimit,
    lazyLoadMembers: true,
  });
}

/**
 * 停止 Matrix 客户端
 */
export async function stopMatrixClient(): Promise<void> {
  if (matrixClient) {
    matrixClient.stopClient();
    await matrixClient.logout().catch(() => {});
    matrixClient = null;
  }
  eventListeners.clear();
}

/**
 * 获取当前同步状态
 */
export function getSyncState(): SyncState | null {
  if (!matrixClient) return null;
  return matrixClient.getSyncState() as SyncState;
}

/**
 * 获取所有已加入的房间
 */
export function getJoinedRooms(): Room[] {
  if (!matrixClient) return [];
  return matrixClient.getRooms().filter(room => room.getMyMembership() === 'join');
}

/**
 * 获取房间
 */
export function getRoom(roomId: string): Room | null {
  if (!matrixClient) return null;
  return matrixClient.getRoom(roomId);
}

/**
 * 发送已读回执
 */
export async function sendReadReceipt(roomId: string, eventId: string): Promise<void> {
  if (!matrixClient) return;
  const room = matrixClient.getRoom(roomId);
  if (!room) return;
  
  const event = room.findEventById(eventId);
  if (event) {
    await matrixClient.sendReadReceipt(event);
  }
}

/**
 * 发送输入状态
 */
export async function sendTyping(roomId: string, isTyping: boolean, timeout: number = 30000): Promise<void> {
  if (!matrixClient) return;
  await matrixClient.sendTyping(roomId, isTyping, timeout);
}

/**
 * 上传媒体文件
 */
export async function uploadMedia(file: File, onProgress?: (percent: number) => void): Promise<string> {
  if (!matrixClient) {
    throw new Error('Matrix 客户端未初始化');
  }

  const response = await matrixClient.uploadContent(file, {
    name: file.name,
    type: file.type,
    progressHandler: (progress: { loaded: number; total: number }) => {
      if (onProgress && progress.total > 0) {
        onProgress(Math.round((progress.loaded / progress.total) * 100));
      }
    },
  });

  return response.content_uri;
}

/**
 * 获取媒体 HTTP URL
 */
export function getMediaHttpUrl(mxcUrl: string, width?: number, height?: number): string | null {
  if (!matrixClient || !mxcUrl) return null;
  
  if (width && height) {
    return matrixClient.mxcUrlToHttp(mxcUrl, width, height, 'scale', false);
  }
  return matrixClient.mxcUrlToHttp(mxcUrl);
}

/**
 * 转换 Matrix Room 到 MoltRoom
 */
export function convertToMoltRoom(room: Room): MoltRoom {
  const lastEvent = room.timeline[room.timeline.length - 1];
  const client = getMatrixClient();
  
  let lastMessage: MoltMessage | undefined;
  if (lastEvent && lastEvent.getType() === 'm.room.message') {
    lastMessage = convertToMoltMessage(lastEvent, room);
  }

  // 判断是否是 DM
  const isDm = room.getDMInviter() !== undefined || 
    (room.getJoinedMemberCount() === 2 && !room.isSpaceRoom());

  return {
    roomId: room.roomId,
    name: room.name || '未命名房间',
    topic: room.currentState.getStateEvents('m.room.topic', '')?.getContent()?.topic,
    avatarUrl: room.getAvatarUrl(client?.getHomeserverUrl() || '', 48, 48, 'crop') || undefined,
    memberCount: room.getJoinedMemberCount(),
    lastMessage,
    unreadCount: room.getUnreadNotificationCount() || 0,
    isPublic: room.getJoinRule() === 'public',
    isDm,
    timestamp: lastEvent?.getTs() || 0,
  };
}

/**
 * 转换 Matrix Event 到 MoltMessage
 */
export function convertToMoltMessage(event: MatrixEvent, room: Room): MoltMessage {
  const content = event.getContent();
  const sender = room.getMember(event.getSender() || '');
  const client = getMatrixClient();
  
  // 判断发送者是否是 Agent（通过 userId 前缀判断）
  const senderId = event.getSender() || '';
  const isAgent = senderId.startsWith('@agent_') || senderId.includes('_agent_');

  // 确定消息类型
  let type: MoltMessage['type'] = 'text';
  let mediaUrl: string | undefined;
  let thumbnailUrl: string | undefined;
  let fileName: string | undefined;
  let fileSize: number | undefined;

  const msgtype = content.msgtype;
  if (msgtype === 'm.image') {
    type = 'image';
    mediaUrl = getMediaHttpUrl(content.url) || undefined;
    if (content.info?.thumbnail_url) {
      thumbnailUrl = getMediaHttpUrl(content.info.thumbnail_url, 320, 240) || undefined;
    }
  } else if (msgtype === 'm.file') {
    type = 'file';
    mediaUrl = getMediaHttpUrl(content.url) || undefined;
    fileName = content.body;
    fileSize = content.info?.size;
  } else if (msgtype === 'm.notice') {
    type = 'notice';
  } else if (msgtype === 'm.emote') {
    type = 'emote';
  }

  return {
    eventId: event.getId() || '',
    roomId: room.roomId,
    senderId,
    senderName: sender?.name || senderId.split(':')[0].substring(1),
    senderAvatar: sender?.getAvatarUrl(client?.getHomeserverUrl() || '', 40, 40, 'crop', false, false) || undefined,
    content: content.body || '',
    timestamp: event.getTs(),
    type,
    isAgent,
    mediaUrl,
    thumbnailUrl,
    fileName,
    fileSize,
  };
}

/**
 * 转换房间成员
 */
export function convertToMoltMember(member: sdk.RoomMember, typingUserIds: string[] = []): MoltMember {
  const client = getMatrixClient();
  const userId = member.userId;
  const isAgent = userId.startsWith('@agent_') || userId.includes('_agent_');

  return {
    userId,
    displayName: member.name || userId.split(':')[0].substring(1),
    avatarUrl: member.getAvatarUrl(client?.getHomeserverUrl() || '', 40, 40, 'crop', false, false) || undefined,
    membership: member.membership as MoltMember['membership'],
    powerLevel: member.powerLevel,
    isAgent,
    isTyping: typingUserIds.includes(userId),
  };
}

/**
 * 获取房间消息历史
 */
export async function getRoomMessages(roomId: string, limit: number = 50): Promise<MoltMessage[]> {
  if (!matrixClient) return [];
  
  const room = matrixClient.getRoom(roomId);
  if (!room) return [];

  // 获取时间线事件
  const timeline = room.getLiveTimeline();
  const events = timeline.getEvents();

  // 过滤消息事件并转换
  return events
    .filter(event => event.getType() === 'm.room.message')
    .slice(-limit)
    .map(event => convertToMoltMessage(event, room));
}

/**
 * 加载更多历史消息
 */
export async function loadMoreMessages(roomId: string, limit: number = 30): Promise<MoltMessage[]> {
  if (!matrixClient) return [];
  
  const room = matrixClient.getRoom(roomId);
  if (!room) return [];

  // 向后滚动加载更多消息
  await matrixClient.scrollback(room, limit);
  
  return getRoomMessages(roomId, limit);
}

/**
 * 获取房间成员列表
 */
export function getRoomMembers(roomId: string): MoltMember[] {
  if (!matrixClient) return [];
  
  const room = matrixClient.getRoom(roomId);
  if (!room) return [];

  const members = room.getJoinedMembers();
  const typingUserIds = room.currentState.getStateEvents('m.typing', '')?.getContent()?.user_ids || [];
  
  return members.map(member => convertToMoltMember(member, typingUserIds));
}

/**
 * 注册事件监听器
 */
export function on(eventName: string, handler: (...args: unknown[]) => void): void {
  if (!eventListeners.has(eventName)) {
    eventListeners.set(eventName, new Set());
  }
  eventListeners.get(eventName)!.add(handler);
  
  if (matrixClient) {
    matrixClient.on(eventName as any, handler as any);
  }
}

/**
 * 移除事件监听器
 */
export function off(eventName: string, handler: (...args: unknown[]) => void): void {
  eventListeners.get(eventName)?.delete(handler);
  
  if (matrixClient) {
    matrixClient.off(eventName as any, handler as any);
  }
}

/**
 * 重新连接所有事件监听器（用于客户端重新初始化后）
 */
export function reconnectListeners(): void {
  if (!matrixClient) return;
  
  eventListeners.forEach((handlers, eventName) => {
    handlers.forEach((handler) => {
      matrixClient!.on(eventName as any, handler as any);
    });
  });
}
