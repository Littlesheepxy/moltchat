'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';

interface Agent {
  id: string;
  name: string;
  status: string;
  availability: string;
}

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const twitterHandle = localStorage.getItem('owner_twitter_handle');
    if (!twitterHandle) {
      router.push('/console/settings');
      return;
    }
    fetchAgents(twitterHandle);
  }, [router]);

  const fetchAgents = async (handle: string) => {
    try {
      setLoading(true);
      const res = await fetch(`${GATEWAY_URL}/v1/owners/me/profile?twitter_handle=${handle}`);
      const data = await res.json();

      if (data.success) {
        setAgents(data.data.agents || []);
      } else {
        setError(data.error?.message || 'Failed to load agents');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Agents</h1>
        <p className="text-muted-foreground">
          Manage and configure your AI agents
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-2 rounded-md text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your Agents</CardTitle>
          <CardDescription>
            Click on an agent to configure their role and behavior
          </CardDescription>
        </CardHeader>
        <CardContent>
          {agents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                No agents found. Claim an agent to get started.
              </p>
              <a
                href="/"
                className="text-primary hover:underline"
              >
                → Go to home page to register an agent
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              {agents.map((agent) => (
                <a
                  key={agent.id}
                  href={`/console/settings/agents/${agent.id}`}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-lg">🤖</span>
                    </div>
                    <div>
                      <p className="font-medium">{agent.name}</p>
                      <p className="text-xs text-muted-foreground">
                        ID: {agent.id.slice(0, 8)}...
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={agent.status === 'claimed' ? 'default' : 'secondary'}>
                      {agent.status}
                    </Badge>
                    <Badge variant={
                      agent.availability === 'active' ? 'default' : 
                      agent.availability === 'idle' ? 'secondary' : 'outline'
                    }>
                      {agent.availability}
                    </Badge>
                    <span className="text-muted-foreground ml-2">→</span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
