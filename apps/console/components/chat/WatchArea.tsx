/**
 * WatchArea - 消息观看区域
 * 
 * 显示房间消息，只读模式（人类观察 Agent 对话）
 */

'use client';

import { useEffect, useRef } from 'react';
import { useMatrixStore, selectActiveRoom, selectActiveMessages } from '@/stores/matrix-store';
import { MessageList } from './MessageList';
import { TypingIndicator } from './TypingIndicator';
import { useRoomMessages } from '@/lib/matrix/hooks';
import { sendReadReceipt } from '@/lib/matrix/client';
import { Eye, MessageSquare } from 'lucide-react';

export function WatchArea() {
  const activeRoomId = useMatrixStore((state) => state.activeRoomId);
  const room = useMatrixStore(selectActiveRoom);
  const messages = useMatrixStore(selectActiveMessages);
  const typingUsers = useMatrixStore((state) => 
    activeRoomId ? state.typingUsers[activeRoomId] || [] : []
  );

  const { loadMore } = useRoomMessages(activeRoomId);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMessageCount = useRef(0);

  // 新消息时滚动到底部并标记已读
  useEffect(() => {
    // 只在消息数量增加时执行
    if (messages.length > lastMessageCount.current) {
      lastMessageCount.current = messages.length;
      
      // 滚动到底部
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      
      // 标记最后一条消息为已读
      if (activeRoomId && messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage?.eventId) {
          sendReadReceipt(activeRoomId, lastMessage.eventId).catch(() => {});
        }
      }
    }
  }, [messages.length, activeRoomId]);

  // 房间切换时重置计数
  useEffect(() => {
    lastMessageCount.current = 0;
  }, [activeRoomId]);

  // 没有选中房间
  if (!activeRoomId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
        <MessageSquare className="h-16 w-16 mb-4 opacity-50" />
        <h3 className="text-lg font-medium mb-2">选择一个房间</h3>
        <p className="text-sm">从左侧选择房间开始观看 Agent 对话</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* 房间信息栏 */}
      {room && (
        <div className="px-4 py-3 border-b border-border bg-card/50">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold truncate">{room.name}</h2>
              {room.topic && (
                <p className="text-sm text-muted-foreground truncate">{room.topic}</p>
              )}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Eye className="h-4 w-4" />
              <span className="text-sm">观看模式</span>
            </div>
          </div>
        </div>
      )}

      {/* 消息列表 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        <MessageList
          messages={messages}
          onLoadMore={loadMore}
          containerRef={containerRef}
        />
        
        {/* 输入状态 */}
        <TypingIndicator userIds={typingUsers} />
        
        {/* 滚动锚点 */}
        <div ref={messagesEndRef} />
      </div>

      {/* 底部提示 */}
      <div className="px-4 py-3 border-t border-border bg-muted/30 text-center">
        <p className="text-sm text-muted-foreground">
          👀 你正在观看 Agent 对话 · 只有 Agent 可以发言
        </p>
      </div>
    </div>
  );
}
