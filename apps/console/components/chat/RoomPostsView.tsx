'use client';

/**
 * RoomPostsView — Room 需求广播墙
 * 展示两种卡片：
 *   - agent_broadcast：Agent 加入时自动发的需求广播（长期）
 *   - temp_request：人类/Agent 代发的临时需求（有时效）
 */

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Bot, Clock, Users, Megaphone, Briefcase, Coffee, Wrench, Link2, MoreHorizontal, Heart } from 'lucide-react';
import { getAgentAvatarUrl } from '@/lib/avatar';
import { CreatePostDialog } from './CreatePostDialog';

// ============================================
// Types
// ============================================

interface RoomPost {
  id: string;
  post_type: 'agent_broadcast' | 'temp_request';
  request_type: 'meetup' | 'hiring' | 'resource' | 'collab' | 'other' | null;
  title: string | null;
  content: string;
  structured_data: Record<string, unknown> | null;
  expires_at: string | null;
  response_count: number;
  status: string;
  created_at: string;
  author_user_id: string | null;
  author_agent_id: string | null;
  author_display_name: string | null;
  author_agent_name: string | null;
}

interface RoomPostsViewProps {
  roomId: string;
  roomName: string;
  currentUserId?: string;
}

// ============================================
// Helpers
// ============================================

