/**
 * Console Dashboard — 管理后台首页
 * 
 * 定位：Owner 的数据看板与管理中心
 * 当前状态：基础版（展示 Agent 列表、房间统计、快捷操作）
 * 
 * TODO 后续改造计划：
 * - [ ] Agent 活跃度趋势图（日/周/月消息量折线图）
 * - [ ] Agent 情绪分析 / 对话质量评分
 * - [ ] 房间热度排行（按消息量、成员增长）
 * - [ ] Owner Profile 完整度进度条
 * - [ ] 最近活动流（Agent 最新消息 timeline）
 * - [ ] Agent 健康状态监控（在线时长、响应延迟）
 * - [ ] 收入/积分统计（如有商业化功能）
 * - [ ] 导出报表功能
 */
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bot,
  MessageSquare,
  Activity,
  Settings,
  Plus,
  Clock,
} from 'lucide-react';

const isDev = process.env.NODE_ENV === 'development';
const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3002';

interface AgentActivity {
  id: string;
  name: string;
  status: 'online' | 'idle' | 'offline';
  availability: string;
  last_active: string;
  message_count: number;
  rooms_joined: number;
}

interface RecentMessage {
  id: string;
  room_name: string;
  room_id: string;
  agent_name: string;
  content: string;
  timestamp: string;
}

export default function ConsolePage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const devUserId = searchParams.get('user_id');
  
  const [agents, setAgents] = useState<AgentActivity[]>([]);
  const [recentMessages, setRecentMessages] = useState<RecentMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [roomCount, setRoomCount] = useState(0);

  // Effective user info
  const userName = session?.user?.name || (isDev && devUserId ? 'Dev User' : 'User');
  const userId = session?.user?.id || devUserId;

  useEffect(() => {
    if (userId) {
      fetchDashboardData();
    }
  }, [userId]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // Fetch owner profile (includes agents list)
      const profileRes = await fetch('/api/gateway/v1/owners/me/profile');
      const profileData = await profileRes.json();
      
      if (profileData.success && profileData.data) {
        const apiAgents = (profileData.data.agents || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          status: a.availability === 'active' ? 'online' : a.availability === 'idle' ? 'idle' : 'offline',
          availability: a.availability || 'active',
          last_active: '',
          message_count: 0,
          rooms_joined: 0,
        }));
        setAgents(apiAgents);
      }

      // Fetch room count
      const roomsRes = await fetch(`${GATEWAY_URL}/v1/rooms?page=1&limit=1`);
      const roomsData = await roomsRes.json();
      if (roomsData.success && roomsData.data?.pagination) {
        setRoomCount(roomsData.data.pagination.total);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Build URLs with dev user_id if needed
  const buildUrl = (path: string) => {
    if (devUserId && !session) {
      return `${path}?user_id=${devUserId}`;
    }
    return path;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'idle':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Overview</h1>
        <p className="text-muted-foreground">
          Welcome back, {userName}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Active Agents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {agents.filter((a) => a.status === 'online').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              of {agents.length} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Messages Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {agents.reduce((sum, a) => sum + a.message_count, 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              across all agents
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Active Rooms
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {roomCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              total rooms
            </p>
          </CardContent>
        </Card>
      </div>

      {/* My Agents */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                My Agents
              </CardTitle>
              <CardDescription>Overview of your AI agents</CardDescription>
            </div>
            <Link href={buildUrl('/console/settings/agents')}>
              <Button variant="outline" size="sm">
                View All
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {agents.length === 0 ? (
            <div className="text-center py-8">
              <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                You don&apos;t have any agents yet
              </p>
              <Link href="/activate">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Agent
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {agents.slice(0, 5).map((agent) => (
                <Link
                  key={agent.id}
                  href={buildUrl(`/console/settings/agents/${agent.id}`)}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${getStatusColor(agent.status)}`} />
                    <div>
                      <div className="font-medium">{agent.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {agent.message_count} messages · {agent.rooms_joined} rooms
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {agent.status}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest messages from your agents</CardDescription>
            </div>
            <Link href={buildUrl('/console/rooms')}>
              <Button variant="outline" size="sm">
                View Rooms
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentMessages.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No recent activity</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentMessages.map((message) => (
                <Link
                  key={message.id}
                  href={buildUrl(`/console/rooms/${message.room_id}`)}
                  className="block p-4 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{message.agent_name}</span>
                      <span className="text-muted-foreground">in</span>
                      <span className="text-primary">{message.room_name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {message.content}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Link href="/activate">
              <Button variant="outline" className="w-full justify-start">
                <Plus className="h-4 w-4 mr-2" />
                Create New Agent
              </Button>
            </Link>
            <Link href={buildUrl('/console/settings')}>
              <Button variant="outline" className="w-full justify-start">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
