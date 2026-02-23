// ===== Deterministic Color Generation from Seed =====

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash)
}

export interface AvatarColors {
  top: string      // 上衣主色
  bottom: string   // 裤子/裙子主色
  hair: string     // 头发颜色
  skin: string     // 肤色
  accent: string   // 配件颜色
}

// 肤色预设盘（从浅到深）
const SKIN_PALETTE = [
  '#FFE0BD', '#FFCD94', '#EAC086', '#FFAD60',
  '#D08B5B', '#AE8B61', '#8D5524', '#60461F',
]

// 头发颜色预设盘
const HAIR_PALETTE = [
  '#090806', '#2C222B', '#3B3024', '#4E433F',
  '#504444', '#6A4E42', '#A7856A', '#B89778',
  '#DCD0BA', '#DEBC99', '#B55239', '#8D4A43',
  '#91672C', '#E6CEA8',
]

/**
 * 由 seed 字符串生成确定性的 Avatar 配色方案。
 * 同 seed 每次结果一致，不同 seed 有明显区分。
 */
export function colorsFromSeed(seed: string): AvatarColors {
  const h1 = hashString(seed)
  const h2 = hashString(seed + '__top')
  const h3 = hashString(seed + '__bottom')
  const h4 = hashString(seed + '__hair')

  // 上衣：全色域，饱和度高
  const topHue = h2 % 360
  // 裤子：偏冷色调（蓝紫灰）
  const bottomHue = (h3 % 180) + 180

  return {
    top: `hsl(${topHue}, 65%, 55%)`,
    bottom: `hsl(${bottomHue}, 45%, 38%)`,
    hair: HAIR_PALETTE[h4 % HAIR_PALETTE.length],
    skin: SKIN_PALETTE[h1 % SKIN_PALETTE.length],
    accent: `hsl(${(topHue + 150) % 360}, 70%, 60%)`,
  }
}

/**
 * HSL 字符串转 hex（用于 THREE.Color）
 */
export function hslToHex(hsl: string): string {
  // 创建临时 div 解析 hsl - 在 Three.js 中直接使用 hsl 字符串也可以
  return hsl
}

/**
 * 根据 seed 获取配件开关（确定性）
 */
export function accessoriesFromSeed(seed: string): {
  hasGlasses: boolean
  hasHat: boolean
  hasBackpack: boolean
} {
  const h = hashString(seed + '__acc')
  return {
    hasGlasses: (h & 1) === 1,
    hasHat: (h & 2) === 2,
    hasBackpack: (h & 4) === 4,
  }
}
