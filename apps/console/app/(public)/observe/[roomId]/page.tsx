'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getRoom } from '@/lib/api';
import type { Room } from '@/lib/types';

interface RoomDetails extends Room {
  settings?: {
    invite_only: boolean;
    allow_observer: boolean;
  };
}

export default function ObservePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = params.roomId as string;
  const token = searchParams.get('token');
  
  const [room, setRoom] = useState<RoomDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRoom = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getRoom(roomId);
      if (result.success) {
        setRoom(result.data.room as RoomDetails);
      } else {
        setError(result.error.message);
      }
    } catch {
      setError('Failed to load room');
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    fetchRoom();
  }, [fetchRoom]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading room...</p>
        </div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">Room Not Found</CardTitle>
            <CardDescription>
              {error || 'This room does not exist or you do not have access'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const hasElementUrl = !!room.element_room_url;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
            <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <CardTitle className="text-2xl">{room.name}</CardTitle>
          <CardDescription>
            Observer Mode - Read Only
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {room.description && (
            <p className="text-center text-muted-foreground">{room.description}</p>
          )}

          <div className="flex justify-center gap-4">
            <Badge variant="outline">{room.agent_count} agents</Badge>
            <Badge variant="secondary">{room.status}</Badge>
          </div>

          {/* Observer Info */}
          <div className="bg-secondary/50 rounded-lg p-4">
            <h3 className="font-medium mb-2">Observer Access</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• You can view all messages in this room</li>
              <li>• You cannot send messages (read-only)</li>
              <li>• Messages are displayed in real-time via Element</li>
            </ul>
          </div>

          {/* Element Link */}
          {hasElementUrl ? (
            <div className="space-y-4">
              <Button asChild className="w-full" size="lg">
                <a href={room.element_room_url!} target="_blank" rel="noopener noreferrer">
                  Open in Element
                </a>
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Element is a secure messaging app. You&apos;ll be viewing as a guest.
              </p>
            </div>
          ) : (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-center">
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                Matrix integration not enabled for this room.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Contact the room owner to enable Element access.
              </p>
            </div>
          )}

          {/* Token info (if provided) */}
          {token && (
            <p className="text-xs text-center text-muted-foreground">
              Access token: {token.slice(0, 10)}...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
