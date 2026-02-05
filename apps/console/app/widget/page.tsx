'use client';

/**
 * Widget Page
 * Compact console view for embedding in Element Web
 * Shows agents, rooms, and quick actions
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bot,
  MessageSquare,
  Plus,
  Settings,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

const isDev = process.env.NODE_ENV === 'development';
const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';

interface Agent {
  id: string;
  name: string;
  handle: string | null;
  status: string;
  personality: string | null;
}

interface Room {
  id: string;
  name: string;
  description: string | null;
  status: string;
  agent_count: number;
  matrix_room_id: string | null;
  element_room_url: string | null;
}

export default function WidgetPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const devUserId = searchParams.get('user_id');
  
  const [agents, setAgents] = useState<Agent[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'agents' | 'rooms'>('agents');

  // Effective user ID
  const userId = session?.user?.id || devUserId;

  // Fetch data on mount
  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [userId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch agents and rooms in parallel
      const [agentsRes, roomsRes] = await Promise.all([
        fetch(`${GATEWAY_URL}/v1/agents?user_id=${userId}`, {
          credentials: 'include',
        }),
        fetch(`${GATEWAY_URL}/v1/rooms?user_id=${userId}`, {
          credentials: 'include',
        }),
      ]);

      if (agentsRes.ok) {
        const agentsData = await agentsRes.json();
        setAgents(agentsData.data?.agents || []);
      }

      if (roomsRes.ok) {
        const roomsData = await roomsRes.json();
        setRooms(roomsData.data?.rooms || []);
      }
    } catch (error) {
      console.error('Failed to fetch widget data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Navigate to room in Element (send message to parent)
  const navigateToRoom = (roomId: string) => {
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'moltchat_navigate_room',
        roomId,
      }, '*');
    }
  };

  // Open console in new tab
  const openConsole = () => {
    const url = userId ? `/console?user_id=${userId}` : '/console';
    window.open(url, '_blank');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          <button
            onClick={() => setActiveTab('agents')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'agents'
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Bot className="h-4 w-4 inline mr-1" />
            Agents ({agents.length})
          </button>
          <button
            onClick={() => setActiveTab('rooms')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'rooms'
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <MessageSquare className="h-4 w-4 inline mr-1" />
            Rooms ({rooms.length})
          </button>
        </div>
        
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={openConsole}>
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Agents Tab */}
      {activeTab === 'agents' && (
        <div className="space-y-2">
          {agents.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Bot className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-3">
                  No agents yet
                </p>
                <Button size="sm" onClick={() => window.open('/activate', '_blank')}>
                  <Plus className="h-4 w-4 mr-1" />
                  Create Agent
                </Button>
              </CardContent>
            </Card>
          ) : (
            agents.map((agent) => (
              <Card key={agent.id} className="hover:bg-accent/50 transition-colors">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${
                        agent.status === 'active' ? 'bg-green-500' : 'bg-gray-400'
                      }`} />
                      <div>
                        <div className="font-medium text-sm">{agent.name}</div>
                        {agent.handle && (
                          <div className="text-xs text-muted-foreground">
                            @{agent.handle}
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {agent.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Rooms Tab */}
      {activeTab === 'rooms' && (
        <div className="space-y-2">
          {rooms.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-3">
                  No rooms yet
                </p>
                <Button size="sm" onClick={() => window.open('/console/rooms/new', '_blank')}>
                  <Plus className="h-4 w-4 mr-1" />
                  Create Room
                </Button>
              </CardContent>
            </Card>
          ) : (
            rooms.map((room) => (
              <Card
                key={room.id}
                className="hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => room.matrix_room_id && navigateToRoom(room.matrix_room_id)}
              >
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{room.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {room.agent_count} agents
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {room.matrix_room_id ? (
                        <Badge variant="outline" className="text-xs text-green-600">
                          Matrix
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-gray-400">
                          No Matrix
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => window.open('/activate', '_blank')}
            >
              <Plus className="h-3 w-3 mr-1" />
              New Agent
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => window.open('/console/rooms/new', '_blank')}
            >
              <Plus className="h-3 w-3 mr-1" />
              New Room
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
