'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getExplorationStatus, decideDMPrescreening, type ExplorationMessage, type ExplorationStatus } from '@/lib/api';
import { Bot, Sparkles, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown } from 'lucide-react';

interface AgentChatProgressViewProps {
  explorationId: string;
  otherPartyName?: string;
  onDecisionMade?: (decision: 'want_chat' | 'pass', sessionId?: string) => void;
  onClose?: () => void;
  compact?: boolean; // 紧凑模式用于列表里的状态条
}

const POLL_INTERVAL_ACTIVE = 3000;  // 对谈中：3s 轮询

export function AgentChatProgressView({
  explorationId,
  otherPartyName,
  onDecisionMade,
  onClose,
  compact = false,
}: AgentChatProgressViewProps) {
  const [status, setStatus] = useState<ExplorationStatus | null>(null);
  const [messages, setMessages] = useState<ExplorationMessage[]>([]);
  const [showMessages, setShowMessages] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [passReason, setPassReason] = useState('');
  const [showPassInput, setShowPassInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

  const fetchStatus = useCallback(async () => {
    if (!isMounted.current) return;
    try {
      const result = await getExplorationStatus(explorationId);
      if (!isMounted.current) return;
      if (!result.success) return;

      const exp = result.data.exploration as unknown as ExplorationStatus & {
        other_party?: { display_name?: string | null };
        match_score?: number | null;
        my_decision?: string;
        status?: string;
        total_rounds?: number;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [key: string]: any;
      };

      setStatus({
        id: exp.id,
        status: exp.status as ExplorationStatus['status'],
        total_rounds: exp.total_rounds ?? 0,
        max_rounds: exp.max_rounds ?? 10,
        match_score: exp.match_score ?? null,
        my_decision: exp.my_decision ?? 'pending',
        other_party_name: exp.other_party?.display_name ?? otherPartyName ?? null,
      });
      setMessages(result.data.messages ?? []);
    } catch {
      setError('加载失败，请刷新重试');
    }
  }, [explorationId, otherPartyName]);

  // 轮询逻辑：初次加载 + 定时刷新（直到完成）
  useEffect(() => {
    isMounted.current = true;
    let stopped = false;

    const poll = async () => {
      if (stopped || !isMounted.current) return;
      await fetchStatus();
      // 读取最新 status 需要通过 ref，这里用 stopped flag 控制
      if (!stopped && isMounted.current) {
        pollRef.current = setTimeout(poll, POLL_INTERVAL_ACTIVE);
      }
    };

    poll();

    return () => {
      stopped = true;
      isMounted.current = false;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [fetchStatus]);

  // 状态完成后停止轮询
  useEffect(() => {
    if (status?.status === 'completed' || status?.status === 'failed') {
      if (pollRef.current) {
        clearTimeout(pollRef.current);
        pollRef.current = null;
      }
    }
  }, [status?.status]);

  // 新消息时滚动到底部
  useEffect(() => {
    if (showMessages) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, showMessages]);

  const handleDecide = async (decision: 'want_chat' | 'pass') => {
    if (decision === 'pass' && !showPassInput) {
      setShowPassInput(true);
      return;
    }
    setDeciding(true);
    try {
      const result = await decideDMPrescreening(explorationId, decision, passReason || undefined);
      if (result.success) {
        onDecisionMade?.(decision, result.data.dm_session_id);
      }
    } catch {
      setError('操作失败，请重试');
    } finally {
      setDeciding(false);
    }
  };

  if (error) {
    return (
      <div className="text-xs text-destructive p-3 bg-destructive/10 rounded-xl">
        {error}
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
        <div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        加载中...
      </div>
    );
  }

  const isActive = status.status === 'in_progress' || status.status === 'pending';
  const isDone = status.status === 'completed';
  const isFailed = status.status === 'failed';
  const scorePercent = status.match_score != null ? Math.round(status.match_score * 100) : null;
  const scoreColor = scorePercent != null
    ? scorePercent >= 70 ? 'text-green-500' : scorePercent >= 40 ? 'text-yellow-500' : 'text-muted-foreground'
    : '';
  const alreadyDecided = status.my_decision !== 'pending';
  const name = status.other_party_name ?? '对方';

  // ── 紧凑模式：用于 DM 列表里的状态条 ──
  if (compact) {
    return (
      <div className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-xl text-xs',
        isActive && 'bg-primary/5 border border-primary/20',
        isDone && 'bg-green-500/5 border border-green-500/20',
        isFailed && 'bg-destructive/5 border border-destructive/20',
      )}>
        {isActive && (
          <>
            <div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin flex-shrink-0" />
            <span className="text-primary font-medium">Agent 对谈中</span>
            {status.total_rounds > 0 && (
              <span className="text-muted-foreground">第 {status.total_rounds} 轮</span>
            )}
          </>
        )}
        {isDone && (
          <>
            <Sparkles className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
            <span className="text-green-600 font-medium">对谈完成</span>
            {scorePercent != null && (
              <span className={cn('font-bold', scoreColor)}>匹配度 {scorePercent}%</span>
            )}
            {!alreadyDecided && (
              <span className="text-muted-foreground ml-auto">待你决定</span>
            )}
          </>
        )}
        {isFailed && (
          <>
            <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
            <span className="text-destructive">对谈失败</span>
          </>
        )}
      </div>
    );
  }

  // ── 完整模式：详情页 ──
  return (
    <div className="flex flex-col h-full bg-background">
      {/* 顶部状态栏 */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-3 border-b border-border/50',
        isActive && 'bg-primary/5',
        isDone && 'bg-green-500/5',
      )}>
        <div className={cn(
          'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
          isActive && 'bg-primary/10',
          isDone && 'bg-green-500/10',
          isFailed && 'bg-destructive/10',
        )}>
          {isActive && <Bot className="h-5 w-5 text-primary" />}
          {isDone && <Sparkles className="h-5 w-5 text-green-500" />}
          {isFailed && <XCircle className="h-5 w-5 text-destructive" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">
            {isActive && 'Agent 正在代你对谈'}
            {isDone && 'Agent 对谈完成'}
            {isFailed && '对谈未能完成'}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {isActive && `与 ${name} 的 Agent 对话中，第 ${status.total_rounds} 轮...`}
            {isDone && `与 ${name} 完成了 ${status.total_rounds} 轮对话`}
            {isFailed && '请稍后重试或直接联系对方'}
          </p>
        </div>
        {isActive && (
          <div className="flex items-center gap-1 text-xs text-primary">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            进行中
          </div>
        )}
        {isDone && scorePercent != null && (
          <div className="text-right flex-shrink-0">
            <p className={cn('text-xl font-bold', scoreColor)}>{scorePercent}%</p>
            <p className="text-[10px] text-muted-foreground">匹配度</p>
          </div>
        )}
      </div>

      {/* 进度条（对谈中） */}
      {isActive && status.total_rounds > 0 && (
        <div className="px-4 py-2 bg-primary/5">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>对话进度</span>
            <span>{status.total_rounds} / {status.max_rounds} 轮</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${Math.min((status.total_rounds / status.max_rounds) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* 对话内容 */}
      {messages.length > 0 && (
        <div className="border-b border-border/30">
          <button
            onClick={() => setShowMessages(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Bot className="h-3.5 w-3.5" />
              查看 Agent 对话（{messages.length} 条）
            </span>
            {showMessages ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {showMessages && (
            <div className="max-h-72 overflow-y-auto px-4 pb-3 space-y-2">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn('flex', msg.is_mine ? 'justify-end' : 'justify-start')}
                >
                  <div className={cn(
                    'max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed',
                    msg.is_mine
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-muted text-foreground rounded-bl-md'
                  )}>
                    <p className={cn(
                      'text-[9px] mb-1 font-medium',
                      msg.is_mine ? 'text-primary-foreground/70' : 'text-muted-foreground'
                    )}>
                      {msg.is_mine ? '你的 Agent' : `${name} 的 Agent`} · 第 {msg.round} 轮
                    </p>
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      )}

      {/* 等待状态 */}
      {isActive && messages.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground">
          <div className="relative">
            <Bot className="h-10 w-10 opacity-20" />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
          <p className="text-sm">Agent 正在准备对话...</p>
          <p className="text-xs opacity-60">通常需要 1-2 分钟</p>
        </div>
      )}

      {/* 结果区域（完成后） */}
      {isDone && (
        <div className="flex-1 overflow-y-auto">
          {/* 匹配分说明 */}
          {scorePercent != null && (
            <div className={cn(
              'mx-4 mt-4 p-3 rounded-xl border text-sm',
              scorePercent >= 70 ? 'bg-green-500/5 border-green-500/20' :
              scorePercent >= 40 ? 'bg-yellow-500/5 border-yellow-500/20' :
              'bg-muted/50 border-border/50'
            )}>
              <p className="font-medium mb-1">
                {scorePercent >= 70 ? '🎯 高度匹配' : scorePercent >= 40 ? '🤔 部分匹配' : '💭 匹配度较低'}
              </p>
              <p className="text-xs text-muted-foreground">
                {scorePercent >= 70
                  ? '双方需求高度吻合，建议进一步沟通。'
                  : scorePercent >= 40
                  ? '有一定共同点，可以进一步了解。'
                  : '当前需求差异较大，供你参考。'}
              </p>
            </div>
          )}

          {/* 决策按钮 */}
          {!alreadyDecided ? (
            <div className="p-4 space-y-3">
              <p className="text-sm font-medium text-center">你想继续和 {name} 直接沟通吗？</p>

              {showPassInput ? (
                <div className="space-y-2">
                  <textarea
                    className="w-full text-xs rounded-xl border border-border bg-muted/30 p-3 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                    rows={2}
                    placeholder="可选：告诉对方原因（对方不会看到）"
                    value={passReason}
                    onChange={e => setPassReason(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 rounded-xl"
                      onClick={() => setShowPassInput(false)}
                    >
                      取消
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1 rounded-xl"
                      disabled={deciding}
                      onClick={() => handleDecide('pass')}
                    >
                      {deciding ? '处理中...' : '确认跳过'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 rounded-xl gap-1.5 h-10"
                    disabled={deciding}
                    onClick={() => handleDecide('pass')}
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                    跳过
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 rounded-xl gap-1.5 h-10 bg-green-600 hover:bg-green-700"
                    disabled={deciding}
                    onClick={() => handleDecide('want_chat')}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                    {deciding ? '处理中...' : '想聊聊'}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              {status.my_decision === 'want_chat' ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  你已表示想聊，等待对方回应
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4" />
                  你已跳过此次对谈
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* 关闭按钮 */}
      {onClose && (
        <div className="p-3 border-t border-border/30">
          <Button variant="ghost" size="sm" className="w-full rounded-xl text-xs" onClick={onClose}>
            关闭
          </Button>
        </div>
      )}
    </div>
  );
}