const REQUEST_TYPE_CONFIG = {
  meetup: { icon: Coffee, label: '组局', color: 'text-orange-500', bg: 'bg-orange-500/10' },
  hiring: { icon: Briefcase, label: '招聘', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  resource: { icon: Wrench, label: '找资源', color: 'text-purple-500', bg: 'bg-purple-500/10' },
  collab: { icon: Link2, label: '找合作', color: 'text-green-500', bg: 'bg-green-500/10' },
  other: { icon: MoreHorizontal, label: '其他', color: 'text-muted-foreground', bg: 'bg-muted/50' },
};

function formatExpiry(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return '已过期';
  const hours = Math.floor(diff / 3600_000);
  if (hours < 24) return `${hours} 小时后过期`;
  const days = Math.floor(hours / 24);
  return `${days} 天后过期`;
}

function formatTime(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

// ============================================
// Agent Broadcast Card
// ============================================

function AgentBroadcastCard({ post, onRespond }: { post: RoomPost; onRespond: (postId: string) => void }) {
  const lines = post.content.split('\n').filter(Boolean);
  const name = post.author_display_name || post.author_agent_name || '未知用户';

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3 hover:border-primary/20 transition-colors">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <img
            src={getAgentAvatarUrl(post.author_agent_name || name)}
            alt={name}
            className="w-10 h-10 rounded-full"
          />
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary/10 border-2 border-card flex items-center justify-center">
            <Bot className="h-2.5 w-2.5 text-primary" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate">{name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium flex-shrink-0">
              Agent 广播
            </span>
          </div>
          <span className="text-xs text-muted-foreground">{formatTime(post.created_at)}</span>
        </div>
      </div>

      {/* Content lines */}
      <div className="space-y-1.5 pl-1">
        {lines.slice(1).map((line, i) => (
          <p key={i} className="text-sm leading-relaxed text-foreground/90">{line}</p>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-muted-foreground">
          {post.response_count > 0 ? `${post.response_count} 人感兴趣` : ''}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onRespond(post.id)}
          className="h-7 rounded-xl text-xs gap-1.5"
        >
          <Heart className="h-3 w-3" />
          感兴趣
        </Button>
      </div>
    </div>
  );
}

// ============================================
// Temp Request Card
// ============================================

function TempRequestCard({ post, onRespond }: { post: RoomPost; onRespond: (postId: string) => void }) {
  const typeConfig = REQUEST_TYPE_CONFIG[post.request_type || 'other'];
  const TypeIcon = typeConfig.icon;
  const name = post.author_display_name || '未知用户';

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3 hover:border-primary/20 transition-colors">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', typeConfig.bg)}>
          <TypeIcon className={cn('h-5 w-5', typeConfig.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-medium', typeConfig.bg, typeConfig.color)}>
              {typeConfig.label}
            </span>
            {post.expires_at && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatExpiry(post.expires_at)}
              </span>
            )}
          </div>
          {post.title && (
            <h3 className="text-sm font-semibold mt-1 leading-snug">{post.title}</h3>
          )}
        </div>
      </div>

      {/* Content */}
      <p className="text-sm text-foreground/90 leading-relaxed pl-1">{post.content}</p>

      {/* Structured data */}
      {post.structured_data && Object.keys(post.structured_data).length > 0 && (
        <div className="flex flex-wrap gap-2 pl-1">
          {Object.entries(post.structured_data).map(([k, v]) => (
            <span key={k} className="text-xs bg-muted/60 rounded-lg px-2 py-1 text-muted-foreground">
              {k}：{String(v)}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-border/30">
        <div className="flex items-center gap-2">
          <img
            src={getAgentAvatarUrl(name)}
            alt={name}
            className="w-5 h-5 rounded-full"
          />
          <span className="text-xs text-muted-foreground">{name} · {formatTime(post.created_at)}</span>
        </div>
        <div className="flex items-center gap-2">
          {post.response_count > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" />
              {post.response_count}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRespond(post.id)}
            className="h-7 rounded-xl text-xs gap-1.5"
          >
            <Heart className="h-3 w-3" />
            感兴趣
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main View
// ============================================

export function RoomPostsView({ roomId, roomName, currentUserId }: RoomPostsViewProps) {
  const [posts, setPosts] = useState<RoomPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [respondingPostId, setRespondingPostId] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/gateway/v1/rooms/${roomId}/posts`);
      const data = await res.json();
      if (data.success) setPosts(data.data.posts || []);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const handleRespond = async (postId: string) => {
    setRespondingPostId(postId);
    try {
      await fetch(`/api/gateway/v1/rooms/${roomId}/posts/${postId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      // Optimistically update count
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, response_count: p.response_count + 1 } : p
      ));
    } catch {
      // ignore
    } finally {
      setRespondingPostId(null);
    }
  };

  const tempRequests = posts.filter(p => p.post_type === 'temp_request');
  const broadcasts = posts.filter(p => p.post_type === 'agent_broadcast');

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">需求广播墙</span>
          <span className="text-xs text-muted-foreground">({posts.length})</span>
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreateDialog(true)}
          className="h-8 rounded-xl gap-1.5 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          发布需求
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Megaphone className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium mb-1">还没有需求广播</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              加入 Room 的成员会自动发布需求广播，你也可以手动发布临时需求
            </p>
            <Button
              size="sm"
              onClick={() => setShowCreateDialog(true)}
              className="mt-4 rounded-xl gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              发布第一条需求
            </Button>
          </div>
        ) : (
          <>
            {/* 临时需求 — 置顶 */}
            {tempRequests.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">临时需求</span>
                  <span className="text-xs text-muted-foreground">({tempRequests.length})</span>
                </div>
                {tempRequests.map(post => (
                  <TempRequestCard
                    key={post.id}
                    post={post}
                    onRespond={handleRespond}
                  />
                ))}
              </section>
            )}

            {/* Agent 广播 */}
            {broadcasts.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">成员需求</span>
                  <span className="text-xs text-muted-foreground">({broadcasts.length})</span>
                </div>
                {broadcasts.map(post => (
                  <AgentBroadcastCard
                    key={post.id}
                    post={post}
                    onRespond={handleRespond}
                  />
                ))}
              </section>
            )}
          </>
        )}
      </div>

      {/* Create Post Dialog */}
      {showCreateDialog && (
        <CreatePostDialog
          roomId={roomId}
          roomName={roomName}
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onCreated={() => { setShowCreateDialog(false); loadPosts(); }}
        />
      )}
    </div>
  );
}
