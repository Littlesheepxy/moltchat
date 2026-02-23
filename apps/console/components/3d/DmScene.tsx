'use client'

// ===== DmScene: 私聊场景 — 森林小营地 =====
// KayKit 素材：树木围绕的小空地，两人围坐篝火
// 帐篷 + 火把 + 岩石 + 温馨氛围

import { useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CameraController } from './CameraController'
import { AvatarManager } from './AvatarManager'
import { buildDmRoomLayout } from './SlotManager'

const DUNGEON = '/models/dungeon'
const MEDIEVAL = '/models/medieval'

export function DmScene() {
  const layout = useMemo(() => buildDmRoomLayout(), [])

  return (
    <group name="dm-scene">
      <CameraController roomType="dm" dmCenter={[0, 0, 0]} />

      {/* 地面 */}
      <DmGround />

      {/* 篝火 */}
      <DmCampfire />

      {/* 围坐桌子 */}
      <SceneModel path={`${DUNGEON}/table_small_decorated_A.glb`} position={[0, 0, 0]} scale={1} castShadow />

      {/* 两侧凳子 */}
      <SceneModel path={`${DUNGEON}/stool.glb`} position={[-0.8, 0, 0]} rotation={[0, Math.PI / 2, 0]} scale={1} castShadow />
      <SceneModel path={`${DUNGEON}/stool.glb`} position={[0.8, 0, 0]} rotation={[0, -Math.PI / 2, 0]} scale={1} castShadow />

      {/* 帐篷 */}
      <SceneModel path={`${MEDIEVAL}/tent.gltf`} position={[0, 0, -3]} rotation={[0, 0, 0]} scale={2} castShadow />

      {/* 桌上装饰 */}
      <SceneModel path={`${DUNGEON}/candle_lit.glb`} position={[0, 0.5, 0]} scale={0.8} />
      <SceneModel path={`${DUNGEON}/bottle_A_brown.glb`} position={[0.2, 0.5, 0.1]} scale={0.8} />

      {/* 树木围绕 */}
      <DmTrees />

      {/* 岩石 */}
      <DmRocks />

      {/* 装饰道具 */}
      <DmProps />

      {/* Avatars */}
      <AvatarManager slots={layout.slots} />
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

// ===== 地面 =====
function DmGround() {
  return (
    <group name="dm-ground">
      {/* 外圈草地 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[10, 48]} />
        <meshStandardMaterial color="#4a7a30" roughness={0.95} />
      </mesh>
      {/* 营地泥地 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[3, 32]} />
        <meshStandardMaterial color="#8b7355" roughness={0.9} />
      </mesh>
      {/* 过渡环 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 0]}>
        <ringGeometry args={[2.8, 3.5, 32]} />
        <meshStandardMaterial color="#6d8a42" roughness={0.95} />
      </mesh>
    </group>
  )
}

// ===== 篝火 =====
function DmCampfire() {
  return (
    <group position={[0, 0, 1.5]}>
      {/* 火把模型 */}
      <SceneModel path={`${DUNGEON}/torch_lit.glb`} position={[0, 0, 0]} scale={1.2} />

      {/* 围石 */}
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2
        return (
          <SceneModel
            key={i}
            path={`${MEDIEVAL}/rock_single_${['A', 'B', 'C'][i % 3]}.gltf`}
            position={[Math.cos(a) * 0.6, 0, Math.sin(a) * 0.6]}
            scale={0.4}
          />
        )
      })}

      {/* 火光 */}
      <pointLight position={[0, 0.8, 0]} intensity={2} color="#ff8844" distance={8} castShadow />
      <pointLight position={[0, 0.3, 0]} intensity={1} color="#ffaa66" distance={5} />

      {/* 火焰 */}
      <DmFire />
    </group>
  )
}

// ===== 火焰动画 =====
function DmFire() {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const t = clock.getElapsedTime()
      meshRef.current.scale.setScalar(0.7 + Math.sin(t * 6) * 0.15)
      meshRef.current.position.y = 0.35 + Math.sin(t * 4) * 0.08
    }
  })

  return (
    <group>
      <mesh ref={meshRef} position={[0, 0.35, 0]}>
        <coneGeometry args={[0.1, 0.4, 6]} />
        <meshBasicMaterial color="#ff6622" transparent opacity={0.6} />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <coneGeometry args={[0.16, 0.5, 6]} />
        <meshBasicMaterial color="#ff9944" transparent opacity={0.25} />
      </mesh>
    </group>
  )
}

