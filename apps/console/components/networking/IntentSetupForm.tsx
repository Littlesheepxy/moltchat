'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Briefcase, TrendingUp, Megaphone, Store, Search,
  UserCheck, DollarSign, Sparkles, X, Plus, Loader2, Users2,
} from 'lucide-react';

const ROLE_OPTIONS = [
  { id: 'job_seeker', icon: Search },
  { id: 'recruiter', icon: UserCheck },
  { id: 'fundraiser', icon: TrendingUp },
  { id: 'investor', icon: DollarSign },
  { id: 'kol_seeker', icon: Megaphone },
  { id: 'kol', icon: Sparkles },
  { id: 'traffic_provider', icon: Store },
  { id: 'business_owner', icon: Briefcase },
  { id: 'business_general', icon: Users2 },
] as const;

interface IntentSetupFormProps {
  onSubmit: (data: {
    roles: string[];
    looking_for: string;
    can_offer: string;
    tags: string[];
  }) => Promise<void>;
  initialData?: {
    roles?: string[];
    looking_for?: string;
    can_offer?: string;
    tags?: string[];
  } | null;
  isLoading?: boolean;
}

export function IntentSetupForm({ onSubmit, initialData, isLoading }: IntentSetupFormProps) {
  const { t } = useI18n();
  const [selectedRoles, setSelectedRoles] = useState<string[]>(initialData?.roles || []);
  const [lookingFor, setLookingFor] = useState(initialData?.looking_for || '');
  const [canOffer, setCanOffer] = useState(initialData?.can_offer || '');
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const toggleRole = (roleId: string) => {
    setSelectedRoles(prev =>
      prev.includes(roleId)
        ? prev.filter(r => r !== roleId)
        : prev.length < 5 ? [...prev, roleId] : prev
    );
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag) && tags.length < 10) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleSubmit = async () => {
    if (selectedRoles.length === 0 || lookingFor.length < 10 || canOffer.length < 10) return;
    setSubmitting(true);
    try {
      await onSubmit({
        roles: selectedRoles,
        looking_for: lookingFor,
        can_offer: canOffer,
        tags,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = selectedRoles.length > 0 && lookingFor.length >= 10 && canOffer.length >= 10;

  return (
    <div className="space-y-6">
      {/* Role Selection */}
      <div>
        <Label className="text-sm font-medium mb-3 block">{t('networking.roles')}</Label>
        <div className="grid grid-cols-3 gap-2">
          {ROLE_OPTIONS.map(({ id, icon: Icon }) => {
            const isSelected = selectedRoles.includes(id);
            const label = t(`networking.roleLabels.${id}`) || id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggleRole(id)}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all',
                  isSelected
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-center leading-tight">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Looking For */}
      <div>
        <Label htmlFor="looking_for" className="text-sm font-medium mb-2 block">
          {t('networking.lookingFor')}
        </Label>
        <Textarea
          id="looking_for"
          value={lookingFor}
          onChange={e => setLookingFor(e.target.value)}
          placeholder={t('networking.lookingForPlaceholder')}
          className="resize-none rounded-xl min-h-[80px]"
          maxLength={500}
        />
        <p className="text-xs text-muted-foreground mt-1 text-right">
          {lookingFor.length}/500
        </p>
      </div>

      {/* Can Offer */}
      <div>
        <Label htmlFor="can_offer" className="text-sm font-medium mb-2 block">
          {t('networking.canOffer')}
        </Label>
        <Textarea
          id="can_offer"
          value={canOffer}
          onChange={e => setCanOffer(e.target.value)}
          placeholder={t('networking.canOfferPlaceholder')}
          className="resize-none rounded-xl min-h-[80px]"
          maxLength={500}
        />
        <p className="text-xs text-muted-foreground mt-1 text-right">
          {canOffer.length}/500
        </p>
      </div>

      {/* Tags */}
      <div>
        <Label className="text-sm font-medium mb-2 block">{t('networking.tags')}</Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.map(tag => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1">
              {tag}
              <button type="button" onClick={() => removeTag(tag)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
            placeholder={t('networking.tagsPlaceholder')}
            className="rounded-xl"
            maxLength={30}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={addTag}
            disabled={!tagInput.trim() || tags.length >= 10}
            className="rounded-xl flex-shrink-0"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={!isValid || submitting || isLoading}
        className="w-full rounded-xl h-12 text-base"
      >
        {submitting ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          t('networking.joinActivity')
        )}
      </Button>
    </div>
  );
}
