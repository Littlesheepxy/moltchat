// ===== SlotManager: Slot 生成、邻居关系、分配算法 =====

import type { Slot, Occupancy, RoomLayout, ClusterDef } from '@/lib/presenceTypes'

// ===== 工具函数 =====

function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

// ===================================================================
// 算法 A：生成"带邻居关系"的网格 Slots（用于走廊/开放区域）
// ===================================================================

export function generateGridSlots(params: {
  clusterId: string
  center: { x: number; z: number }
  rows: number
  cols: number
  spacing: number
  y?: number
}): Slot[] {
  const { clusterId, center, rows, cols, spacing, y = 0 } = params
  const slots: Slot[] = []

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = center.x + (c - (cols - 1) / 2) * spacing
      const z = center.z + (r - (rows - 1) / 2) * spacing

      const slot: Slot = {
        id: `${clusterId}-g-${r}-${c}`,
        position: [x, y, z],
        clusterId,
        type: 'grid',
        neighbors: {},
      }

      // 四联通邻居
      if (r > 0) slot.neighbors.up = `${clusterId}-g-${r - 1}-${c}`
      if (r < rows - 1) slot.neighbors.down = `${clusterId}-g-${r + 1}-${c}`
      if (c > 0) slot.neighbors.left = `${clusterId}-g-${r}-${c - 1}`
      if (c < cols - 1) slot.neighbors.right = `${clusterId}-g-${r}-${c + 1}`

      slots.push(slot)
    }
  }

  return slots
}

// ===================================================================
// 算法 B：小圆桌"自动围坐" Slots（用于 thread 聚团讨论）
// ===================================================================

export function generateCircleSeats(params: {
  clusterId: string
  center: { x: number; z: number }
  radius: number
  seatCount: number
  y?: number
}): Slot[] {
  const { clusterId, center, radius, seatCount, y = 0 } = params
  const seats: Slot[] = []
  const entranceId = `${clusterId}-entrance`

  for (let i = 0; i < seatCount; i++) {
    const angle = (i / seatCount) * Math.PI * 2
    const x = center.x + Math.cos(angle) * radius
    const z = center.z + Math.sin(angle) * radius

    const prevIdx = (i - 1 + seatCount) % seatCount
    const nextIdx = (i + 1) % seatCount

    seats.push({
      id: `${clusterId}-c-${i}`,
      position: [x, y, z],
      clusterId,
      type: 'circle',
      facingAngle: angle + Math.PI, // 朝向桌子中心
      neighbors: {
        left: `${clusterId}-c-${prevIdx}`,
        right: `${clusterId}-c-${nextIdx}`,
        up: entranceId,    // 离开桌子
        down: entranceId,  // 离开桌子
      },
    })
  }

  return seats
}

// ===================================================================
// 入口 Slot 生成
// ===================================================================

export function generateEntranceSlot(params: {
  clusterId: string
  center: { x: number; z: number }
  offsetDirection: 'north' | 'south' | 'east' | 'west'
  distance?: number
  y?: number
}): Slot {
  const { clusterId, center, offsetDirection, distance = 2.5, y = 0 } = params

  const offsets: Record<string, { x: number; z: number }> = {
    north: { x: 0, z: -distance },
    south: { x: 0, z: distance },
    east: { x: distance, z: 0 },
    west: { x: -distance, z: 0 },
  }
  const off = offsets[offsetDirection]

  return {
    id: `${clusterId}-entrance`,
    position: [center.x + off.x, y, center.z + off.z],
    clusterId,
    type: 'entrance',
    neighbors: {
      // 默认 down 连到第一个圆桌座位
      down: `${clusterId}-c-0`,
    },
  }
}

// ===================================================================
// 连接入口与网格 Slot
// ===================================================================

export function linkEntranceToGrid(
  entrance: Slot,
  gridSlots: Slot[],
  direction: 'up' | 'down' | 'left' | 'right',
): void {
  // 找最近的 grid slot
  let nearest: Slot | null = null
  let minDist = Infinity

  for (const gs of gridSlots) {
    const dx = gs.position[0] - entrance.position[0]
    const dz = gs.position[2] - entrance.position[2]
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist < minDist) {
      minDist = dist
      nearest = gs
    }
  }

  if (nearest) {
    entrance.neighbors[direction] = nearest.id
    // 反向连接
    const reverseMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
      up: 'down',
      down: 'up',
      left: 'right',
      right: 'left',
    }
    nearest.neighbors[reverseMap[direction]] = entrance.id
  }
}

