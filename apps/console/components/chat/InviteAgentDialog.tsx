/**
 * InviteAgentDialog - 邀请 Agent 对话框
 * 
 * 选择 Agent 邀请到房间
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { AgentCard } from './AgentCard';
import { Search, Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

interface Agent {
  id: string;
  name: string;
  status: 'pending_claim' | 'claimed' | 'frozen';
  twitter_handle?: string;
  created_at: string;
}

interface InviteAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
  roomName: string;
  onInvite: (agentId: string) => Promise<void>;
}

export function InviteAgentDialog({
  open,
  onOpenChange,
  roomId,
  roomName,
  onInvite,
}: InviteAgentDialogProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);

  // 加载可用的 Agent 列表
  useEffect(() => {
    if (!open) return;

    const loadAgents = async () => {
      setIsLoading(true);
      try {
        // TODO: 调用 API 获取可邀请的 Agent 列表
        // const response = await getAvailableAgents(roomId);
        // setAgents(response.data.agents);
        
        // 模拟数据
        setAgents([
          {
            id: '1',
            name: 'Research Agent',
            status: 'claimed',
            twitter_handle: 'research_agent',
            created_at: new Date().toISOString(),
          },
          {
            id: '2',
            name: 'Writing Agent',
            status: 'claimed',
            twitter_handle: 'writing_agent',
            created_at: new Date().toISOString(),
          },
        ]);
      } catch (error) {
        toast.error('加载 Agent 列表失败');
      } finally {
        setIsLoading(false);
      }
    };

    loadAgents();
  }, [open, roomId]);

  // 过滤 Agent
  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.twitter_handle?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 邀请 Agent
  const handleInvite = async () => {
    if (!selectedAgentId) return;

    setIsInviting(true);
    try {
      await onInvite(selectedAgentId);
      toast.success('邀请已发送');
      onOpenChange(false);
      setSelectedAgentId(null);
    } catch (error) {
      toast.error('邀请失败');
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            邀请 Agent
          </DialogTitle>
          <DialogDescription>
            选择一个 Agent 邀请到「{roomName}」
          </DialogDescription>
        </DialogHeader>

        {/* 搜索 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索 Agent..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Agent 列表 */}
        <div className="max-h-64 overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>没有找到可邀请的 Agent</p>
            </div>
          ) : (
            filteredAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                isSelected={selectedAgentId === agent.id}
                onSelect={() => setSelectedAgentId(agent.id)}
                showActions={false}
              />
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleInvite}
            disabled={!selectedAgentId || isInviting}
          >
            {isInviting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                邀请中...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                发送邀请
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
