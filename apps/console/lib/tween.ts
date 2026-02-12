// ===== Tween / Easing Utilities for 3D Animation =====

/** 线性插值 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** 三维向量线性插值（写入 out 避免 GC） */
export function lerpV3(
  out: [number, number, number],
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  out[0] = lerp(a[0], b[0], t)
  out[1] = lerp(a[1], b[1], t)
  out[2] = lerp(a[2], b[2], t)
  return out
}

/** 角度插值（最短路径） */
export function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a
  while (diff > Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2
  return a + diff * t
}

// ===== Easing Functions =====

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

export function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4)
}

export function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

// ===== Tween State Helper =====

export interface TweenState {
  startPos: [number, number, number]
  endPos: [number, number, number]
  progress: number     // 0 → 1
  duration: number     // seconds
  startAngle: number
  endAngle: number
}

export function createTweenState(
  pos: [number, number, number],
  angle: number = 0,
): TweenState {
  return {
    startPos: [...pos] as [number, number, number],
    endPos: [...pos] as [number, number, number],
    progress: 1,
    duration: 0.8,
    startAngle: angle,
    endAngle: angle,
  }
}

/**
 * 启动一次 tween：从当前位置过渡到目标位置
 */
export function startTween(
  tween: TweenState,
  currentPos: [number, number, number],
  targetPos: [number, number, number],
  currentAngle: number,
  targetAngle: number,
  duration: number = 0.8,
): void {
  tween.startPos = [...currentPos] as [number, number, number]
  tween.endPos = [...targetPos] as [number, number, number]
  tween.startAngle = currentAngle
  tween.endAngle = targetAngle
  tween.progress = 0
  tween.duration = duration
}

/**
 * 每帧更新 tween，返回当前插值位置和角度
 */
export function updateTween(
  tween: TweenState,
  delta: number,
): { pos: [number, number, number]; angle: number; done: boolean } {
  if (tween.progress >= 1) {
    return {
      pos: [...tween.endPos] as [number, number, number],
      angle: tween.endAngle,
      done: true,
    }
  }

  tween.progress = Math.min(1, tween.progress + delta / tween.duration)
  const t = easeInOutCubic(tween.progress)

  const pos: [number, number, number] = [0, 0, 0]
  lerpV3(pos, tween.startPos, tween.endPos, t)

  const angle = lerpAngle(tween.startAngle, tween.endAngle, t)

  return { pos, angle, done: tween.progress >= 1 }
}
