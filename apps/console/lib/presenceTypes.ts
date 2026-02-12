// ===== 3D Spatial Chat: Core Types =====

/** 一个站位点 */
export interface Slot {
  id: string
  position: [number, number, number]
  clusterId?: string
  type?: 'grid' | 'circle' | 'entrance'
  neighbors: {
    up?: string
    down?: string
    left?: string
    right?: string
  }
  /** 环形座位的朝向角度（弧度），用于 avatar lookAt */
  facingAngle?: number
}

/** 讨论区/桌子 定义 */
export interface ClusterDef {
  id: string
  label: string
  center: { x: number; z: number }
  tableRadius: number
  seatCount: number
}

/** 用户 Presence（实时状态） */
export interface UserPresence {
  userId: string
  roomId: string
  slotId: string
  threadId?: string
  state: 'idle' | 'typing' | 'speaking' | 'away'
  lastActiveAt: number
  avatarSeed: string
  displayName: string
  /** 当前说话内容（speaking 状态使用） */
  message?: string
}

/** 方向 */
export type Direction = 'up' | 'down' | 'left' | 'right'

/** 座位占用表：slotId -> userId */
export type Occupancy = Map<string, string>

/** 房间布局 */
export interface RoomLayout {
  slots: Map<string, Slot>
  clusters: ClusterDef[]
}

/** 房间类型 */
export type RoomType = 'group' | 'dm'

/** WebSocket 事件 */
export interface PresenceUpdateEvent {
  type: 'presence_update'
  payload: UserPresence
}

export interface PresenceLeaveEvent {
  type: 'presence_leave'
  payload: { userId: string; roomId: string }
}

export interface MoveEvent {
  type: 'move'
  payload: { userId: string; roomId: string; slotId: string }
}

export interface PresenceSnapshotEvent {
  type: 'presence_snapshot'
  payload: UserPresence[]
}

export type PresenceEvent =
  | PresenceUpdateEvent
  | PresenceLeaveEvent
  | MoveEvent
  | PresenceSnapshotEvent
