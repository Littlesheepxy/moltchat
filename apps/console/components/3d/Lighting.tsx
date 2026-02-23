'use client'

// ===== 灯光方案 — 户外冒险营地 =====
// 自然日光 + 暖色调环境光
// 篝火等局部光源在各场景组件中单独添加

export function Lighting() {
  return (
    <>
      {/* 环境光：偏暖的基础亮度 */}
      <ambientLight intensity={0.4} color="#fff8e8" />

      {/* 半球光：天空蓝 + 地面暖黄绿 */}
      <hemisphereLight
        args={['#87ceeb', '#8b7355', 0.5]}
        position={[0, 15, 0]}
      />

      {/* 主日光：右上方偏暖，模拟黄昏/清晨 */}
      <directionalLight
        position={[10, 18, 8]}
        intensity={1.0}
        color="#fff5e0"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-bias={-0.001}
      />

      {/* 补光：对侧柔和蓝光，模拟天空散射 */}
      <directionalLight
        position={[-10, 8, -6]}
        intensity={0.25}
        color="#b0d4f1"
      />

      {/* 背光：从后方微弱冷光 */}
      <directionalLight
        position={[0, 10, -14]}
        intensity={0.1}
        color="#c8d8f0"
      />

      {/* 雾气 (远处渐隐) */}
      <fog attach="fog" args={['#87a96b', 25, 50]} />
    </>
  )
}
