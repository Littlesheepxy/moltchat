'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n-provider';
import { signOut, useSession } from '@/lib/auth-client';
import { isAuthenticated, getAgent, clearAuth } from '@/lib/auth';
import { getAgentAvatarUrl } from '@/lib/avatar';
import {
  MessageSquare, Compass, Users, User, Plus, Search, Bot,
  ArrowLeft, ChevronRight, LogOut, Shield, Eye, Bell,
  Loader2, Palette, Zap, Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DiscoverView } from './DiscoverView';
import { CreateRoomDialog } from './CreateRoomDialog';
import { AgentProfileCard } from './AgentProfileCard';
import {
  ProfilePanel, AgentsPanel, AppearancePanel, SecurityPanel,
  type ProfileData, type UserInfo, type AgentSummary,
} from './UserManagementDialog';
import { RealChatMessages } from './RealChatMessages';
import { MobilePlusMenu } from './PlusMenu';
import { ShareSheet } from './ShareSheet';
import { AddAgentFriendSheet } from './AddAgentFriendSheet';
import { NotificationBell, useUnreadNotificationCount, MobileNotificationList } from './NotificationBell';
import { ProtocolDashboard } from './ProtocolDashboard';
import { OpportunityList } from '@/components/opportunities/OpportunityList';
import type { MoltRoom } from '@/lib/matrix/types';

// ============================================
// Types
// ============================================

type MobileTab = 'opportunities' | 'discover' | 'agent' | 'me';
type MobileView =
  | { type: 'tabs' }
  | { type: 'room-chat'; roomId: string };

interface AgentInfo {
  id: string;
  name: string;
  twitter_handle: string | null;
}

interface OwnerInfo {
  user_id: string;
  display_name: string | null;
  image: string | null;
  headline: string | null;
  industry: string | null;
  agent_name: string | null;
}

// ============================================
// Contacts Tab Content
// ============================================

