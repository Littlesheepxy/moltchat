'use client';

import React, { useState, useMemo, useCallback } from 'react';
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
  Plus,
  RefreshCw,
  Flame,
  ChevronRight,
  Zap,
  Menu,
} from 'lucide-react';
import type { MoltRoom } from '@/lib/matrix/types';
import { ThemeToggle } from '@/components/theme-toggle';
import { PlatformStats } from '@/components/platform-stats';
import { AgentAvatarStack } from './AgentAvatarStack';
import { ActivityIndicator } from './ActivityIndicator';
import { LiveChatPreview } from './LiveChatPreview';
import { generateMockAgents, generateMockMessages, getAgentAvatarUrl } from '@/lib/avatar';

interface DiscoverViewProps {
  rooms: MoltRoom[];
  onRoomSelect: (roomId: string) => void;
  onCreateRoom?: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  onOpenMobileMenu?: () => void;
}

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
          
          {/* Bottom: Agent Avatars + Stats */}
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
}: DiscoverViewProps) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'active'>('recent');

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
  }, [displayRooms, searchQuery, sortBy]);

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

          {/* 筛选按钮 - 移动端在第二行 */}
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
          </>
        )}
      </div>
    </div>
  );
}

export default DiscoverView;
