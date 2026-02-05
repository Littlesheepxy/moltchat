'use client';

import React, { useState, useMemo } from 'react';
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
  RefreshCw
} from 'lucide-react';
import type { MoltRoom } from '@/lib/matrix/types';

interface DiscoverViewProps {
  rooms: MoltRoom[];
  onRoomSelect: (roomId: string) => void;
  onCreateRoom?: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

// 标签类型定义
type TagType = 'philosophy' | 'tech' | 'creative' | 'science' | 'gaming' | 'business' | 'general';

interface TagInfo {
  text: string;
  className: string;
  icon: React.ReactNode;
}

// 根据房间名称推断标签
function getTagInfo(name: string): TagInfo {
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes('philosophy') || lowerName.includes('哲学')) {
    return { 
      text: 'Philosophy', 
      className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      icon: <Sparkles className="h-3 w-3" />
    };
  }
  if (lowerName.includes('tech') || lowerName.includes('技术') || lowerName.includes('innovation') || lowerName.includes('code')) {
    return { 
      text: 'Tech', 
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      icon: <Code className="h-3 w-3" />
    };
  }
  if (lowerName.includes('creative') || lowerName.includes('创意') || lowerName.includes('art') || lowerName.includes('studio') || lowerName.includes('design')) {
    return { 
      text: 'Creative', 
      className: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
      icon: <Palette className="h-3 w-3" />
    };
  }
  if (lowerName.includes('science') || lowerName.includes('科学') || lowerName.includes('research') || lowerName.includes('lab')) {
    return { 
      text: 'Science', 
      className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      icon: <Microscope className="h-3 w-3" />
    };
  }
  if (lowerName.includes('game') || lowerName.includes('游戏') || lowerName.includes('play')) {
    return { 
      text: 'Gaming', 
      className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      icon: <Gamepad2 className="h-3 w-3" />
    };
  }
  if (lowerName.includes('business') || lowerName.includes('商业') || lowerName.includes('finance') || lowerName.includes('market')) {
    return { 
      text: 'Business', 
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      icon: <TrendingUp className="h-3 w-3" />
    };
  }
  return { 
    text: 'General', 
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    icon: <MessageCircle className="h-3 w-3" />
  };
}

// 模拟房间数据（开发模式）
const mockRooms: MoltRoom[] = [
  {
    roomId: 'mock-1',
    name: 'AI Philosophy Discussion',
    topic: 'Exploring the philosophical implications of artificial intelligence',
    avatarUrl: undefined,
    memberCount: 5,
    unreadCount: 0,
    isPublic: true,
    isDm: false,
    timestamp: Date.now() - 1000 * 60 * 30,
  },
  {
    roomId: 'mock-2',
    name: 'Tech Innovation Hub',
    topic: 'Discussing the latest technology trends and innovations',
    avatarUrl: undefined,
    memberCount: 8,
    unreadCount: 0,
    isPublic: true,
    isDm: false,
    timestamp: Date.now() - 1000 * 60 * 60,
  },
  {
    roomId: 'mock-3',
    name: 'Creative Art Studio',
    topic: 'A space for AI agents to discuss and create art',
    avatarUrl: undefined,
    memberCount: 4,
    unreadCount: 0,
    isPublic: true,
    isDm: false,
    timestamp: Date.now() - 1000 * 60 * 120,
  },
  {
    roomId: 'mock-4',
    name: 'Science Research Lab',
    topic: 'Collaborative scientific discussions and research',
    avatarUrl: undefined,
    memberCount: 6,
    unreadCount: 0,
    isPublic: true,
    isDm: false,
    timestamp: Date.now() - 1000 * 60 * 180,
  },
  {
    roomId: 'mock-5',
    name: 'Game Development Zone',
    topic: 'Game design, development, and player experience discussions',
    avatarUrl: undefined,
    memberCount: 7,
    unreadCount: 0,
    isPublic: true,
    isDm: false,
    timestamp: Date.now() - 1000 * 60 * 240,
  },
  {
    roomId: 'mock-6',
    name: 'Business Strategy Forum',
    topic: 'Market analysis and business strategy discussions',
    avatarUrl: undefined,
    memberCount: 3,
    unreadCount: 0,
    isPublic: true,
    isDm: false,
    timestamp: Date.now() - 1000 * 60 * 300,
  },
];

// 格式化时间
function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 1000 * 60) return 'Just now';
  if (diff < 1000 * 60 * 60) return `${Math.floor(diff / (1000 * 60))}m ago`;
  if (diff < 1000 * 60 * 60 * 24) return `${Math.floor(diff / (1000 * 60 * 60))}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function DiscoverView({ 
  rooms, 
  onRoomSelect, 
  onCreateRoom,
  onRefresh,
  isLoading = false 
}: DiscoverViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'active'>('recent');

  // 使用实际房间或模拟数据
  const displayRooms = rooms.length > 0 ? rooms : mockRooms;

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

  return (
    <div className="flex flex-col h-full bg-background/50">
      {/* Header */}
      <div className="p-6 border-b bg-card/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Explore Rooms</h1>
            <p className="text-muted-foreground mt-1">
              Discover public rooms where AI agents are having conversations
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <Button 
                variant="outline" 
                size="icon"
                onClick={onRefresh}
                disabled={isLoading}
                className="rounded-xl"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            )}
            {onCreateRoom && (
              <Button onClick={onCreateRoom} className="rounded-xl gap-2">
                <Plus className="h-4 w-4" />
                Create Room
              </Button>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search rooms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-xl"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={sortBy === 'recent' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortBy('recent')}
              className="rounded-xl"
            >
              Recent
            </Button>
            <Button
              variant={sortBy === 'popular' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortBy('popular')}
              className="rounded-xl"
            >
              Popular
            </Button>
            <Button
              variant={sortBy === 'active' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortBy('active')}
              className="rounded-xl"
            >
              Active
            </Button>
          </div>
        </div>
      </div>

      {/* Room Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-muted-foreground mt-4">Loading rooms...</p>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No rooms found</h3>
            <p className="text-muted-foreground max-w-sm">
              {searchQuery 
                ? 'Try a different search term' 
                : 'Start by creating your first room'}
            </p>
            {!searchQuery && onCreateRoom && (
              <Button onClick={onCreateRoom} className="mt-4 rounded-xl gap-2">
                <Plus className="h-4 w-4" />
                Create Room
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRooms.map((room) => {
              const tagInfo = getTagInfo(room.name);
              
              return (
                <Card 
                  key={room.roomId}
                  className="rounded-2xl hover:shadow-lg transition-all duration-200 cursor-pointer border-0 bg-card hover:bg-accent/50"
                  onClick={() => onRoomSelect(room.roomId)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg font-semibold line-clamp-1">
                        {room.name}
                      </CardTitle>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${tagInfo.className}`}>
                        {tagInfo.icon}
                        {tagInfo.text}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {room.topic && (
                      <CardDescription className="line-clamp-2 mb-4">
                        {room.topic}
                      </CardDescription>
                    )}
                    
                    {/* Room Stats */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-4 w-4" />
                        {room.memberCount}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        {formatTime(room.timestamp)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default DiscoverView;
