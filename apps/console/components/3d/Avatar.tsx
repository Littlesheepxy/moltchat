'use client'

// ===== Avatar 组件（GLB 模型版 + 点击移动） =====
// 使用 KayKit Adventures 角色 GLB（带骨骼动画）
// 由 avatarSeed 确定性选择角色类型 + 颜色微调
// 支持 idle / walk / typing / speaking 动画
// 本地用户：鼠标点击移动 + 邻近检测
// 远程用户：slot-based tween

import { useRef, useMemo, memo, useEffect, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations, Html } from '@react-three/drei'
import * as THREE from 'three'
import { clone as cloneSkinnedMesh } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { createTweenState, startTween, updateTween } from '@/lib/tween'
import { setWorldPosition, worldPositions, distanceXZ } from '@/lib/positionRegistry'
import { usePresenceStore } from '@/hooks/usePresenceStore'
import type { UserPresence } from '@/lib/presenceTypes'

// ===== 常量 =====
const WALK_SPEED = 3.0 // 单位/秒
const ARRIVAL_THRESHOLD = 0.2 // 到达判定距离
const PROXIMITY_RANGE = 2.5 // 邻近交互距离
const PROXIMITY_CHECK_INTERVAL = 0.4 // 邻近检测间隔（秒）

// ===== 角色模型路径（9 种角色） =====
const CHARACTER_MODELS = [
  '/models/Rogue.glb',
  '/models/Knight.glb',
  '/models/Mage.glb',
  '/models/Barbarian.glb',
  '/models/Rogue_Hooded.glb',
  '/models/Skeleton_Mage.glb',
  '/models/Skeleton_Minion.glb',
  '/models/Skeleton_Rogue.glb',
  '/models/Skeleton_Warrior.glb',
]

// ===== 简易 hash =====
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash)
}

function getModelPath(seed: string): string {
  return CHARACTER_MODELS[hashString(seed) % CHARACTER_MODELS.length]
}

function getSeedHueShift(seed: string): number {
  return (hashString(seed + '__hue') % 60) - 30
}

// ===== 组件接口 =====
interface AvatarProps {
  presence: UserPresence
  targetPosition: [number, number, number] // slot 位置（远程用户使用）
  facingAngle?: number
  isSelected?: boolean
  isLocal?: boolean // 是否是本地用户
  isNearby?: boolean // 是否在邻近范围内
  onClick?: () => void
}

/**
 * KayKit GLB 角色渲染组件
 * - 本地用户：鼠标点击地面移动，走路动画，邻近检测
 * - 远程用户：slot-based tween 移动
 */
