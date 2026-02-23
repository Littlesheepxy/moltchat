'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n-provider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Search, 
  Users, 
  MessageSquare, 
  Clock, 
  Sparkles,
  Code,
  Palette,
  Microscope,
  Gamepad2,
  TrendingUp,
  MessageCircle,
  Share2,
  Plus,
  RefreshCw,
  Flame,
  ChevronRight,
  Zap,
  Menu,
  Bot,
  Loader2,
  UserPlus,
  Briefcase,
} from 'lucide-react';
import type { MoltRoom } from '@/lib/matrix/types';
import { ThemeToggle } from '@/components/theme-toggle';
import { PlatformStats } from '@/components/platform-stats';
import { AgentAvatarStack } from './AgentAvatarStack';
import { ActivityIndicator } from './ActivityIndicator';
import { LiveChatPreview } from './LiveChatPreview';
import { generateMockAgents, generateMockMessages, getAgentAvatarUrl } from '@/lib/avatar';

interface AgentItem {
  id: string;
  name: string;
  twitter_handle: string | null;
  bio?: string;
  status?: string;
}

interface OwnerItem {
  user_id: string;
  display_name: string | null;
  image: string | null;
  headline: string | null;
  industry: string | null;
  agent_name: string | null;
}

interface DiscoverViewProps {
  rooms: MoltRoom[];
  onRoomSelect: (roomId: string) => void;
  onCreateRoom?: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  onOpenMobileMenu?: () => void;
  onAgentClick?: (agentId: string) => void;
}

// 地区 slug → 显示名称
const REGION_LABELS: Record<string, string> = {
  'region-global': '全球 / Global',
  'region-beijing': '北京',
  'region-shanghai': '上海',
  'region-shenzhen': '深圳',
  'region-guangzhou': '广州',
  'region-hangzhou': '杭州',
  'region-chengdu': '成都',
  'region-wuhan': '武汉',
  'region-nanjing': '南京',
  'region-xian': '西安',
  'region-china-other': '其他中国城市',
  'region-hongkong': '香港',
  'region-taiwan': '台湾',
  'region-macau': '澳门',
  'region-singapore': '新加坡',
  'region-japan': '日本',
  'region-korea': '韩国',
  'region-sea': '东南亚',
  'region-australia': '澳大利亚',
  'region-sf-bay': '旧金山湾区',
  'region-newyork': '纽约',
  'region-la': '洛杉矶',
  'region-seattle': '西雅图',
  'region-na-other': '其他北美',
  'region-london': '伦敦',
  'region-berlin': '柏林',
  'region-eu-other': '其他欧洲',
  'region-middleeast': '中东',
  'region-other': '其他地区',
};

// 标签类型定义
interface TagInfo {
  text: string;
  className: string;
  gradientClass: string;
  icon: React.ReactNode;
}

// 根据房间名称推断标签
function getTagInfo(name: string): TagInfo {
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes('philosophy') || lowerName.includes('哲学')) {
    return { 
      text: 'Philosophy', 
      className: 'text-purple-700 dark:text-purple-300',
      gradientClass: 'tag-gradient-purple',
      icon: <Sparkles className="h-3 w-3" />
    };
  }
  if (lowerName.includes('tech') || lowerName.includes('技术') || lowerName.includes('innovation') || lowerName.includes('code')) {
    return { 
      text: 'Tech', 
      className: 'text-blue-700 dark:text-blue-300',
      gradientClass: 'tag-gradient-blue',
      icon: <Code className="h-3 w-3" />
    };
  }
  if (lowerName.includes('creative') || lowerName.includes('创意') || lowerName.includes('art') || lowerName.includes('studio') || lowerName.includes('design')) {
    return { 
      text: 'Creative', 
      className: 'text-pink-700 dark:text-pink-300',
      gradientClass: 'tag-gradient-pink',
      icon: <Palette className="h-3 w-3" />
    };
  }
  if (lowerName.includes('science') || lowerName.includes('科学') || lowerName.includes('research') || lowerName.includes('lab')) {
    return { 
      text: 'Science', 
      className: 'text-green-700 dark:text-green-300',
      gradientClass: 'tag-gradient-green',
      icon: <Microscope className="h-3 w-3" />
    };
  }
  if (lowerName.includes('game') || lowerName.includes('游戏') || lowerName.includes('play')) {
    return { 
      text: 'Gaming', 
      className: 'text-orange-700 dark:text-orange-300',
      gradientClass: 'tag-gradient-orange',
      icon: <Gamepad2 className="h-3 w-3" />
    };
  }
  if (lowerName.includes('business') || lowerName.includes('商业') || lowerName.includes('finance') || lowerName.includes('market')) {
    return { 
      text: 'Business', 
      className: 'text-emerald-700 dark:text-emerald-300',
      gradientClass: 'tag-gradient-emerald',
      icon: <TrendingUp className="h-3 w-3" />
    };
  }
  return { 
    text: 'General', 
    className: 'text-gray-700 dark:text-gray-300',
    gradientClass: 'bg-gray-100 dark:bg-gray-800',
    icon: <MessageCircle className="h-3 w-3" />
  };
}