// ===== 树木 =====
function DmTrees() {
  const trees = useMemo(() => {
    const items: { path: string; pos: [number, number, number]; rot: number; s: number }[] = []
    const types = [
      `${MEDIEVAL}/tree_single_A.gltf`,
      `${MEDIEVAL}/tree_single_B.gltf`,
      `${MEDIEVAL}/trees_A_medium.gltf`,
      `${MEDIEVAL}/trees_B_medium.gltf`,
    ]

    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2 + (Math.random() - 0.5) * 0.3
      const dist = 5 + Math.random() * 3
      items.push({
        path: types[i % types.length],
        pos: [Math.cos(angle) * dist, 0, Math.sin(angle) * dist],
        rot: Math.random() * Math.PI * 2,
        s: 1.5 + Math.random() * 1,
      })
    }

    return items
  }, [])

  return (
    <group name="dm-trees">
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

// ===== 岩石 =====
function DmRocks() {
  const rocks: { path: string; pos: [number, number, number]; s: number }[] = [
    { path: `${MEDIEVAL}/rock_single_A.gltf`, pos: [-3.5, 0, -2], s: 1.2 },
    { path: `${MEDIEVAL}/rock_single_B.gltf`, pos: [3.5, 0, -1.5], s: 1.5 },
    { path: `${MEDIEVAL}/rock_single_C.gltf`, pos: [-2, 0, 3.5], s: 1 },
    { path: `${MEDIEVAL}/rock_single_A.gltf`, pos: [2.5, 0, 3], s: 0.8 },
  ]

  return (
    <group name="dm-rocks">
      {rocks.map((r, i) => (
        <SceneModel key={i} path={r.path} position={r.pos} scale={r.s} castShadow />
      ))}
    </group>
  )
}

// ===== 装饰道具 =====
function DmProps() {
  return (
    <group name="dm-props">
      {/* 木桶 */}
      <SceneModel path={`${DUNGEON}/barrel_large.glb`} position={[-2, 0, -2.5]} scale={0.8} castShadow />

      {/* 麻袋 */}
      <SceneModel path={`${MEDIEVAL}/sack.gltf`} position={[2, 0, -2.5]} scale={1.5} castShadow />

      {/* 旗帜 */}
      <SceneModel path={`${MEDIEVAL}/flag_red.gltf`} position={[-3, 0, -3]} scale={2} castShadow />

      {/* 火把 (照明) */}
      <SceneModel path={`${DUNGEON}/torch_lit.glb`} position={[-2, 0, 0.5]} scale={1} />
      <SceneModel path={`${DUNGEON}/torch_lit.glb`} position={[2, 0, 0.5]} scale={1} />

      {/* 火把光源 */}
      <pointLight position={[-2, 1.2, 0.5]} intensity={0.6} color="#ff8844" distance={5} />
      <pointLight position={[2, 1.2, 0.5]} intensity={0.6} color="#ff8844" distance={5} />
    </group>
  )
}

// ===== 预加载 =====
const DM_PRELOAD = [
  `${DUNGEON}/torch_lit.glb`,
  `${DUNGEON}/stool.glb`,
  `${DUNGEON}/table_small_decorated_A.glb`,
  `${DUNGEON}/candle_lit.glb`,
  `${DUNGEON}/bottle_A_brown.glb`,
  `${DUNGEON}/barrel_large.glb`,
  `${MEDIEVAL}/tree_single_A.gltf`,
  `${MEDIEVAL}/tree_single_B.gltf`,
  `${MEDIEVAL}/trees_A_medium.gltf`,
  `${MEDIEVAL}/trees_B_medium.gltf`,
  `${MEDIEVAL}/rock_single_A.gltf`,
  `${MEDIEVAL}/rock_single_B.gltf`,
  `${MEDIEVAL}/rock_single_C.gltf`,
  `${MEDIEVAL}/tent.gltf`,
  `${MEDIEVAL}/sack.gltf`,
  `${MEDIEVAL}/flag_red.gltf`,
]
DM_PRELOAD.forEach((p) => useGLTF.preload(p))
