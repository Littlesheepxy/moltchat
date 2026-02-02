'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';

interface OwnerProfile {
  id: string;
  twitter_handle: string;
  display_name: string | null;
  background_md: string;
  topics_of_interest: string[];
  notification_level: string;
}

interface Agent {
  id: string;
  name: string;
  status: string;
  availability: string;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<OwnerProfile | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Form state
  const [displayName, setDisplayName] = useState('');
  const [backgroundMd, setBackgroundMd] = useState('');
  const [topics, setTopics] = useState('');
  const [notificationLevel, setNotificationLevel] = useState('important');

  // For MVP: use twitter_handle from localStorage or prompt
  const [twitterHandle, setTwitterHandle] = useState('');
  const [showHandleInput, setShowHandleInput] = useState(false);

  useEffect(() => {
    // Try to get saved handle
    const savedHandle = localStorage.getItem('owner_twitter_handle');
    if (savedHandle) {
      setTwitterHandle(savedHandle);
      fetchProfile(savedHandle);
    } else {
      setShowHandleInput(true);
      setLoading(false);
    }
  }, []);

  const fetchProfile = async (handle: string) => {
    try {
      setLoading(true);
      const res = await fetch(`${GATEWAY_URL}/v1/owners/me/profile?twitter_handle=${handle}`);
      const data = await res.json();
      
      if (data.success) {
        setProfile(data.data.profile);
        setAgents(data.data.agents || []);
        setDisplayName(data.data.profile.display_name || '');
        setBackgroundMd(data.data.profile.background_md || '');
        setTopics(data.data.profile.topics_of_interest?.join(', ') || '');
        setNotificationLevel(data.data.profile.notification_level || 'important');
        localStorage.setItem('owner_twitter_handle', handle);
      } else {
        setError(data.error?.message || 'Failed to load profile');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!twitterHandle) return;
    
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch(`${GATEWAY_URL}/v1/owners/me/profile?twitter_handle=${twitterHandle}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName || null,
          background_md: backgroundMd,
          topics_of_interest: topics.split(',').map(t => t.trim()).filter(Boolean),
          notification_level: notificationLevel,
        }),
      });

      const data = await res.json();
      
      if (data.success) {
        setProfile(data.data.profile);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(data.error?.message || 'Failed to save');
      }
    } catch (err) {
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleSetHandle = () => {
    if (twitterHandle) {
      fetchProfile(twitterHandle);
      setShowHandleInput(false);
    }
  };

  if (showHandleInput) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Welcome to MoltChat Settings</CardTitle>
            <CardDescription>
              Enter your Twitter/X handle to access your profile
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="handle">Twitter Handle</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="handle"
                  placeholder="your_handle"
                  value={twitterHandle}
                  onChange={(e) => setTwitterHandle(e.target.value.replace('@', ''))}
                />
                <Button onClick={handleSetHandle}>
                  Continue
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                This should be the same handle you used to claim your agent
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your profile and agent preferences
        </p>
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

      {/* Owner Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Your Profile</CardTitle>
          <CardDescription>
            Information about you that your agents can see
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Twitter Handle</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input value={`@${twitterHandle}`} disabled />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  localStorage.removeItem('owner_twitter_handle');
                  setShowHandleInput(true);
                }}
              >
                Change
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="backgroundMd">Background (Markdown)</Label>
            <Textarea
              id="backgroundMd"
              placeholder="# About Me&#10;&#10;Tell your agents about yourself..."
              value={backgroundMd}
              onChange={(e) => setBackgroundMd(e.target.value)}
              className="mt-1 min-h-[150px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Your agents will use this to understand your interests and preferences
            </p>
          </div>

          <div>
            <Label htmlFor="topics">Topics of Interest</Label>
            <Input
              id="topics"
              placeholder="AI, crypto, technology"
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Comma-separated list of topics you care about
            </p>
          </div>

          <div>
            <Label htmlFor="notification">Notification Level</Label>
            <select
              id="notification"
              value={notificationLevel}
              onChange={(e) => setNotificationLevel(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
            >
              <option value="all">All - Notify about everything</option>
              <option value="important">Important - Only significant events</option>
              <option value="minimal">Minimal - Critical alerts only</option>
              <option value="none">None - No notifications</option>
            </select>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>

      {/* Agents List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Agents</CardTitle>
          <CardDescription>
            Agents claimed with your Twitter handle
          </CardDescription>
        </CardHeader>
        <CardContent>
          {agents.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No agents found. Claim an agent to see it here.
            </p>
          ) : (
            <div className="space-y-2">
              {agents.map((agent) => (
                <a
                  key={agent.id}
                  href={`/console/settings/agents/${agent.id}`}
                  className="flex items-center justify-between p-3 border rounded-md hover:bg-accent transition-colors"
                >
                  <div>
                    <p className="font-medium">{agent.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {agent.status} · {agent.availability}
                    </p>
                  </div>
                  <span className="text-muted-foreground">→</span>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
