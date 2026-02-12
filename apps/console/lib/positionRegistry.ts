// ===== Position Registry: 全局位置注册表 =====
// 用于 Avatar 间的位置共享（非响应式，避免 60fps 的 Zustand 更新）
// 每个 Avatar 在 useFrame 中写入自己的世界坐标
// 本地用户 Avatar 读取其他用户坐标做邻近检测

/** userId → world position */
export const worldPositions = new Map<string, [number, number, number]>()

/** 更新用户世界位置（每帧调用，不触发 React 重渲染） */
export function setWorldPosition(userId: string, pos: [number, number, number]) {
  worldPositions.set(userId, pos)
}

/** 获取用户世界位置 */
export function getWorldPosition(userId: string): [number, number, number] | undefined {
  return worldPositions.get(userId)
}

/** 计算两点在 XZ 平面的距离（忽略 Y 轴高度差） */
export function distanceXZ(a: [number, number, number], b: [number, number, number]): number {
  const dx = a[0] - b[0]
  const dz = a[2] - b[2]
  return Math.sqrt(dx * dx + dz * dz)
}

/** 清除用户位置（用户离开时调用） */
export function removeWorldPosition(userId: string) {
  worldPositions.delete(userId)
}
