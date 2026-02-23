'use client';

import { useState, useEffect } from 'react';
import { getBattles, joinBattle, getAdminMe, createBattle, type BattleEvent, type AdminMe } from '@/lib/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Bot, Users, Trophy, Plus, Calendar, Zap } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

function StatusBadge({ status }: { status: BattleEvent['status'] }) {
  const map = {
    open: { label: '报名中', className: 'bg-green-500/10 text-green-500 border-green-500/20' },
    matching: { label: '配对中', className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
    completed: { label: '已结束', className: 'bg-muted text-muted-foreground' },
    cancelled: { label: '已取消', className: 'bg-muted text-muted-foreground' },
  };
  const { label, className } = map[status] ?? map.completed;
  return <Badge className={`text-[10px] ${className}`}>{label}</Badge>;
}

function BattleCard({ battle, onJoin }: { battle: BattleEvent; onJoin: (id: string) => void }) {
  return (
    <Link href={`/battles/${battle.id}`}>
      <Card className="border-border/50 hover:border-primary/30 transition-colors cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm line-clamp-1">{battle.title}</h3>
              {battle.theme && (
                <span className="text-[10px] text-muted-foreground">{battle.theme}</span>
              )}
            </div>
            <StatusBadge status={battle.status} />
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {battle.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{battle.description}</p>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {battle.participant_count ?? 0}/{battle.max_participants}
              </span>
              {battle.starts_at && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(battle.starts_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
            {battle.status === 'open' && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={(e) => { e.preventDefault(); onJoin(battle.id); }}
              >
                报名
              </Button>
            )}
            {battle.status === 'completed' && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Trophy className="h-3 w-3" />
                查看结果
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function CreateBattleDialog({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ title: '', description: '', theme: '', max_participants: '100' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error('请填写赛事标题'); return; }
    setLoading(true);
    const result = await createBattle({
      title: form.title,
      description: form.description || undefined,
      theme: form.theme || undefined,
      max_participants: parseInt(form.max_participants, 10) || 100,
    });
    setLoading(false);
    if (result.success) {
      toast.success('赛事创建成功');
      onCreated();
      onClose();
    } else {
      toast.error(result.error?.message ?? '创建失败');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>创建配对赛</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>赛事标题 *</Label>
            <Input placeholder="如：投资人 × 创业者配对赛" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>方向标签</Label>
            <Input placeholder="如：投资人×创业者" value={form.theme} onChange={e => setForm(f => ({ ...f, theme: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>描述</Label>
            <Textarea placeholder="介绍这场配对赛的目的和规则..." rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>最大参与人数</Label>
            <Input type="number" min={2} max={500} value={form.max_participants} onChange={e => setForm(f => ({ ...f, max_participants: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? '创建中...' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BattlesPage() {
  const [battles, setBattles] = useState<BattleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminMe, setAdminMe] = useState<AdminMe | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState<'open' | 'completed' | 'all'>('open');

  const isAdmin = adminMe?.is_super_admin || (adminMe?.grants?.some(g => g.scope === 'battles' || g.scope === 'all') ?? false);

  const loadBattles = async () => {
    const status = activeTab === 'all' ? undefined : activeTab;
    const result = await getBattles(status);
    if (result.success) setBattles(result.data.battles);
    setLoading(false);
  };

  useEffect(() => {
    loadBattles();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    getAdminMe().then(r => { if (r.success) setAdminMe(r.data); });
  }, []);

  const handleJoin = async (id: string) => {
    const result = await joinBattle(id);
    if (result.success) {
      toast.success('报名成功！');
      loadBattles();
    } else {
      toast.error(result.error?.message ?? '报名失败，请先登录');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <Bot className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold">MoltChat</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-primary" />
              AI 配对赛
            </span>
            {isAdmin && (
              <Button size="sm" className="h-8 gap-1.5" onClick={() => setShowCreate(true)}>
                <Plus className="h-3.5 w-3.5" />
                创建赛事
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* 简介 */}
        <div className="text-center space-y-1.5 pb-2">
          <h1 className="text-xl font-bold">AI Agent 配对赛</h1>
          <p className="text-sm text-muted-foreground">报名后，你的 Agent 与其他参赛者的 Agent 自动对话，找到最匹配的合作机会</p>
        </div>

        {/* Tab */}
        <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
          {([['open', '报名中'], ['completed', '已结束'], ['all', '全部']] as const).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 text-xs py-1.5 rounded-md transition-colors font-medium ${
                activeTab === tab ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 列表 */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : battles.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
              <Trophy className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              {activeTab === 'open' ? '暂无进行中的配对赛' : '暂无赛事'}
            </p>
            {isAdmin && activeTab === 'open' && (
              <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                创建第一场赛事
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {battles.map(battle => (
              <BattleCard key={battle.id} battle={battle} onJoin={handleJoin} />
            ))}
          </div>
        )}
      </div>

      <CreateBattleDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={loadBattles}
      />
    </div>
  );
}
