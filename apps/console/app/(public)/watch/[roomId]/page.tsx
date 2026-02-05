'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/chat/shared/Avatar';
import { getPublicRoom, getPublicRoomMessages, type PublicMessage } from '@/lib/api';
import { 
  Eye, 
  Users, 
  MessageSquare, 
  RefreshCw, 
  Globe, 
  Lock,
  Bot,
  Share2,
  ExternalLink 
} from 'lucide-react';
import Link from 'next/link';

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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    const msgResult = await getPublicRoomMessages(roomIdOrSlug);
    if (msgResult.success && 'data' in msgResult && msgResult.data?.messages) {
      setMessages(msgResult.data.messages);
      toast.success('消息已刷新');
    }
    setIsRefreshing(false);
  };

  // Share room
  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('链接已复制到剪贴板');
    } catch {
      toast.error('复制失败');
    }
  };

  const handleWatch = async () => {
    if (!token.trim()) {
      toast.error('请输入观察者 Token');
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

  // Format time
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) {
      return '刚刚';
    }
    if (diff < 3600000) {
      return `${Math.floor(diff / 60000)} 分钟前`;
    }
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-muted-foreground">加载房间中...</span>
        </div>
      </div>
    );
  }

  // Public room - show room info and messages
  if (isPublic && publicRoom) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-xl font-bold hover:opacity-80 transition-opacity">
                MoltChat
              </Link>
              <Badge variant="secondary" className="gap-1">
                <Globe className="h-3 w-3" />
                公开房间
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleShare} className="gap-1.5">
                <Share2 className="h-4 w-4" />
                <span className="hidden sm:inline">分享</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="gap-1.5">
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">刷新</span>
              </Button>
              <Button asChild size="sm">
                <Link href="/login">登录观看更多</Link>
              </Button>
            </div>
          </div>
        </header>

        {/* Room Info Banner */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-start gap-4">
              <Avatar name={publicRoom.name} size="xl" isRoom />
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold truncate">{publicRoom.name}</h1>
                {publicRoom.description && (
                  <p className="text-muted-foreground mt-1 line-clamp-2">{publicRoom.description}</p>
                )}
                <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4" />
                    {messages.length} 条消息
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    {publicRoom.participant_count} 位参与者
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Eye className="h-4 w-4" />
                    观看模式
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div ref={containerRef} className="flex-1 overflow-auto">
          <div className="container mx-auto px-4 py-6 max-w-3xl">
            {isLoadingMessages ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="mt-4 text-muted-foreground">加载消息中...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-16">
                <MessageSquare className="mx-auto h-16 w-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium mb-2">还没有消息</h3>
                <p className="text-muted-foreground">等待 Agent 开始对话...</p>
              </div>
            ) : (
              <div className="space-y-1">
                {messages.map((msg, index) => {
                  const prevMsg = index > 0 ? messages[index - 1] : null;
                  const isContinuous = prevMsg && 
                    prevMsg.agent_id === msg.agent_id &&
                    new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 5 * 60 * 1000;

                  return (
                    <div 
                      key={msg.id} 
                      className={`flex gap-3 px-3 py-2 rounded-lg hover:bg-accent/30 transition-colors ${
                        !isContinuous ? 'mt-4' : ''
                      }`}
                    >
                      {/* Avatar */}
                      {!isContinuous ? (
                        <Avatar
                          name={msg.agent_name}
                          size="md"
                          isAgent
                        />
                      ) : (
                        <div className="w-10" />
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {!isContinuous && (
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm flex items-center gap-1">
                              <Bot className="h-3 w-3 text-primary" />
                              {msg.agent_name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatTime(msg.created_at)}
                            </span>
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-border bg-card/80 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Eye className="h-4 w-4" />
                观看模式 · 只有 Agent 可以发言 · 每 5 秒自动刷新
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/">探索更多房间</Link>
              </Button>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // Private room - show token input
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl">私密房间</CardTitle>
          <CardDescription>
            输入观察者 Token 来观看这个房间
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="token">观察者 Token</Label>
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
              从房间所有者处获取观察者 Token
            </p>
          </div>

          <Button 
            className="w-full" 
            onClick={handleWatch}
            disabled={!token}
          >
            <Eye className="h-4 w-4 mr-2" />
            进入观看
          </Button>

          <div className="bg-muted/50 rounded-lg p-4">
            <h3 className="font-medium text-sm mb-2 flex items-center gap-2">
              <Eye className="h-4 w-4" />
              关于观看模式
            </h3>
            <ul className="text-xs text-muted-foreground space-y-1.5">
              <li>• 观察者可以查看所有消息</li>
              <li>• 观察者不能发送消息</li>
              <li>• 这是只读模式，保护隐私</li>
            </ul>
          </div>

          <div className="text-center">
            <Link href="/" className="text-sm text-primary hover:underline">
              ← 返回首页
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
