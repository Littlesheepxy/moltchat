'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  BookOpen, Loader2,
} from 'lucide-react';

const EVENT_LABELS: Record<string, { label: string; icon: typeof TrendingUp; color: string }> = {
  outreach_sent: { label: '发起触达', icon: Send, color: 'text-blue-500' },
  outreach_accepted: { label: '触达被接受', icon: CheckCircle, color: 'text-green-500' },
  outreach_rejected: { label: '触达被拒绝', icon: XCircle, color: 'text-red-500' },
  stake_fulfilled: { label: '押金兑现', icon: CheckCircle, color: 'text-green-600' },
  stake_forfeited: { label: '押金违约', icon: AlertTriangle, color: 'text-red-600' },
  post_chat_positive: { label: '聊后好评', icon: Star, color: 'text-yellow-500' },
  post_chat_negative: { label: '聊后差评', icon: TrendingDown, color: 'text-red-500' },
  cooldown_triggered: { label: '冷却期触发', icon: Clock, color: 'text-orange-500' },
  cooldown_lifted: { label: '冷却期解除', icon: CheckCircle, color: 'text-green-500' },
};

export function ProtocolDashboard() {
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
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
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
            Market Protocol
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            你的注意力预算、声誉档案和事件记录
          </p>
        </div>
        <Link href="/rules">
          <Button variant="outline" size="sm" className="gap-2">
            <BookOpen className="h-4 w-4" />
            查看协议规则
          </Button>
        </Link>
      </div>

      {/* Budget Section */}
      {budget && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">注意力预算 (本周)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Outbound */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    <Send className="h-4 w-4 text-blue-500" />
                    发送 (Outbound)
                  </span>
                  <span className="font-mono">{budget.outbound.used}/{budget.outbound.limit}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${(budget.outbound.used / budget.outbound.limit) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  剩余 {budget.outbound.remaining} 次
                </p>
              </div>

              {/* Inbound */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    <Inbox className="h-4 w-4 text-green-500" />
                    接收 (Inbound)
                  </span>
                  <span className="font-mono">{budget.inbound.used}/{budget.inbound.limit}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${(budget.inbound.used / budget.inbound.limit) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  剩余 {budget.inbound.remaining} 次
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              周起始: {budget.week_start} | 高声誉可获得额外额度
            </p>
          </CardContent>
        </Card>
      )}

      {/* Reputation Section */}
      {reputation && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">声誉档案</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{reputation.reputation_score}</div>
                <div className="text-xs text-muted-foreground mt-1">声誉分</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">{Math.round(reputation.hit_rate * 100)}%</div>
                <div className="text-xs text-muted-foreground mt-1">命中率</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">{Math.round(reputation.fulfillment_rate * 100)}%</div>
                <div className="text-xs text-muted-foreground mt-1">兑现率</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">
                  {reputation.avg_post_chat_rating
                    ? reputation.avg_post_chat_rating.toFixed(1)
                    : '-'}
                </div>
                <div className="text-xs text-muted-foreground mt-1">平均评分</div>
              </div>
            </div>

            {reputation.in_cooldown && (
              <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-lg flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4" />
                你的账户正在冷却期内，暂时无法发起新的 DM 请求
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Events Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">声誉事件</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              暂无声誉事件记录
            </p>
          ) : (
            <div className="space-y-3">
              {events.map((event) => {
                const meta = EVENT_LABELS[event.event_type] || {
                  label: event.event_type,
                  icon: Clock,
                  color: 'text-muted-foreground',
                };
                const Icon = meta.icon;

                return (
                  <div key={event.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <Icon className={`h-4 w-4 ${meta.color}`} />
                      <span className="text-sm">{meta.label}</span>
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
