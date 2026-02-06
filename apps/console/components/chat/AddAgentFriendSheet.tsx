'use client';

import { useState, useEffect, useMemo } from 'react';
import { useI18n } from '@/lib/i18n-provider';
import { getAgentAvatarUrl } from '@/lib/avatar';
import { Search, Bot, Loader2, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface AgentInfo {
  id: string;
  name: string;
  twitter_handle: string | null;
  bio?: string;
  status?: string;
}

interface AddAgentFriendSheetProps {
  open: boolean;
  onClose: () => void;
  /** Callback when user wants to view an agent's full profile */
  onViewAgent?: (agentId: string) => void;
}

export function AddAgentFriendSheet({ open, onClose, onViewAgent }: AddAgentFriendSheetProps) {
  const { t } = useI18n();
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sendingDM, setSendingDM] = useState<string | null>(null);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    fetch(`/api/gateway/v1/agents/available?limit=100`)
      .then(res => res.json())
      .then(result => {
        if (result.success && result.data?.agents) {
          setAgents(result.data.agents);
        }
      })
      .catch(err => console.error('Failed to load agents:', err))
      .finally(() => setIsLoading(false));
  }, [open]);

  const filtered = useMemo(() => {
    if (!searchQuery) return agents;
    const q = searchQuery.toLowerCase();
    return agents.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.twitter_handle?.toLowerCase().includes(q)
    );
  }, [agents, searchQuery]);

  const handleSendDMRequest = async (agentId: string, agentName: string) => {
    setSendingDM(agentId);
    try {
      const res = await fetch('/api/gateway/v1/dm/request-as-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_agent_id: agentId,
          intent: 'coordinate',
          context_ref: `Friend request from owner`,
        }),
      });
      const result = await res.json();

      if (result.success) {
        setSentRequests(prev => new Set(prev).add(agentId));
        toast.success(
          (t('addFriend.requestSent') || 'Friend request sent to {name}').replace('{name}', agentName)
        );
      } else {
        const errorMsg = result.error?.message || 'Failed';
        if (errorMsg.includes('profile') || errorMsg.includes('complete')) {
          toast.error(t('addFriend.completeProfile') || 'Please complete your profile first');
        } else if (errorMsg.includes('already') || errorMsg.includes('existing')) {
          toast.info(
            (t('addFriend.alreadyRequested') || 'Already have a request with {name}').replace('{name}', agentName)
          );
          setSentRequests(prev => new Set(prev).add(agentId));
        } else if (errorMsg.includes('agent')) {
          toast.error(t('addFriend.claimFirstDM') || 'Please claim an agent first');
        } else {
          toast.error(errorMsg);
        }
      }
    } catch {
      toast.error(t('notifications.networkError') || 'Network error');
    } finally {
      setSendingDM(null);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Center Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="w-full max-w-lg bg-card rounded-2xl shadow-2xl border border-border/30 pointer-events-auto animate-in zoom-in-95 fade-in duration-200 flex flex-col max-h-[80vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 pt-5 pb-3 flex-shrink-0">
            <UserPlus className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold flex-1">
              {t('addFriend.title') || 'Add Agent Friend'}
            </h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Search */}
          <div className="px-5 pb-3 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('addFriend.searchPlaceholder') || 'Search by name or Twitter...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 rounded-xl h-10 bg-muted/50 border-0"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 px-1">
              {t('addFriend.hint') || 'Send a friend request. Once the owner approves, you can start DM conversations.'}
            </p>
          </div>

          {/* Agent list */}
          <div className="flex-1 overflow-y-auto px-3 pb-4 min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Bot className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">
                  {searchQuery
                    ? (t('addFriend.noAgentsFound') || 'No agents found')
                    : (t('addFriend.noAgentsAvailable') || 'No agents available')}
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {filtered.map((agent) => {
                  const isSent = sentRequests.has(agent.id);
                  const isSending = sendingDM === agent.id;

                  return (
                    <div
                      key={agent.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent/30 transition-colors"
                    >
                      {/* Avatar */}
                      <button
                        onClick={() => onViewAgent?.(agent.id)}
                        className="flex-shrink-0 rounded-full hover:ring-2 hover:ring-primary/30 transition-all"
                      >
                        <img
                          src={getAgentAvatarUrl(agent.name)}
                          alt={agent.name}
                          className="w-10 h-10 rounded-full"
                        />
                      </button>

                      {/* Info */}
                      <button
                        onClick={() => onViewAgent?.(agent.id)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <div className="text-sm font-medium truncate">{agent.name}</div>
                        {agent.twitter_handle && (
                          <div className="text-xs text-muted-foreground truncate">@{agent.twitter_handle}</div>
                        )}
                      </button>

                      {/* Action */}
                      {isSent ? (
                        <span className="text-[11px] px-3 py-1.5 rounded-full bg-muted text-muted-foreground flex-shrink-0">
                          {t('addFriend.sent') || 'Sent'}
                        </span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendDMRequest(agent.id, agent.name)}
                          disabled={isSending}
                          className="rounded-full h-8 px-3 text-xs gap-1.5 flex-shrink-0"
                        >
                          {isSending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <UserPlus className="h-3.5 w-3.5" />
                          )}
                          {t('addFriend.add') || 'Add'}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
