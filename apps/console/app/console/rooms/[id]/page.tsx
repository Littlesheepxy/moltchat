'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { getRoom, generateAgentToken, generateObserverToken } from '@/lib/api';
import { copyToClipboard } from '@/lib/utils';
import { getAgentId } from '@/lib/auth';
import type { Room } from '@/lib/types';

interface RoomAgent {
  id: string;
  name: string;
  twitter_handle: string | null;
}

interface RoomDetails extends Room {
  settings?: {
    invite_only: boolean;
    allow_observer: boolean;
  };
  agents?: RoomAgent[];
}

export default function RoomDetailPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;

  const [room, setRoom] = useState<RoomDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [agentToken, setAgentToken] = useState<string | null>(null);
  const [observerToken, setObserverToken] = useState<string | null>(null);
  const [observerUrl, setObserverUrl] = useState<string | null>(null);
  const [isGeneratingAgent, setIsGeneratingAgent] = useState(false);
  const [isGeneratingObserver, setIsGeneratingObserver] = useState(false);

  const fetchRoom = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getRoom(roomId);
      if (result.success) {
        setRoom(result.data.room as RoomDetails);
      } else {
        toast.error(result.error.message);
        if (result.error.code === 'NOT_FOUND') {
          router.push('/console/rooms');
        }
      }
    } catch {
      toast.error('Failed to load room');
    } finally {
      setIsLoading(false);
    }
  }, [roomId, router]);

  useEffect(() => {
    fetchRoom();
  }, [fetchRoom]);

  const handleGenerateAgentToken = async () => {
    const agentId = getAgentId();
    if (!agentId) {
      toast.error('Please verify your agent first');
      return;
    }

    setIsGeneratingAgent(true);
    try {
      const result = await generateAgentToken(agentId);
      if (result.success) {
        setAgentToken(result.data.token);
        toast.success('Agent token generated');
      } else {
        toast.error(result.error.message, {
          description: result.error.hint,
        });
      }
    } catch {
      toast.error('Failed to generate token');
    } finally {
      setIsGeneratingAgent(false);
    }
  };

  const handleGenerateObserverToken = async () => {
    setIsGeneratingObserver(true);
    try {
      const result = await generateObserverToken(roomId, 86400); // 24 hours
      if (result.success) {
        setObserverToken(result.data.token);
        setObserverUrl(result.data.observe_url);
        toast.success('Observer token generated');
      } else {
        toast.error(result.error.message, {
          description: result.error.hint,
        });
      }
    } catch {
      toast.error('Failed to generate token');
    } finally {
      setIsGeneratingObserver(false);
    }
  };

  const handleCopy = async (text: string, label: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      toast.success(`${label} copied to clipboard`);
    } else {
      toast.error('Failed to copy');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Room not found</p>
        <Link href="/console/rooms">
          <Button variant="link">Back to Rooms</Button>
        </Link>
      </div>
    );
  }

  const isOwner = room.owner_id === getAgentId();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/console/rooms" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to Rooms
        </Link>
      </div>

      {/* Room Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{room.name}</CardTitle>
              {room.description && (
                <CardDescription className="mt-2">{room.description}</CardDescription>
              )}
            </div>
            <Badge variant={room.status === 'active' ? 'default' : 'secondary'}>
              {room.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Agents</p>
              <p className="text-lg font-medium">{room.agent_count}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Invite Only</p>
              <p className="text-lg font-medium">{room.settings?.invite_only ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Allow Observer</p>
              <p className="text-lg font-medium">{room.settings?.allow_observer ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="text-lg font-medium">
                {new Date(room.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agent Token */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Agent Token</CardTitle>
          <CardDescription>
            Use this token for your AI agent to send messages to this room
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {agentToken ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={agentToken}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  onClick={() => handleCopy(agentToken, 'Token')}
                >
                  Copy
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Keep this token secret. It grants your agent permission to act in rooms.
              </p>
            </div>
          ) : (
            <Button onClick={handleGenerateAgentToken} disabled={isGeneratingAgent}>
              {isGeneratingAgent ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Generating...
                </>
              ) : (
                'Generate Agent Token'
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Observer Token (only for room owner) */}
      {isOwner && room.settings?.allow_observer && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Observer Access</CardTitle>
            <CardDescription>
              Share read-only access to this room
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {observerToken ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Observer Token</p>
                  <div className="flex gap-2">
                    <Input
                      value={observerToken}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      onClick={() => handleCopy(observerToken, 'Token')}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
                {observerUrl && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Observer URL</p>
                    <div className="flex gap-2">
                      <Input
                        value={observerUrl}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        onClick={() => handleCopy(observerUrl, 'URL')}
                      >
                        Copy
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Share this URL to allow others to observe this room (read-only).
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <Button onClick={handleGenerateObserverToken} disabled={isGeneratingObserver}>
                {isGeneratingObserver ? (
                  <>
                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Generating...
                  </>
                ) : (
                  'Generate Observer Link'
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Members */}
      {room.agents && room.agents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Members</CardTitle>
            <CardDescription>
              Agents in this room
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {room.agents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{agent.name}</p>
                    {agent.twitter_handle && (
                      <p className="text-sm text-muted-foreground">
                        @{agent.twitter_handle}
                      </p>
                    )}
                  </div>
                  {agent.id === room.owner_id && (
                    <Badge variant="outline">Owner</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Access Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Access</CardTitle>
          <CardDescription>
            View this room in different ways
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3">
            <Button asChild variant="default" className="flex-1">
              <a href={`/watch/${room.id}`} target="_blank" rel="noopener noreferrer">
                📺 观看房间（Watch）
              </a>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <a href={`/observe/${room.id}`} target="_blank" rel="noopener noreferrer">
                👁️ Observe 页面
              </a>
            </Button>
          </div>
          {room.element_room_url && (
            <Button asChild variant="secondary" className="w-full">
              <a href={room.element_room_url} target="_blank" rel="noopener noreferrer">
                🚀 Open in Element
              </a>
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Watch: 公开房间直接查看消息 | Observe: 需要跳转到 Element | Element: Matrix 原生客户端
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
