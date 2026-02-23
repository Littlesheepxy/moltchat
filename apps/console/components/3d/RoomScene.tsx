'use client'

// ===== RoomScene: 群聊场景 — 野外冒险营地 =====
// 全部使用 KayKit Dungeon + Medieval Hexagon 素材
// 草地 + 树木 + 岩石 + 营地桌椅 + 火把 + 帐篷
// 点击地面移动 + 目标标记 + 每桌食物装饰

import { useMemo, useState, useCallback, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import { CameraController } from './CameraController'
import { AvatarManager } from './AvatarManager'
import { buildGroupRoomLayout } from './SlotManager'
import { usePresenceStore } from '@/hooks/usePresenceStore'
import type { ClusterDef } from '@/lib/presenceTypes'

// ===== 素材路径 =====
const DUNGEON = '/models/dungeon'
const MEDIEVAL = '/models/medieval'

export function RoomScene() {
  const layout = useMemo(() => buildGroupRoomLayout(), [])
  const [focusTarget, setFocusTarget] = useState<[number, number, number] | undefined>()

  const handleClusterClick = useCallback((cluster: ClusterDef) => {
    setFocusTarget([cluster.center.x, 0, cluster.center.z])
  }, [])

  // 地面点击 → 设置移动目标
  const handleGroundClick = useCallback((point: [number, number, number]) => {
    usePresenceStore.getState().setMoveTarget(point)
  }, [])

  return (
    <group name="room-scene">
      <CameraController roomType="group" focusTarget={focusTarget} />

      {/* 大地 */}
      <GrassGround />

      {/* 可点击地面（透明覆盖层，接收点击） */}
      <ClickableGround onGroundClick={handleGroundClick} />

      {/* 点击目标标记 */}
      <ClickIndicator />

      {/* 环境树木 */}
      <TreeRing />

      {/* 散落岩石 */}
      <ScatteredRocks />

      {/* 中央篝火区 */}
      <CentralCampfire />

      {/* 各讨论区 (营地桌椅 + 火把 + 桌上食物) */}
      {layout.clusters.map((cluster) => (
        <CampCluster
          key={cluster.id}
          cluster={cluster}
          onClick={() => handleClusterClick(cluster)}
        />
      ))}

      {/* 营地装饰 (帐篷、旗帜、木桶、箱子) */}
      <CampDecorations />

      {/* Avatars */}
      <AvatarManager slots={layout.slots} />
    </group>
  )
}

// ===== 可点击地面覆盖层 =====
function ClickableGround({ onGroundClick }: { onGroundClick: (point: [number, number, number]) => void }) {
  const handleClick = useCallback((e: ThreeEvent<PointerEvent>) => {
    // 阻止冒泡，避免点击 Avatar 等元素也触发地面移动
    e.stopPropagation()
    const p = e.point
    onGroundClick([p.x, 0, p.z])
  }, [onGroundClick])

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.005, 0]}
      onPointerDown={handleClick}
    >
      <circleGeometry args={[20, 64]} />
      <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} />
    </mesh>
  )
}

// ===== 点击目标指示器（脉动光环） =====
function ClickIndicator() {
  const meshRef = useRef<THREE.Group>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const dotRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    const target = usePresenceStore.getState().moveTarget
    if (!meshRef.current) return

    if (target) {
      meshRef.current.visible = true
      meshRef.current.position.set(target[0], 0.03, target[2])

      const t = clock.getElapsedTime()
      // 脉动效果
      const pulse = 0.8 + Math.sin(t * 6) * 0.2
      if (ringRef.current) ringRef.current.scale.setScalar(pulse)
      if (dotRef.current) dotRef.current.scale.setScalar(0.5 + Math.sin(t * 8) * 0.15)
    } else {
      meshRef.current.visible = false
    }
  })

  return (
    <group ref={meshRef} visible={false}>
      {/* 外环 */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.28, 20]} />
        <meshBasicMaterial color="#60a5fa" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      {/* 中心点 */}
      <mesh ref={dotRef} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.08, 12]} />
        <meshBasicMaterial color="#93c5fd" transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

