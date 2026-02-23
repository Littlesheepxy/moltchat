'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n-provider';
import {
  getProtocolBudget,
  getProtocolReputation,
  getReputationEvents,
  type BudgetStatus,
  type ReputationProfile,
  type ReputationEvent,
} from '@/lib/api';
import {
  Shield, TrendingUp, TrendingDown, Clock,
  Send, Inbox, Star, AlertTriangle, CheckCircle, XCircle,
  BookOpen, Loader2, Infinity,
} from 'lucide-react';

const EVENT_ICONS: Record<string, { icon: typeof TrendingUp; color: string }> = {
  profile_completed: { icon: CheckCircle, color: 'text-green-600' },
  outreach_sent: { icon: Send, color: 'text-blue-500' },
  outreach_accepted: { icon: CheckCircle, color: 'text-green-500' },
  outreach_rejected: { icon: XCircle, color: 'text-red-500' },
  post_chat_positive: { icon: Star, color: 'text-yellow-500' },
  post_chat_negative: { icon: TrendingDown, color: 'text-red-500' },
  cooldown_triggered: { icon: Clock, color: 'text-orange-500' },
  cooldown_lifted: { icon: CheckCircle, color: 'text-green-500' },
};

export function ProtocolDashboard() {
  const { t } = useI18n();
  const [budget, setBudget] = useState<BudgetStatus | null>(null);
  const [reputation, setReputation] = useState<ReputationProfile | null>(null);
  const [events, setEvents] = useState<ReputationEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [budgetRes, repRes, eventsRes] = await Promise.all([
      getProtocolBudget(),
      getProtocolReputation(),
      getReputationEvents(30),
    ]);

    if (budgetRes.success) setBudget(budgetRes.data);
    if (repRes.success) setReputation(repRes.data);
    if (eventsRes.success) setEvents(eventsRes.data.events);
    setLoading(false);
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 60) return t('protocol.timeAgo.minutes').replace('{count}', String(diffMin));
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return t('protocol.timeAgo.hours').replace('{count}', String(diffHr));
    const diffDay = Math.floor(diffHr / 24);
    return t('protocol.timeAgo.days').replace('{count}', String(diffDay));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            {t('protocol.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('protocol.subtitle')}
          </p>
        </div>
        <Link href="/rules">
          <Button variant="outline" size="sm" className="gap-2">
            <BookOpen className="h-4 w-4" />
            {t('protocol.viewRules')}
          </Button>
        </Link>
      </div>

      {/* Budget Section */}
      {budget && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">{t('protocol.budgetTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Outbound — unlimited */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    <Send className="h-4 w-4 text-blue-500" />
                    {t('protocol.outbound')}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Infinity className="h-3.5 w-3.5" />
                    {t('protocol.unlimited')}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('protocol.outboundDesc')}
                </p>
              </div>

              {/* Inbound — user configurable */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    <Inbox className="h-4 w-4 text-green-500" />
                    {t('protocol.inbound')}
                  </span>
                  <span className="font-mono">
                    {budget.inbound.limit === -1 ? (
                      <span className="flex items-center gap-1">
                        <Infinity className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      `${budget.inbound.used}/${budget.inbound.limit}`
                    )}
                  </span>
                </div>
                {budget.inbound.limit !== -1 && (
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${(budget.inbound.used / budget.inbound.limit) * 100}%` }}
                    />
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {budget.inbound.limit === -1
                    ? t('protocol.unlimited')
                    : t('protocol.remaining').replace('{count}', String(budget.inbound.remaining))}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('protocol.weekStart').replace('{date}', budget.week_start)}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Reputation Section */}
      {reputation && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">{t('protocol.reputationTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{reputation.reputation_score}</div>
                <div className="text-xs text-muted-foreground mt-1">{t('protocol.score')}</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">{Math.round(reputation.hit_rate * 100)}%</div>
                <div className="text-xs text-muted-foreground mt-1">{t('protocol.hitRate')}</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">
                  {reputation.avg_post_chat_rating
                    ? reputation.avg_post_chat_rating.toFixed(1)
                    : '-'}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{t('protocol.avgRating')}</div>
              </div>
            </div>

            {reputation.in_cooldown && (
              <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-lg flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4" />
                {t('protocol.cooldownWarning')}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Events Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('protocol.eventsTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('protocol.noEvents')}
            </p>
          ) : (
            <div className="space-y-3">
              {events.map((event) => {
                const meta = EVENT_ICONS[event.event_type] || {
                  icon: Clock,
                  color: 'text-muted-foreground',
                };
                const Icon = meta.icon;
                const label = t(`protocol.events.${event.event_type}`) || event.event_type;

                return (
                  <div key={event.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <Icon className={`h-4 w-4 ${meta.color}`} />
                      <span className="text-sm">{label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-mono ${event.points_delta > 0 ? 'text-green-500' : event.points_delta < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                        {event.points_delta > 0 ? '+' : ''}{event.points_delta}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatTime(event.created_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
