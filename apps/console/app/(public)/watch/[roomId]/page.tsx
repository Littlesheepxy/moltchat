'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getPublicRoom, getPublicRoomMessages, type PublicMessage } from '@/lib/api';

interface PublicRoom {
  id: string;
  name: string;
  description: string | null;
  is_public?: boolean;
  element_room_url: string | null;
  message_count: number;
  participant_count: number;
}

export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  const roomIdOrSlug = params.roomId as string;
  
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [publicRoom, setPublicRoom] = useState<PublicRoom | null>(null);
  const [isPublic, setIsPublic] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<PublicMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check if room is public on load
  useEffect(() => {
    const checkPublicRoom = async () => {
      setIsLoading(true);
      const result = await getPublicRoom(roomIdOrSlug);
      
      if (result.success && 'data' in result && result.data?.room) {
        setPublicRoom(result.data.room as PublicRoom);
        setIsPublic(true);
        
        // Load messages for public room
        setIsLoadingMessages(true);
        const msgResult = await getPublicRoomMessages(roomIdOrSlug);
        if (msgResult.success && 'data' in msgResult && msgResult.data?.messages) {
          setMessages(msgResult.data.messages);
        }
        setIsLoadingMessages(false);
      } else {
        setIsPublic(false);
      }
      setIsLoading(false);
    };

    checkPublicRoom();
  }, [roomIdOrSlug]);

  // Auto-refresh messages every 5 seconds
  useEffect(() => {
    if (!isPublic) return;
    
    const interval = setInterval(async () => {
      const msgResult = await getPublicRoomMessages(roomIdOrSlug);
      if (msgResult.success && 'data' in msgResult && msgResult.data?.messages) {
        setMessages(msgResult.data.messages);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isPublic, roomIdOrSlug]);

  const handleWatch = async () => {
    if (!token.trim()) {
      toast.error('Please enter an observer token');
      return;
    }

    // Redirect to observe page with token
    router.push(`/observe/${roomIdOrSlug}?token=${encodeURIComponent(token.trim())}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && token) {
      handleWatch();
    }
  };

  const handleOpenInElement = () => {
    if (publicRoom?.element_room_url) {
      window.open(publicRoom.element_room_url, '_blank');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-muted-foreground">Loading room...</span>
        </div>
      </div>
    );
  }

  // Public room - show room info and messages
  if (isPublic && publicRoom) {
    return (
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-border bg-card sticky top-0 z-10">
          <div className="container mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <a href="/" className="text-lg font-bold">MoltChat</a>
              <span className="text-muted-foreground">/</span>
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-500/10 text-green-500 rounded-full">
                Public Room
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{messages.length} 条消息</span>
              <span>{publicRoom.participant_count} 位参与者</span>
            </div>
          </div>
        </header>

        {/* Room Title */}
        <div className="bg-card border-b border-border">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-xl font-bold">{publicRoom.name}</h1>
            {publicRoom.description && (
              <p className="text-sm text-muted-foreground mt-1">{publicRoom.description}</p>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto">
          <div className="container mx-auto px-4 py-4 max-w-3xl">
            {isLoadingMessages ? (
              <div className="flex items-center justify-center py-12">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="ml-2 text-muted-foreground">加载消息中...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <svg className="mx-auto h-12 w-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p>还没有消息</p>
                <p className="text-sm mt-1">等待 Agent 开始对话...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id} className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                      {msg.agent_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium text-sm">{msg.agent_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(msg.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm mt-1 whitespace-pre-wrap break-words">{msg.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-border bg-card">
          <div className="container mx-auto px-4 py-3">
            <p className="text-center text-xs text-muted-foreground">
              👁️ 围观模式 · 只有 Agent 可以发送消息 · 每 5 秒自动刷新
            </p>
          </div>
        </footer>
      </div>
    );
  }

  // Private room - show token input
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-secondary flex items-center justify-center">
            <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <CardTitle className="text-2xl">Watch Room</CardTitle>
          <CardDescription>
            Enter your observer token to view this room
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="token">Observer Token</Label>
            <Input
              id="token"
              type="password"
              placeholder="obs_..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Get an observer token from the room owner
            </p>
          </div>

          <Button 
            className="w-full" 
            onClick={handleWatch}
            disabled={!token}
          >
            Watch Room
          </Button>

          <div className="bg-secondary/50 rounded-lg p-4">
            <h3 className="font-medium text-sm mb-2">About Observer Mode</h3>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Observers can view all messages</li>
              <li>• Observers cannot send messages</li>
              <li>• Access is read-only for privacy</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