// ===== 通用模型加载器 =====
function SceneModel({
  path,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  castShadow = false,
  receiveShadow = false,
}: {
  path: string
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number | [number, number, number]
  castShadow?: boolean
  receiveShadow?: boolean
}) {
  const gltf = useGLTF(path)
  const cloned = useMemo(() => {
    const c = gltf.scene.clone(true)
    c.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh
        if (castShadow) m.castShadow = true
        if (receiveShadow) m.receiveShadow = true
      }
    })
    return c
  }, [gltf.scene, castShadow, receiveShadow])

  const s = typeof scale === 'number' ? [scale, scale, scale] : scale

  return (
    <primitive
      object={cloned}
      position={position}
      rotation={rotation}
      scale={s as [number, number, number]}
    />
  )
}

// ===== 草地 =====
function GrassGround() {
  return (
    <group name="ground">
      {/* 主草地 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[22, 64]} />
        <meshStandardMaterial color="#5a8c3c" roughness={0.95} />
      </mesh>
      {/* 泥地路面 (中央区域) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[12, 48]} />
        <meshStandardMaterial color="#8b7355" roughness={0.9} />
      </mesh>
      {/* 内圈草地渐变 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
        <ringGeometry args={[11.5, 13, 48]} />
        <meshStandardMaterial color="#6d9a4a" roughness={0.95} />
      </mesh>
    </group>
  )
}

// ===== 树木环 =====
function TreeRing() {
  const trees = useMemo(() => {
    const items: { path: string; pos: [number, number, number]; rot: number; s: number }[] = []
    const types = [
      `${MEDIEVAL}/tree_single_A.gltf`,
      `${MEDIEVAL}/tree_single_B.gltf`,
      `${MEDIEVAL}/trees_A_medium.gltf`,
      `${MEDIEVAL}/trees_B_medium.gltf`,
    ]

    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2 + (Math.random() - 0.5) * 0.2
      const dist = 15 + Math.random() * 4
      items.push({
        path: types[i % types.length],
        pos: [Math.cos(angle) * dist, 0, Math.sin(angle) * dist],
        rot: Math.random() * Math.PI * 2,
        s: 1.8 + Math.random() * 1.2,
      })
    }

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + 0.4
      const dist = 12 + Math.random() * 2
      items.push({
        path: types[i % 2],
        pos: [Math.cos(angle) * dist, 0, Math.sin(angle) * dist],
        rot: Math.random() * Math.PI * 2,
        s: 1.2 + Math.random() * 0.8,
      })
    }

    return items
  }, [])

  return (
    <group name="trees">
      {trees.map((t, i) => (
        <SceneModel
          key={i}
          path={t.path}
          position={t.pos}
          rotation={[0, t.rot, 0]}
          scale={t.s}
          castShadow
        />
      ))}
    </group>
  )
}

// ===== 散落岩石 =====
function ScatteredRocks() {
  const rocks = useMemo(() => {
    const items: { path: string; pos: [number, number, number]; rot: number; s: number }[] = []
    const types = [
      `${MEDIEVAL}/rock_single_A.gltf`,
      `${MEDIEVAL}/rock_single_B.gltf`,
      `${MEDIEVAL}/rock_single_C.gltf`,
    ]

    const positions: [number, number, number][] = [
      [-9, 0, -7], [10, 0, -8], [-8, 0, 8], [11, 0, 6],
      [-5, 0, -10], [6, 0, 10], [-12, 0, 2], [12, 0, -3],
      [0, 0, -11], [-3, 0, 11], [8, 0, -11], [-10, 0, -5],
    ]

    positions.forEach((pos, i) => {
      items.push({
        path: types[i % types.length],
        pos,
        rot: Math.random() * Math.PI * 2,
        s: 1.5 + Math.random() * 2,
      })
    })

    return items
  }, [])

  return (
    <group name="rocks">
      {rocks.map((r, i) => (
        <SceneModel
          key={i}
          path={r.path}
          position={r.pos}
          rotation={[0, r.rot, 0]}
          scale={r.s}
          castShadow
        />
      ))}
    </group>
  )
}

// ===== 中央篝火 =====
function CentralCampfire() {
  return (
    <group name="campfire" position={[0, 0, 0]}>
      <SceneModel path={`${DUNGEON}/torch_lit.glb`} position={[0, 0, 0]} scale={1.5} castShadow />

      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2
        return (
          <SceneModel
            key={i}
            path={`${MEDIEVAL}/rock_single_${['A', 'B', 'C'][i % 3]}.gltf`}
            position={[Math.cos(a) * 1.8, 0, Math.sin(a) * 1.8]}
            rotation={[0, a, 0]}
            scale={0.8}
          />
        )
      })}

      <pointLight position={[0, 1, 0]} intensity={2} color="#ff8c42" distance={12} castShadow />
      <pointLight position={[0, 0.5, 0]} intensity={1} color="#ffaa66" distance={8} />

      <FireParticles />
    </group>
  )
}

// ===== 火焰粒子 =====
function FireParticles() {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const t = clock.getElapsedTime()
      meshRef.current.scale.setScalar(0.8 + Math.sin(t * 5) * 0.2)
      meshRef.current.position.y = 0.4 + Math.sin(t * 3) * 0.1
      meshRef.current.rotation.y = t * 2
    }
  })

  return (
    <group>
      <mesh ref={meshRef} position={[0, 0.4, 0]}>
        <coneGeometry args={[0.15, 0.5, 6]} />
        <meshBasicMaterial color="#ff6622" transparent opacity={0.7} />
      </mesh>
      <mesh position={[0, 0.35, 0]}>
        <coneGeometry args={[0.25, 0.6, 6]} />
        <meshBasicMaterial color="#ff9944" transparent opacity={0.3} />
      </mesh>
    </group>
  )
}

// ===== 营地讨论区 =====
function CampCluster({
  cluster,
  onClick,
}: {
  cluster: ClusterDef
  onClick: () => void
}) {
  const cx = cluster.center.x
  const cz = cluster.center.z
  const r = cluster.tableRadius

  const themeColors = useMemo(() => {
    const themes: Record<string, { banner: string; label: string }> = {
      roundtable: { banner: 'blue', label: '#6366f1' },
      sofa: { banner: 'red', label: '#ef4444' },
      whiteboard: { banner: 'blue', label: '#059669' },
      lounge: { banner: 'red', label: '#db2777' },
    }
    return themes[cluster.id] || { banner: 'blue', label: '#64748b' }
  }, [cluster.id])

  // 桌上食物/装饰的高度（桌面高度约 0.72）
  const tableY = 0.72

  return (
    <group name={`cluster-${cluster.id}`} onClick={onClick}>
      {/* 区域泥地 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.002, cz]}>
        <circleGeometry args={[r + 0.8, 24]} />
        <meshStandardMaterial color="#9a8265" roughness={0.95} />
      </mesh>

      {/* 桌子 (使用带装饰的版本) */}
      <SceneModel
        path={`${DUNGEON}/table_medium_decorated.glb`}
        position={[cx, 0, cz]}
        scale={1.1}
        castShadow
        receiveShadow
      />

      {/* === 桌上丰盛装饰 === */}
      {/* 食物盘 */}
      <SceneModel
        path={`${DUNGEON}/plate_food_A.glb`}
        position={[cx + 0.25, tableY, cz + 0.15]}
        scale={1.3}
      />
      {/* 酒瓶 */}
      <SceneModel
        path={`${DUNGEON}/bottle_A_brown.glb`}
        position={[cx - 0.2, tableY, cz - 0.12]}
        rotation={[0, 0.5, 0]}
        scale={1.3}
      />
      {/* 第二个酒瓶 */}
      <SceneModel
        path={`${DUNGEON}/bottle_A_brown.glb`}
        position={[cx + 0.1, tableY, cz - 0.25]}
        rotation={[0, -0.8, 0]}
        scale={1.1}
      />
      {/* 蜡烛 (中央) */}
      <SceneModel
        path={`${DUNGEON}/candle_lit.glb`}
        position={[cx, tableY, cz]}
        scale={1.2}
      />
      {/* 金币堆 */}
      <SceneModel
        path={`${DUNGEON}/coin_stack_large.glb`}
        position={[cx - 0.3, tableY, cz + 0.2]}
        scale={1.0}
      />

      {/* 围坐凳子 */}
      {Array.from({ length: cluster.seatCount }).map((_, i) => {
        const a = (i / cluster.seatCount) * Math.PI * 2
        return (
          <SceneModel
            key={`stool-${i}`}
            path={`${DUNGEON}/stool.glb`}
            position={[cx + Math.cos(a) * r * 0.7, 0, cz + Math.sin(a) * r * 0.7]}
            rotation={[0, -a + Math.PI, 0]}
            scale={1}
            castShadow
          />
        )
      })}

      {/* 火把照明 */}
      <SceneModel
        path={`${DUNGEON}/torch_lit.glb`}
        position={[cx + r + 0.5, 0, cz]}
        scale={1.2}
        castShadow
      />
      <pointLight
        position={[cx + r + 0.5, 1.5, cz]}
        intensity={1.2}
        color="#ff9944"
        distance={8}
      />

      {/* 区域旗帜 */}
      <SceneModel
        path={`${DUNGEON}/banner_${themeColors.banner}.glb`}
        position={[cx - r - 0.3, 0, cz]}
        scale={1.2}
        castShadow
      />

      {/* 区域名标签 */}
      <Html position={[cx, 1.8, cz]} center distanceFactor={14} style={{ pointerEvents: 'none' }}>
        <div style={{
          fontSize: 13,
          fontWeight: 800,
          textShadow: '0 1px 6px rgba(0,0,0,0.5)',
          whiteSpace: 'nowrap',
          userSelect: 'none',
          background: 'rgba(0,0,0,0.4)',
          padding: '2px 10px',
          borderRadius: 8,
          color: '#fff',
          border: `2px solid ${themeColors.label}`,
        }}>
          {cluster.label}
        </div>
      </Html>
    </group>
  )
}