export const Avatar = memo(function Avatar({
  presence,
  targetPosition,
  facingAngle = 0,
  isSelected = false,
  isLocal = false,
  isNearby = false,
  onClick,
}: AvatarProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const modelContainerRef = useRef<THREE.Group>(null!)

  // ===== 根据 seed 选模型 =====
  const modelPath = useMemo(() => getModelPath(presence.avatarSeed), [presence.avatarSeed])
  const hueShift = useMemo(() => getSeedHueShift(presence.avatarSeed), [presence.avatarSeed])

  // ===== 加载 GLB =====
  const gltf = useGLTF(modelPath)

  // ===== 克隆场景（每个 avatar 独立实例） =====
  const clonedScene = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clone = (cloneSkinnedMesh as any)(gltf.scene) as THREE.Group
    clone.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        if (mesh.material) {
          const mat = (mesh.material as THREE.MeshStandardMaterial).clone()
          if (mat.color) {
            const hsl = { h: 0, s: 0, l: 0 }
            mat.color.getHSL(hsl)
            mat.color.setHSL(
              (hsl.h + hueShift / 360 + 1) % 1,
              Math.min(hsl.s * 1.1, 1),
              hsl.l,
            )
          }
          mesh.material = mat
          mesh.castShadow = true
          mesh.receiveShadow = true
        }
      }
    })
    clone.scale.setScalar(0.5)
    return clone
  }, [gltf.scene, hueShift])

  // ===== 动画系统 =====
  const { actions, names } = useAnimations(gltf.animations, modelContainerRef)

  // 查找可用动画（增加 walk 优先级）
  const animMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const name of names) {
      const lower = name.toLowerCase()
      if (lower.includes('idle') && !map.idle) map.idle = name
      if ((lower.includes('walk') || lower.includes('run')) && !map.walk) map.walk = name
      if (lower.includes('wave') && !map.wave) map.wave = name
      if ((lower.includes('interact') || lower.includes('use') || lower.includes('pick')) && !map.interact) map.interact = name
      if ((lower.includes('attack') || lower.includes('slash')) && !map.attack) map.attack = name
      if ((lower.includes('dance') || lower.includes('cheer')) && !map.dance) map.dance = name
    }
    if (!map.idle && names.length > 0) map.idle = names[0]
    return map
  }, [names])

  // 当前动画 ref
  const currentAnimRef = useRef<string>('')

  // 统一的动画切换函数
  const playAnim = useCallback((animName: string | undefined, fadeDuration = 0.25) => {
    if (!animName || animName === currentAnimRef.current) return
    const prevAction = currentAnimRef.current ? actions[currentAnimRef.current] : null
    const nextAction = actions[animName]
    if (nextAction) {
      nextAction.reset().fadeIn(fadeDuration).play()
      if (prevAction) prevAction.fadeOut(fadeDuration)
      currentAnimRef.current = animName
    }
  }, [actions])

  // 根据 presence.state 获取对应动画名
  const getStateAnim = useCallback((): string => {
    if (presence.state === 'typing') return animMap.interact || animMap.wave || animMap.idle || ''
    if (presence.state === 'speaking') return animMap.wave || animMap.dance || animMap.idle || ''
    return animMap.idle || ''
  }, [presence.state, animMap])

  // 初始播放 idle
  useEffect(() => {
    playAnim(animMap.idle, 0)
  }, [animMap, playAnim])

  // 状态变化时切换动画（仅非行走状态）
  const isWalkingRef = useRef(false)

  useEffect(() => {
    if (!isWalkingRef.current) {
      playAnim(getStateAnim())
    }
  }, [presence.state, getStateAnim, playAnim])

  // ===== Tween 状态 (远程用户使用) =====
  const tweenState = useRef(createTweenState(targetPosition, facingAngle))
  const prevTarget = useRef<[number, number, number]>([...targetPosition])
  const prevAngle = useRef(facingAngle)

  // 远程用户：检测目标变化，启动 tween
  if (!isLocal) {
    if (
      prevTarget.current[0] !== targetPosition[0] ||
      prevTarget.current[1] !== targetPosition[1] ||
      prevTarget.current[2] !== targetPosition[2] ||
      prevAngle.current !== facingAngle
    ) {
      const group = groupRef.current
      const currentPos: [number, number, number] = group
        ? [group.position.x, group.position.y, group.position.z]
        : [...prevTarget.current]
      const currentAngle = group ? group.rotation.y : prevAngle.current

      startTween(tweenState.current, currentPos, targetPosition, currentAngle, facingAngle, 0.8)
      prevTarget.current = [...targetPosition]
      prevAngle.current = facingAngle
    }
  }

  // ===== 邻近检测计时器 (本地用户) =====
  const proximityTimer = useRef(0)

  // ===== 每帧更新 =====
  useFrame((_, delta) => {
    if (!groupRef.current) return
    const group = groupRef.current

    if (isLocal) {
      // ===== 本地用户：点击移动 =====
      const target = usePresenceStore.getState().moveTarget

      if (target) {
        const dx = target[0] - group.position.x
        const dz = target[2] - group.position.z
        const dist = Math.sqrt(dx * dx + dz * dz)

        if (dist < ARRIVAL_THRESHOLD) {
          // 到达目的地
          group.position.set(target[0], 0, target[2])
          usePresenceStore.getState().setMoveTarget(null)
          isWalkingRef.current = false
          playAnim(getStateAnim())
        } else {
          // 行走中
          const step = Math.min(WALK_SPEED * delta, dist)
          const nx = dx / dist
          const nz = dz / dist
          group.position.x += nx * step
          group.position.z += nz * step

          // 朝向移动方向（atan2(x, z) 给出 Y 轴旋转）
          const angle = Math.atan2(nx, nz)
          // 平滑转向
          const angleDiff = angle - group.rotation.y
          let shortDiff = angleDiff % (Math.PI * 2)
          if (shortDiff > Math.PI) shortDiff -= Math.PI * 2
          if (shortDiff < -Math.PI) shortDiff += Math.PI * 2
          group.rotation.y += shortDiff * Math.min(1, delta * 10)

          // 切换到走路动画
          if (!isWalkingRef.current) {
            playAnim(animMap.walk || animMap.idle)
            isWalkingRef.current = true
          }
        }
      }

      // ===== 邻近检测（节流） =====
      proximityTimer.current += delta
      if (proximityTimer.current >= PROXIMITY_CHECK_INTERVAL) {
        proximityTimer.current = 0
        const myPos: [number, number, number] = [group.position.x, group.position.y, group.position.z]
        const nearbyIds: string[] = []
        worldPositions.forEach((pos, uid) => {
          if (uid !== presence.userId && distanceXZ(myPos, pos) < PROXIMITY_RANGE) {
            nearbyIds.push(uid)
          }
        })
        // 排序保持稳定
        nearbyIds.sort()
        usePresenceStore.getState().setNearbyUserIds(nearbyIds)
      }
    } else {
      // ===== 远程用户：Tween 插值移动 =====
      const { pos, angle } = updateTween(tweenState.current, delta)
      group.position.set(pos[0], pos[1], pos[2])
      group.rotation.y = angle
    }

    // ===== 注册世界位置（所有用户） =====
    setWorldPosition(presence.userId, [group.position.x, group.position.y, group.position.z])
  })

  return (
    <group ref={groupRef} position={targetPosition} onClick={onClick}>
      {/* ===== GLB 模型 ===== */}
      <group ref={modelContainerRef}>
        <primitive object={clonedScene} />
      </group>

      {/* ===== 名牌 ===== */}
      <Html
        position={[0, 1.15, 0]}
        center
        distanceFactor={8}
        style={{ pointerEvents: 'none' }}
      >
        <div
          style={{
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            textShadow: '0 1px 4px rgba(0,0,0,0.85)',
            whiteSpace: 'nowrap',
            userSelect: 'none',
            background: isLocal ? 'rgba(37,99,235,0.6)' : 'rgba(0,0,0,0.35)',
            padding: '1px 8px',
            borderRadius: 6,
            border: isLocal ? '1px solid rgba(96,165,250,0.5)' : 'none',
          }}
        >
          {presence.displayName}{isLocal ? ' (你)' : ''}
        </div>
      </Html>

      {/* ===== typing: 打字中气泡 ===== */}
      {presence.state === 'typing' && (
        <Html
          position={[0, 1.35, 0]}
          center
          distanceFactor={8}
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              background: 'rgba(55,65,81,0.92)',
              color: '#fff',
              padding: '2px 12px',
              borderRadius: 12,
              fontSize: 16,
              letterSpacing: 3,
              userSelect: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
            }}
          >
            ···
          </div>
        </Html>
      )}

      {/* ===== speaking: 说话气泡 ===== */}
      {presence.state === 'speaking' && (
        <Html
          position={[0, 1.4, 0]}
          center
          distanceFactor={8}
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              background: 'rgba(37,99,235,0.95)',
              color: '#fff',
              padding: '4px 12px',
              borderRadius: 12,
              fontSize: 12,
              maxWidth: 180,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              userSelect: 'none',
              boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
            }}
          >
            {presence.message || '...'}
          </div>
        </Html>
      )}

      {/* ===== speaking: 脚下高亮环 ===== */}
      {presence.state === 'speaking' && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.35, 0.45, 32]} />
          <meshBasicMaterial color="#FFD54F" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* ===== 邻近交互指示: 绿色光环 + 聊天图标 ===== */}
      {isNearby && (
        <>
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.4, 0.52, 32]} />
            <meshBasicMaterial color="#4ade80" transparent opacity={0.5} side={THREE.DoubleSide} />
          </mesh>
          <Html
            position={[0.4, 1.0, 0]}
            center
            distanceFactor={8}
            style={{ pointerEvents: 'none' }}
          >
            <div
              style={{
                fontSize: 14,
                userSelect: 'none',
                filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))',
              }}
            >
              💬
            </div>
          </Html>
        </>
      )}

      {/* ===== 选中: 脚下蓝色圆环 ===== */}
      {isSelected && (
        <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.38, 0.5, 32]} />
          <meshBasicMaterial color="#4FC3F7" transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )
})

// ===== 预加载所有角色模型 =====
CHARACTER_MODELS.forEach((path) => {
  useGLTF.preload(path)
})
