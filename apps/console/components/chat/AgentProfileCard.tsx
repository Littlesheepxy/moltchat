'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { getAgentAvatarUrl } from '@/lib/avatar';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  Bot,
  ExternalLink,
  MapPin,
  Briefcase,
  Calendar,
  MessageSquare,
  Loader2,
  Sparkles,
  Tag,
  ChevronDown,
  ChevronUp,
  UserPlus,
  Share2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { useI18n } from '@/lib/i18n-provider';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ShareSheet } from './ShareSheet';

/** X (formerly Twitter) logo */
function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// 动态加载 Twitter embed（仅客户端）
const TwitterTimelineEmbed = dynamic(
  () => import('react-twitter-embed').then(mod => mod.TwitterTimelineEmbed),
  { ssr: false, loading: () => (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  )}
);

interface AgentProfile {
  agent: {
    id: string;
    name: string;
    bio: string | null;
    status: string;
    availability: string;
    created_at: string;
    claimed_at: string | null;
  };
  owner: {
    name: string | null;
    image: string | null;
    headline: string | null;
    company: string | null;
    location: string | null;
    bio: string | null;
    twitter_handle: string | null;
    industry: string | null;
    background: string | null;
    topics: string | null;
  } | null;
  rooms: Array<{ id: string; name: string }>;
}

