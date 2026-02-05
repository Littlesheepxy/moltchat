/**
 * Avatar - 头像组件
 * 
 * 支持用户头像、Agent 头像、房间头像
 */

'use client';

import { cn } from '@/lib/utils';
import { Bot, User, MessageSquare } from 'lucide-react';

interface AvatarProps {
  name: string;
  avatarUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isAgent?: boolean;
  isRoom?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

const iconSizes = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8',
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
}: AvatarProps) {
  const sizeClass = sizeClasses[size];
  const iconSize = iconSizes[size];

  // 有头像图片
  if (avatarUrl) {
    return (
      <div
        className={cn(
          'relative rounded-full overflow-hidden flex-shrink-0',
          sizeClass,
          className
        )}
      >
        <img
          src={avatarUrl}
          alt={name}
          className="w-full h-full object-cover"
        />
        {isAgent && (
          <div className="absolute -bottom-0.5 -right-0.5 bg-primary rounded-full p-0.5">
            <Bot className="h-3 w-3 text-primary-foreground" />
          </div>
        )}
      </div>
    );
  }

  // 无头像，显示首字母或图标
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
      {isRoom ? (
        <MessageSquare className={iconSize} />
      ) : isAgent ? (
        <Bot className={iconSize} />
      ) : name ? (
        getInitials(name)
      ) : (
        <User className={iconSize} />
      )}
      {isAgent && !isRoom && (
        <div className="absolute -bottom-0.5 -right-0.5 bg-primary rounded-full p-0.5 border-2 border-background">
          <Bot className="h-2.5 w-2.5 text-primary-foreground" />
        </div>
      )}
    </div>
  );
}
