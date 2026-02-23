'use client'

// ===== useKeyboardMove: 键盘移动 Hook =====
// WASD / 方向键控制用户在 slot 间移动
// 带输入节流 + 冲突检测 + ws 广播接口

import { useEffect, useRef, useCallback } from 'react'
import {
  usePresenceStore,
  selectLocalPresence,
  selectOccupancy,
} from '@/hooks/usePresenceStore'
import type { Slot, Direction, RoomType } from '@/lib/presenceTypes'

interface UseKeyboardMoveOptions {
  /** 所有 slot 数据 */
  slots: Map<string, Slot>
  /** 房间类型（DM 房间限制移动） */
  roomType: RoomType
  /** 输入节流间隔 ms */
  throttleMs?: number
  /** 移动后回调（用于 ws 广播） */
  onMove?: (slotId: string) => void
  /** 是否启用 */
  enabled?: boolean
}

// 按键 → 方向映射
const KEY_MAP: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  W: 'up',
  s: 'down',
  S: 'down',
  a: 'left',
  A: 'left',
  d: 'right',
  D: 'right',
}

export function useKeyboardMove({
  slots,
  roomType,
  throttleMs = 120,
  onMove,
  enabled = true,
}: UseKeyboardMoveOptions) {
  const lastMoveTime = useRef(0)

  const attemptMove = useCallback(
    (direction: Direction) => {
      // DM 房间：默认不允许移动（仅 left/right 微调也可）
      if (roomType === 'dm') return

      const now = Date.now()
      if (now - lastMoveTime.current < throttleMs) return

      const localPresence = selectLocalPresence(usePresenceStore.getState())
      if (!localPresence) return

      const currentSlot = slots.get(localPresence.slotId)
      if (!currentSlot) return

      const nextSlotId = currentSlot.neighbors[direction]
      if (!nextSlotId) return

      // 检查是否被占用
      const occupancy = selectOccupancy(usePresenceStore.getState())
      const occupant = occupancy.get(nextSlotId)

      let targetSlotId = nextSlotId

      if (occupant && occupant !== localPresence.userId) {
        // 被占用：沿同方向继续查找空位（最多跳 8 步）
        let candidate = nextSlotId
        let found = false
        for (let step = 0; step < 8; step++) {
          const candidateSlot = slots.get(candidate)
          if (!candidateSlot) break

          const further = candidateSlot.neighbors[direction]
          if (!further) break

          const furtherOccupant = occupancy.get(further)
          if (!furtherOccupant || furtherOccupant === localPresence.userId) {
            targetSlotId = further
            found = true
            break
          }
          candidate = further
        }
        if (!found) return // 该方向全满，放弃
      }

      // 执行移动
      lastMoveTime.current = now
      usePresenceStore.getState().moveLocalUser(targetSlotId)

      // 回调（ws 广播）
      onMove?.(targetSlotId)
    },
    [slots, roomType, throttleMs, onMove],
  )

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果焦点在输入框，不拦截
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const direction = KEY_MAP[e.key]
      if (direction) {
        e.preventDefault()
        attemptMove(direction)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, attemptMove])

  return { attemptMove }
}
