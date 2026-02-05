/**
 * DMRequestCard - DM 请求卡片
 * 
 * 显示待处理的 DM 请求
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from './shared/Avatar';
import { Check, X, MessageSquare, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface DMRequest {
  id: string;
  fromAgentId: string;
  fromAgentName: string;
  intent: 'clarify' | 'coordinate' | 'handoff' | 'feedback';
  context?: string;
  createdAt: string;
  expiresAt: string;
}

interface DMRequestCardProps {
  request: DMRequest;
  onAccept: (requestId: string) => Promise<void>;
  onReject: (requestId: string) => Promise<void>;
}

const intentLabels: Record<DMRequest['intent'], { label: string; color: string }> = {
  clarify: { label: '澄清问题', color: 'bg-blue-500/10 text-blue-500' },
  coordinate: { label: '协调任务', color: 'bg-green-500/10 text-green-500' },
  handoff: { label: '任务交接', color: 'bg-orange-500/10 text-orange-500' },
  feedback: { label: '反馈结果', color: 'bg-purple-500/10 text-purple-500' },
};

export function DMRequestCard({ request, onAccept, onReject }: DMRequestCardProps) {
  const [isLoading, setIsLoading] = useState<'accept' | 'reject' | null>(null);
  
  const intentInfo = intentLabels[request.intent] || { label: request.intent, color: 'bg-gray-500/10 text-gray-500' };
  
  // 计算剩余时间
  const getTimeRemaining = () => {
    const expires = new Date(request.expiresAt).getTime();
    const now = Date.now();
    const diff = expires - now;
    
    if (diff <= 0) return '已过期';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) return `${hours}小时${minutes}分钟后过期`;
    return `${minutes}分钟后过期`;
  };

  const handleAccept = async () => {
    setIsLoading('accept');
    try {
      await onAccept(request.id);
      toast.success('已接受 DM 请求');
    } catch (error) {
      toast.error('操作失败');
    } finally {
      setIsLoading(null);
    }
  };

  const handleReject = async () => {
    setIsLoading('reject');
    try {
      await onReject(request.id);
      toast.success('已拒绝 DM 请求');
    } catch (error) {
      toast.error('操作失败');
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <Avatar name={request.fromAgentName} size="md" isAgent />
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              {request.fromAgentName}
              <Badge className={intentInfo.color}>{intentInfo.label}</Badge>
            </CardTitle>
            <CardDescription className="flex items-center gap-1 mt-1">
              <Clock className="h-3 w-3" />
              {getTimeRemaining()}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      {request.context && (
        <CardContent className="pt-0 pb-3">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {request.context}
          </p>
        </CardContent>
      )}
      
      <CardContent className="pt-0 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={handleReject}
          disabled={!!isLoading}
        >
          {isLoading === 'reject' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <X className="h-4 w-4 mr-1" />
              拒绝
            </>
          )}
        </Button>
        <Button
          size="sm"
          className="flex-1"
          onClick={handleAccept}
          disabled={!!isLoading}
        >
          {isLoading === 'accept' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Check className="h-4 w-4 mr-1" />
              接受
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
