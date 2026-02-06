/**
 * CreateRoomDialog - 一站式创建房间弹窗
 * 
 * 包含房间名称、描述和 Agent 选择
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { createRoom } from '@/lib/api';
import { useI18n } from '@/lib/i18n-provider';
import { getAgentAvatarUrl } from '@/lib/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Search, Check, Bot, Plus, X, Globe, Lock } from 'lucide-react';

const GATEWAY_URL = '/api/gateway';

interface AvailableAgent {
  id: string;
  name: string;
  twitter_handle: string | null;
  personality: string | null;
}

interface CreateRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (roomId: string) => void;
}

export function CreateRoomDialog({ open, onOpenChange, onCreated }: CreateRoomDialogProps) {
  const { t } = useI18n();
  // Form state
  const [roomName, setRoomName] = useState('');
  const [roomDescription, setRoomDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [selectedAgents, setSelectedAgents] = useState<AvailableAgent[]>([]);
  
  // Agent search state
  const [searchQuery, setSearchQuery] = useState('');
  const [availableAgents, setAvailableAgents] = useState<AvailableAgent[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  
  // Submit state
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch available agents
  const fetchAgents = useCallback(async (search?: string) => {
    setIsLoadingAgents(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('limit', '20');
      
      const response = await fetch(`${GATEWAY_URL}/v1/agents/available?${params}`);
      const data = await response.json();
      
      if (data.success && data.data?.agents) {
        setAvailableAgents(data.data.agents);
      }
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    } finally {
      setIsLoadingAgents(false);
    }
  }, []);

  // Load agents when dialog opens
  useEffect(() => {
    if (open) {
      fetchAgents();
    } else {
      // Reset form on close
      setRoomName('');
      setRoomDescription('');
      setIsPublic(true);
      setSelectedAgents([]);
      setSearchQuery('');
      setError('');
    }
  }, [open, fetchAgents]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      fetchAgents(searchQuery || undefined);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, fetchAgents]);

  const toggleAgent = (agent: AvailableAgent) => {
    setSelectedAgents(prev => {
      const exists = prev.find(a => a.id === agent.id);
      if (exists) {
        return prev.filter(a => a.id !== agent.id);
      }
      return [...prev, agent];
    });
  };

  const isSelected = (agentId: string) => selectedAgents.some(a => a.id === agentId);

  const handleCreate = async () => {
    if (!roomName.trim()) {
      setError(t('chat.createRoomDialog.roomNameRequired'));
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      // 1. Create room
      const result = await createRoom(
        roomName.trim(),
        roomDescription.trim() || undefined,
        { invite_only: false, allow_observer: true, is_public: isPublic }
      );

      if (!result.success || !result.data) {
        setError(t('chat.createRoomDialog.createFailed'));
        setIsCreating(false);
        return;
      }

      const roomId = result.data.room.id;

      // 2. Invite selected agents
      for (const agent of selectedAgents) {
        try {
          await fetch(`${GATEWAY_URL}/v1/rooms/${roomId}/invite-agent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agent_id: agent.id }),
          });
        } catch (err) {
          console.error(`Failed to invite agent ${agent.name}:`, err);
        }
      }

      onCreated?.(roomId);
    } catch (err) {
      setError(t('chat.createRoomDialog.createFailed'));
    } finally {
      setIsCreating(false);
    }
  };

  // Filter out already selected agents from available list
  const filteredAgents = availableAgents.filter(a => !isSelected(a.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] rounded-2xl p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">{t('chat.createRoomDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('chat.createRoomDialog.description')}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {/* Room Name */}
          <div className="space-y-2">
            <Label htmlFor="room-name" className="text-sm font-medium">
              {t('chat.createRoomDialog.roomName')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="room-name"
              placeholder={t('chat.createRoomDialog.roomNamePlaceholder')}
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className="rounded-xl h-10"
              maxLength={100}
            />
          </div>

          {/* Room Description */}
          <div className="space-y-2">
            <Label htmlFor="room-description" className="text-sm font-medium">
              {t('chat.createRoomDialog.roomDescription')}
            </Label>
            <Textarea
              id="room-description"
              placeholder={t('chat.createRoomDialog.roomDescriptionPlaceholder')}
              value={roomDescription}
              onChange={(e) => setRoomDescription(e.target.value)}
              className="rounded-xl resize-none h-20"
              maxLength={500}
            />
          </div>

          {/* Public/Private Toggle */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('chat.createRoomDialog.visibility')}</Label>
            <div className="flex gap-2">
              <button
                onClick={() => setIsPublic(true)}
                className={cn(
                  'flex-1 flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 transition-all text-left',
                  isPublic 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border/50 hover:border-border'
                )}
              >
                <Globe className={cn('h-4 w-4 flex-shrink-0', isPublic ? 'text-primary' : 'text-muted-foreground')} />
                <div>
                  <div className={cn('text-sm font-medium', isPublic ? 'text-primary' : '')}>{t('chat.createRoomDialog.public')}</div>
                  <div className="text-xs text-muted-foreground">{t('chat.createRoomDialog.publicDesc')}</div>
                </div>
              </button>
              <button
                disabled
                className="flex-1 flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 border-border/30 opacity-50 cursor-not-allowed text-left"
              >
                <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-muted-foreground">{t('chat.createRoomDialog.private')}</div>
                  <div className="text-xs text-muted-foreground">{t('chat.createRoomDialog.privateDesc')}</div>
                </div>
              </button>
            </div>
          </div>

          {/* Agent Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {t('chat.createRoomDialog.inviteAgents')}
            </Label>

            {/* Selected Agents */}
            {selectedAgents.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedAgents.map(agent => (
                  <div
                    key={agent.id}
                    className="flex items-center gap-1.5 bg-primary/10 text-primary rounded-full pl-1 pr-2 py-0.5 text-xs font-medium"
                  >
                    <img
                      src={getAgentAvatarUrl(agent.name)}
                      alt={agent.name}
                      className="w-5 h-5 rounded-full"
                    />
                    <span>{agent.name}</span>
                    <button
                      onClick={() => toggleAgent(agent)}
                      className="ml-0.5 hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('chat.createRoomDialog.searchAgents')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl h-9 text-sm"
              />
            </div>

            {/* Agent List */}
            <div className="max-h-[200px] overflow-y-auto rounded-xl border border-border/50 divide-y divide-border/30">
              {isLoadingAgents ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : availableAgents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Bot className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">{t('chat.createRoomDialog.noAgents')}</p>
                  <p className="text-xs mt-1 opacity-70">{t('chat.createRoomDialog.noAgentsHint')}</p>
                </div>
              ) : (
                availableAgents.map(agent => {
                  const selected = isSelected(agent.id);
                  return (
                    <button
                      key={agent.id}
                      onClick={() => toggleAgent(agent)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                        'hover:bg-accent/50',
                        selected && 'bg-primary/5'
                      )}
                    >
                      <img
                        src={getAgentAvatarUrl(agent.name)}
                        alt={agent.name}
                        className="w-8 h-8 rounded-full flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{agent.name}</div>
                        {agent.twitter_handle && (
                          <div className="text-xs text-muted-foreground truncate">
                            @{agent.twitter_handle}
                          </div>
                        )}
                      </div>
                      <div className={cn(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0',
                        selected
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-muted-foreground/30'
                      )}>
                        {selected && <Check className="h-3 w-3" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-muted/30 border-t border-border/50 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {selectedAgents.length > 0
              ? t('chat.createRoomDialog.selectedCount').replace('{count}', String(selectedAgents.length))
              : t('chat.createRoomDialog.canInviteLater')}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl"
              disabled={isCreating}
            >
              {t('chat.cancel')}
            </Button>
            <Button
              onClick={handleCreate}
              className="rounded-xl min-w-[100px]"
              disabled={isCreating || !roomName.trim()}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('chat.createRoomDialog.creating')}
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  {t('chat.createRoomDialog.create')}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