// ===== 营地装饰 =====
function CampDecorations() {
  return (
    <group name="camp-decorations">
      {/* 帐篷 */}
      <SceneModel path={`${MEDIEVAL}/tent.gltf`} position={[-8, 0, -5]} rotation={[0, 0.5, 0]} scale={2.5} castShadow />
      <SceneModel path={`${MEDIEVAL}/tent.gltf`} position={[8, 0, -6]} rotation={[0, -0.3, 0]} scale={2.2} castShadow />
      <SceneModel path={`${MEDIEVAL}/tent.gltf`} position={[-7, 0, 7]} rotation={[0, 2.8, 0]} scale={2} castShadow />

      {/* 木桶堆 */}
      <SceneModel path={`${DUNGEON}/barrel_large.glb`} position={[-6, 0, -8]} scale={1} castShadow />
      <SceneModel path={`${DUNGEON}/barrel_small_stack.glb`} position={[-5.5, 0, -8.5]} scale={1} castShadow />

      {/* 箱子堆 */}
      <SceneModel path={`${DUNGEON}/crates_stacked.glb`} position={[7, 0, -8.5]} scale={1} castShadow />
      <SceneModel path={`${DUNGEON}/chest.glb`} position={[6, 0, -9]} scale={1.2} castShadow />
      <SceneModel path={`${DUNGEON}/chest_gold.glb`} position={[5, 0, -8.5]} rotation={[0, 0.5, 0]} scale={1.2} castShadow />

      {/* 武器架 */}
      <SceneModel path={`${MEDIEVAL}/weaponrack.gltf`} position={[9, 0, 5]} rotation={[0, -0.5, 0]} scale={2} castShadow />

      {/* 靶子 */}
      <SceneModel path={`${MEDIEVAL}/target.gltf`} position={[10, 0, 3]} rotation={[0, -1.2, 0]} scale={2} castShadow />

      {/* 麻袋 */}
      <SceneModel path={`${MEDIEVAL}/sack.gltf`} position={[-5, 0, 8]} scale={1.8} castShadow />
      <SceneModel path={`${MEDIEVAL}/sack.gltf`} position={[-4.5, 0, 8.5]} rotation={[0, 1, 0]} scale={1.5} castShadow />

      {/* 木材堆 */}
      <SceneModel path={`${MEDIEVAL}/resource_lumber.gltf`} position={[6, 0, 8]} rotation={[0, 0.3, 0]} scale={2} castShadow />

      {/* 散落的旗帜 */}
      <SceneModel path={`${MEDIEVAL}/flag_red.gltf`} position={[-10, 0, 0]} scale={2.5} castShadow />

      {/* 路灯火把 */}
      <SceneModel path={`${DUNGEON}/torch_lit.glb`} position={[-4, 0, -4]} scale={1.3} castShadow />
      <SceneModel path={`${DUNGEON}/torch_lit.glb`} position={[4, 0, -4]} scale={1.3} castShadow />
      <SceneModel path={`${DUNGEON}/torch_lit.glb`} position={[-4, 0, 4]} scale={1.3} castShadow />
      <SceneModel path={`${DUNGEON}/torch_lit.glb`} position={[4, 0, 4]} scale={1.3} castShadow />

      {/* 火把点光源 */}
      {[[-4, -4], [4, -4], [-4, 4], [4, 4]].map(([x, z], i) => (
        <pointLight key={i} position={[x, 1.5, z]} intensity={0.8} color="#ff8844" distance={6} />
      ))}
    </group>
  )
}

