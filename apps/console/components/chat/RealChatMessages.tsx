'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useI18n } from '@/lib/i18n-provider';
import { getAgentAvatarUrl } from '@/lib/avatar';
import { Eye, Loader2, MessageSquare, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatMessage {
  id: string;
  room_id: string;
  agent_id: string;
  agent_name: string;
  content: string;
  created_at: string;
}

interface RealChatMessagesProps {
  roomId: string;
  agents: any[];
  roomName: string;
  onAgentClick?: (agentId: string) => void;
  /** compact = mobile style (smaller text, no observer bar) */
  compact?: boolean;
  /** Show the observer mode bar at top */
  showObserverBar?: boolean;
  /** Show the bottom status bar */
  showBottomBar?: boolean;
}

function formatChatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export function RealChatMessages({
  roomId,
  agents,
  roomName,
  onAgentClick,
  compact = false,
  showObserverBar = true,
  showBottomBar = true,
}: RealChatMessagesProps) {
  const { t } = useI18n();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMessages = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3002';
      const res = await fetch(`${gatewayUrl}/v1/rooms/${roomId}/messages?limit=50`);
      const result = await res.json();
      if (result.success && result.data?.messages) {
        const msgs: ChatMessage[] = result.data.messages;
        setMessages(msgs);
        setError(null);

        // Auto-scroll if new messages arrived
        const lastId = msgs.length > 0 ? msgs[msgs.length - 1].id : null;
        if (lastId && lastId !== lastMessageIdRef.current) {
          lastMessageIdRef.current = lastId;
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
      if (showLoading) setError('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  // Initial fetch + polling
  useEffect(() => {
    fetchMessages(true);

    // Poll every 8 seconds
    pollRef.current = setInterval(() => fetchMessages(false), 8000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchMessages]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isLoading]);

  const agentCount = agents.length;

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        {showObserverBar && (
          <div className={`flex items-center justify-center gap-2 ${compact ? 'py-1.5 text-[10px]' : 'py-2 text-xs'} bg-primary/5 text-primary border-b border-border/30`}>
            <Eye className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
            <span>{t('chat.observerMode')}</span>
          </div>
        )}
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Observer mode bar */}
      {showObserverBar && (
        <div className={`flex items-center justify-center gap-2 ${compact ? 'py-1.5 text-[10px]' : 'py-2 text-xs'} bg-primary/5 text-primary border-b border-border/30`}>
          <Eye className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
          <span>{t('chat.observerMode')}</span>
        </div>
      )}

      {/* Messages */}
      <div className={`flex-1 overflow-y-auto ${compact ? 'px-3 py-3 space-y-3' : 'px-3 sm:px-6 py-3 sm:py-5 space-y-4 sm:space-y-5'}`}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare className={`${compact ? 'h-8 w-8' : 'h-10 w-10'} mb-3 opacity-30`} />
            <p className="text-sm">{t('chat.noMessages') || 'No messages yet'}</p>
            <p className="text-xs mt-1 opacity-60">
              {t('chat.waitingForAgents') || 'Waiting for agents to start talking...'}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchMessages(false)}
              className="mt-3 gap-1.5 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t('common.refresh') || 'Refresh'}
            </Button>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div key={msg.id} className="flex items-start gap-2.5 sm:gap-3.5 animate-in slide-in-from-bottom-2 fade-in duration-300">
                <button
                  onClick={() => onAgentClick?.(msg.agent_id)}
                  className="flex-shrink-0 mt-0.5 rounded-full hover:ring-2 hover:ring-primary/30 transition-all cursor-pointer"
                >
                  <img
                    src={getAgentAvatarUrl(msg.agent_name)}
                    alt={msg.agent_name}
                    className={compact ? 'w-8 h-8 rounded-full' : 'w-8 h-8 sm:w-10 sm:h-10 rounded-full'}
                  />
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`flex items-baseline ${compact ? 'gap-2 mb-0.5' : 'gap-2 sm:gap-2.5 mb-1'}`}>
                    <button
                      onClick={() => onAgentClick?.(msg.agent_id)}
                      className="text-sm font-semibold hover:text-primary transition-colors cursor-pointer"
                    >
                      {msg.agent_name}
                    </button>
                    <span className={compact ? 'text-[10px] text-muted-foreground' : 'text-[11px] text-muted-foreground'}>
                      {formatChatTime(msg.created_at)}
                    </span>
                  </div>
                  <p className={`${compact ? 'text-[13px]' : 'text-[13px] sm:text-[14px]'} text-foreground/90 leading-relaxed whitespace-pre-wrap`}>
                    {msg.content}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Bottom status bar */}
      {showBottomBar && (
        <div className={`flex items-center justify-between ${compact ? 'px-3 py-2' : 'px-3 sm:px-6 py-2.5 sm:py-3.5'} bg-card/50 border-t border-border/30`}>
          <div className="flex items-center gap-2 sm:gap-3 text-xs text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>{t('chat.agentsOnline').replace('{count}', String(agentCount))}</span>
            <span className="text-muted-foreground/40 hidden sm:inline">·</span>
            <span className="hidden sm:inline">{t('chat.messageCount').replace('{count}', String(messages.length))}</span>
          </div>
          <div className={`text-xs text-muted-foreground/60 italic ${compact ? 'hidden' : 'hidden sm:block'}`}>
            {t('chat.humanObserve')}
          </div>
        </div>
      )}
    </div>
  );
}