// ===================================================================
// 连接两个入口（跨区移动）
// ===================================================================

export function linkEntrances(
  a: Slot,
  b: Slot,
  dirAtoB: 'up' | 'down' | 'left' | 'right',
): void {
  const reverseMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
    up: 'down',
    down: 'up',
    left: 'right',
    right: 'left',
  }
  a.neighbors[dirAtoB] = b.id
  b.neighbors[reverseMap[dirAtoB]] = a.id
}

// ===================================================================
// Slot 分配算法
// ===================================================================

/**
 * 为用户分配一个 slot。
 * threadId 存在 → 优先该 cluster 的 circle seats；
 * 无 threadId → 分配 grid slots / entrance。
 */
export function assignSlotForPresence(params: {
  clusterId: string
  threadId?: string
  userId: string
  allSlots: Map<string, Slot>
  occupancy: Occupancy
}): string | null {
  const { clusterId, threadId, userId, allSlots, occupancy } = params

  if (threadId) {
    return assignCircleSeat(clusterId, threadId, userId, allSlots, occupancy)
  }
  return assignGridSlot(clusterId, userId, allSlots, occupancy)
}

/** 分配圆桌座位 */
function assignCircleSeat(
  clusterId: string,
  threadId: string,
  userId: string,
  allSlots: Map<string, Slot>,
  occupancy: Occupancy,
): string | null {
  // 收集此 cluster 的所有 circle seats
  const circleSeats: Slot[] = []
  allSlots.forEach((slot) => {
    if (slot.clusterId === clusterId && slot.type === 'circle') {
      circleSeats.push(slot)
    }
  })
  if (circleSeats.length === 0) return null

  // 确定性推荐座位：hash(threadId + userId) % seatCount
  const preferredIdx = simpleHash(threadId + userId) % circleSeats.length

  // 从推荐座位开始，沿两侧扩散寻找空位
  for (let offset = 0; offset < circleSeats.length; offset++) {
    const idx = (preferredIdx + offset) % circleSeats.length
    const seatId = circleSeats[idx].id
    if (!occupancy.has(seatId) || occupancy.get(seatId) === userId) {
      return seatId
    }
  }

  // 圆桌满了，退回 grid
  return assignGridSlot(clusterId, userId, allSlots, occupancy)
}

/** 分配 grid slot */
function assignGridSlot(
  clusterId: string,
  userId: string,
  allSlots: Map<string, Slot>,
  occupancy: Occupancy,
): string | null {
  // 优先入口
  const entranceId = `${clusterId}-entrance`
  if (!occupancy.has(entranceId) || occupancy.get(entranceId) === userId) {
    return entranceId
  }

  // BFS 从入口找最近空 grid slot
  const entrance = allSlots.get(entranceId)
  if (entrance) {
    const result = findNearestAvailable(entrance.id, allSlots, occupancy, userId)
    if (result) return result
  }

  // 最后兜底：任意空的 grid slot
  let fallbackSlotId: string | null = null
  allSlots.forEach((slot) => {
    if (fallbackSlotId) return
    if (slot.clusterId === clusterId && slot.type === 'grid') {
      if (!occupancy.has(slot.id) || occupancy.get(slot.id) === userId) {
        fallbackSlotId = slot.id
      }
    }
  })
  if (fallbackSlotId) return fallbackSlotId

  return null
}

// ===================================================================
// BFS 寻找最近可用 slot
// ===================================================================

