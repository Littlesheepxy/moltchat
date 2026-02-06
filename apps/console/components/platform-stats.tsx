'use client';

import { useState, useEffect } from 'react';
import { Users, Bot, MessageSquare, MessagesSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3002';

interface Stats {
  humans: number;
  agents: number;
  rooms: number;
  dms: number;
  messages: number;
}

interface PlatformStatsProps {
  variant?: 'large' | 'compact';
  className?: string;
}

// 格式化大数字
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

// 动画计数器 Hook
function useAnimatedCount(target: number, duration: number = 1000): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (target === 0) {
      setCount(0);
      return;
    }

    const startTime = Date.now();
    const startValue = 0;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(startValue + (target - startValue) * easeOut);
      
      setCount(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [target, duration]);

  return count;
}

// 单个统计项组件
function StatItem({ 
  icon: Icon, 
  value, 
  label, 
  variant 
}: { 
  icon: React.ElementType; 
  value: number; 
  label: string;
  variant: 'large' | 'compact';
}) {
  const animatedValue = useAnimatedCount(value);

  if (variant === 'large') {
    return (
      <div className="flex items-center gap-1 sm:gap-2">
        <Icon className="h-3.5 w-3.5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-primary" />
        <span className="text-sm sm:text-3xl md:text-4xl font-bold text-foreground tabular-nums">
          {formatNumber(animatedValue)}
        </span>
        <span className="text-[10px] sm:text-sm md:text-base text-muted-foreground">{label}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Icon className="h-4 w-4" />
      <span className="font-medium">{formatNumber(animatedValue)}</span>
    </div>
  );
}

export function PlatformStats({ variant = 'large', className }: PlatformStatsProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch(`${GATEWAY_URL}/v1/stats`);
        const data = await res.json();
        if (data.success && data.data) {
          setStats(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
        // 使用模拟数据
        setStats({
          humans: 156,
          agents: 423,
          rooms: 89,
          dms: 234,
          messages: 12580,
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (isLoading || !stats) {
  if (variant === 'large') {
    return (
      <div className={cn('flex items-center justify-center gap-3 sm:gap-12 flex-wrap', className)}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-1 animate-pulse">
            <div className="h-3.5 w-3.5 sm:h-6 sm:w-6 bg-muted rounded" />
            <div className="h-4 sm:h-10 w-8 sm:w-16 bg-muted rounded" />
            <div className="h-3 sm:h-4 w-6 sm:w-12 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

    return (
      <div className={cn('flex items-center gap-4', className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-4 w-12 bg-muted rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (variant === 'large') {
    return (
      <div className={cn('flex items-center justify-center gap-3 sm:gap-6 md:gap-10 flex-wrap', className)}>
        <StatItem icon={Users} value={stats.humans} label="Humans" variant="large" />
        <div className="hidden sm:block h-8 w-px bg-border/50" />
        <StatItem icon={Bot} value={stats.agents} label="Agents" variant="large" />
        <div className="hidden sm:block h-8 w-px bg-border/50" />
        <StatItem icon={MessageSquare} value={stats.rooms} label="Rooms" variant="large" />
        <div className="hidden sm:block h-8 w-px bg-border/50" />
        <StatItem icon={MessagesSquare} value={stats.messages} label="Messages" variant="large" />
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <StatItem icon={Bot} value={stats.agents} label="Agents" variant="compact" />
      <StatItem icon={MessageSquare} value={stats.rooms} label="Rooms" variant="compact" />
      <StatItem icon={MessagesSquare} value={stats.messages} label="Messages" variant="compact" />
    </div>
  );
}
