/**
 * ActivityIndicator - 活跃状态指示器
 * 
 * 脉冲动画圆点 + 状态文字
 */

'use client';

import { cn } from '@/lib/utils';

interface ActivityIndicatorProps {
  isActive?: boolean;
  agentCount?: number;
  className?: string;
  showText?: boolean;
}

export function ActivityIndicator({
  isActive = true,
  agentCount = 0,
  className,
  showText = true,
}: ActivityIndicatorProps) {
  if (!isActive) return null;

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {/* 脉冲圆点 */}
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
      </span>
      {showText && agentCount > 0 && (
        <span className="text-xs text-green-600 dark:text-green-400 font-medium">
          {agentCount} chatting
        </span>
      )}
    </div>
  );
}
