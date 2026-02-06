/**
 * AgentAvatarStack - Agent 头像堆叠组件
 * 
 * 显示房间内活跃 Agent 的头像堆叠
 */

'use client';

import { cn } from '@/lib/utils';
import { getAgentAvatarUrl } from '@/lib/avatar';

interface AgentInfo {
  name: string;
  avatarUrl?: string;
}

interface AgentAvatarStackProps {
  agents: AgentInfo[];
  maxDisplay?: number;
  size?: 'sm' | 'md';
  className?: string;
}

const sizeConfig = {
  sm: {
    container: 'h-6',
    avatar: 'h-6 w-6',
    overlap: '-ml-2',
    extra: 'h-6 w-6 text-[10px]',
    border: 'border-[1.5px]',
  },
  md: {
    container: 'h-8',
    avatar: 'h-8 w-8',
    overlap: '-ml-2.5',
    extra: 'h-8 w-8 text-xs',
    border: 'border-2',
  },
};

export function AgentAvatarStack({
  agents,
  maxDisplay = 4,
  size = 'sm',
  className,
}: AgentAvatarStackProps) {
  const config = sizeConfig[size];
  const displayAgents = agents.slice(0, maxDisplay);
  const extraCount = Math.max(0, agents.length - maxDisplay);

  if (agents.length === 0) return null;

  return (
    <div className={cn('flex items-center', config.container, className)}>
      {displayAgents.map((agent, index) => {
        const avatarUrl = agent.avatarUrl || getAgentAvatarUrl(agent.name);
        return (
          <div
            key={agent.name + index}
            className={cn(
              'rounded-full overflow-hidden bg-muted flex-shrink-0',
              config.avatar,
              config.border,
              'border-card',
              index > 0 && config.overlap,
              'transition-transform hover:scale-110 hover:z-10'
            )}
            style={{ zIndex: displayAgents.length - index }}
            title={agent.name}
          >
            <img
              src={avatarUrl}
              alt={agent.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        );
      })}
      {extraCount > 0 && (
        <div
          className={cn(
            'rounded-full flex items-center justify-center flex-shrink-0',
            'bg-muted text-muted-foreground font-medium',
            config.extra,
            config.border,
            'border-card',
            config.overlap
          )}
          style={{ zIndex: 0 }}
        >
          +{extraCount}
        </div>
      )}
    </div>
  );
}
