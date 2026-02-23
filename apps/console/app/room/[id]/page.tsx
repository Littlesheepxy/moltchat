'use client'

// ===== 群聊 3D 房间页面 =====
// /room/[id] - 群聊大房间，鼠标点击移动，靠近即聊天

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { usePresenceStore } from '@/hooks/usePresenceStore'
import { useSocketPresence, generateMockPresences } from '@/hooks/useSocketPresence'
import { buildGroupRoomLayout } from '@/components/3d/SlotManager'

// 动态导入 3D 组件，禁用 SSR
const SceneRoot = dynamic(
  () => import('@/components/3d/SceneRoot').then((m) => m.SceneRoot),
  { ssr: false },
)
const RoomScene = dynamic(
  () => import('@/components/3d/RoomScene').then((m) => m.RoomScene),
  { ssr: false },
)

export default function RoomPage({ params }: { params: { id: string } }) {
  const roomId = params.id
  const localUserId = 'user-0'

  const layout = useMemo(() => buildGroupRoomLayout(), [])
  const slotIds = useMemo(() => Array.from(layout.slots.keys()), [layout])
  const [initialized, setInitialized] = useState(false)

  // ===== WebSocket（当前 stub） =====
  useSocketPresence({
    roomId,
    userId: localUserId,
    enabled: false,
  })

  // ===== 初始化假数据 =====
  useEffect(() => {
    const store = usePresenceStore.getState()
    store.setLocalUser(localUserId)

    const mockPresences = generateMockPresences({
      roomId,
      count: 8,
      slotIds,
      localUserId,
    })

    store.batchUpdatePresences(mockPresences)
    setInitialized(true)

    return () => {
      for (const p of mockPresences) {
        store.removePresence(p.userId)
      }
    }
  }, [roomId, slotIds, localUserId])

  // ===== UI =====
  const [uiVisible, setUiVisible] = useState(true)

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* 3D 场景 */}
      {initialized && (
        <SceneRoot>
          <RoomScene />
        </SceneRoot>
      )}

      {/* 加载提示 */}
      {!initialized && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#87ceeb',
            color: '#64748b',
            fontSize: 16,
          }}
        >
          正在加载 3D 场景...
        </div>
      )}

      {/* HUD 覆盖层 */}
      {uiVisible && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div
            style={{
              background: 'rgba(0,0,0,0.7)',
              color: 'white',
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>冒险营地 #{roomId}</div>
            <div>点击地面移动角色</div>
            <div>靠近其他人自动触发聊天</div>
            <div>鼠标拖拽旋转 | 滚轮缩放</div>
          </div>

          <StatePanel />
          <NearbyPanel />
        </div>
      )}

      {/* 切换 UI 按钮 */}
      <button
        onClick={() => setUiVisible(!uiVisible)}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 10,
          background: 'rgba(0,0,0,0.5)',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          padding: '6px 12px',
          cursor: 'pointer',
          fontSize: 12,
        }}
      >
        {uiVisible ? '隐藏 HUD' : '显示 HUD'}
      </button>
    </div>
  )
}

// ===== 状态切换面板 =====
function StatePanel() {
  const setLocalState = usePresenceStore((s) => s.setLocalState)
  const setLocalMessage = usePresenceStore((s) => s.setLocalMessage)
  const localPresence = usePresenceStore((s) => {
    const uid = s.localUserId
    return uid ? s.presences[uid] : null
  })

  const handleStateChange = useCallback(
    (state: 'idle' | 'typing' | 'speaking' | 'away') => {
      setLocalState(state)
      if (state === 'speaking') {
        setLocalMessage('这是一条测试消息')
      }
    },
    [setLocalState, setLocalMessage],
  )

  return (
    <div
      style={{
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '8px 14px',
        borderRadius: 8,
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>状态切换</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['idle', 'typing', 'speaking', 'away'] as const).map((state) => (
          <button
            key={state}
            onClick={() => handleStateChange(state)}
            style={{
              padding: '4px 10px',
              borderRadius: 4,
              border: localPresence?.state === state ? '2px solid #60a5fa' : '1px solid #555',
              background: localPresence?.state === state ? '#1e40af' : '#333',
              color: 'white',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            {state}
          </button>
        ))}
      </div>
    </div>
  )
}

// ===== 邻近用户面板 =====
function NearbyPanel() {
  const nearbyUserIds = usePresenceStore((s) => s.nearbyUserIds)
  const presences = usePresenceStore((s) => s.presences)

  if (nearbyUserIds.length === 0) return null

  return (
    <div
      style={{
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '8px 14px',
        borderRadius: 8,
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6, color: '#4ade80' }}>
        附近的冒险者 ({nearbyUserIds.length})
      </div>
      {nearbyUserIds.map((uid) => {
        const p = presences[uid]
        if (!p) return null
        return (
          <div
            key={uid}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '2px 0',
            }}
          >
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: p.state === 'speaking' ? '#fbbf24' : p.state === 'typing' ? '#60a5fa' : '#4ade80',
              display: 'inline-block',
            }} />
            <span>{p.displayName}</span>
            <span style={{ opacity: 0.5 }}>
              {p.state === 'speaking' ? '说话中' : p.state === 'typing' ? '输入中' : '在线'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
