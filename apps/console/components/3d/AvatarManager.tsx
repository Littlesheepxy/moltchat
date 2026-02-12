'use client'

// ===== AvatarManager: 根据 presence 列表渲染多个 Avatar =====
// 职责：
// - 从 store 订阅 presences
// - 根据 slotId 查找 slot 位置
// - 传递 isLocal / isNearby 标记
// - 渲染 Avatar 组件

import { useCallback, useMemo, useRef } from 'react'
import { Avatar } from './Avatar'
import { usePresenceStore } from '@/hooks/usePresenceStore'
import type { Slot, UserPresence } from '@/lib/presenceTypes'

interface AvatarManagerProps {
  slots: Map<string, Slot>
}

export function AvatarManager({ slots }: AvatarManagerProps) {
  const presencesObj = usePresenceStore((s) => s.presences)
  const selectedUserId = usePresenceStore((s) => s.selectedUserId)
  const setSelectedUser = usePresenceStore((s) => s.setSelectedUser)
  const localUserId = usePresenceStore((s) => s.localUserId)
  const nearbyUserIds = usePresenceStore((s) => s.nearbyUserIds)

  // 稳定引用的 presence 列表
  const prevRef = useRef<{ obj: typeof presencesObj; list: UserPresence[] }>({
    obj: presencesObj,
    list: [],
  })

  const presenceList = useMemo(() => {
    if (prevRef.current.obj !== presencesObj) {
      prevRef.current.obj = presencesObj
      prevRef.current.list = Object.values(presencesObj)
    }
    return prevRef.current.list
  }, [presencesObj])

  // 邻近 Set（快速查找）
  const nearbySet = useMemo(() => new Set(nearbyUserIds), [nearbyUserIds])

  // 查找 slot 位置
  const getSlotInfo = useCallback(
    (slotId: string) => {
      const slot = slots.get(slotId)
      if (!slot) return { position: [0, 0, 0] as [number, number, number], facingAngle: 0 }
      return {
        position: slot.position,
        facingAngle: slot.facingAngle ?? 0,
      }
    },
    [slots],
  )

  // Memo 化列表
  const avatarEntries = useMemo(() => {
    return presenceList.map((p) => ({
      presence: p,
      ...getSlotInfo(p.slotId),
      isLocal: p.userId === localUserId,
      isNearby: nearbySet.has(p.userId),
    }))
  }, [presenceList, getSlotInfo, localUserId, nearbySet])

  return (
    <group name="avatar-manager">
      {avatarEntries.map((entry) => (
        <Avatar
          key={entry.presence.userId}
          presence={entry.presence}
          targetPosition={entry.position}
          facingAngle={entry.facingAngle}
          isSelected={selectedUserId === entry.presence.userId}
          isLocal={entry.isLocal}
          isNearby={entry.isNearby}
          onClick={() =>
            setSelectedUser(
              selectedUserId === entry.presence.userId ? null : entry.presence.userId,
            )
          }
        />
      ))}
    </group>
  )
}
