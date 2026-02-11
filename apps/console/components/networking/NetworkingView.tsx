'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Loader2, Sparkles, Users, Zap } from 'lucide-react';
import {
  getActivities, getActivity, joinActivity, getExplorations,
  type Activity, type ActivityDetail, type MyParticipation,
  type ExplorationStats, type ExplorationItem,
} from '@/lib/api';
import { ActivityCard } from './ActivityCard';
import { IntentSetupForm } from './IntentSetupForm';
import { ExplorationCard } from './ExplorationCard';
import { ExplorationDetailView } from './ExplorationDetail';

type ViewState =
  | { type: 'activities' }
  | { type: 'activity-home'; activityId: string }
  | { type: 'join-activity'; activityId: string }
  | { type: 'exploration-detail'; explorationId: string; activityId: string };

export function NetworkingView() {
  const { t } = useI18n();

  // View navigation
  const [view, setView] = useState<ViewState>({ type: 'activities' });

  // Data
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [currentActivity, setCurrentActivity] = useState<ActivityDetail | null>(null);
  const [myParticipation, setMyParticipation] = useState<MyParticipation | null>(null);
  const [explorationStats, setExplorationStats] = useState<ExplorationStats | null>(null);
  const [explorations, setExplorations] = useState<ExplorationItem[]>([]);
  const [explorationFilter, setExplorationFilter] = useState('all');
  const [loadingExplorations, setLoadingExplorations] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load activities
  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async () => {
    setLoadingActivities(true);
    const result = await getActivities();
    if (result.success && result.data) {
      setActivities(result.data.activities);
    }
    setLoadingActivities(false);
  };

  // Load activity detail
  const loadActivityDetail = useCallback(async (activityId: string) => {
    const result = await getActivity(activityId);
    if (result.success && result.data) {
      setCurrentActivity(result.data.activity);
      setMyParticipation(result.data.my_participation);
      setExplorationStats(result.data.exploration_stats);
    }
  }, []);

  // Load explorations
  const loadExplorations = useCallback(async (activityId: string, filter: string) => {
    setLoadingExplorations(true);
    const result = await getExplorations(activityId, filter);
    if (result.success && result.data) {
      setExplorations(result.data.explorations);
    }
    setLoadingExplorations(false);
  }, []);

  // Navigate to activity
  const handleActivityClick = useCallback(async (activityId: string) => {
    await loadActivityDetail(activityId);
    setView({ type: 'activity-home', activityId });
    loadExplorations(activityId, 'all');
  }, [loadActivityDetail, loadExplorations]);

  // Join activity
  const handleJoin = useCallback(async (data: { roles: string[]; looking_for: string; can_offer: string; tags: string[] }) => {
    if (view.type !== 'join-activity') return;
    setError(null);
    const result = await joinActivity(view.activityId, data);
    if (result.success) {
      await loadActivityDetail(view.activityId);
      setView({ type: 'activity-home', activityId: view.activityId });
      loadExplorations(view.activityId, 'all');
    } else if (!result.success && result.error) {
      setError(result.error.message);
    }
  }, [view, loadActivityDetail, loadExplorations]);

  // Filter change
  const handleFilterChange = useCallback((filter: string) => {
    setExplorationFilter(filter);
    if (view.type === 'activity-home') {
      loadExplorations(view.activityId, filter);
    }
  }, [view, loadExplorations]);

  // Render based on view state
  const renderContent = () => {
    switch (view.type) {
      case 'activities':
        return renderActivitiesList();
      case 'activity-home':
        return renderActivityHome();
      case 'join-activity':
        return renderJoinActivity();
      case 'exploration-detail':
        return (
          <ExplorationDetailView
            explorationId={view.explorationId}
            onBack={() => {
              setView({ type: 'activity-home', activityId: view.activityId });
              loadExplorations(view.activityId, explorationFilter);
            }}
            onChatReady={(dmSessionId) => {
              // TODO: Navigate to DM chat
              console.log('Chat ready:', dmSessionId);
            }}
          />
        );
    }
  };

  // ============================================
  // Activities List
  // ============================================
  const renderActivitiesList = () => (
    <div className="p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Zap className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">{t('networking.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('networking.activities')}</p>
        </div>
      </div>

      {loadingActivities ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Zap className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <h3 className="text-lg font-medium mb-1">{t('networking.noActivities')}</h3>
          <p className="text-sm">{t('networking.noActivitiesHint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {activities.map(activity => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              onClick={handleActivityClick}
            />
          ))}
        </div>
      )}
    </div>
  );

  // ============================================
  // Activity Home (exploration results)
  // ============================================
  const renderActivityHome = () => (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setView({ type: 'activities' })}
          className="rounded-xl"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold truncate">{currentActivity?.name}</h1>
          {currentActivity?.theme && (
            <Badge variant="outline" className="mt-0.5">{currentActivity.theme}</Badge>
          )}
        </div>
        {!myParticipation && currentActivity?.status === 'active' && (
          <Button
            onClick={() => setView({ type: 'join-activity', activityId: view.type === 'activity-home' ? view.activityId : '' })}
            className="rounded-xl"
          >
            {t('networking.joinActivity')}
          </Button>
        )}
      </div>

      {/* Stats bar */}
      {explorationStats && (
        <div className="flex gap-3 mb-4">
          <Card className="flex-1">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-primary">{explorationStats.total}</p>
              <p className="text-xs text-muted-foreground">{t('networking.all')}</p>
            </CardContent>
          </Card>
          <Card className="flex-1">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-yellow-500">{explorationStats.pending_review}</p>
              <p className="text-xs text-muted-foreground">{t('networking.pendingReview')}</p>
            </CardContent>
          </Card>
          <Card className="flex-1">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-green-500">{explorationStats.completed}</p>
              <p className="text-xs text-muted-foreground">{t('networking.liked')}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-muted/50 rounded-xl p-1">
        {['all', 'pending', 'want_chat', 'passed'].map(filter => (
          <button
            key={filter}
            onClick={() => handleFilterChange(filter)}
            className={cn(
              'flex-1 text-xs font-medium py-2 px-3 rounded-lg transition-all',
              explorationFilter === filter
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {filter === 'all' ? t('networking.all') :
             filter === 'pending' ? t('networking.pendingReview') :
             filter === 'want_chat' ? t('networking.liked') :
             t('networking.passed')}
          </button>
        ))}
      </div>

      {/* Exploration list */}
      {loadingExplorations ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : explorations.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <h3 className="font-medium mb-1">{t('networking.noExplorations')}</h3>
          <p className="text-sm">{t('networking.noExplorationsHint')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {explorations.map(exp => (
            <ExplorationCard
              key={exp.id}
              exploration={exp}
              onClick={(id) => setView({
                type: 'exploration-detail',
                explorationId: id,
                activityId: view.type === 'activity-home' ? view.activityId : '',
              })}
            />
          ))}
        </div>
      )}
    </div>
  );

  // ============================================
  // Join Activity
  // ============================================
  const renderJoinActivity = () => (
    <div className="p-4 sm:p-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (view.type === 'join-activity') {
              setView({ type: 'activity-home', activityId: view.activityId });
            }
          }}
          className="rounded-xl"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">{t('networking.setupIdentity')}</h1>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
          {error}
        </div>
      )}

      <IntentSetupForm
        onSubmit={handleJoin}
        initialData={myParticipation}
      />
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto">
      {renderContent()}
    </div>
  );
}
