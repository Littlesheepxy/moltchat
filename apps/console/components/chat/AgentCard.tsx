/**
 * AgentCard - Agent 卡片组件
 * 
 * 显示 Agent 信息和状态
 */

'use client';

import { cn } from '@/lib/utils';
import { Avatar } from './shared/Avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Bot, 
  CheckCircle, 
  Clock, 
  XCircle, 
  Settings,
  ExternalLink,
  MoreVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';

interface Agent {
  id: string;
  name: string;
  status: 'pending_claim' | 'claimed' | 'frozen';
  twitter_handle?: string;
  created_at: string;
  room_count?: number;
}

interface AgentCardProps {
  agent: Agent;
  onSelect?: () => void;
  isSelected?: boolean;
  showActions?: boolean;
}

const statusConfig = {
  pending_claim: {
    label: '待验证',
    color: 'bg-yellow-500/10 text-yellow-500',
    icon: Clock,
  },
  claimed: {
    label: '已验证',
    color: 'bg-green-500/10 text-green-500',
    icon: CheckCircle,
  },
  frozen: {
    label: '已冻结',
    color: 'bg-red-500/10 text-red-500',
    icon: XCircle,
  },
};

export function AgentCard({ agent, onSelect, isSelected, showActions = true }: AgentCardProps) {
  const status = statusConfig[agent.status] || statusConfig.pending_claim;
  const StatusIcon = status.icon;

  return (
    <Card
      className={cn(
        'transition-all cursor-pointer hover:border-primary/50',
        isSelected && 'border-primary ring-1 ring-primary'
      )}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <Avatar name={agent.name} size="lg" isAgent />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium truncate">{agent.name}</h3>
              <Badge className={cn('flex-shrink-0', status.color)}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {status.label}
              </Badge>
            </div>

            {agent.twitter_handle && (
              <p className="text-sm text-muted-foreground mt-1">
                @{agent.twitter_handle}
              </p>
            )}

            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Bot className="h-3 w-3" />
                {agent.room_count || 0} 个房间
              </span>
              <span>
                创建于 {new Date(agent.created_at).toLocaleDateString('zh-CN')}
              </span>
            </div>
          </div>

          {/* Actions */}
          {showActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/console/settings/agents/${agent.id}`}>
                    <Settings className="h-4 w-4 mr-2" />
                    管理 Agent
                  </Link>
                </DropdownMenuItem>
                {agent.twitter_handle && (
                  <DropdownMenuItem asChild>
                    <a 
                      href={`https://twitter.com/${agent.twitter_handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      查看 Twitter
                    </a>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
