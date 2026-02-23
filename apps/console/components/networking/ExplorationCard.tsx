'use client';

import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n-provider';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, MessageSquare, ArrowRight, Check, Clock, X, Send } from 'lucide-react';
import type { ExplorationItem } from '@/lib/api';

interface ExplorationCardProps {
  exploration: ExplorationItem;
  onClick: (id: string) => void;
}

export function ExplorationCard({ exploration, onClick }: ExplorationCardProps) {
  const { t } = useI18n();

  const score = exploration.match_score ?? 0;
  const scorePercent = Math.round(score * 100);
  const scoreColor = score >= 0.7 ? 'text-green-500' : score >= 0.4 ? 'text-yellow-500' : 'text-muted-foreground';
  const barColor = score >= 0.7 ? 'bg-green-500' : score >= 0.4 ? 'bg-yellow-500' : 'bg-muted';

  // Decision state
  const isWaiting = exploration.my_decision === 'want_chat' && exploration.other_decision === 'pending';
  const isChatReady = exploration.dm_request_id && (
    exploration.other_decision === 'accept' || exploration.other_decision === 'want_chat'
  );
  const hasRequest = exploration.my_decision === 'pending' && exploration.chat_requested_by;

  return (
    <Card
      className={cn(
        'group cursor-pointer transition-all duration-200',
        'hover:shadow-md hover:border-primary/30',
        hasRequest && 'border-primary/40 bg-primary/5'
      )}
      onClick={() => onClick(exploration.id)}
    >
      <CardContent className="p-4">
        {/* Top row: score + status */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn('text-lg font-bold tabular-nums', scoreColor)}>
              {scorePercent}%
            </div>
            <div className="flex-1 h-1.5 bg-muted rounded-full w-16 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', barColor)}
                style={{ width: `${scorePercent}%` }}
              />
            </div>
          </div>

          {/* Status badge */}
          {isChatReady ? (
            <Badge variant="success" className="gap-1">
              <MessageSquare className="h-3 w-3" />
              {t('networking.chatReady')}
            </Badge>
          ) : isWaiting ? (
            <Badge variant="warning" className="gap-1">
              <Clock className="h-3 w-3" />
              {t('networking.requestSent')}
            </Badge>
          ) : hasRequest ? (
            <Badge variant="default" className="gap-1 animate-pulse">
              <Send className="h-3 w-3" />
              {t('networking.chatRequestReceived')}
            </Badge>
          ) : exploration.my_decision === 'pass' ? (
            <Badge variant="secondary" className="gap-1">
              <X className="h-3 w-3" />
              {t('networking.passed')}
            </Badge>
          ) : null}
        </div>

        {/* Highlights */}
        {exploration.match_highlights && exploration.match_highlights.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {exploration.match_highlights.slice(0, 3).map((h, i) => (
              <Badge key={i} variant="outline" className="text-xs font-normal">
                <Sparkles className="h-3 w-3 mr-1 text-primary" />
                {h}
              </Badge>
            ))}
          </div>
        )}

        {/* Other party info */}
        <div className="flex items-center gap-2 mb-2">
          {exploration.other_party.roles?.map(role => (
            <Badge key={role} variant="secondary" className="text-xs">
              {t(`networking.roleLabels.${role}`) || role}
            </Badge>
          ))}
          {exploration.other_party.industry && (
            <span className="text-xs text-muted-foreground">
              {exploration.other_party.industry}
            </span>
          )}
        </div>

        {/* Summary preview */}
        {exploration.summary_preview && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {exploration.summary_preview}
          </p>
        )}

        {/* Tags */}
        {exploration.other_party.tags && exploration.other_party.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {exploration.other_party.tags.slice(0, 5).map(tag => (
              <span key={tag} className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Arrow indicator */}
        <div className="flex justify-end mt-2">
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-0.5 transform" />
        </div>
      </CardContent>
    </Card>
  );
}