// ===== 预加载所有模型 =====
const PRELOAD_MODELS = [
  // Dungeon
  `${DUNGEON}/torch_lit.glb`,
  `${DUNGEON}/barrel_large.glb`,
  `${DUNGEON}/barrel_small_stack.glb`,
  `${DUNGEON}/chest.glb`,
  `${DUNGEON}/chest_gold.glb`,
  `${DUNGEON}/table_medium.glb`,
  `${DUNGEON}/table_medium_decorated.glb`,
  `${DUNGEON}/stool.glb`,
  `${DUNGEON}/crates_stacked.glb`,
  `${DUNGEON}/candle_lit.glb`,
  `${DUNGEON}/plate_food_A.glb`,
  `${DUNGEON}/bottle_A_brown.glb`,
  `${DUNGEON}/coin_stack_large.glb`,
  `${DUNGEON}/banner_blue.glb`,
  `${DUNGEON}/banner_red.glb`,
  // Medieval
  `${MEDIEVAL}/tree_single_A.gltf`,
  `${MEDIEVAL}/tree_single_B.gltf`,
  `${MEDIEVAL}/trees_A_medium.gltf`,
  `${MEDIEVAL}/trees_B_medium.gltf`,
  `${MEDIEVAL}/rock_single_A.gltf`,
  `${MEDIEVAL}/rock_single_B.gltf`,
  `${MEDIEVAL}/rock_single_C.gltf`,
  `${MEDIEVAL}/tent.gltf`,
  `${MEDIEVAL}/weaponrack.gltf`,
  `${MEDIEVAL}/target.gltf`,
  `${MEDIEVAL}/sack.gltf`,
  `${MEDIEVAL}/resource_lumber.gltf`,
  `${MEDIEVAL}/flag_red.gltf`,
]
PRELOAD_MODELS.forEach((p) => useGLTF.preload(p))
