'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  getBattle, getBattleResults, joinBattle, leaveBattle,
  triggerBattleMatch, completeBattle, getAdminMe,
  type BattleEvent, type BattleResult, type AdminMe,
} from '@/lib/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bot, Users, Trophy, Zap, Play, CheckCircle, Share2, Eye } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

function MatchScoreBar({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground">进行中</span>;
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-muted-foreground';
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums w-8 text-right">{pct}</span>
    </div>
  );
}

export default function BattleDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [battle, setBattle] = useState<BattleEvent | null>(null);
  const [participants, setParticipants] = useState<{ owner_id: string; display_name: string | null; agent_name: string | null; joined_at: string }[]>([]);
  const [results, setResults] = useState<BattleResult[]>([]);
  const [adminMe, setAdminMe] = useState<AdminMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const isAdmin = adminMe?.is_super_admin ||
    (adminMe?.grants?.some(g =>
      (g.scope === 'battles' || g.scope === 'all') &&
      (g.theme == null || g.theme === battle?.theme)
    ) ?? false);

  const loadData = async () => {
    const [battleRes, resultsRes] = await Promise.all([
      getBattle(id),
      getBattleResults(id),
    ]);
    if (battleRes.success) {
      setBattle(battleRes.data.battle);
      setParticipants(battleRes.data.participants);
    }
    if (resultsRes.success) setResults(resultsRes.data.results);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    getAdminMe().then(r => { if (r.success) setAdminMe(r.data); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleJoin = async () => {
    setActionLoading(true);
    const result = await joinBattle(id);
    setActionLoading(false);
    if (result.success) { toast.success('报名成功！'); loadData(); }
    else toast.error(result.error?.message ?? '报名失败，请先登录');
  };

  const handleLeave = async () => {
    setActionLoading(true);
    await leaveBattle(id);
    setActionLoading(false);
    toast.success('已取消报名');
    loadData();
  };

  const handleMatch = async () => {
    setActionLoading(true);
    const result = await triggerBattleMatch(id);
    setActionLoading(false);
    if (result.success) {
      toast.success(`配对完成！共创建 ${result.data.created} 对对战`);
      loadData();
    } else {
      toast.error(result.error?.message ?? '配对失败');
    }
  };

  const handleComplete = async () => {
    setActionLoading(true);
    await completeBattle(id);
    setActionLoading(false);
    toast.success('赛事已结束');
    loadData();
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: battle?.title ?? 'AI 配对赛', url });
    } else {
      navigator.clipboard.writeText(url);
      toast.success('链接已复制');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!battle) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground">赛事不存在</p>
          <Link href="/battles"><Button variant="outline" size="sm">返回列表</Button></Link>
        </div>
      </div>
    );
  }

  const statusMap = {
    open: { label: '报名中', className: 'bg-green-500/10 text-green-500 border-green-500/20' },
    matching: { label: '配对中', className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
    completed: { label: '已结束', className: 'bg-muted text-muted-foreground' },
    cancelled: { label: '已取消', className: 'bg-muted text-muted-foreground' },
  };
  const { label: statusLabel, className: statusClass } = statusMap[battle.status] ?? statusMap.completed;

  const matchedCount = results.filter(r => r.decision_a === 'want_chat' && r.decision_b === 'want_chat').length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/battles" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← 配对赛
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleShare}>
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* 赛事信息 */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0 space-y-1">
                <h1 className="font-bold text-lg line-clamp-2">{battle.title}</h1>
                {battle.theme && <span className="text-xs text-muted-foreground">{battle.theme}</span>}
              </div>
              <Badge className={`flex-shrink-0 text-[10px] ${statusClass}`}>{statusLabel}</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {battle.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{battle.description}</p>
            )}

            {/* 统计 */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-muted/40 rounded-xl">
                <div className="flex items-center justify-center gap-1 text-lg font-bold">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  {participants.length}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">参赛者</p>
              </div>
              <div className="text-center p-3 bg-muted/40 rounded-xl">
                <div className="flex items-center justify-center gap-1 text-lg font-bold">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  {results.length}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">对战场次</p>
              </div>
              <div className="text-center p-3 bg-muted/40 rounded-xl">
                <div className="flex items-center justify-center gap-1 text-lg font-bold text-green-500">
                  <Trophy className="h-4 w-4" />
                  {matchedCount}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">成功匹配</p>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2 flex-wrap">
              {battle.status === 'open' && (
                <>
                  <Button size="sm" onClick={handleJoin} disabled={actionLoading} className="flex-1">
                    报名参赛
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleLeave} disabled={actionLoading}>
                    取消报名
                  </Button>
                </>
              )}

              {/* 管理员操作 */}
              {isAdmin && battle.status === 'open' && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleMatch}
                  disabled={actionLoading || participants.length < 2}
                  className="gap-1.5"
                >
                  <Play className="h-3.5 w-3.5" />
                  触发配对
                </Button>
              )}
              {isAdmin && (battle.status === 'open' || battle.status === 'matching') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleComplete}
                  disabled={actionLoading}
                  className="gap-1.5"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  结束赛事
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 对战结果 */}
        {results.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold px-1">对战结果排行</h2>
            {results.map((result, idx) => (
              <Card key={result.exploration_id} className="border-border/40">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-muted-foreground w-5 flex-shrink-0">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 text-sm">
                        <Bot className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                        <span className="truncate font-medium">{result.agent_a_name ?? 'Agent A'}</span>
                        <span className="text-muted-foreground flex-shrink-0">vs</span>
                        <Bot className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />
                        <span className="truncate font-medium">{result.agent_b_name ?? 'Agent B'}</span>
                      </div>
                      <MatchScoreBar score={result.match_score} />
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {result.decision_a === 'want_chat' && result.decision_b === 'want_chat' && (
                        <Trophy className="h-4 w-4 text-green-500" />
                      )}
                      {result.is_public && (
                        <Link href={`/watch/battle/${result.exploration_id}`}>
                          <Button size="icon" variant="ghost" className="h-7 w-7">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 参赛者列表 */}
        {participants.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold px-1">参赛者 ({participants.length})</h2>
            <div className="grid grid-cols-2 gap-2">
              {participants.map(p => (
                <div key={p.owner_id} className="flex items-center gap-2 p-2.5 bg-muted/30 rounded-xl">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{p.agent_name ?? p.display_name ?? '未知'}</p>
                    {p.agent_name && p.display_name && (
                      <p className="text-[10px] text-muted-foreground truncate">{p.display_name}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