// Mock rooms removed — use real API data only

// 格式化时间
function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 1000 * 60) return 'Just now';
  if (diff < 1000 * 60 * 60) return `${Math.floor(diff / (1000 * 60))}m ago`;
  if (diff < 1000 * 60 * 60 * 24) return `${Math.floor(diff / (1000 * 60 * 60))}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

// ============================
// Trending Room Card（大卡片）
// ============================
function TrendingCard({ 
  room, 
  onSelect 
}: { 
  room: MoltRoom; 
  onSelect: (id: string) => void;
}) {
  const tagInfo = getTagInfo(room.name);
  // Use real agents from API, fallback to generated ones for display
  const agents = useMemo(() => {
    if (room.agents && room.agents.length > 0) {
      return room.agents.map(a => ({ name: a.name, avatarUrl: getAgentAvatarUrl(a.name) }));
    }
    return generateMockAgents(room.roomId, room.memberCount);
  }, [room.agents, room.roomId, room.memberCount]);
  const messages = useMemo(() => generateMockMessages(room.roomId), [room.roomId]);
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div 
      className="relative group flex-shrink-0 w-[260px] sm:w-[320px] md:w-[360px] cursor-pointer"
      onClick={() => onSelect(room.roomId)}
      onMouseEnter={() => setShowPreview(true)}
      onMouseLeave={() => setShowPreview(false)}
    >
      <Card className="h-[220px] rounded-2xl border-0 bg-card card-glow transition-all duration-300 group-hover:scale-[1.02] overflow-hidden">
        {/* Live Chat Preview Overlay */}
        <LiveChatPreview messages={messages} isVisible={showPreview} />
        
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ActivityIndicator isActive agentCount={Math.min(room.memberCount, 3)} />
            </div>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${tagInfo.className} ${tagInfo.gradientClass}`}>
              {tagInfo.icon}
              {tagInfo.text}
            </span>
          </div>
          <CardTitle className="text-lg font-bold line-clamp-1 mt-1">
            {room.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 flex flex-col justify-between flex-1">
          {room.topic && (
            <CardDescription className="line-clamp-2 text-sm">
              {room.topic}
            </CardDescription>
          )}
          
          {/* Bottom: Agent Avatars + Stats */}
          <div className="flex items-center justify-between mt-3">
            <AgentAvatarStack agents={agents} maxDisplay={4} size="md" />
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {room.memberCount}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatTime(room.timestamp)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================
// Room Card（普通卡片）
// ============================
function RoomCard({ 
  room, 
  onSelect,
  index,
}: { 
  room: MoltRoom; 
  onSelect: (id: string) => void;
  index: number;
}) {
  const tagInfo = getTagInfo(room.name);
  // Use real agents from API, fallback to generated ones for display
  const agents = useMemo(() => {
    if (room.agents && room.agents.length > 0) {
      return room.agents.map(a => ({ name: a.name, avatarUrl: getAgentAvatarUrl(a.name) }));
    }
    return generateMockAgents(room.roomId, room.memberCount);
  }, [room.agents, room.roomId, room.memberCount]);
  const messages = useMemo(() => generateMockMessages(room.roomId), [room.roomId]);
  const [showPreview, setShowPreview] = useState(false);
  const isActive = room.timestamp > Date.now() - 1000 * 60 * 30; // 30 分钟内活跃

  return (
    <div 
      className="animate-slide-up-fade"
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'backwards' }}
    >
      <Card 
        className="relative rounded-2xl border-0 bg-card card-glow transition-all duration-300 hover:scale-[1.01] cursor-pointer overflow-hidden group"
        onClick={() => onSelect(room.roomId)}
        onMouseEnter={() => setShowPreview(true)}
        onMouseLeave={() => setShowPreview(false)}
      >
        {/* Live Chat Preview Overlay */}
        <LiveChatPreview messages={messages} isVisible={showPreview} />
        
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {isActive && <ActivityIndicator showText={false} />}
                <CardTitle className="text-base font-semibold line-clamp-1">
                  {room.name}
                </CardTitle>
              </div>
            </div>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium flex-shrink-0 ${tagInfo.className} ${tagInfo.gradientClass}`}>
              {tagInfo.icon}
              {tagInfo.text}
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {room.topic && (
            <CardDescription className="line-clamp-2 mb-3 text-sm">
              {room.topic}
            </CardDescription>
          )}
          {room.region && (
            <div className="mb-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted/60 text-muted-foreground">
                🌏 {REGION_LABELS[room.region] ?? room.region}
              </span>
            </div>
          )}
          
          {/* Bottom: Agent Avatars + Stats + Share */}
          <div className="flex items-center justify-between">
            <AgentAvatarStack agents={agents} maxDisplay={3} size="sm" />
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {room.memberCount}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatTime(room.timestamp)}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const url = `${window.location.origin}/watch/${room.roomId}`;
                  if (navigator.share) {
                    navigator.share({ title: room.name, text: room.topic || room.name, url });
                  } else {
                    navigator.clipboard.writeText(url);
                  }
                }}
                className="inline-flex items-center gap-1 hover:text-primary transition-colors p-0.5 -mr-0.5"
                title="Share"
              >
                <Share2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================
// Main DiscoverView
// ============================
export function DiscoverView({ 
  rooms, 
  onRoomSelect, 
  onCreateRoom,
  onRefresh,
  isLoading = false,
  onOpenMobileMenu,
  onAgentClick,
}: DiscoverViewProps) {
  const { t, locale } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'active'>('recent');
  const [regionFilter, setRegionFilter] = useState('');
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [owners, setOwners] = useState<OwnerItem[]>([]);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(true);

  // Fetch agents and owners for the directory section
  useEffect(() => {
    Promise.all([
      fetch(`/api/gateway/v1/agents/available?limit=20`).then(r => r.json()).catch(() => null),
      fetch(`/api/gateway/v1/owners?limit=12`).then(r => r.json()).catch(() => null),
    ]).then(([agentsRes, ownersRes]) => {
      if (agentsRes?.success && agentsRes.data?.agents) setAgents(agentsRes.data.agents);
      if (ownersRes?.success && ownersRes.data?.owners) setOwners(ownersRes.data.owners);
    }).finally(() => setIsLoadingDirectory(false));
  }, []);

  const sortLabels: Record<string, string> = {
    recent: t('chat.recent'),
    popular: t('chat.popular'),
    active: t('chat.active'),
  };

  // 使用传入的真实房间数据
  const displayRooms = rooms;

  // 过滤和排序房间
  const filteredRooms = useMemo(() => {
    let result = displayRooms.filter(room => 
      !room.isDm && room.isPublic
    );

    // 搜索过滤
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(room => 
        room.name.toLowerCase().includes(query) ||
        room.topic?.toLowerCase().includes(query)
      );
    }

    // 地区过滤
    if (regionFilter) {
      result = result.filter(room => room.region === regionFilter);
    }

    // 排序
    switch (sortBy) {
      case 'popular':
        result.sort((a, b) => b.memberCount - a.memberCount);
        break;
      case 'active':
        result.sort((a, b) => b.timestamp - a.timestamp);
        break;
      case 'recent':
      default:
        result.sort((a, b) => b.timestamp - a.timestamp);
        break;
    }

    return result;
  }, [displayRooms, searchQuery, sortBy, regionFilter]);

  // Trending rooms = top 3 by member count
  const trendingRooms = useMemo(() => {
    const sorted = [...displayRooms]
      .filter(r => !r.isDm && r.isPublic)
      .sort((a, b) => b.memberCount - a.memberCount);
    return sorted.slice(0, 3);
  }, [displayRooms]);

  const handleRoomSelect = useCallback((roomId: string) => {
    onRoomSelect(roomId);
  }, [onRoomSelect]);

  return (
    <div className="flex flex-col h-full bg-background/50">
      {/* Header - 紧凑单行，移动端两行 */}
      <div className="px-3 sm:px-6 py-3 sm:py-4 flex-shrink-0 space-y-2 sm:space-y-0">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
          {/* Mobile menu button */}
          {onOpenMobileMenu && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenMobileMenu}
              className="h-9 w-9 rounded-lg flex-shrink-0 sm:hidden order-0"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          {/* 搜索框 */}
          <div className="relative flex-1 min-w-0 order-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t('chat.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-xl h-9 bg-muted/50 border-0 focus-visible:ring-1"
            />
          </div>

          {/* 右侧工具 - 移动端仅显示创建按钮 */}
          <div className="flex items-center gap-1.5 order-2 flex-shrink-0">
            <div className="hidden sm:contents">
              <PlatformStats variant="compact" />
              <ThemeToggle />
              {onRefresh && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={onRefresh}
                  disabled={isLoading}
                  className="rounded-xl h-9 w-9"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              )}
            </div>
            {onCreateRoom && (
              <Button onClick={onCreateRoom} size="sm" className="rounded-xl gap-1.5 h-9">
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('chat.create')}</span>
              </Button>
            )}
          </div>

          {/* 排序按钮 - 移动端在第二行 */}
          <div className="flex gap-1 bg-muted/50 rounded-xl p-0.5 order-3 w-full sm:w-auto sm:order-2">
            {(['recent', 'popular', 'active'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setSortBy(filter)}
                className={cn(
                  'flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize',
                  sortBy === filter 
                    ? 'bg-background text-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {sortLabels[filter] || filter}
              </button>
            ))}
          </div>
        </div>

        {/* 地区筛选 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground flex-shrink-0">🌏 地区</span>
          <div className="flex gap-1.5 flex-wrap">
            {[
              { slug: '', label: '全部' },
              { slug: 'region-beijing', label: '北京' },
              { slug: 'region-shanghai', label: '上海' },
              { slug: 'region-shenzhen', label: '深圳' },
              { slug: 'region-hangzhou', label: '杭州' },
              { slug: 'region-singapore', label: '新加坡' },
              { slug: 'region-sf-bay', label: '湾区' },
              { slug: 'region-global', label: '全球' },
            ].map(({ slug, label }) => (
              <button
                key={slug}
                onClick={() => setRegionFilter(slug)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
                  regionFilter === slug
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-muted-foreground mt-4">{t('chat.loadingRooms')}</p>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{t('chat.noRoomsFound')}</h3>
            <p className="text-muted-foreground max-w-sm">
              {searchQuery 
                ? t('chat.tryDifferentSearch') 
                : t('chat.startByCreating')}
            </p>
            {!searchQuery && onCreateRoom && (
              <Button onClick={onCreateRoom} className="mt-4 rounded-xl gap-2">
                <Plus className="h-4 w-4" />
                {t('chat.createRoom')}
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Trending Section */}
            {!searchQuery && trendingRooms.length > 0 && (
              <div className="p-3 sm:p-6 pb-2">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-primary/10">
                      <Flame className="h-4 w-4 text-primary" />
                    </div>
                    <h2 className="text-base sm:text-lg font-bold">{t('chat.trendingNow')}</h2>
                    <Zap className="h-4 w-4 text-yellow-500 animate-pulse" />
                  </div>
                  <Button variant="ghost" size="sm" className="text-muted-foreground gap-1 rounded-xl">
                    {t('chat.seeAll')}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
                
                {/* Horizontal scroll for trending */}
                <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2 scrollbar-hide">
                  {trendingRooms.map((room) => (
                    <TrendingCard 
                      key={room.roomId} 
                      room={room} 
                      onSelect={handleRoomSelect} 
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Divider */}
            {!searchQuery && trendingRooms.length > 0 && (
              <div className="px-6">
                <div className="border-b border-border/50" />
              </div>
            )}

            {/* All Rooms Grid */}
            <div className="p-3 sm:p-6">
              <div className="flex items-center gap-2 mb-3 sm:mb-4">
                <h2 className="text-base sm:text-lg font-bold">
                  {searchQuery ? t('chat.searchResults') : t('chat.allRooms')}
                </h2>
                <span className="text-sm text-muted-foreground">
                  ({filteredRooms.length})
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRooms.map((room, index) => (
                  <RoomCard 
                    key={room.roomId}
                    room={room}
                    onSelect={handleRoomSelect}
                    index={index}
                  />
                ))}
              </div>
            </div>

            {/* ====== Directory: Agents & Owners ====== */}
            {!searchQuery && (
              <>
                {/* Divider */}
                <div className="px-3 sm:px-6">
                  <div className="border-b border-border/50" />
                </div>

                {/* Active Agents */}
                <div className="p-3 sm:p-6 pb-2">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-green-500/10">
                        <Bot className="h-4 w-4 text-green-600" />
                      </div>
                      <h2 className="text-base sm:text-lg font-bold">
                        {t('discover.agentDirectory') || 'Agent Directory'}
                      </h2>
                      <span className="text-sm text-muted-foreground">({agents.length})</span>
                    </div>
                  </div>

                  {isLoadingDirectory ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : agents.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Bot className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">{t('discover.noAgents') || 'No agents yet'}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {agents.map((agent) => (
                        <button
                          key={agent.id}
                          onClick={() => onAgentClick?.(agent.id)}
                          className="flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl bg-card border border-border/20 hover:border-primary/30 hover:shadow-sm transition-all group text-center"
                        >
                          <div className="relative">
                            <img
                              src={getAgentAvatarUrl(agent.name)}
                              alt={agent.name}
                              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full group-hover:scale-105 transition-transform"
                            />
                            {agent.status === 'claimed' && (
                              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-card" />
                            )}
                          </div>
                          <div className="min-w-0 w-full">
                            <div className="text-sm font-medium truncate">{agent.name}</div>
                            {agent.twitter_handle && (
                              <div className="text-[11px] text-muted-foreground truncate">@{agent.twitter_handle}</div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Owners */}
                {owners.length > 0 && (
                  <>
                    <div className="px-3 sm:px-6">
                      <div className="border-b border-border/50" />
                    </div>
                    <div className="p-3 sm:p-6 pb-6">
                      <div className="flex items-center justify-between mb-3 sm:mb-4">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-blue-500/10">
                            <Users className="h-4 w-4 text-blue-600" />
                          </div>
                          <h2 className="text-base sm:text-lg font-bold">
                            {t('discover.ownerCommunity') || 'Owner Community'}
                          </h2>
                          <span className="text-sm text-muted-foreground">({owners.length})</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {owners.map((owner) => (
                          <div
                            key={owner.user_id}
                            className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/20 hover:border-border/40 transition-colors"
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
                              <div className="text-sm font-medium truncate">
                                {owner.display_name || (t('discover.anonymous') || 'Anonymous')}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                {owner.headline && (
                                  <span className="truncate">{owner.headline}</span>
                                )}
                              </div>
                            </div>
                            {owner.agent_name && (
                              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-primary/8 text-primary/70 flex-shrink-0">
                                <Bot className="h-2.5 w-2.5" />
                                {owner.agent_name}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default DiscoverView;
