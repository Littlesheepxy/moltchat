'use client';

import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Calendar, ArrowRight, Check } from 'lucide-react';
import type { Activity } from '@/lib/api';

interface ActivityCardProps {
  activity: Activity;
  onClick: (id: string) => void;
}

export function ActivityCard({ activity, onClick }: ActivityCardProps) {
  const { t } = useI18n();

  const statusVariant = {
    active: 'success' as const,
    paused: 'warning' as const,
    ended: 'secondary' as const,
    draft: 'outline' as const,
  }[activity.status] || 'outline' as const;

  const statusLabel = {
    active: t('networking.active'),
    paused: t('networking.paused'),
    ended: t('networking.ended'),
    draft: 'Draft',
  }[activity.status] || activity.status;

  const isFull = activity.participant_count >= activity.max_participants;

  return (
    <Card
      className={cn(
        'group cursor-pointer transition-all duration-200',
        'hover:shadow-md hover:border-primary/30',
        activity.status !== 'active' && 'opacity-70'
      )}
      onClick={() => onClick(activity.id)}
    >
      {/* Cover image or gradient */}
      <div className={cn(
        'h-24 rounded-t-xl relative overflow-hidden',
        !activity.cover_image && 'bg-gradient-to-br from-primary/20 via-primary/10 to-background'
      )}>
        {activity.cover_image && (
          <img src={activity.cover_image} alt="" className="w-full h-full object-cover" />
        )}
        <div className="absolute top-3 left-3 flex gap-2">
          <Badge variant={statusVariant}>{statusLabel}</Badge>
          {activity.theme && (
            <Badge variant="outline" className="bg-background/80 backdrop-blur-sm">
              {activity.theme}
            </Badge>
          )}
        </div>
        {activity.user_joined && (
          <div className="absolute top-3 right-3">
            <Badge variant="default" className="bg-primary/90 backdrop-blur-sm">
              <Check className="h-3 w-3 mr-1" />
              {t('networking.joined')}
            </Badge>
          </div>
        )}
      </div>

      <CardContent className="p-4">
        <h3 className="font-semibold text-base mb-1 line-clamp-1 group-hover:text-primary transition-colors">
          {activity.name}
        </h3>
        {activity.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {activity.description}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {activity.participant_count}/{activity.max_participants}
            </span>
            {activity.starts_at && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(activity.starts_at).toLocaleDateString()}
              </span>
            )}
          </div>

          {isFull && !activity.user_joined ? (
            <Badge variant="secondary">{t('networking.full')}</Badge>
          ) : (
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors group-hover:translate-x-0.5 transform" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
