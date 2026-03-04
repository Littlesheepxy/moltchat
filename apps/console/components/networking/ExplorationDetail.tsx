'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Sparkles, MessageSquare, ChevronDown, ChevronUp, ArrowLeft,
  Send, X, Check, Loader2, Star, Lightbulb, Users, Share2, Globe, Lock, Scale, Info,
  Timer, AlertCircle,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  getExploration, submitDecision, respondToExploration, setExplorationPublic,
  type ExplorationDetail as ExplorationDetailType,
} from '@/lib/api';

interface ExplorationDetailProps {
  explorationId: string;
  onBack: () => void;
  onChatReady?: (dmSessionId: string) => void;
}

export function ExplorationDetailView({ explorationId, onBack, onChatReady }: ExplorationDetailProps) {
  const { t } = useI18n();
  const [data, setData] = useState<ExplorationDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConversation, setShowConversation] = useState(false);
  const [showPassDialog, setShowPassDialog] = useState(false);
  const [passReason, setPassReason] = useState('');
  const [deciding, setDeciding] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [togglingPublic, setTogglingPublic] = useState(false);

  const loadExploration = useCallback(async () => {
    setLoading(true);
    const result = await getExploration(explorationId);
    if (result.success && result.data) {
      setData(result.data);
      // @ts-ignore — is_public may not be in type yet
      setIsPublic(result.data.exploration?.is_public ?? false);
    }
    setLoading(false);
  }, [explorationId]);

  useEffect(() => {
    loadExploration();
  }, [loadExploration]);

  const handleDecision = async (decision: 'want_chat' | 'pass', reason?: string) => {
    setDeciding(true);
    const result = await submitDecision(explorationId, decision, reason);
    if (result.success && result.data) {
      if (result.data.dm_session_id && onChatReady) {
        onChatReady(result.data.dm_session_id);
      }
      await loadExploration();
    }
    setDeciding(false);
    setShowPassDialog(false);
  };

  const handleRespond = async (action: 'accept' | 'reject', reason?: string) => {
    setDeciding(true);
    const result = await respondToExploration(explorationId, action, reason);
    if (result.success && result.data) {
      if (result.data.dm_session_id && onChatReady) {
        onChatReady(result.data.dm_session_id);
      }
      await loadExploration();
    }
    setDeciding(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
        <p>Exploration not found</p>
        <Button variant="ghost" onClick={onBack} className="mt-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>
    );
  }

  const { exploration, messages } = data;
  const score = exploration.match_score ?? 0;
  const scorePercent = Math.round(score * 100);
  const scoreColor = score >= 0.7 ? 'text-green-500' : score >= 0.4 ? 'text-yellow-500' : 'text-muted-foreground';

  // Decision state
  const isPending = exploration.my_decision === 'pending';
  const isRecipient = exploration.chat_requested_by && exploration.my_decision === 'pending';
  const isChatReady = exploration.dm_request_id && (
    exploration.other_decision === 'accept' || exploration.other_decision === 'want_chat'
  ) && exploration.my_decision !== 'pass';

  return (
    <div className="max-w-2xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">{t('networking.explorations')}</h2>
          <p className="text-sm text-muted-foreground">
            {exploration.total_rounds} {t('networking.round').replace('{n}', '')} rounds
          </p>
        </div>
        <div className={cn('text-2xl font-bold tabular-nums', scoreColor)}>
          {scorePercent}%
        </div>
      </div>

      {/* Match Score Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm mb-1">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Scale className="h-3.5 w-3.5" />
            <span>{t('networking.matchScore')}</span>
          </div>
          <span className={cn('font-medium', scoreColor)}>{scorePercent}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              score >= 0.7 ? 'bg-gradient-to-r from-green-400 to-green-500' :
              score >= 0.4 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' :
              'bg-muted-foreground/40'
            )}
            style={{ width: `${scorePercent}%` }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground/70 mt-1.5 flex items-center gap-1">
          <Info className="h-3 w-3" />
          {t('networking.refereeHint') || '由平台裁判基于对话内容中立评分 · 双方看到相同分数'}
        </p>
      </div>

      {/* Status Banners */}
      {exploration.status === 'timed_out' && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-2.5">
          <Timer className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-destructive">{t('networking.timedOut')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('networking.timedOutHint') || '对话因 48 小时内无活动被自动关闭。可重新发起 DM 请求。'}
            </p>
          </div>
        </div>
      )}

      {exploration.status === 'in_progress' && (
        <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-2.5">
          <Loader2 className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0 animate-spin" />
          <div>
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">{t('networking.inProgress')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('networking.inProgressHint') || `双方 Agent 正在对话中 (${exploration.total_rounds}/${exploration.max_rounds ?? 10} 轮)，完成后将自动生成裁判评估。`}
            </p>
          </div>
        </div>
      )}

      {/* Highlights */}
      {exploration.match_highlights && exploration.match_highlights.length > 0 && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{t('networking.highlights')}</span>
            </div>
            <div className="space-y-2">
              {exploration.match_highlights.map((h, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <Star className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                  <span>{h}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Other Party Info */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{t('networking.otherParty')}</span>
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {exploration.other_party.roles?.map(role => (
                <Badge key={role} variant="secondary">
                  {t(`networking.roleLabels.${role}`) || role}
                </Badge>
              ))}
            </div>
            {exploration.other_party.industry && (
              <p className="text-sm text-muted-foreground">
                Industry: {exploration.other_party.industry}
              </p>
            )}
            {exploration.other_party.looking_for && (
              <p className="text-sm">
                <span className="text-muted-foreground">Looking for: </span>
                {exploration.other_party.looking_for}
              </p>
            )}
            {exploration.other_party.can_offer && (
              <p className="text-sm">
                <span className="text-muted-foreground">Can offer: </span>
                {exploration.other_party.can_offer}
              </p>
            )}
            {exploration.other_party.tags && exploration.other_party.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {exploration.other_party.tags.map(tag => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* AI Summary (by platform referee) */}
      {exploration.summary ? (
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{t('networking.aiSummary')}</span>
              </div>
              <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                <Scale className="h-3 w-3" />
                {t('networking.refereeBadge') || '裁判评估'}
              </span>
            </div>
            <p className="text-sm leading-relaxed">{exploration.summary}</p>
            {exploration.collaboration_potential && (
              <div className="mt-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
                <p className="text-xs font-medium text-primary mb-1">
                  {t('networking.collaborationPotential')}
                </p>
                <p className="text-sm">{exploration.collaboration_potential}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : exploration.status === 'completed' && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">
                {t('networking.refereeUnavailable') || '裁判评估生成中或暂时不可用，请稍后刷新查看。'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Conversation (collapsible) */}
      {messages.length > 0 && (
        <Card className="mb-6">
          <button
            onClick={() => setShowConversation(!showConversation)}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                {showConversation ? t('networking.hideConversation') : t('networking.showConversation')}
              </span>
              <Badge variant="secondary" className="text-xs">
                {messages.length} msgs
              </Badge>
            </div>
            {showConversation ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {showConversation && (
            <CardContent className="px-4 pb-4 pt-0 border-t">
              <div className="space-y-3 mt-3">
                {messages.map((msg, idx) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex gap-2',
                      msg.is_mine ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm',
                        msg.is_mine
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-muted rounded-bl-md'
                      )}
                    >
                      <p className="text-[10px] font-medium opacity-70 mb-1">
                        {msg.is_mine ? t('networking.mySide') : t('networking.theirSide')}
                        {' - '}
                        {t('networking.round').replace('{n}', String(msg.round))}
                      </p>
                      <p className="leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Public Toggle + Share (only when completed) */}
      {exploration.status === 'completed' && (
        <div className="flex items-center justify-between px-1 pb-2">
          <button
            onClick={async () => {
              setTogglingPublic(true);
              const next = !isPublic;
              const result = await setExplorationPublic(explorationId, next);
              if (result.success) {
                setIsPublic(next);
                toast.success(next ? '对战已公开，可分享给任何人' : '对战已设为私密');
              }
              setTogglingPublic(false);
            }}
            disabled={togglingPublic}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {isPublic ? <Globe className="h-3.5 w-3.5 text-green-500" /> : <Lock className="h-3.5 w-3.5" />}
            {isPublic ? '已公开' : '设为公开'}
          </button>
          {isPublic && (
            <button
              onClick={() => {
                const url = `${window.location.origin}/watch/battle/${explorationId}`;
                if (navigator.share) {
                  navigator.share({ title: 'AI 对战 - MoltChat', url });
                } else {
                  navigator.clipboard.writeText(url);
                  toast.success('链接已复制');
                }
              }}
              className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              <Share2 className="h-3.5 w-3.5" />
              分享对战
            </button>
          )}
        </div>
      )}

      {/* Decision Panel (sticky bottom) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-lg border-t border-border/50 z-20">
        <div className="max-w-2xl mx-auto">
          {exploration.status === 'timed_out' ? (
            <div className="text-center text-sm text-muted-foreground py-2">
              {t('networking.timedOutDecision') || '此对话已超时关闭'}
            </div>
          ) : exploration.status === 'in_progress' ? (
            <div className="text-center py-2">
              <Badge variant="outline" className="gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t('networking.waitingForCompletion') || '等待对话完成...'}
              </Badge>
            </div>
          ) : isChatReady ? (
            <Button
              onClick={() => {
                // Navigate to DM chat
                if (onChatReady && exploration.dm_request_id) {
                  onChatReady(exploration.dm_request_id);
                }
              }}
              className="w-full rounded-xl h-12 text-base gap-2 bg-green-600 hover:bg-green-700"
            >
              <MessageSquare className="h-5 w-5" />
              {t('networking.openChat')}
            </Button>
          ) : exploration.my_decision === 'want_chat' ? (
            <div className="text-center py-2">
              <Badge variant="warning" className="gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t('networking.requestSentHint')}
              </Badge>
            </div>
          ) : isRecipient ? (
            // 被请求方：接受 / 拒绝
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => handleRespond('reject')}
                disabled={deciding}
                className="flex-1 rounded-xl h-12"
              >
                <X className="h-4 w-4 mr-1" />
                {t('networking.reject')}
              </Button>
              <Button
                onClick={() => handleRespond('accept')}
                disabled={deciding}
                className="flex-1 rounded-xl h-12 bg-green-600 hover:bg-green-700"
              >
                {deciding ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    {t('networking.accept')}
                  </>
                )}
              </Button>
            </div>
          ) : isPending ? (
            // 主动方：想聊 / 跳过
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowPassDialog(true)}
                disabled={deciding}
                className="flex-1 rounded-xl h-12"
              >
                <X className="h-4 w-4 mr-1" />
                {t('networking.pass')}
              </Button>
              <Button
                onClick={() => handleDecision('want_chat')}
                disabled={deciding}
                className="flex-1 rounded-xl h-12"
              >
                {deciding ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1" />
                    {t('networking.wantChat')}
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="text-center text-sm text-muted-foreground py-2">
              {exploration.my_decision === 'pass' ? t('networking.passed') : null}
            </div>
          )}
        </div>
      </div>

      {/* Pass Reason Dialog */}
      <Dialog open={showPassDialog} onOpenChange={setShowPassDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('networking.passReasonTitle')}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={passReason}
            onChange={e => setPassReason(e.target.value)}
            placeholder="Optional..."
            className="resize-none rounded-xl"
            maxLength={500}
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPassDialog(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={() => handleDecision('pass', passReason || undefined)}
              disabled={deciding}
              className="rounded-xl"
            >
              {deciding ? <Loader2 className="h-4 w-4 animate-spin" /> : t('networking.pass')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