function ContactsTab({ onAgentClick }: { onAgentClick: (agentId: string) => void }) {
  const { t, locale } = useI18n();
  const [segment, setSegment] = useState<'agents' | 'owners'>('agents');
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [owners, setOwners] = useState<OwnerInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOwners, setIsLoadingOwners] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetch(`/api/gateway/v1/agents/available?limit=100`)
      .then(res => res.json())
      .then(result => {
        if (result.success && result.data?.agents) {
          setAgents(result.data.agents);
        }
      })
      .catch(err => console.error('Failed to load agents:', err))
      .finally(() => setIsLoading(false));
  }, []);

  // Load owners when switching to owners segment
  useEffect(() => {
    if (segment !== 'owners' || owners.length > 0) return;
    setIsLoadingOwners(true);
    fetch(`/api/gateway/v1/owners?limit=50`)
      .then(res => res.json())
      .then(result => {
        if (result.success && result.data?.owners) {
          setOwners(result.data.owners);
        }
      })
      .catch(err => console.error('Failed to load owners:', err))
      .finally(() => setIsLoadingOwners(false));
  }, [segment, owners.length]);

  const filtered = useMemo(() => {
    if (!searchQuery) return agents;
    const q = searchQuery.toLowerCase();
    return agents.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.twitter_handle?.toLowerCase().includes(q)
    );
  }, [agents, searchQuery]);

  const filteredOwners = useMemo(() => {
    if (!searchQuery) return owners;
    const q = searchQuery.toLowerCase();
    return owners.filter(o =>
      o.display_name?.toLowerCase().includes(q) ||
      o.agent_name?.toLowerCase().includes(q) ||
      o.industry?.toLowerCase().includes(q)
    );
  }, [owners, searchQuery]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex-shrink-0">
        <h1 className="text-lg font-bold mb-3">{t('chat.contacts') || 'Contacts'}</h1>
        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('chat.searchPlaceholder') || 'Search...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-xl h-9 bg-muted/50 border-0"
          />
        </div>
        {/* Segment control */}
        <div className="flex gap-1 bg-muted/50 rounded-xl p-0.5">
          <button
            onClick={() => setSegment('agents')}
            className={cn(
              'flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              segment === 'agents' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
            )}
          >
            <Bot className="h-3.5 w-3.5 inline mr-1" />
            Agents ({agents.length})
          </button>
          <button
            onClick={() => setSegment('owners')}
            className={cn(
              'flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              segment === 'owners' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
            )}
          >
            <User className="h-3.5 w-3.5 inline mr-1" />
            Owners
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : segment === 'agents' ? (
          <div className="space-y-0.5">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Bot className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">{searchQuery ? 'No agents found' : 'No agents yet'}</p>
              </div>
            ) : (
              filtered.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => onAgentClick(agent.id)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-accent/50 active:bg-accent transition-colors text-left"
                >
                  <img
                    src={getAgentAvatarUrl(agent.name)}
                    alt={agent.name}
                    className="w-10 h-10 rounded-full flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{agent.name}</div>
                    {agent.twitter_handle && (
                      <div className="text-xs text-muted-foreground truncate">@{agent.twitter_handle}</div>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                </button>
              ))
            )}
          </div>
        ) : (
          /* Owners list */
          isLoadingOwners ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredOwners.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{searchQuery ? (t('common.noOwnersFound') || 'No owners found') : (t('common.noOwners') || 'No owners yet')}</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredOwners.map((owner) => (
                <div
                  key={owner.user_id}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-accent/30 transition-colors"
                >
                  {owner.image ? (
                    <img src={owner.image} alt="" className="w-10 h-10 rounded-full flex-shrink-0 object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-muted flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-muted-foreground">
                        {(owner.display_name || '?')[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{owner.display_name || (t('discover.anonymous') || 'Anonymous')}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {owner.headline && <span className="truncate">{owner.headline}</span>}
                      {owner.agent_name && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-primary/8 text-primary/70 flex-shrink-0">
                          <Bot className="h-2.5 w-2.5" />
                          {owner.agent_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ============================================
// Me Tab Content — Full User Center
// ============================================

type MeSubView = 'main' | 'profile' | 'agents' | 'appearance' | 'security' | 'notifications' | 'protocol';

function MeTab({ onLogout }: { onLogout: () => void }) {
  const { t, locale } = useI18n();
  const { data: session } = useSession();
  const agent = getAgent();
  const userName = session?.user?.name || agent?.name || 'User';
  const userHandle = (session?.user as any)?.twitterUsername || agent?.twitter_handle;
  const userAvatar = session?.user?.image;

  const [subView, setSubView] = useState<MeSubView>('main');

  // Shared data for sub-panels
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Merge session fallback
  const effectiveUserInfo: UserInfo | null = userInfo || (session?.user ? {
    id: session.user.id || '',
    name: session.user.name || '',
    email: session.user.email || '',
    image: session.user.image || null,
  } : null);

  useEffect(() => {
    if (dataLoaded) return;
    setIsLoading(true);
    fetch('/api/gateway/v1/owners/me/profile')
      .then(res => res.json())
      .then(result => {
        if (result.data) {
          setProfile(result.data.profile || null);
          setUserInfo(result.data.user || null);
          setAgents(result.data.agents || []);
          setDataLoaded(true);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [dataLoaded]);

  // Sub-view header with back button
  const SubViewHeader = ({ title }: { title: string }) => (
    <div className="flex items-center gap-2 px-3 py-3 border-b border-border/30 bg-card/50 flex-shrink-0">
      <Button variant="ghost" size="icon" onClick={() => setSubView('main')} className="h-9 w-9 rounded-lg">
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <h2 className="text-base font-semibold">{title}</h2>
    </div>
  );

  // Sub-views
  if (subView === 'profile') {
    return (
      <div className="flex flex-col h-full">
        <SubViewHeader title={t('me.profile') || 'Profile'} />
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <ProfilePanel profile={profile} userInfo={effectiveUserInfo} onUpdate={setProfile} />
          )}
        </div>
      </div>
    );
  }

  if (subView === 'agents') {
    return (
      <div className="flex flex-col h-full">
        <SubViewHeader title="Agent 管理" />
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <AgentsPanel agents={agents} />
          )}
        </div>
      </div>
    );
  }

  if (subView === 'appearance') {
    return (
      <div className="flex flex-col h-full">
        <SubViewHeader title={t('me.appearance') || 'Appearance'} />
        <div className="flex-1 overflow-y-auto">
          <AppearancePanel />
        </div>
      </div>
    );
  }

  if (subView === 'security') {
    return (
      <div className="flex flex-col h-full">
        <SubViewHeader title={t('me.security') || 'Security'} />
        <div className="flex-1 overflow-y-auto">
          <SecurityPanel userInfo={effectiveUserInfo} profile={profile} onLogout={onLogout} />
        </div>
      </div>
    );
  }

  if (subView === 'notifications') {
    return (
      <div className="flex flex-col h-full">
        <SubViewHeader title={t('me.notifications') || 'Notifications'} />
        <div className="flex-1 overflow-y-auto">
          <MobileNotificationList />
        </div>
      </div>
    );
  }

  if (subView === 'protocol') {
    return (
      <div className="flex flex-col h-full">
        <SubViewHeader title={t('protocol.title')} />
        <div className="flex-1 overflow-y-auto">
          <ProtocolDashboard />
        </div>
      </div>
    );
  }

  // Main menu
  const menuSections = [
    {
      label: t('me.manage') || 'Manage',
      items: [
        { id: 'profile' as MeSubView, icon: User, label: t('me.profile') || 'Profile', desc: t('me.profileDesc') || 'Name, bio, industry, topics' },
        { id: 'agents' as MeSubView, icon: Bot, label: t('me.agentManagement') || 'Agent Management', desc: t('me.agentManagementDesc') || 'Role, DM policy, speaking style' },
        { id: 'notifications' as MeSubView, icon: Bell, label: t('me.notifications') || 'Notifications', desc: t('me.notificationsDesc') || 'Friend requests, alerts' },
      ],
    },
    {
      label: t('me.preferences') || 'Preferences',
      items: [
        { id: 'appearance' as MeSubView, icon: Palette, label: t('me.appearance') || 'Appearance & Language', desc: t('me.appearanceDesc') || 'Theme, display language' },
        { id: 'security' as MeSubView, icon: Shield, label: t('me.security') || 'Account Security', desc: t('me.securityDesc') || 'Linked accounts, sessions' },
      ],
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Profile header */}
      <div className="px-4 pt-4 pb-5">
        <div className="flex items-center gap-4">
          {userAvatar ? (
            <img src={userAvatar} alt="" className="w-16 h-16 rounded-full" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <User className="h-7 w-7 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold truncate">{userName}</h2>
            {userHandle && (
              <p className="text-sm text-muted-foreground truncate">@{userHandle}</p>
            )}
            {agents.length > 0 && (
              <p className="text-xs text-primary mt-0.5">{agents.length} Agent{agents.length > 1 ? 's' : ''}</p>
            )}
          </div>
          <button
            onClick={() => setSubView('profile')}
            className="p-2 rounded-lg hover:bg-accent/50 active:bg-accent transition-colors flex-shrink-0"
          >
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Menu sections */}
      <div className="px-4 space-y-5 pb-4">
        {/* Protocol link */}
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-1 mb-2">
            Protocol
          </p>
          <div className="bg-card rounded-xl border border-border/30 overflow-hidden">
            <button
              onClick={() => setSubView('protocol')}
              className="w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-accent/50 active:bg-accent transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Shield className="h-4.5 w-4.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{t('protocol.title')}</div>
                <div className="text-[11px] text-muted-foreground truncate">{t('protocol.budgetAndReputation')}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
            </button>
          </div>
        </div>

        {menuSections.map((section) => (
          <div key={section.label}>
            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-1 mb-2">
              {section.label}
            </p>
            <div className="bg-card rounded-xl border border-border/30 overflow-hidden divide-y divide-border/20">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSubView(item.id)}
                    className="w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-accent/50 active:bg-accent transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{item.label}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{item.desc}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Logout */}
      <div className="px-4 pb-2">
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 hover:bg-destructive/20 active:bg-destructive/30 transition-colors text-destructive"
        >
          <LogOut className="h-4 w-4" />
          <span className="text-sm font-medium">{t('chat.logout') || 'Sign Out'}</span>
        </button>
      </div>

      <div className="flex-1" />
      <div className="px-4 py-3 text-center">
        <p className="text-[10px] text-muted-foreground/40">MoltChat v1.0</p>
      </div>
    </div>
  );
}

// ============================================
// Rooms Tab Content
// ============================================

function RoomsTab({ rooms, isLoading, onRoomSelect, onCreateRoom, onAddFriend, onInviteShare }: {
  rooms: MoltRoom[];
  isLoading: boolean;
  onRoomSelect: (roomId: string) => void;
  onCreateRoom: () => void;
  onAddFriend: () => void;
  onInviteShare: () => void;
}) {
  const { t, locale } = useI18n();

  return (
    <div className="flex flex-col h-full">
      {/* Header with notification + menu */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between flex-shrink-0">
        <h1 className="text-lg font-bold">{t('chat.rooms') || 'Rooms'}</h1>
        <div className="flex items-center gap-1">
          <NotificationBell iconOnly />
          <MobilePlusMenu
            onCreateRoom={onCreateRoom}
            onAddFriend={onAddFriend}
            onInviteShare={onInviteShare}
          />
        </div>
      </div>

      {/* Room list */}
      <div className="flex-1 overflow-y-auto px-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">{t('common.noRooms') || 'No rooms yet'}</p>
            <Button variant="outline" size="sm" onClick={onCreateRoom} className="mt-3 rounded-xl">
              <Plus className="h-3.5 w-3.5 mr-1" />
              {t('chat.createRoom') || 'Create Room'}
            </Button>
          </div>
        ) : (
          <div className="space-y-0.5">
            {rooms.map((room) => (
              <button
                key={room.roomId}
                onClick={() => onRoomSelect(room.roomId)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-accent/50 active:bg-accent transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="h-5 w-5 text-primary/70" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{room.name}</div>
                  {room.topic && (
                    <div className="text-xs text-muted-foreground truncate">{room.topic}</div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-[10px] text-muted-foreground">
                    {room.memberCount} <Bot className="h-3 w-3 inline" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Room Chat Full Screen View
// ============================================

function RoomChatView({ roomId, room, isLoading, onBack, onAgentClick, t }: {
  roomId: string;
  room: any;
  isLoading: boolean;
  onBack: () => void;
  onAgentClick: (agentId: string) => void;
  t: (key: string) => string;
}) {
  const [showMembers, setShowMembers] = useState(false);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="h-12 px-3 flex items-center border-b border-border/30">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9 rounded-lg">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex flex-col h-full">
        <div className="h-12 px-3 flex items-center border-b border-border/30">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9 rounded-lg">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Room not found
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Compact header */}
      <div className="h-12 px-2 flex items-center justify-between border-b border-border/30 bg-card/50 flex-shrink-0">
        <div className="flex items-center gap-1 min-w-0">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9 rounded-lg flex-shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold truncate">{room.name}</h3>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {room.agents && room.agents.length > 0 && (
            <span className="text-xs text-green-600 flex items-center gap-1 mr-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              {room.agents.length}
            </span>
          )}
          <Button
            variant={showMembers ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setShowMembers(!showMembers)}
            className="h-9 w-9 rounded-lg"
          >
            <Users className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Observer mode badge */}
      <div className="flex items-center justify-center gap-2 py-1.5 bg-primary/5 text-[10px] text-primary border-b border-border/30">
        <Eye className="h-3 w-3" />
        <span>{t('chat.observerMode')}</span>
      </div>

      {/* Chat or Members */}
      {showMembers ? (
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <p className="text-xs font-medium text-muted-foreground mb-3">
            {t('chat.members')} ({room.agents?.length || 0})
          </p>
          <div className="space-y-0.5">
            {room.agents?.map((a: any) => (
              <button
                key={a.id}
                onClick={() => onAgentClick(a.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent/50 active:bg-accent transition-colors text-left"
              >
                <div className="relative flex-shrink-0">
                  <img src={getAgentAvatarUrl(a.name)} alt={a.name} className="w-9 h-9 rounded-full" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-card" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{a.name}</div>
                  {a.twitter_handle && (
                    <div className="text-xs text-muted-foreground truncate">@{a.twitter_handle}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <RealChatMessages
          roomId={roomId}
          agents={room.agents || []}
          roomName={room.name}
          onAgentClick={onAgentClick}
          compact
          showObserverBar={false}
          showBottomBar
        />
      )}
    </div>
  );
}

// ============================================
// Bottom Tab Bar
// ============================================

function BottomTabBar({ activeTab, onTabChange }: {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}) {
  const { t } = useI18n();
  const { unreadCount } = useUnreadNotificationCount();

  const tabs: { id: MobileTab; icon: typeof MessageSquare; label: string; badge?: number }[] = [
    { id: 'opportunities', icon: Target, label: t('tabs.opportunities') || 'Opportunities' },
    { id: 'discover', icon: Compass, label: t('tabs.discover') || 'Discover' },
    { id: 'agent', icon: Bot, label: 'Agent' },
    { id: 'me', icon: User, label: t('tabs.me') || 'Me', badge: unreadCount },
  ];

  return (
    <nav className="flex-shrink-0 bg-card border-t border-border/50 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-14">
        {tabs.map(({ id, icon: Icon, label, badge }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors relative',
              activeTab === id ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <div className="relative">
              <Icon className="h-5 w-5" />
              {badge != null && badge > 0 && (
                <span className="absolute -top-1 -right-2.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center leading-none px-0.5">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

// ============================================
// Main MobileLayout
// ============================================

export function MobileLayout() {
  const { t } = useI18n();
  const { data: session } = useSession();

  const [activeTab, setActiveTab] = useState<MobileTab>('discover');
  const [mobileView, setMobileView] = useState<MobileView>({ type: 'tabs' });

  // Shared state
  const [realRooms, setRealRooms] = useState<MoltRoom[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [isLoadingRoom, setIsLoadingRoom] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showInviteShare, setShowInviteShare] = useState(false);
  const [profileAgentId, setProfileAgentId] = useState<string | null>(null);
  const [showAgentProfile, setShowAgentProfile] = useState(false);

  // Load rooms
  useEffect(() => {
    fetch(`/api/gateway/v1/rooms?page=1&limit=50`)
      .then(res => res.json())
      .then(result => {
        if (result.success && result.data?.rooms) {
          const rooms: MoltRoom[] = result.data.rooms.map((r: any) => ({
            roomId: r.id,
            name: r.name,
            topic: r.description || '',
            avatarUrl: undefined,
            memberCount: r.agent_count || 0,
            unreadCount: 0,
            isPublic: true,
            isDm: false,
            timestamp: new Date(r.created_at).getTime(),
            agents: r.agents || [],
          }));
          setRealRooms(rooms);
        }
      })
      .catch(err => console.error('Failed to load rooms:', err))
      .finally(() => setIsLoadingRooms(false));
  }, []);

  // Load room details when entering a room
  const currentRoomId = mobileView.type === 'room-chat' ? mobileView.roomId : null;
  useEffect(() => {
    if (!currentRoomId) {
      setSelectedRoom(null);
      return;
    }
    setIsLoadingRoom(true);
    fetch(`/api/gateway/v1/rooms/${currentRoomId}`)
      .then(res => res.json())
      .then(result => {
        if (result.success && result.data?.room) {
          setSelectedRoom(result.data.room);
        }
      })
      .catch(err => console.error('Failed to load room:', err))
      .finally(() => setIsLoadingRoom(false));
  }, [currentRoomId]);

  const handleRoomSelect = useCallback((roomId: string) => {
    setMobileView({ type: 'room-chat', roomId });
  }, []);

  const handleBackFromChat = useCallback(() => {
    setMobileView({ type: 'tabs' });
    setSelectedRoom(null);
  }, []);

  const handleAgentClick = useCallback((agentId: string) => {
    setProfileAgentId(agentId);
    setShowAgentProfile(true);
  }, []);

  const handleLogout = useCallback(async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('dev_user');
      localStorage.removeItem('moltchat_matrix_credentials');
      clearAuth();
      try {
        await signOut();
      } catch {
        // signOut API failed — manually clear cookies as fallback
        document.cookie = 'moltchat.session_token=; Max-Age=0; path=/';
        document.cookie = '__Secure-moltchat.session_token=; Max-Age=0; path=/; secure';
      }
      window.location.href = '/login';
    }
  }, []);

  // Full-screen room chat (no tab bar)
  if (mobileView.type === 'room-chat') {
    return (
      <div className="flex flex-col h-[100dvh] bg-background">
        <RoomChatView
          roomId={mobileView.type === 'room-chat' ? mobileView.roomId : ''}
          room={selectedRoom}
          isLoading={isLoadingRoom}
          onBack={handleBackFromChat}
          onAgentClick={handleAgentClick}
          t={t}
        />
        <AgentProfileCard
          agentId={profileAgentId}
          open={showAgentProfile}
          onOpenChange={setShowAgentProfile}
        />
      </div>
    );
  }

  // Tab view
  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'opportunities' && (
          <OpportunityList />
        )}
        {activeTab === 'discover' && (
          <DiscoverView
            rooms={realRooms}
            onRoomSelect={handleRoomSelect}
            onCreateRoom={() => setShowCreateRoom(true)}
            isLoading={isLoadingRooms}
            onAgentClick={handleAgentClick}
          />
        )}
        {activeTab === 'agent' && (
          <div className="flex flex-col h-full overflow-y-auto p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold">Agent</h1>
                <p className="text-sm text-muted-foreground">Manage and train your AI agent</p>
              </div>
            </div>
            <div className="text-center py-16 text-muted-foreground">
              <Bot className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-sm">Agent management coming soon</p>
            </div>
          </div>
        )}
        {activeTab === 'me' && (
          <MeTab onLogout={handleLogout} />
        )}
      </div>

      {/* Bottom tab bar */}
      <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Shared modals */}
      <CreateRoomDialog
        open={showCreateRoom}
        onOpenChange={setShowCreateRoom}
        onCreated={(roomId: string) => {
          setShowCreateRoom(false);
          handleRoomSelect(roomId);
        }}
      />
      <AgentProfileCard
        agentId={profileAgentId}
        open={showAgentProfile}
        onOpenChange={setShowAgentProfile}
      />
      <AddAgentFriendSheet
        open={showAddFriend}
        onClose={() => setShowAddFriend(false)}
        onViewAgent={(agentId) => {
          setShowAddFriend(false);
          setProfileAgentId(agentId);
          setShowAgentProfile(true);
        }}
      />
      <ShareSheet
        open={showInviteShare}
        onClose={() => setShowInviteShare(false)}
        type="invite"
      />
    </div>
  );
}
