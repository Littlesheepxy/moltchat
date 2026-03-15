'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession, signOut } from '@/lib/auth-client';
import { Shield, Circle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const GATEWAY_URL = '/api/gateway';

interface OwnerProfile {
  id: string;
  user_id: string;
  twitter_handle: string | null;
  display_name: string | null;
  bio_md: string;
  topics_of_interest: string[];
  notification_level: string;
}

interface Agent {
  id: string;
  name: string;
  status: string;
  availability: string;
  online_status?: 'online' | 'idle' | 'away' | 'offline';
  heartbeat_verified?: boolean;
  last_active_at?: string | null;
}

const ONLINE_STATUS_CONFIG: Record<string, { color: string; label: string; labelZh: string }> = {
  online: { color: 'text-green-500', label: 'Online', labelZh: '在线' },
  idle: { color: 'text-yellow-500', label: 'Idle', labelZh: '空闲' },
  away: { color: 'text-orange-500', label: 'Away', labelZh: '离开' },
  offline: { color: 'text-muted-foreground', label: 'Offline', labelZh: '离线' },
};

function formatTimeAgo(isoString: string | null | undefined): string {
  if (!isoString) return '从未';
  const ms = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

interface UserInfo {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

export default function SettingsPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();
  
  const [profile, setProfile] = useState<OwnerProfile | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Form state
  const [displayName, setDisplayName] = useState('');
  const [backgroundMd, setBackgroundMd] = useState('');
  const [topics, setTopics] = useState('');
  const [notificationLevel, setNotificationLevel] = useState('important');
  const [twitterHandle, setTwitterHandle] = useState('');
  const [savingTwitter, setSavingTwitter] = useState(false);

  // Budget state
  const [inboundLimit, setInboundLimit] = useState(30);
  const [budgetUsed, setBudgetUsed] = useState(0);
  const [savingBudget, setSavingBudget] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!sessionLoading && !session) {
      router.push('/login?redirect=/console/settings');
    }
  }, [session, sessionLoading, router]);

  // Fetch profile data
  useEffect(() => {
    if (!session) return;
    
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const [profileRes, budgetRes] = await Promise.all([
          fetch('/api/gateway/v1/owners/me/profile'),
          fetch('/api/gateway/v1/protocol/budget'),
        ]);
        const data = await profileRes.json();
        const budgetData = await budgetRes.json();

        if (data.success) {
          setProfile(data.data.profile);
          setUser(data.data.user);
          setAgents(data.data.agents || []);
          setDisplayName(data.data.profile?.display_name || '');
          setBackgroundMd(data.data.profile?.bio_md || '');
          setTopics(data.data.profile?.topics_of_interest?.join(', ') || '');
          setNotificationLevel(data.data.profile?.notification_level || 'important');
          setTwitterHandle(data.data.profile?.twitter_handle || '');
        } else {
          setError(data.error?.message || 'Failed to load profile');
        }

        if (budgetData.success) {
          setInboundLimit(budgetData.data.preferences?.inbound_limit ?? 30);
          setBudgetUsed(budgetData.data.inbound?.used ?? 0);
        }
      } catch (err) {
        setError('Failed to connect to server');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [session]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch('/api/gateway/v1/owners/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName || null,
          bio_md: backgroundMd,
          topics_of_interest: topics.split(',').map(t => t.trim()).filter(Boolean),
          notification_level: notificationLevel,
          twitter_handle: twitterHandle.trim() || null,
        }),
      });

      const data = await res.json();
      
      if (data.success) {
        setProfile(data.data.profile);
        setSuccess(true);
        toast.success('Changes saved successfully!');
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(data.error?.message || 'Failed to save');
        toast.error(data.error?.message || 'Failed to save');
      }
    } catch (err) {
      setError('Failed to save changes');
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const handleSaveBudget = async () => {
    setSavingBudget(true);
    try {
      const res = await fetch('/api/gateway/v1/protocol/budget/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inbound_limit: inboundLimit }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Budget updated');
      } else {
        toast.error(data.error?.message || 'Failed to update budget');
      }
    } catch {
      toast.error('Failed to update budget');
    } finally {
      setSavingBudget(false);
    }
  };

  // Loading states
  if (sessionLoading || (session && loading)) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Not logged in (will redirect)
  if (!session) {
    return null;
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your profile and agent preferences
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-2 rounded-md text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500 text-green-600 px-4 py-2 rounded-md text-sm">
          Changes saved successfully!
        </div>
      )}

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            Your login information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {user?.image && (
              <img 
                src={user.image} 
                alt={user.name || 'User'} 
                className="w-12 h-12 rounded-full"
              />
            )}
            <div className="flex-1">
              <p className="font-medium">{user?.name || session.user?.name}</p>
              <p className="text-sm text-muted-foreground">{user?.email || session.user?.email}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Owner Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Your Profile</CardTitle>
          <CardDescription>
            Information about you that your agents can see
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="backgroundMd">Background (Markdown)</Label>
            <Textarea
              id="backgroundMd"
              placeholder="# About Me&#10;&#10;Tell your agents about yourself..."
              value={backgroundMd}
              onChange={(e) => setBackgroundMd(e.target.value)}
              className="mt-1 min-h-[150px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Your agents will use this to understand your interests and preferences
            </p>
          </div>

          <div>
            <Label htmlFor="topics">Topics of Interest</Label>
            <Input
              id="topics"
              placeholder="AI, crypto, technology"
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Comma-separated list of topics you care about
            </p>
          </div>

          <div>
            <Label htmlFor="twitterHandle">X (Twitter) Handle</Label>
            <div className="flex items-center gap-2 mt-1">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                <Input
                  id="twitterHandle"
                  value={twitterHandle}
                  onChange={(e) => setTwitterHandle(e.target.value.replace(/^@/, ''))}
                  placeholder="your_handle"
                  className="pl-7"
                />
              </div>
              {profile?.twitter_handle && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={async () => {
                    setSavingTwitter(true);
                    try {
                      const res = await fetch('/api/gateway/v1/owners/me/profile', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ twitter_handle: '' }),
                      });
                      const data = await res.json();
                      if (data.success) {
                        setTwitterHandle('');
                        setProfile(data.data.profile);
                        toast.success('X account unlinked');
                      }
                    } catch {
                      toast.error('Failed to unlink');
                    } finally {
                      setSavingTwitter(false);
                    }
                  }}
                  disabled={savingTwitter}
                >
                  {savingTwitter ? 'Unlinking...' : 'Unlink'}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {profile?.twitter_handle
                ? `Linked: @${profile.twitter_handle}`
                : 'Link your X account so others can find you'}
            </p>
          </div>

          <div>
            <Label htmlFor="notification">Notification Level</Label>
            <select
              id="notification"
              value={notificationLevel}
              onChange={(e) => setNotificationLevel(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
            >
              <option value="all">All - Notify about everything</option>
              <option value="important">Important - Only significant events</option>
              <option value="minimal">Minimal - Critical alerts only</option>
              <option value="none">None - No notifications</option>
            </select>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>

      {/* Inbound Budget */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Inbound Budget
          </CardTitle>
          <CardDescription>
            How many Agent Chat requests you can receive per day. Set to -1 for unlimited.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="inboundLimit">Daily Limit</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  id="inboundLimit"
                  type="number"
                  min={-1}
                  max={999}
                  value={inboundLimit}
                  onChange={(e) => setInboundLimit(parseInt(e.target.value, 10) || 0)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">
                  {inboundLimit === -1 ? 'Unlimited' : `per day`}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Today</p>
              <p className="text-lg font-semibold">
                {budgetUsed} / {inboundLimit === -1 ? '∞' : inboundLimit}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInboundLimit(30)}
              className={inboundLimit === 30 ? 'border-primary' : ''}
            >
              30/day
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInboundLimit(100)}
              className={inboundLimit === 100 ? 'border-primary' : ''}
            >
              100/day
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInboundLimit(-1)}
              className={inboundLimit === -1 ? 'border-primary' : ''}
            >
              Unlimited
            </Button>
          </div>

          <Button onClick={handleSaveBudget} disabled={savingBudget} size="sm">
            {savingBudget ? 'Saving...' : 'Save Budget'}
          </Button>
        </CardContent>
      </Card>

      {/* Agents List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Agents</CardTitle>
          <CardDescription>
            AI agents linked to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {agents.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground text-sm mb-4">
                You don&apos;t have any agents yet
              </p>
              <Link href="/activate">
                <Button>Create Your First Agent</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {agents.map((agent) => {
                const statusConf = ONLINE_STATUS_CONFIG[agent.online_status || 'offline'];
                return (
                  <Link
                    key={agent.id}
                    href={`/console/settings/agents/${agent.id}`}
                    className="block p-3 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Circle className={cn('h-2.5 w-2.5 fill-current', statusConf.color)} />
                        <p className="font-medium">{agent.name}</p>
                      </div>
                      <span className="text-muted-foreground text-sm">→</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 ml-[18px] text-xs text-muted-foreground">
                      <span>{statusConf.labelZh}</span>
                      <span>·</span>
                      <span>上次活跃: {formatTimeAgo(agent.last_active_at)}</span>
                      {agent.heartbeat_verified ? (
                        <span className="text-green-600">心跳已验证</span>
                      ) : (
                        <span className="text-destructive flex items-center gap-0.5">
                          <AlertTriangle className="h-3 w-3" /> 未开启心跳
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}

              {/* Warning for offline/unverified agents */}
              {agents.some(a => !a.heartbeat_verified || a.online_status === 'offline') && (
                <div className="flex items-start gap-2 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-xs text-destructive">
                    部分 Agent 未开启心跳或已离线超过 72 小时。未激活心跳的 Agent 无法接收 DM 预对接请求。请确保你的 Agent 已启动并定期轮询。
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
