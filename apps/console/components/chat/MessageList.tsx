/**
 * MessageList - 消息列表
 * 
 * 使用虚拟滚动优化大量消息的渲染
 */

'use client';

import { useRef, useCallback, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { MessageItem } from './MessageItem';
import type { MoltMessage } from '@/lib/matrix/types';
import { Loader2 } from 'lucide-react';

interface MessageListProps {
  messages: MoltMessage[];
  onLoadMore?: () => Promise<void>;
  containerRef: React.RefObject<HTMLDivElement>;
}

export function MessageList({ messages, onLoadMore, containerRef }: MessageListProps) {
  const isLoadingMore = useRef(false);

  // 虚拟滚动
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 80, // 预估每条消息高度
    overscan: 10, // 预渲染的额外项数
  });

  // 加载更多（滚动到顶部时）
  const handleScroll = useCallback(async () => {
    if (!containerRef.current || !onLoadMore || isLoadingMore.current) return;

    const { scrollTop } = containerRef.current;
    
    // 滚动到顶部附近时加载更多
    if (scrollTop < 100) {
      isLoadingMore.current = true;
      try {
        await onLoadMore();
      } finally {
        isLoadingMore.current = false;
      }
    }
  }, [onLoadMore, containerRef]);

  // 监听滚动
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [containerRef, handleScroll]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
        <p className="text-sm">暂无消息</p>
        <p className="text-xs mt-1">等待 Agent 开始对话...</p>
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      style={{
        height: `${virtualizer.getTotalSize()}px`,
        width: '100%',
        position: 'relative',
      }}
    >
      {isLoadingMore.current && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      
      {virtualItems.map((virtualItem) => {
        const message = messages[virtualItem.index];
        const prevMessage = virtualItem.index > 0 ? messages[virtualItem.index - 1] : null;
        
        // 是否显示日期分隔符
        const showDateSeparator = !prevMessage || 
          !isSameDay(prevMessage.timestamp, message.timestamp);
        
        // 是否是连续消息（同一发送者，5分钟内）
        const isContinuous = prevMessage &&
          prevMessage.senderId === message.senderId &&
          message.timestamp - prevMessage.timestamp < 5 * 60 * 1000;

        return (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {showDateSeparator && (
              <DateSeparator timestamp={message.timestamp} />
            )}
            <MessageItem
              message={message}
              showAvatar={!isContinuous}
              showName={!isContinuous}
            />
          </div>
        );
      })}
    </div>
  );
}

// 判断是否是同一天
function isSameDay(timestamp1: number, timestamp2: number): boolean {
  const date1 = new Date(timestamp1);
  const date2 = new Date(timestamp2);
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

// 日期分隔符
function DateSeparator({ timestamp }: { timestamp: number }) {
  const date = new Date(timestamp);
  const now = new Date();
  
  let dateText: string;
  
  if (isSameDay(timestamp, now.getTime())) {
    dateText = '今天';
  } else if (isSameDay(timestamp, now.getTime() - 24 * 60 * 60 * 1000)) {
    dateText = '昨天';
  } else {
    dateText = date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  return (
    <div className="flex items-center gap-4 py-4">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs text-muted-foreground">{dateText}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}
