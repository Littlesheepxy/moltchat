'use client'

// ===== 私聊 3D 房间页面 =====
// /dm/[id] - 私聊小房间，两人面对面

import dynamic from 'next/dynamic'
import { useEffect, useState, useCallback } from 'react'
import { usePresenceStore } from '@/hooks/usePresenceStore'
import type { UserPresence } from '@/lib/presenceTypes'

// 动态导入 3D 组件，禁用 SSR
const SceneRoot = dynamic(
  () => import('@/components/3d/SceneRoot').then((m) => m.SceneRoot),
  { ssr: false },
)
const DmScene = dynamic(
  () => import('@/components/3d/DmScene').then((m) => m.DmScene),
  { ssr: false },
)

export default function DmPage({ params }: { params: { id: string } }) {
  const dmId = params.id
  const localUserId = 'user-0'
  const remoteUserId = 'user-1'
  const [initialized, setInitialized] = useState(false)

  // ===== 初始化假数据：两人 =====
  useEffect(() => {
    const store = usePresenceStore.getState()
    store.setLocalUser(localUserId)

    const presences: UserPresence[] = [
      {
        userId: localUserId,
        roomId: dmId,
        slotId: 'dm-seat-a',
        state: 'idle',
        lastActiveAt: Date.now(),
        avatarSeed: 'local-user-seed-42',
        displayName: '我',
      },
      {
        userId: remoteUserId,
        roomId: dmId,
        slotId: 'dm-seat-b',
        state: 'idle',
        lastActiveAt: Date.now(),
        avatarSeed: 'remote-user-seed-77',
        displayName: '对方',
      },
    ]

    store.batchUpdatePresences(presences)
    setInitialized(true)

    return () => {
      store.removePresence(localUserId)
      store.removePresence(remoteUserId)
    }
  }, [dmId, localUserId, remoteUserId])

  // ===== 模拟对方状态变化 =====
  useEffect(() => {
    if (!initialized) return

    const states: Array<{ state: UserPresence['state']; message?: string; delay: number }> = [
      { state: 'idle', delay: 3000 },
      { state: 'typing', delay: 5000 },
      { state: 'speaking', message: '你好呀，最近怎么样？', delay: 8000 },
      { state: 'idle', delay: 12000 },
      { state: 'typing', delay: 15000 },
      { state: 'speaking', message: '周末要不要一起吃饭？', delay: 18000 },
      { state: 'idle', delay: 22000 },
    ]

    const timers: ReturnType<typeof setTimeout>[] = []

    for (const s of states) {
      const timer = setTimeout(() => {
        const store = usePresenceStore.getState()
        const current = store.presences[remoteUserId]
        if (current) {
          store.updatePresence({
            ...current,
            state: s.state,
            message: s.message,
            lastActiveAt: Date.now(),
          })
        }
      }, s.delay)
      timers.push(timer)
    }

    return () => timers.forEach(clearTimeout)
  }, [initialized, remoteUserId])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* 3D 场景 */}
      {initialized && (
        <SceneRoot bgColor="#f8fafc">
          <DmScene />
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
            background: '#f8fafc',
            color: '#64748b',
            fontSize: 16,
          }}
        >
          正在加载 3D 场景...
        </div>
      )}

      {/* HUD */}
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
          <div style={{ fontWeight: 600, marginBottom: 4 }}>私聊 #{dmId}</div>
          <div>自动演示对方状态变化</div>
          <div>点击下方按钮切换自己状态</div>
        </div>

        <DmStatePanel />
      </div>
    </div>
  )
}

// ===== 私聊状态面板 =====
function DmStatePanel() {
  const setLocalState = usePresenceStore((s) => s.setLocalState)
  const setLocalMessage = usePresenceStore((s) => s.setLocalMessage)
  const localPresence = usePresenceStore((s) => {
    const uid = s.localUserId
    return uid ? s.presences[uid] : null
  })

  const [inputMsg, setInputMsg] = useState('')

  const handleSend = useCallback(() => {
    if (!inputMsg.trim()) return
    setLocalState('speaking')
    setLocalMessage(inputMsg)
    setInputMsg('')

    // 2秒后回到 idle
    setTimeout(() => {
      setLocalState('idle')
    }, 3000)
  }, [inputMsg, setLocalState, setLocalMessage])

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
      <div style={{ fontWeight: 600, marginBottom: 6 }}>我的状态</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {(['idle', 'typing', 'speaking'] as const).map((state) => (
          <button
            key={state}
            onClick={() => {
              setLocalState(state)
              if (state === 'speaking') setLocalMessage('你好！')
            }}
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

      <div style={{ display: 'flex', gap: 4 }}>
        <input
          value={inputMsg}
          onChange={(e) => {
            setInputMsg(e.target.value)
            setLocalState('typing')
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="输入消息..."
          style={{
            flex: 1,
            padding: '4px 8px',
            borderRadius: 4,
            border: '1px solid #555',
            background: '#222',
            color: 'white',
            fontSize: 11,
            outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          style={{
            padding: '4px 10px',
            borderRadius: 4,
            background: '#2563eb',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          发送
        </button>
      </div>
    </div>
  )
}