export function findNearestAvailable(
  startSlotId: string,
  allSlots: Map<string, Slot>,
  occupancy: Occupancy,
  excludeUserId?: string,
): string | null {
  const visited = new Set<string>()
  const queue = [startSlotId]
  visited.add(startSlotId)

  while (queue.length > 0) {
    const currentId = queue.shift()!
    const current = allSlots.get(currentId)
    if (!current) continue

    const occupant = occupancy.get(currentId)
    if (!occupant || occupant === excludeUserId) {
      return currentId
    }

    // 入队邻居
    const dirs: Array<'up' | 'down' | 'left' | 'right'> = ['up', 'down', 'left', 'right']
    for (const dir of dirs) {
      const neighborId = current.neighbors[dir]
      if (neighborId && !visited.has(neighborId)) {
        visited.add(neighborId)
        queue.push(neighborId)
      }
    }
  }

  return null
}

// ===================================================================
// 构建群聊房间布局
// ===================================================================

export function buildGroupRoomLayout(): RoomLayout {
  const allSlots = new Map<string, Slot>()

  const clusters: ClusterDef[] = [
    { id: 'roundtable', label: '圆桌区', center: { x: 0, z: -1 }, tableRadius: 1.8, seatCount: 10 },
    { id: 'sofa', label: '沙发区', center: { x: -6, z: -1 }, tableRadius: 1.3, seatCount: 6 },
    { id: 'whiteboard', label: '白板区', center: { x: 6, z: -1 }, tableRadius: 1.5, seatCount: 8 },
    { id: 'lounge', label: '休息区', center: { x: 0, z: -7 }, tableRadius: 1.1, seatCount: 6 },
  ]

  // 为每个 cluster 生成圆桌座位 + 入口
  for (const cluster of clusters) {
    const seats = generateCircleSeats({
      clusterId: cluster.id,
      center: cluster.center,
      radius: cluster.tableRadius,
      seatCount: cluster.seatCount,
    })
    seats.forEach((s) => allSlots.set(s.id, s))

    const entrance = generateEntranceSlot({
      clusterId: cluster.id,
      center: cluster.center,
      offsetDirection: 'south',
      distance: cluster.tableRadius + 1.8,
    })
    allSlots.set(entrance.id, entrance)
  }

  // 生成中央走廊网格（连接各区域）
  const hallGrid = generateGridSlots({
    clusterId: 'hall',
    center: { x: 0, z: 5 },
    rows: 3,
    cols: 10,
    spacing: 1.0,
  })
  hallGrid.forEach((s) => allSlots.set(s.id, s))

  // 连接入口到网格
  for (const cluster of clusters) {
    const entrance = allSlots.get(`${cluster.id}-entrance`)
    if (entrance) {
      linkEntranceToGrid(entrance, hallGrid, 'down')
    }
  }

  // 跨区入口互联
  const rtE = allSlots.get('roundtable-entrance')!
  const sfE = allSlots.get('sofa-entrance')!
  const wbE = allSlots.get('whiteboard-entrance')!
  const lgE = allSlots.get('lounge-entrance')!

  linkEntrances(rtE, sfE, 'left')
  linkEntrances(rtE, wbE, 'right')
  linkEntrances(lgE, rtE, 'down')

  return { slots: allSlots, clusters }
}

// ===================================================================
// 构建私聊房间布局
// ===================================================================

export function buildDmRoomLayout(): RoomLayout {
  const allSlots = new Map<string, Slot>()

  const seatA: Slot = {
    id: 'dm-seat-a',
    position: [-0.8, 0, 0],
    type: 'circle',
    facingAngle: 0,        // 面朝右（朝向 B）
    neighbors: { right: 'dm-seat-b' },
  }

  const seatB: Slot = {
    id: 'dm-seat-b',
    position: [0.8, 0, 0],
    type: 'circle',
    facingAngle: Math.PI,  // 面朝左（朝向 A）
    neighbors: { left: 'dm-seat-a' },
  }

  allSlots.set(seatA.id, seatA)
  allSlots.set(seatB.id, seatB)

  return { slots: allSlots, clusters: [] }
}

// ===================================================================
// 获取 cluster 的所有 slot ID
// ===================================================================

export function getClusterSlotIds(
  allSlots: Map<string, Slot>,
  clusterId: string,
): string[] {
  const ids: string[] = []
  allSlots.forEach((slot) => {
    if (slot.clusterId === clusterId) ids.push(slot.id)
  })
  return ids
}
