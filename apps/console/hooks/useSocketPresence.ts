'use client'

// ===== useSocketPresence: WebSocket Presence 同步 =====
// Stub 实现：提供完整接口和事件格式
// 后续接入真实 WebSocket / Socket.io 时只需替换连接层

import { useEffect, useRef, useCallback } from 'react'
import { usePresenceStore } from '@/hooks/usePresenceStore'
import type { UserPresence, PresenceEvent } from '@/lib/presenceTypes'

interface UseSocketPresenceOptions {
  /** 房间 ID */
  roomId: string
  /** 当前用户 ID */
  userId: string
  /** WebSocket URL（正式环境使用） */
  wsUrl?: string
  /** 是否启用（false = 使用假数据模式） */
  enabled?: boolean
}

/**
 * WebSocket Presence 同步 Hook
 *
 * 事件协议：
 * - C→S: { type: "join", payload: { userId, roomId, slotId } }
 * - C→S: { type: "move", payload: { userId, roomId, slotId } }
 * - C→S: { type: "state_change", payload: { userId, state, message? } }
 * - C→S: { type: "leave", payload: { userId, roomId } }
 *
 * - S→C: { type: "presence_update", payload: UserPresence }
 * - S→C: { type: "presence_leave", payload: { userId, roomId } }
 * - S→C: { type: "presence_snapshot", payload: UserPresence[] }
 */
export function useSocketPresence({
  roomId,
  userId,
  wsUrl,
  enabled = false,
}: UseSocketPresenceOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>()

  // ===== 发送消息 =====
  const send = useCallback(
    (event: PresenceEvent) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(event))
      }
    },
    [],
  )

  // ===== 广播移动 =====
  const broadcastMove = useCallback(
    (slotId: string) => {
      send({
        type: 'move',
        payload: { userId, roomId, slotId },
      })
    },
    [send, userId, roomId],
  )

  // ===== 广播状态变化 =====
  const broadcastState = useCallback(
    (state: UserPresence['state'], message?: string) => {
      const localPresence = usePresenceStore.getState().presences[userId]
      if (!localPresence) return
      send({
        type: 'presence_update',
        payload: { ...localPresence, state, message: message ?? localPresence.message },
      })
    },
    [send, userId],
  )

  // ===== WebSocket 连接 =====
  useEffect(() => {
    if (!enabled || !wsUrl) return

    const connect = () => {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[ws] connected to', wsUrl)
        // 加入房间
        ws.send(
          JSON.stringify({
            type: 'join',
            payload: { userId, roomId },
          }),
        )
      }

      ws.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as PresenceEvent & { type: string; payload: any }

          switch (event.type) {
            case 'presence_update':
              usePresenceStore.getState().updatePresence(event.payload)
              break
            case 'presence_leave':
              usePresenceStore.getState().removePresence(event.payload.userId)
              break
            case 'presence_snapshot':
              usePresenceStore.getState().batchUpdatePresences(event.payload)
              break
            default:
              console.warn('[ws] unknown event type:', event.type)
          }
        } catch (err) {
          console.error('[ws] parse error:', err)
        }
      }

      ws.onclose = () => {
        console.log('[ws] disconnected, reconnecting in 3s...')
        reconnectTimer.current = setTimeout(connect, 3000)
      }

      ws.onerror = (err) => {
        console.error('[ws] error:', err)
        ws.close()
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [enabled, wsUrl, roomId, userId])

  return {
    send,
    broadcastMove,
    broadcastState,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
  }
}

// ===================================================================
// Mock Data Generator（开发用假数据）
// ===================================================================

const NAMES = [
  '小明', '小红', '小刚', '小丽', '阿强', '阿芳',
  '大卫', '安娜', '鲍勃', '凯西', '丹尼', '艾米',
  '弗兰克', '格蕾丝', '亨利', '艾拉', '杰克', '凯特',
  '利奥', '米娅',
]

const STATES: UserPresence['state'][] = ['idle', 'typing', 'speaking', 'idle', 'idle', 'away']

const MESSAGES = [
  '我觉得这个方案不错',
  '有没有考虑过用 WebSocket？',
  '同意！',
  '我来分享一下进展',
  '能再说详细一点吗？',
  '这里有个 bug',
]

/**
 * 生成假的 presence 数据，用于开发/演示
 */
export function generateMockPresences(params: {
  roomId: string
  count: number
  slotIds: string[]
  localUserId?: string
}): UserPresence[] {
  const { roomId, count, slotIds, localUserId } = params
  const presences: UserPresence[] = []
  const usedSlots = new Set<string>()

  // 分散分配：按间隔跳着选 slot，避免全挤在一个 cluster
  const step = Math.max(1, Math.floor(slotIds.length / count))

  for (let i = 0; i < Math.min(count, slotIds.length); i++) {
    const userId = `user-${i}`
    const isLocal = userId === localUserId

    // 按间隔分配，让用户分散在各区域
    let slotId = slotIds[0]
    const preferredIdx = i * step
    for (let j = 0; j < slotIds.length; j++) {
      const idx = (preferredIdx + j) % slotIds.length
      if (!usedSlots.has(slotIds[idx])) {
        slotId = slotIds[idx]
        break
      }
    }
    usedSlots.add(slotId)

    const stateIdx = isLocal ? 0 : i % STATES.length
    const state = STATES[stateIdx]

    presences.push({
      userId,
      roomId,
      slotId,
      threadId: i < 8 ? 'thread-main' : i < 14 ? 'thread-design' : undefined,
      state,
      lastActiveAt: Date.now() - Math.random() * 60000,
      avatarSeed: `seed-${i}-${NAMES[i % NAMES.length]}`,
      displayName: isLocal ? '我' : NAMES[i % NAMES.length],
      message: state === 'speaking' ? MESSAGES[i % MESSAGES.length] : undefined,
    })
  }

  return presences
}
