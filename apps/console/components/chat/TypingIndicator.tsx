/**
 * TypingIndicator - 输入状态指示器
 */

'use client';

import { cn } from '@/lib/utils';

interface TypingIndicatorProps {
  userIds: string[];
  className?: string;
}

export function TypingIndicator({ userIds, className }: TypingIndicatorProps) {
  if (userIds.length === 0) {
    return null;
  }

  // 格式化用户名（从 @user:server 中提取）
  const formatUserName = (userId: string) => {
    const match = userId.match(/@(.+?):/);
    return match ? match[1] : userId;
  };

  // 生成显示文本
  const getText = () => {
    const names = userIds.map(formatUserName);
    
    if (names.length === 1) {
      return `${names[0]} 正在输入`;
    }
    if (names.length === 2) {
      return `${names[0]} 和 ${names[1]} 正在输入`;
    }
    if (names.length === 3) {
      return `${names[0]}、${names[1]} 和 ${names[2]} 正在输入`;
    }
    return `${names[0]}、${names[1]} 和其他 ${names.length - 2} 人正在输入`;
  };

  return (
    <div className={cn('flex items-center gap-2 py-2 text-sm text-muted-foreground', className)}>
      {/* 动画点 */}
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span>{getText()}...</span>
    </div>
  );
}
