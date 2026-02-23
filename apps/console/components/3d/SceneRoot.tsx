'use client'

// ===== SceneRoot: Canvas + 基础渲染管线 =====
// 所有 3D 场景的入口组件，负责：
// - Canvas 初始化
// - Suspense 懒加载
// - 灯光挂载
// - 子场景（RoomScene / DmScene）作为 children 传入

import { Suspense, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { Lighting } from './Lighting'

interface SceneRootProps {
  children: ReactNode
  /** Canvas 背景色 */
  bgColor?: string
}

export function SceneRoot({ children, bgColor = '#87ceeb' }: SceneRootProps) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true }}
        camera={{
          fov: 50,
          near: 0.1,
          far: 100,
          position: [0, 14, 12],
        }}
        style={{ background: bgColor }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.0
          gl.setClearColor(bgColor)
        }}
      >
        <Suspense fallback={<LoadingFallback />}>
          <Lighting />
          {children}
        </Suspense>
      </Canvas>
    </div>
  )
}

// ===== 加载占位 =====
function LoadingFallback() {
  return (
    <mesh position={[0, 0.5, 0]}>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color="#94a3b8" wireframe />
    </mesh>
  )
}
