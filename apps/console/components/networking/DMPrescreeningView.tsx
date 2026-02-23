'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n-provider';
import { Loader2, Sparkles, Bot } from 'lucide-react';
import {
  getDMPrescreenings,
  getExploration,
  decideDMPrescreening,
  type ExplorationItem,
  type ExplorationDetail as ExplorationDetailType,
} from '@/lib/api';
import { ExplorationCard } from './ExplorationCard';
import { ExplorationDetailView } from './ExplorationDetail';

type ViewState =
  | { type: 'list' }
  | { type: 'detail'; explorationId: string };

interface DMPrescreeningViewProps {
  onChatReady?: (dmSessionId: string) => void;
}

export function DMPrescreeningView({ onChatReady }: DMPrescreeningViewProps) {
  const { t } = useI18n();

  const [view, setView] = useState<ViewState>({ type: 'list' });
  const [prescreenings, setPrescreenings] = useState<ExplorationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const loadPrescreenings = useCallback(async (f: string) => {
    setLoading(true);
    const result = await getDMPrescreenings(f);
    if (result.success && result.data) {
      setPrescreenings(result.data.prescreenings);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPrescreenings(filter);
  }, [filter, loadPrescreenings]);

  const handleFilterChange = (f: string) => {
    setFilter(f);
  };

  if (view.type === 'detail') {
    return (
      <ExplorationDetailView
        explorationId={view.explorationId}
        onBack={() => {
          setView({ type: 'list' });
          loadPrescreenings(filter);
        }}
        onChatReady={onChatReady}
      />
    );
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">{t('dm.prescreening.title') || 'Agent 对谈'}</h1>
          <p className="text-sm text-muted-foreground">
            {t('dm.prescreening.subtitle') || 'AI Agent 代你先聊一轮，看看双方是否值得连接'}
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-muted/50 rounded-xl p-1">
        {['all', 'pending', 'want_chat', 'passed'].map(f => (
          <button
            key={f}
            onClick={() => handleFilterChange(f)}
            className={cn(
              'flex-1 text-xs font-medium py-2 px-3 rounded-lg transition-all',
              filter === f
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {f === 'all' ? t('networking.all') :
             f === 'pending' ? t('networking.pendingReview') :
             f === 'want_chat' ? t('networking.liked') :
             t('networking.passed')}
          </button>
        ))}
      </div>

      {/* Prescreening list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : prescreenings.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <h3 className="font-medium mb-1">{t('dm.prescreening.noResults') || '暂无对谈记录'}</h3>
          <p className="text-sm">
            {t('dm.prescreening.noResultsHint') || '发送或收到 DM 请求后，Agent 对谈结果将在此显示'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {prescreenings.map(exp => (
            <ExplorationCard
              key={exp.id}
              exploration={exp}
              onClick={(id) => setView({ type: 'detail', explorationId: id })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