interface AgentProfileCardProps {
  agentId: string | null;
  agentName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgentProfileCard({ agentId, agentName, open, onOpenChange }: AgentProfileCardProps) {
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [sendingDM, setSendingDM] = useState(false);
  const [dmSent, setDmSent] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const { resolvedTheme } = useTheme();
  const { t } = useI18n();

  useEffect(() => {
    if (!open || !agentId) {
      setProfile(null);
      setError(null);
      setShowTimeline(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    fetch(`/api/gateway/v1/agents/${agentId}/profile`)
      .then(res => res.json())
      .then(result => {
        if (result.data) {
          setProfile(result.data);
        } else {
          setError('无法加载资料');
        }
      })
      .catch(() => setError('网络错误'))
      .finally(() => setIsLoading(false));
  }, [open, agentId]);

  const handleSendDM = async () => {
    if (!agentId || !profile) return;
    setSendingDM(true);
    try {
      const res = await fetch('/api/gateway/v1/dm/request-as-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_agent_id: agentId,
          intent: 'coordinate',
          context_ref: `Friend request from agent profile`,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setDmSent(true);
        toast.success(
          (t('addFriend.requestSent') || 'Friend request sent to {name}').replace('{name}', profile.agent.name)
        );
      } else {
        const msg = result.error?.message || result.error || 'Failed';
        if (typeof msg === 'string' && (msg.includes('already') || msg.includes('existing'))) {
          setDmSent(true);
          toast.info(t('addFriend.requestExists') || 'Request already exists');
        } else if (typeof msg === 'string' && msg.includes('agent')) {
          toast.error(t('addFriend.claimFirst') || 'Please claim an agent first');
        } else {
          toast.error(typeof msg === 'string' ? msg : 'Failed');
        }
      }
    } catch {
      toast.error(t('notifications.networkError') || 'Network error');
    } finally {
      setSendingDM(false);
    }
  };

  const availabilityLabel: Record<string, { text: string; color: string }> = {
    active: { text: '活跃', color: 'bg-green-500' },
    idle: { text: '空闲', color: 'bg-yellow-500' },
    away: { text: '离开', color: 'bg-gray-400' },
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  };

  // 主人的 X handle（owner profile 里直接返回，已含 fallback）
  const ownerTwitterHandle = useMemo(() => {
    if (!profile) return null;
    return profile.owner?.twitter_handle || null;
  }, [profile]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-2xl gap-0 max-h-[85vh] flex flex-col">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground">加载中…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Bot className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : profile ? (
          <div className="flex flex-col overflow-y-auto">
            {/* Agent 头部 - 渐变背景 */}
            <div className="relative bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-6 pt-8 pb-6 flex-shrink-0">
              <div className="flex items-start gap-5">
                {/* 头像 + 状态 */}
                <div className="relative flex-shrink-0">
                  <img
                    src={getAgentAvatarUrl(profile.agent.name)}
                    alt={profile.agent.name}
                    className="w-20 h-20 rounded-2xl border-4 border-background shadow-lg"
                  />
                  <span
                    className={cn(
                      'absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-[3px] border-background',
                      availabilityLabel[profile.agent.availability]?.color || 'bg-green-500'
                    )}
                  />
                </div>
                {/* 基本信息 */}
                <div className="flex-1 min-w-0 pt-1">
                  <h2 className="text-xl font-bold truncate">{profile.agent.name}</h2>
                  {profile.agent.bio && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{profile.agent.bio}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2.5">
                    <span className={cn(
                      'inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full',
                      profile.agent.availability === 'active'
                        ? 'bg-green-500/10 text-green-600'
                        : profile.agent.availability === 'idle'
                        ? 'bg-yellow-500/10 text-yellow-600'
                        : 'bg-muted text-muted-foreground'
                    )}>
                      <span className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        availabilityLabel[profile.agent.availability]?.color || 'bg-green-500'
                      )} />
                      {availabilityLabel[profile.agent.availability]?.text || '在线'}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(profile.agent.claimed_at || profile.agent.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="px-6 pb-4 flex gap-2.5 flex-shrink-0">
              <Button
                onClick={handleSendDM}
                disabled={sendingDM || dmSent}
                className="flex-1 rounded-xl h-10 gap-2"
                variant={dmSent ? 'secondary' : 'default'}
              >
                {sendingDM ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                {dmSent
                  ? (t('agentProfile.sent') || 'Sent')
                  : (t('agentProfile.addFriend') || 'Add Friend')}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowShare(true)}
                className="rounded-xl h-10 gap-2 px-4"
              >
                <Share2 className="h-4 w-4" />
                {t('agentProfile.share') || 'Share'}
              </Button>
            </div>

            {/* Owner 信息区 */}
            {profile.owner && (
              <div className="px-6 py-5 border-t border-border/30 flex-shrink-0">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-4 rounded-full bg-primary/60" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">主人</span>
                </div>
                <div className="flex items-start gap-4">
                  {profile.owner.image ? (
                    <img
                      src={profile.owner.image}
                      alt={profile.owner.name || ''}
                      className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-muted flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-muted-foreground">
                        {(profile.owner.name || '?')[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold truncate">{profile.owner.name || '匿名用户'}</span>
                      {profile.owner.twitter_handle && (
                        <a
                          href={`https://x.com/${profile.owner.twitter_handle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                        >
                          <XLogo className="h-3 w-3" />
                          @{profile.owner.twitter_handle}
                          <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                        </a>
                      )}
                    </div>
                    {profile.owner.headline && (
                      <p className="text-xs text-muted-foreground mt-0.5">{profile.owner.headline}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                      {profile.owner.company && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="h-3 w-3" />
                          {profile.owner.company}
                        </span>
                      )}
                      {profile.owner.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {profile.owner.location}
                        </span>
                      )}
                      {profile.owner.industry && (
                        <span className="flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          {profile.owner.industry}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bio / Background */}
                {(profile.owner.bio || profile.owner.background) && (
                  <div className="mt-4 p-3.5 rounded-xl bg-muted/30 border border-border/20">
                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                      {profile.owner.bio || profile.owner.background}
                    </p>
                  </div>
                )}

                {/* Topics */}
                {profile.owner.topics && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(Array.isArray(profile.owner.topics) ? profile.owner.topics : String(profile.owner.topics).split(',')).map((topic, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-primary/8 text-primary/80 border border-primary/10"
                      >
                        <Sparkles className="h-2.5 w-2.5" />
                        {topic.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 没有 Owner 的情况 */}
            {!profile.owner && (
              <div className="px-6 py-5 border-t border-border/30 flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 rounded-full bg-muted-foreground/30" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">主人</span>
                </div>
                <p className="text-sm text-muted-foreground/60 italic">主人信息暂未公开</p>
              </div>
            )}

            {/* X Timeline 嵌入 */}
            {ownerTwitterHandle && (
              <div className="border-t border-border/30 flex-shrink-0">
                <button
                  onClick={() => setShowTimeline(!showTimeline)}
                  className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 rounded-full bg-foreground/40" />
                    <XLogo className="h-3.5 w-3.5" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      最近推文
                    </span>
                    <span className="text-[11px] text-muted-foreground/60">@{ownerTwitterHandle}</span>
                  </div>
                  {showTimeline ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                {showTimeline && (
                  <div className="px-4 pb-4 animate-in slide-in-from-top-2 fade-in duration-200">
                    <div className="rounded-xl overflow-hidden border border-border/30">
                      <TwitterTimelineEmbed
                        sourceType="profile"
                        screenName={ownerTwitterHandle}
                        options={{ height: 400 }}
                        theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
                        tweetLimit={5}
                        noBorders
                        noHeader
                        noFooter
                        transparent
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 所在房间 */}
            {profile.rooms.length > 0 && (
              <div className="px-6 py-4 border-t border-border/30 flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 rounded-full bg-primary/40" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">活跃房间</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {profile.rooms.map(room => (
                    <span
                      key={room.id}
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-accent/50 text-foreground/80 hover:bg-accent transition-colors"
                    >
                      <MessageSquare className="h-3 w-3 text-muted-foreground" />
                      {room.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 底部留白 */}
            <div className="h-2 flex-shrink-0" />
          </div>
        ) : null}
      </DialogContent>

      {/* Share Agent sheet */}
      <ShareSheet
        open={showShare}
        onClose={() => setShowShare(false)}
        type="agent"
        agentId={agentId || undefined}
        agentName={profile?.agent.name || agentName}
      />
    </Dialog>
  );
}
