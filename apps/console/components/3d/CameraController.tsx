'use client'

// ===== 相机控制器 =====
// 群聊：OrbitControls（可缩放，斜俯视）
// 私聊：固定近景相机（轻微平滑跟随），自动框住两人

import { useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { RoomType } from '@/lib/presenceTypes'

interface CameraControllerProps {
  roomType: RoomType
  /** 群聊：聚焦目标（点击 cluster 时传入其 center） */
  focusTarget?: [number, number, number]
  /** 私聊：两人中点 */
  dmCenter?: [number, number, number]
}

export function CameraController({
  roomType,
  focusTarget,
  dmCenter,
}: CameraControllerProps) {
  if (roomType === 'dm') {
    return <DmCamera center={dmCenter} />
  }
  return <GroupCamera focusTarget={focusTarget} />
}

// ===== 群聊相机：OrbitControls + 可选聚焦 =====

function GroupCamera({ focusTarget }: { focusTarget?: [number, number, number] }) {
  const controlsRef = useRef<any>(null)
  const targetVec = useRef(new THREE.Vector3(0, 0, 0))

  const { camera } = useThree()

  // 初始化相机位置：斜俯视
  useEffect(() => {
    camera.position.set(0, 14, 12)
    camera.lookAt(0, 0, 0)
  }, [camera])

  // 平滑聚焦
  useFrame((_, delta) => {
    if (!controlsRef.current) return

    if (focusTarget) {
      targetVec.current.lerp(
        new THREE.Vector3(focusTarget[0], focusTarget[1], focusTarget[2]),
        delta * 3,
      )
      controlsRef.current.target.copy(targetVec.current)
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.08}
      minDistance={4}
      maxDistance={25}
      maxPolarAngle={Math.PI / 2.2}   // 限制不能到正下方
      minPolarAngle={Math.PI / 8}     // 限制不能到正侧面
      target={[0, 0, 0]}
      // enableKeys 在新版 drei 中已移除（默认不拦截键盘）
    />
  )
}

// ===== 私聊相机：固定近景，平滑跟随中点 =====

function DmCamera({ center }: { center?: [number, number, number] }) {
  const { camera } = useThree()
  const targetCenter = useRef(new THREE.Vector3(0, 0.5, 0))

  useEffect(() => {
    camera.position.set(0, 2.5, 4)
    camera.lookAt(0, 0.5, 0)
  }, [camera])

  useFrame((_, delta) => {
    if (center) {
      targetCenter.current.lerp(
        new THREE.Vector3(center[0], center[1] + 0.5, center[2]),
        delta * 2,
      )
    }

    // 平滑跟随
    const target = targetCenter.current
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, target.x, delta * 2)
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, target.y + 2, delta * 2)
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, target.z + 3.5, delta * 2)
    camera.lookAt(target)
  })

  return null
}
