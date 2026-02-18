'use client';

import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sparkles, ArrowRight, Check, Clock, X, Send,
  MessageSquare, Loader2, Hash, Zap,
} from 'lucide-react';
import type { MyExplorationItem } from '@/lib/api';

interface OpportunityCardProps {
  exploration: MyExplorationItem;
  onClick: (id: string) => void;
  onDecide?: (id: string, decision: 'want_chat' | 'pass') => void;
}

export function OpportunityCard({ exploration, onClick, onDecide }: OpportunityCardProps) {
  const { t } = useI18n();

  const score = exploration.match_score ?? 0;
  const scorePercent = Math.round(score * 100);
  const scoreColor = score >= 0.7 ? 'text-green-500' : score >= 0.4 ? 'text-yellow-500' : 'text-muted-foreground';
  const scoreBg = score >= 0.7 ? 'bg-green-500' : score >= 0.4 ? 'bg-yellow-500' : 'bg-muted';

  // Status logic
  const isInProgress = exploration.status === 'pending' || exploration.status === 'in_progress';
  const isPendingDecision = exploration.status === 'completed' && exploration.my_decision === 'pending';
  const isWaiting = exploration.my_decision === 'want_chat' && exploration.other_decision === 'pending';
  const isMutualMatch = exploration.my_decision === 'want_chat' &&
    (exploration.other_decision === 'want_chat' || exploration.other_decision === 'accept');
  const hasIncomingRequest = exploration.my_decision === 'pending' && exploration.chat_requested_by;
  const isPassed = exploration.my_decision === 'pass';

  // Source label
  const sourceLabel = exploration.context.room_name
    ? `#${exploration.context.room_name}`
    : exploration.context.activity_name
    ? exploration.context.activity_name
    : exploration.source === 'dm' ? 'DM' : '';

  // Other party display
  const otherName = exploration.other_party.display_name || t('networking.anonymousUser') || 'Anonymous';
  const otherTitle = exploration.other_party.job_title;
  const otherIndustry = exploration.other_party.industry;

  return (
    <Card
      className={cn(
        'group cursor-pointer transition-all duration-200',
        'hover:shadow-md hover:border-primary/30',
        hasIncomingRequest && 'border-primary/40 bg-primary/5',
        isPendingDecision && !hasIncomingRequest && 'border-yellow-500/30',
      )}
      onClick={() => onClick(exploration.id)}
    >
      <CardContent className="p-4">
        {/* Top row: score + status badge */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            {isInProgress ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm font-medium text-primary">
                  {exploration.total_rounds}/{exploration.max_rounds} {t('networking.rounds') || 'rounds'}
                </span>
              </div>
            ) : (
              <>
                <span className={cn('text-xl font-bold tabular-nums', scoreColor)}>
                  {scorePercent}%
                </span>
                <div className="h-1.5 bg-muted rounded-full w-12 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', scoreBg)}
                    style={{ width: `${scorePercent}%` }}
                  />
                </div>
              </>
            )}
          </div>

          {/* Status badge */}
          {isMutualMatch ? (
            <Badge className="gap-1 bg-green-500/10 text-green-600 border-green-500/20">
              <Check className="h-3 w-3" />
              {t('networking.mutualMatch') || 'Matched'}
            </Badge>
          ) : isWaiting ? (
            <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-500/30">
              <Clock className="h-3 w-3" />
              {t('networking.requestSent') || 'Waiting'}
            </Badge>
          ) : hasIncomingRequest ? (
            <Badge className="gap-1 animate-pulse bg-primary/10 text-primary border-primary/20">
              <Send className="h-3 w-3" />
              {t('networking.chatRequestReceived') || 'Wants to meet'}
            </Badge>
          ) : isInProgress ? (
            <Badge variant="outline" className="gap-1 text-primary border-primary/20">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('networking.inProgress') || 'Screening'}
            </Badge>
          ) : isPassed ? (
            <Badge variant="secondary" className="gap-1">
              <X className="h-3 w-3" />
              {t('networking.passed') || 'Skipped'}
            </Badge>
          ) : null}
        </div>

        {/* Name + title */}
        <div className="mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{otherName}</span>
            {otherTitle && (
              <span className="text-xs text-muted-foreground">{otherTitle}</span>
            )}
          </div>
          {otherIndustry && (
            <span className="text-xs text-muted-foreground">{otherIndustry}</span>
          )}
        </div>

        {/* Summary / highlights */}
        {exploration.match_highlights && exploration.match_highlights.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {exploration.match_highlights.slice(0, 3).map((h, i) => (
              <Badge key={i} variant="outline" className="text-xs font-normal">
                <Sparkles className="h-3 w-3 mr-1 text-primary" />
                {typeof h === 'string' ? h : ''}
              </Badge>
            ))}
          </div>
        )}

        {exploration.summary && !isInProgress && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
            {typeof exploration.summary === 'string'
              ? exploration.summary.substring(0, 120)
              : ''}
          </p>
        )}

        {/* Bottom row: source + time + action buttons */}
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {sourceLabel && (
              <span className="flex items-center gap-1">
                {exploration.context.room_name ? (
                  <Hash className="h-3 w-3" />
                ) : (
                  <Zap className="h-3 w-3" />
                )}
                {sourceLabel}
              </span>
            )}
            <span>{formatTimeAgo(exploration.completed_at || exploration.created_at)}</span>
          </div>

          {/* Quick action buttons for pending decisions */}
          {isPendingDecision && onDecide && (
            <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs rounded-lg"
                onClick={() => onDecide(exploration.id, 'pass')}
              >
                {t('networking.skip') || 'Skip'}
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs rounded-lg"
                onClick={() => onDecide(exploration.id, 'want_chat')}
              >
                <Check className="h-3 w-3 mr-1" />
                {t('networking.meet') || 'Meet'}
              </Button>
            </div>
          )}

          {!isPendingDecision && (
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-0.5 transform" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;
  if (diffDay < 7) return `${diffDay}d`;
  return date.toLocaleDateString();
}
