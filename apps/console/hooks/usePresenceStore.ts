// ===== Presence Store (Zustand) =====
// 管理所有用户的实时在线状态，R3F 组件通过 selector 订阅需要的字段

import { create } from 'zustand'
import type { UserPresence, Occupancy } from '@/lib/presenceTypes'

interface PresenceStore {
  // ===== State =====
  /** 所有用户的 presence，以 userId 为 key */
  presences: Record<string, UserPresence>
  /** 当前本地用户 ID */
  localUserId: string | null
  /** 当前选中的用户 ID（点击查看） */
  selectedUserId: string | null
  /** 鼠标点击的移动目标位置 */
  moveTarget: [number, number, number] | null
  /** 邻近的用户 ID 列表（距离 < 2.5 的其他用户） */
  nearbyUserIds: string[]

  // ===== Actions =====
  /** 设置本地用户 ID */
  setLocalUser: (id: string) => void
  /** 更新单个用户的 presence */
  updatePresence: (p: UserPresence) => void
  /** 批量更新 presences（初始化/全量同步） */
  batchUpdatePresences: (ps: UserPresence[]) => void
  /** 移除用户 presence（离线） */
  removePresence: (userId: string) => void
  /** 设置选中用户 */
  setSelectedUser: (id: string | null) => void
  /** 更新本地用户的 slotId（移动） */
  moveLocalUser: (slotId: string) => void
  /** 更新本地用户状态 */
  setLocalState: (state: UserPresence['state']) => void
  /** 更新本地用户消息 */
  setLocalMessage: (message: string) => void
  /** 设置鼠标点击移动目标 */
  setMoveTarget: (target: [number, number, number] | null) => void
  /** 更新邻近用户列表 */
  setNearbyUserIds: (ids: string[]) => void
}

export const usePresenceStore = create<PresenceStore>((set, get) => ({
  presences: {},
  localUserId: null,
  selectedUserId: null,
  moveTarget: null,
  nearbyUserIds: [],

  setLocalUser: (id) => set({ localUserId: id }),

  updatePresence: (p) =>
    set((state) => ({
      presences: { ...state.presences, [p.userId]: p },
    })),

  batchUpdatePresences: (ps) =>
    set((state) => {
      const next = { ...state.presences }
      for (const p of ps) {
        next[p.userId] = p
      }
      return { presences: next }
    }),

  removePresence: (userId) =>
    set((state) => {
      const next = { ...state.presences }
      delete next[userId]
      return { presences: next }
    }),

  setSelectedUser: (id) => set({ selectedUserId: id }),

  moveLocalUser: (slotId) =>
    set((state) => {
      const uid = state.localUserId
      if (!uid || !state.presences[uid]) return state
      return {
        presences: {
          ...state.presences,
          [uid]: { ...state.presences[uid], slotId, lastActiveAt: Date.now() },
        },
      }
    }),

  setLocalState: (newState) =>
    set((state) => {
      const uid = state.localUserId
      if (!uid || !state.presences[uid]) return state
      return {
        presences: {
          ...state.presences,
          [uid]: { ...state.presences[uid], state: newState, lastActiveAt: Date.now() },
        },
      }
    }),

  setLocalMessage: (message) =>
    set((state) => {
      const uid = state.localUserId
      if (!uid || !state.presences[uid]) return state
      return {
        presences: {
          ...state.presences,
          [uid]: { ...state.presences[uid], message },
        },
      }
    }),

  setMoveTarget: (target) => set({ moveTarget: target }),

  setNearbyUserIds: (ids) => {
    // 浅比较避免无意义更新
    const current = get().nearbyUserIds
    if (
      current.length === ids.length &&
      current.every((id, i) => id === ids[i])
    ) {
      return
    }
    set({ nearbyUserIds: ids })
  },
}))

// ===== Selectors（避免不必要的重渲染） =====

/** 获取所有 presence 列表 */
export const selectPresenceList = (state: PresenceStore): UserPresence[] =>
  Object.values(state.presences)

/** 获取本地用户 presence */
export const selectLocalPresence = (state: PresenceStore): UserPresence | null => {
  const uid = state.localUserId
  return uid ? state.presences[uid] ?? null : null
}

/** 计算座位占用表 */
export const selectOccupancy = (state: PresenceStore): Occupancy => {
  const occ = new Map<string, string>()
  for (const p of Object.values(state.presences)) {
    occ.set(p.slotId, p.userId)
  }
  return occ
}

/** 获取单个用户的 presence（用于 Avatar 组件的精确订阅） */
export function selectUserPresence(userId: string) {
  return (state: PresenceStore): UserPresence | undefined => state.presences[userId]
}
