/**
 * Matrix Module - 主入口
 * 
 * 导出所有 Matrix 相关功能
 */

// 类型
export * from './types';

// 客户端
export {
  getMatrixClient,
  isConnected,
  initMatrixClient,
  startSync,
  stopMatrixClient,
  getSyncState,
  getJoinedRooms,
  getRoom,
  sendReadReceipt,
  sendTyping,
  uploadMedia,
  getMediaHttpUrl,
  convertToMoltRoom,
  convertToMoltMessage,
  convertToMoltMember,
  getRoomMessages,
  loadMoreMessages,
  getRoomMembers,
  on,
  off,
  reconnectListeners,
} from './client';

// Hooks
export {
  useMatrix,
  useRoom,
  useRoomMessages,
  useRoomMembers,
  useTyping,
  useReadReceipt,
  useMediaUpload,
  useMatrixEvent,
  useAutoConnect,
} from './hooks';
