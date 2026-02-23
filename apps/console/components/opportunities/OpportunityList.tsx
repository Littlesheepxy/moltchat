'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Target, Sparkles } from 'lucide-react';
import { getMyExplorations, submitDecision, type MyExplorationItem, type MyExplorationsStats } from '@/lib/api';
import { OpportunityCard } from './OpportunityCard';
import { ExplorationDetailView } from '@/components/networking/ExplorationDetail';

type ViewState =
  | { type: 'list' }
  | { type: 'detail'; explorationId: string };

export function OpportunityList() {
  const { t } = useI18n();

  const [view, setView] = useState<ViewState>({ type: 'list' });
  const [explorations, setExplorations] = useState<MyExplorationItem[]>([]);
  const [stats, setStats] = useState<MyExplorationsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const loadData = useCallback(async (f: string) => {
    setLoading(true);
    const result = await getMyExplorations(f);
    if (result.success && result.data) {
      setExplorations(result.data.explorations);
      setStats(result.data.stats);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData(filter);
  }, [filter, loadData]);

  const handleDecide = useCallback(async (id: string, decision: 'want_chat' | 'pass') => {
    const result = await submitDecision(id, decision);
    if (result.success) {
      // Reload to reflect changes
      loadData(filter);
    }
  }, [filter, loadData]);

  // Detail view
  if (view.type === 'detail') {
    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <ExplorationDetailView
          explorationId={view.explorationId}
          onBack={() => {
            setView({ type: 'list' });
            loadData(filter);
          }}
          onChatReady={(dmSessionId) => {
            console.log('Chat ready:', dmSessionId);
          }}
        />
      </div>
    );
  }

  // List view
  const filters = [
    { key: 'all', label: t('networking.all') || 'All' },
    { key: 'pending', label: t('networking.pendingReview') || 'To Review' },
    { key: 'in_progress', label: t('networking.inProgress') || 'In Progress' },
    { key: 'decided', label: t('networking.decided') || 'Decided' },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{t('opportunities.title') || 'Opportunities'}</h1>
            <p className="text-sm text-muted-foreground">
              {t('opportunities.subtitle') || 'Agent Chat results from your Rooms'}
            </p>
          </div>
        </div>

        {/* Stats bar */}
        {stats && (
          <div className="grid grid-cols-3 gap-3 mb-5">
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-yellow-500">{stats.pending_decision}</p>
                <p className="text-[11px] text-muted-foreground">{t('opportunities.toReview') || 'To Review'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-primary">{stats.in_progress}</p>
                <p className="text-[11px] text-muted-foreground">{t('opportunities.screening') || 'Screening'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-green-500">{stats.decided}</p>
                <p className="text-[11px] text-muted-foreground">{t('opportunities.decided') || 'Decided'}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 mb-5 bg-muted/50 rounded-xl p-1">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'flex-1 text-xs font-medium py-2 px-2 rounded-lg transition-all',
                filter === f.key
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {f.label}
              {f.key === 'pending' && stats && stats.pending_decision > 0 && (
                <span className="ml-1 text-[10px] bg-yellow-500/20 text-yellow-600 rounded-full px-1.5">
                  {stats.pending_decision}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Exploration list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : explorations.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-medium mb-2">
              {filter === 'pending'
                ? (t('opportunities.noPending') || 'No pending reviews')
                : filter === 'in_progress'
                ? (t('opportunities.noInProgress') || 'No active screenings')
                : (t('opportunities.noExplorations') || 'No opportunities yet')}
            </h3>
            <p className="text-sm max-w-xs mx-auto">
              {t('opportunities.joinRoomHint') || 'Join a Room from the Discover tab — your Agent will automatically find matches for you.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {explorations.map(exp => (
              <OpportunityCard
                key={exp.id}
                exploration={exp}
                onClick={(id) => setView({ type: 'detail', explorationId: id })}
                onDecide={handleDecide}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
