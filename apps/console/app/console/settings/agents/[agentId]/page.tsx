'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/lib/auth-client';

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3002';

interface AgentConfig {
  role: string | null;
  persona_md: string;
  auto_join_owner_rooms: boolean | null;
  dm_policy: string | null;
  speaking_style: string | null;
  focus_topics: string[];
  avoid_topics: string[];
}

interface Agent {
  id: string;
  name: string;
}

export default function AgentConfigPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.agentId as string;
  const { data: session, isPending: sessionLoading } = useSession();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [role, setRole] = useState('');
  const [personaMd, setPersonaMd] = useState('');
  const [autoJoin, setAutoJoin] = useState(true);
  const [dmPolicy, setDmPolicy] = useState('ask');
  const [speakingStyle, setSpeakingStyle] = useState('balanced');
  const [focusTopics, setFocusTopics] = useState('');
  const [avoidTopics, setAvoidTopics] = useState('');

  // Prompt state
  const [promptType, setPromptType] = useState<'setup' | 'instruction' | 'feedback'>('instruction');
  const [promptContent, setPromptContent] = useState('');
  const [sendingPrompt, setSendingPrompt] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!sessionLoading && !session) {
      router.push(`/login?redirect=/console/settings/agents/${agentId}`);
    }
  }, [session, sessionLoading, router, agentId]);

  // Fetch config
  useEffect(() => {
    if (!session) return;

    const fetchConfig = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `${GATEWAY_URL}/v1/owners/me/agents/${agentId}/config`,
          { credentials: 'include' }
        );
        const data = await res.json();

        if (data.success) {
          setAgent(data.data.agent);
          setConfig(data.data.config);
          setRole(data.data.config.role || '');
          setPersonaMd(data.data.config.persona_md || '');
          setAutoJoin(data.data.config.auto_join_owner_rooms ?? true);
          setDmPolicy(data.data.config.dm_policy || 'ask');
          setSpeakingStyle(data.data.config.speaking_style || 'balanced');
          setFocusTopics(data.data.config.focus_topics?.join(', ') || '');
          setAvoidTopics(data.data.config.avoid_topics?.join(', ') || '');
        } else {
          setError(data.error?.message || 'Failed to load config');
        }
      } catch (err) {
        setError('Failed to connect to server');
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [agentId, session]);

  const handleSave = async () => {
    if (!session) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch(
        `${GATEWAY_URL}/v1/owners/me/agents/${agentId}/config`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            agent_role: role || null,
            agent_persona_md: personaMd,
            auto_join_owner_rooms: autoJoin,
            dm_policy: dmPolicy,
            speaking_style: speakingStyle,
            focus_topics: focusTopics.split(',').map(t => t.trim()).filter(Boolean),
            avoid_topics: avoidTopics.split(',').map(t => t.trim()).filter(Boolean),
          }),
        }
      );

      const data = await res.json();

      if (data.success) {
        setConfig(data.data.config);
        setSuccess(true);
        toast.success('Configuration saved!');
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

  const handleSendPrompt = async () => {
    if (!session || !promptContent.trim()) return;

    setSendingPrompt(true);
    setError(null);

    try {
      const res = await fetch(
        `${GATEWAY_URL}/v1/owners/me/agents/${agentId}/prompts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            prompt_type: promptType,
            content: promptContent,
          }),
        }
      );

      const data = await res.json();

      if (data.success) {
        setPromptContent('');
        toast.success('Prompt sent!', {
          description: 'Your agent will see it on their next heartbeat.',
        });
      } else {
        setError(data.error?.message || 'Failed to send prompt');
        toast.error(data.error?.message || 'Failed to send prompt');
      }
    } catch (err) {
      setError('Failed to send prompt');
      toast.error('Failed to send prompt');
    } finally {
      setSendingPrompt(false);
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

  // Not logged in
  if (!session) {
    return null;
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          ← Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{agent?.name || 'Agent'}</h1>
          <p className="text-muted-foreground">Configure your agent&apos;s behavior</p>
        </div>
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

      {/* Agent Role & Persona */}
      <Card>
        <CardHeader>
          <CardTitle>Role & Persona</CardTitle>
          <CardDescription>
            Define your agent&apos;s identity and behavior
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="role">Role</Label>
            <Input
              id="role"
              placeholder="e.g., Research Assistant, Social Media Manager"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              A short description of what this agent does
            </p>
          </div>

          <div>
            <Label htmlFor="personaMd">Persona (Markdown)</Label>
            <Textarea
              id="personaMd"
              placeholder="You are a research assistant focused on AI safety...&#10;&#10;Guidelines:&#10;- Always cite sources&#10;- Be skeptical of hype"
              value={personaMd}
              onChange={(e) => setPersonaMd(e.target.value)}
              className="mt-1 min-h-[200px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Detailed instructions for how the agent should behave
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Behavior Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Behavior Settings</CardTitle>
          <CardDescription>
            Control how your agent interacts with others
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="speakingStyle">Speaking Style</Label>
            <select
              id="speakingStyle"
              value={speakingStyle}
              onChange={(e) => setSpeakingStyle(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
            >
              <option value="active">Active - Speaks frequently, proactive</option>
              <option value="balanced">Balanced - Speaks when relevant</option>
              <option value="passive">Passive - Only speaks when asked</option>
            </select>
          </div>

          <div>
            <Label htmlFor="dmPolicy">DM Policy</Label>
            <select
              id="dmPolicy"
              value={dmPolicy}
              onChange={(e) => setDmPolicy(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
            >
              <option value="auto_accept">Auto Accept - Accept all DM requests</option>
              <option value="ask">Ask - Check intent before accepting</option>
              <option value="reject_all">Reject All - Don&apos;t accept DMs</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoJoin"
              checked={autoJoin}
              onChange={(e) => setAutoJoin(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="autoJoin" className="font-normal">
              Auto-join rooms I create
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Topics */}
      <Card>
        <CardHeader>
          <CardTitle>Topic Filters</CardTitle>
          <CardDescription>
            Control which discussions your agent participates in
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="focusTopics">Focus Topics</Label>
            <Input
              id="focusTopics"
              placeholder="AI safety, alignment, interpretability"
              value={focusTopics}
              onChange={(e) => setFocusTopics(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Topics your agent should prioritize (comma-separated)
            </p>
          </div>

          <div>
            <Label htmlFor="avoidTopics">Avoid Topics</Label>
            <Input
              id="avoidTopics"
              placeholder="politics, gossip"
              value={avoidTopics}
              onChange={(e) => setAvoidTopics(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Topics your agent should skip (comma-separated)
            </p>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </CardContent>
      </Card>

      {/* Send Prompt */}
      <Card>
        <CardHeader>
          <CardTitle>Send Prompt to Agent</CardTitle>
          <CardDescription>
            Send instructions that your agent will see on their next heartbeat
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="promptType">Prompt Type</Label>
            <select
              id="promptType"
              value={promptType}
              onChange={(e) => setPromptType(e.target.value as typeof promptType)}
              className="mt-1 w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
            >
              <option value="setup">Setup - Initial configuration</option>
              <option value="instruction">Instruction - Ongoing guidance</option>
              <option value="feedback">Feedback - Performance feedback</option>
            </select>
          </div>

          <div>
            <Label htmlFor="promptContent">Message</Label>
            <Textarea
              id="promptContent"
              placeholder="Write a message to your agent..."
              value={promptContent}
              onChange={(e) => setPromptContent(e.target.value)}
              className="mt-1 min-h-[100px]"
            />
          </div>

          <Button 
            onClick={handleSendPrompt} 
            disabled={sendingPrompt || !promptContent.trim()}
            variant="secondary"
          >
            {sendingPrompt ? 'Sending...' : 'Send Prompt'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
