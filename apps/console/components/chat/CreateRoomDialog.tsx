/**
 * CreateRoomDialog - 双模式创建房间弹窗
 *
 * Step 1: 选择房间类型（开放房间 / 协议房间）
 * Step 2a: 开放房间 — 名称 + 描述 + Agent 邀请
 * Step 2b: 协议房间 — 名称 + 描述 + 意图声明 + 标签 + Agent 邀请
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
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2, Search, Check, Bot, Plus, X,
  MessageCircle, Shield, ArrowLeft, Tag,
} from 'lucide-react';

const GATEWAY_URL = '/api/gateway';

type RoomType = 'open' | 'protocol';
type Step = 'choose' | 'form';

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

  // Step & type
  const [step, setStep] = useState<Step>('choose');
  const [roomType, setRoomType] = useState<RoomType>('open');

  // Common form state
  const [roomName, setRoomName] = useState('');
  const [roomDescription, setRoomDescription] = useState('');
  const [selectedAgents, setSelectedAgents] = useState<AvailableAgent[]>([]);

  // Protocol room extras
  const [lookingFor, setLookingFor] = useState('');
  const [canOffer, setCanOffer] = useState('');
  const [industry, setIndustry] = useState('');
  const [region, setRegion] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

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

  // Load agents when entering form step
  useEffect(() => {
    if (open && step === 'form') {
      fetchAgents();
    }
  }, [open, step, fetchAgents]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep('choose');
      setRoomType('open');
      setRoomName('');
      setRoomDescription('');
      setSelectedAgents([]);
      setLookingFor('');
      setCanOffer('');
      setIndustry('');
      setRegion('');
      setTags([]);
      setTagInput('');
      setSearchQuery('');
      setError('');
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (step !== 'form') return;
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      fetchAgents(searchQuery || undefined);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, fetchAgents, step]);

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

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim();
      if (!tags.includes(newTag) && tags.length < 10) {
        setTags(prev => [...prev, newTag]);
      }
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
  };

  const selectType = (type: RoomType) => {
    setRoomType(type);
    setStep('form');
  };

  const handleCreate = async () => {
    if (!roomName.trim()) {
      setError(t('chat.createRoomDialog.roomNameRequired'));
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      // Build description with protocol metadata for protocol rooms
      let finalDescription = roomDescription.trim() || undefined;
      const metadata: Record<string, unknown> = {};

      if (roomType === 'protocol') {
        metadata.room_type = 'protocol';
        if (lookingFor.trim()) metadata.looking_for = lookingFor.trim();
        if (canOffer.trim()) metadata.can_offer = canOffer.trim();
        if (industry.trim()) metadata.industry = industry.trim();
        if (region) metadata.region = region;
        if (tags.length > 0) metadata.tags = tags;
      }

      // Build tag slugs: region + any other system tags
      const tagSlugs: string[] = [];
      if (region) tagSlugs.push(region);

      // Create room
      const result = await createRoom(
        roomName.trim(),
        finalDescription,
        {
          invite_only: false,
          allow_observer: true,
          is_public: true,
          ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
        },
        tagSlugs.length > 0 ? tagSlugs : undefined
      );

      if (!result.success || !result.data) {
        setError(t('chat.createRoomDialog.createFailed'));
        setIsCreating(false);
        return;
      }

      const roomId = result.data.room.id;

      // Invite selected agents
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] rounded-2xl p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
              {step === 'form' && (
                <button
                  onClick={() => setStep('choose')}
                  className="hover:bg-accent rounded-lg p-1 transition-colors -ml-1"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              )}
              {t('chat.createRoomDialog.title')}
            </DialogTitle>
            <DialogDescription>
              {step === 'choose'
                ? t('chat.createRoomDialog.description')
                : roomType === 'protocol'
                  ? t('chat.createRoomDialog.protocolRoomDesc')
                  : t('chat.createRoomDialog.openRoomDesc')}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Step 1: Choose type */}
        {step === 'choose' && (
          <div className="px-6 pb-6">
            <div className="grid grid-cols-2 gap-3">
              {/* Open Room */}
              <button
                onClick={() => selectType('open')}
                className="group flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all text-center"
              >
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                  <MessageCircle className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <div className="text-sm font-semibold mb-1">
                    {t('chat.createRoomDialog.openRoom')}
                  </div>
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    {t('chat.createRoomDialog.openRoomDesc')}
                  </div>
                </div>
              </button>

              {/* Protocol Room */}
              <button
                onClick={() => selectType('protocol')}
                className="group flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all text-center"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-semibold mb-1">
                    {t('chat.createRoomDialog.protocolRoom')}
                  </div>
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    {t('chat.createRoomDialog.protocolRoomDesc')}
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Form */}
        {step === 'form' && (
          <>
            <div className="px-6 pb-6 space-y-4 max-h-[60vh] overflow-y-auto">
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

              {/* Protocol Room Extras */}
              {roomType === 'protocol' && (
                <>
                  {/* Looking For */}
                  <div className="space-y-2">
                    <Label htmlFor="looking-for" className="text-sm font-medium">
                      {t('chat.createRoomDialog.lookingFor')}
                    </Label>
                    <Textarea
                      id="looking-for"
                      placeholder={t('chat.createRoomDialog.lookingForPlaceholder')}
                      value={lookingFor}
                      onChange={(e) => setLookingFor(e.target.value)}
                      className="rounded-xl resize-none h-16"
                      maxLength={300}
                    />
                  </div>

                  {/* Can Offer */}
                  <div className="space-y-2">
                    <Label htmlFor="can-offer" className="text-sm font-medium">
                      {t('chat.createRoomDialog.canOffer')}
                    </Label>
                    <Textarea
                      id="can-offer"
                      placeholder={t('chat.createRoomDialog.canOfferPlaceholder')}
                      value={canOffer}
                      onChange={(e) => setCanOffer(e.target.value)}
                      className="rounded-xl resize-none h-16"
                      maxLength={300}
                    />
                  </div>

                  {/* Industry */}
                  <div className="space-y-2">
                    <Label htmlFor="industry" className="text-sm font-medium">
                      {t('chat.createRoomDialog.industry')}
                    </Label>
                    <Input
                      id="industry"
                      placeholder={t('chat.createRoomDialog.industryPlaceholder')}
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      className="rounded-xl h-10"
                      maxLength={100}
                    />
                  </div>

                  {/* Region */}
                  <div className="space-y-2">
                    <Label htmlFor="region" className="text-sm font-medium flex items-center gap-1.5">
                      🌏 地区
                    </Label>
                    <select
                      id="region"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      className="w-full h-10 px-3 border border-input rounded-xl bg-background text-sm"
                    >
                      <option value="">不限地区（全球）</option>
                      <optgroup label="中国大陆">
                        <option value="region-beijing">北京</option>
                        <option value="region-shanghai">上海</option>
                        <option value="region-shenzhen">深圳</option>
                        <option value="region-guangzhou">广州</option>
                        <option value="region-hangzhou">杭州</option>
                        <option value="region-chengdu">成都</option>
                        <option value="region-wuhan">武汉</option>
                        <option value="region-nanjing">南京</option>
                        <option value="region-xian">西安</option>
                        <option value="region-china-other">其他中国城市</option>
                      </optgroup>
                      <optgroup label="港澳台">
                        <option value="region-hongkong">香港</option>
                        <option value="region-taiwan">台湾</option>
                        <option value="region-macau">澳门</option>
                      </optgroup>
                      <optgroup label="亚太">
                        <option value="region-singapore">新加坡</option>
                        <option value="region-japan">日本</option>
                        <option value="region-korea">韩国</option>
                        <option value="region-sea">东南亚</option>
                        <option value="region-australia">澳大利亚</option>
                      </optgroup>
                      <optgroup label="北美">
                        <option value="region-sf-bay">旧金山湾区</option>
                        <option value="region-newyork">纽约</option>
                        <option value="region-la">洛杉矶</option>
                        <option value="region-seattle">西雅图</option>
                        <option value="region-na-other">其他北美</option>
                      </optgroup>
                      <optgroup label="欧洲">
                        <option value="region-london">伦敦</option>
                        <option value="region-berlin">柏林</option>
                        <option value="region-eu-other">其他欧洲</option>
                      </optgroup>
                      <optgroup label="其他">
                        <option value="region-middleeast">中东</option>
                        <option value="region-global">全球 / Global</option>
                        <option value="region-other">其他地区</option>
                      </optgroup>
                    </select>
                  </div>

                  {/* Tags */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      {t('chat.createRoomDialog.tags')}
                    </Label>
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {tags.map(tag => (
                          <span
                            key={tag}
                            className="flex items-center gap-1 bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-medium"
                          >
                            <Tag className="h-3 w-3" />
                            {tag}
                            <button
                              onClick={() => removeTag(tag)}
                              className="ml-0.5 hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <Input
                      placeholder={t('chat.createRoomDialog.tagsPlaceholder')}
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleAddTag}
                      className="rounded-xl h-9 text-sm"
                      maxLength={30}
                    />
                  </div>

                  {/* Protocol hint */}
                  <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-xl border border-primary/10">
                    <Shield className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {t('chat.createRoomDialog.protocolHint')}
                    </p>
                  </div>
                </>
              )}

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
                <div className="max-h-[160px] overflow-y-auto rounded-xl border border-border/50 divide-y divide-border/30">
                  {isLoadingAgents ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : availableAgents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
