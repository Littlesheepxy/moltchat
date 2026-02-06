/**
 * Avatar - 头像组件
 * 
 * 支持用户头像、Agent 头像（DiceBear 自动生成）、房间头像
 */

'use client';

import { cn } from '@/lib/utils';
import { Bot, User, MessageSquare } from 'lucide-react';
import { getAgentAvatarUrl, getRoomAvatarUrl } from '@/lib/avatar';

interface AvatarProps {
  name: string;
  avatarUrl?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isAgent?: boolean;
  isRoom?: boolean;
  className?: string;
  /** 用于 DiceBear 生成的 seed，默认使用 name */
  seed?: string;
}

const sizeClasses = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

const iconSizes = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8',
};

const badgeSizes = {
  xs: 'h-2 w-2',
  sm: 'h-2.5 w-2.5',
  md: 'h-3 w-3',
  lg: 'h-3 w-3',
  xl: 'h-3.5 w-3.5',
};

// 根据名称生成背景颜色
function getColorFromName(name: string): string {
  const colors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-yellow-500',
    'bg-lime-500',
    'bg-green-500',
    'bg-emerald-500',
    'bg-teal-500',
    'bg-cyan-500',
    'bg-sky-500',
    'bg-blue-500',
    'bg-indigo-500',
    'bg-violet-500',
    'bg-purple-500',
    'bg-fuchsia-500',
    'bg-pink-500',
    'bg-rose-500',
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

// 获取名称首字母
function getInitials(name: string): string {
  const parts = name.split(/[\s_-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

export function Avatar({
  name,
  avatarUrl,
  size = 'md',
  isAgent = false,
  isRoom = false,
  className,
  seed,
}: AvatarProps) {
  const sizeClass = sizeClasses[size];
  const iconSize = iconSizes[size];
  const badgeSize = badgeSizes[size];

  // 决定使用的头像 URL
  const resolvedAvatarUrl = avatarUrl 
    || (isAgent ? getAgentAvatarUrl(seed || name) : undefined)
    || (isRoom ? getRoomAvatarUrl(seed || name) : undefined);

  // 有头像图片（自定义或 DiceBear 生成）
  if (resolvedAvatarUrl) {
    return (
      <div
        className={cn(
          'relative rounded-full overflow-hidden flex-shrink-0 bg-muted',
          sizeClass,
          className
        )}
      >
        <img
          src={resolvedAvatarUrl}
          alt={name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {isAgent && (
          <div className="absolute -bottom-0.5 -right-0.5 bg-primary rounded-full p-0.5 border border-background">
            <Bot className={badgeSize + ' text-primary-foreground'} />
          </div>
        )}
      </div>
    );
  }

  // 无头像，显示首字母或图标（仅用于人类用户）
  const bgColor = getColorFromName(name);

  return (
    <div
      className={cn(
        'relative rounded-full flex items-center justify-center flex-shrink-0 text-white font-medium',
        sizeClass,
        bgColor,
        className
      )}
    >
      {name ? (
        getInitials(name)
      ) : (
        <User className={iconSize} />
      )}
    </div>
  );
}
