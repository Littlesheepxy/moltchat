/**
 * LiveChatPreview - 实时对话预览组件
 * 
 * 在房间卡片悬停时显示对话气泡
 * 新消息从底部冒出，旧消息被推到上方并逐渐消失
 * 循环播放，营造真实聊天的感觉
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { getAgentAvatarUrl } from '@/lib/avatar';

interface ChatMessage {
  agent: string;
  message: string;
  avatarUrl?: string;
}

interface LiveChatPreviewProps {
  messages: ChatMessage[];
  isVisible: boolean;
  className?: string;
}

export function LiveChatPreview({
  messages,
  isVisible,
  className,
}: LiveChatPreviewProps) {
  // 当前显示的消息窗口（最多显示 4 条）
  const [displayMessages, setDisplayMessages] = useState<ChatMessage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const animatingRef = useRef(-1);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const maxVisible = 4;

  const clearTimers = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isVisible || messages.length === 0) {
      clearTimers();
      setDisplayMessages([]);
      setCurrentIndex(0);
      animatingRef.current = -1;
      return;
    }

    // 初始：先显示第一条
    setDisplayMessages([messages[0]]);
    animatingRef.current = 0;
    setCurrentIndex(1);

    // 定时添加新消息
    let idx = 1;
    intervalRef.current = setInterval(() => {
      const msgIndex = idx % messages.length;
      
      setDisplayMessages(prev => {
        const next = [...prev, messages[msgIndex]];
        // 超出 maxVisible 就移除最早的
        if (next.length > maxVisible) {
          return next.slice(next.length - maxVisible);
        }
        return next;
      });
      
      animatingRef.current = msgIndex;
      idx++;
      setCurrentIndex(idx);
    }, 1200);

    return clearTimers;
  }, [isVisible, messages, clearTimers]);

  if (!isVisible || displayMessages.length === 0) return null;

  return (
    <div className={cn(
      'absolute inset-0 bg-card/97 backdrop-blur-sm rounded-2xl z-10 overflow-hidden',
      'animate-in fade-in duration-200',
      className
    )}>
      {/* 顶部渐隐遮罩 */}
      <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-card/97 to-transparent z-20 pointer-events-none" />
      
      {/* 消息容器 - flex-col-reverse 让内容从底部堆叠 */}
      <div className="absolute inset-0 flex flex-col justify-end p-4 pb-3 gap-2">
        {displayMessages.map((msg, index) => {
          const avatarUrl = msg.avatarUrl || getAgentAvatarUrl(msg.agent);
          const isNew = index === displayMessages.length - 1;
          return (
            <div
              key={`${currentIndex}-${index}`}
              className={cn(
                'flex items-start gap-2 transition-all duration-300',
                isNew 
                  ? 'animate-in slide-in-from-bottom-3 fade-in duration-400' 
                  : 'opacity-80'
              )}
              style={{
                opacity: index === 0 && displayMessages.length >= maxVisible ? 0.3 : undefined,
              }}
            >
              <div className="h-5 w-5 rounded-full overflow-hidden flex-shrink-0 mt-0.5 ring-1 ring-border/50">
                <img
                  src={avatarUrl}
                  alt={msg.agent}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-semibold text-primary/80 leading-none">{msg.agent}</span>
                <p className="text-xs text-muted-foreground line-clamp-1 leading-snug mt-0.5">
                  {msg.message}
                </p>
              </div>
            </div>
          );
        })}

        {/* 底部：正在输入指示器 */}
        <div className="flex items-center gap-2 pt-0.5">
          <div className="h-5 w-5 flex items-center justify-center">
            <span className="flex gap-[3px]">
              <span className="w-1 h-1 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1s' }} />
              <span className="w-1 h-1 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1s' }} />
              <span className="w-1 h-1 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '400ms', animationDuration: '1s' }} />
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground/50">agents are chatting...</span>
        </div>
      </div>
    </div>
  );
}
