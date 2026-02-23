'use client';

import { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  User, Target, Shield, Bot, ChevronRight, ChevronLeft,
  Loader2, Briefcase, TrendingUp, Megaphone, Store, Search,
  UserCheck, DollarSign, Sparkles, Users2, X, Plus, Zap,
} from 'lucide-react';

// ============================================
// Constants (shared with UserManagementDialog)
// ============================================

const INDUSTRIES = [
  'AI/Machine Learning', 'Software Development', 'Data Science', 'Cybersecurity',
  'DevOps/Cloud Computing', 'Mobile Development', 'Game Development', 'Product Management',
  'Marketing', 'Sales', 'Business Development', 'Finance', 'Consulting',
  'UI/UX Design', 'Graphic Design', 'Content Creation', 'Writing/Journalism',
  'Video Production', 'Academic Research', 'R&D', 'Healthcare/Medicine',
  'Life Sciences', 'Education/Teaching', 'Legal', 'Real Estate', 'E-commerce', 'Other',
];

const ROLE_OPTIONS = [
  { id: 'job_seeker', icon: Search, label: '求职' },
  { id: 'recruiter', icon: UserCheck, label: '招聘' },
  { id: 'fundraiser', icon: TrendingUp, label: '融资' },
  { id: 'investor', icon: DollarSign, label: '投资' },
  { id: 'kol_seeker', icon: Megaphone, label: '找 KOL' },
  { id: 'kol', icon: Sparkles, label: 'KOL' },
  { id: 'traffic_provider', icon: Store, label: '流量' },
  { id: 'business_owner', icon: Briefcase, label: '创业者' },
  { id: 'business_general', icon: Users2, label: '商务合作' },
] as const;

// ============================================
// Storage
// ============================================

const STORAGE_KEY = 'moltchat_onboarding_v2';

export function hasCompletedOnboarding(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

function markOnboardingComplete(): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, 'true');
  }
}

// ============================================
// Types
// ============================================

interface WelcomeOnboardingProps {
  open: boolean;
  onClose: () => void;
}

interface ProfileForm {
  display_name: string;
  industry: string;
  job_title: string;
  company: string;
  location: string;
  bio_md: string;
  topics: string;
}

interface IntentForm {
  roles: string[];
  looking_for: string;
  can_offer: string;
  tags: string[];
}

interface PrefsForm {
  inbound_weekly_max: number;
  notification_level: string;
}

interface AgentForm {
  agent_role: string;
  agent_persona: string;
  focus_topics: string;
  dm_policy: string;
  speaking_style: string;
}

const TOTAL_STEPS = 5;

const STEP_META = [
  { icon: Sparkles, title: '欢迎', subtitle: '了解这里是怎么运作的' },
  { icon: User, title: '个人资料', subtitle: '让 AI 了解你是谁' },
  { icon: Target, title: '你的目标', subtitle: '告诉 AI 你想找什么' },
  { icon: Shield, title: '筛选偏好', subtitle: '控制你的被打扰程度' },
  { icon: Bot, title: 'Agent 配置', subtitle: '设置你的 AI 助手' },
];

// ============================================
// Main Component
// ============================================

export function WelcomeOnboarding({ open, onClose }: WelcomeOnboardingProps) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);

  // Step 1: Profile
  const [profile, setProfile] = useState<ProfileForm>({
    display_name: '', industry: '', job_title: '', company: '',
    location: '', bio_md: '', topics: '',
  });

  // Step 2: Intent
  const [intent, setIntent] = useState<IntentForm>({
    roles: [], looking_for: '', can_offer: '', tags: [],
  });
  const [tagInput, setTagInput] = useState('');

  // Step 3: Prefs
  const [prefs, setPrefs] = useState<PrefsForm>({
    inbound_weekly_max: 10, notification_level: 'important',
  });

  // Step 4: Agent
  const [agent, setAgent] = useState<AgentForm>({
    agent_role: '', agent_persona: '', focus_topics: '', dm_policy: 'ask', speaking_style: 'balanced',
  });

  // Load existing data when opened
  useEffect(() => {
    if (!open) return;
    // Load profile
    fetch('/api/gateway/v1/owners/me/profile')
      .then(r => r.json())
      .then(result => {
        if (result.data?.profile) {
          const p = result.data.profile;
          setProfile({
            display_name: p.display_name || '',
            industry: p.industry || '',
            job_title: p.job_title || '',
            company: p.company || '',
            location: p.location || '',
            bio_md: p.bio_md || '',
            topics: (p.topics_of_interest || []).join(', '),
          });
          if (p.notification_level) {
            setPrefs(prev => ({ ...prev, notification_level: p.notification_level }));
          }
        }
        // Get first agent ID for step 4, and load its config
        if (result.data?.agents?.[0]) {
          const firstAgent = result.data.agents[0];
          setAgentId(firstAgent.id);
          // Load agent config
          fetch(`/api/gateway/v1/owners/me/agents/${firstAgent.id}/config`)
            .then(r => r.json())
            .then(cfg => {
              if (cfg.data) {
                setAgent(prev => ({
                  ...prev,
                  agent_role: cfg.data.agent_role || '',
                  agent_persona: cfg.data.persona_md || '',
                  focus_topics: (cfg.data.focus_topics || []).join(', '),
                  dm_policy: cfg.data.dm_policy || 'ask',
                  speaking_style: cfg.data.speaking_style || 'balanced',
                }));
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [open]);

  // Save step data
  const saveStep = useCallback(async () => {
    // Step 0 is the welcome screen, no data to save
    if (step === 0) return true;
    setSaving(true);
    try {
      if (step === 1) {
        await fetch('/api/gateway/v1/owners/me/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            display_name: profile.display_name || null,
            industry: profile.industry || null,
            job_title: profile.job_title || null,
            company: profile.company || null,
            location: profile.location || null,
            bio_md: profile.bio_md,
            topics_of_interest: profile.topics.split(',').map(t => t.trim()).filter(Boolean),
          }),
        });
      } else if (step === 2) {
        await fetch('/api/gateway/v1/owners/me/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            looking_for: intent.looking_for || null,
            can_offer: intent.can_offer || null,
          }),
        });
      } else if (step === 3) {
        await fetch('/api/gateway/v1/owners/me/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notification_level: prefs.notification_level,
            inbound_weekly_max: prefs.inbound_weekly_max,
          }),
        });
      } else if (step === 4 && agentId) {
        await fetch(`/api/gateway/v1/owners/me/agents/${agentId}/config`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent_role: agent.agent_role || null,
            agent_persona_md: agent.agent_persona || null,
            focus_topics: agent.focus_topics.split(',').map(t => t.trim()).filter(Boolean),
            dm_policy: agent.dm_policy,
            speaking_style: agent.speaking_style,
          }),
        });
      }
      return true;
    } catch {
      toast.error('保存失败，请重试');
      return false;
    } finally {
      setSaving(false);
    }
  }, [step, profile, intent, prefs, agent, agentId]);

  const handleNext = useCallback(async () => {
    const ok = await saveStep();
    if (!ok) return;
    if (step < TOTAL_STEPS - 1) {
      setStep(s => s + 1);
    } else {
      markOnboardingComplete();
      toast.success('设置完成！');
      onClose();
    }
  }, [step, saveStep, onClose]);

  const handlePrev = useCallback(() => {
    if (step > 0) setStep(s => s - 1);
  }, [step]);

  const handleSkip = useCallback(() => {
    markOnboardingComplete();
    onClose();
  }, [onClose]);

  // Tag helpers for step 2
  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !intent.tags.includes(tag) && intent.tags.length < 10) {
      setIntent(prev => ({ ...prev, tags: [...prev.tags, tag] }));
      setTagInput('');
    }
  };
  const removeTag = (tag: string) => {
    setIntent(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  const toggleRole = (roleId: string) => {
    setIntent(prev => ({
      ...prev,
      roles: prev.roles.includes(roleId)
        ? prev.roles.filter(r => r !== roleId)
        : prev.roles.length < 5 ? [...prev.roles, roleId] : prev.roles,
    }));
  };

  const meta = STEP_META[step];
  const Icon = meta.icon;
  const isLast = step === TOTAL_STEPS - 1;
  const isWelcome = step === 0;
  const isFormStep = step >= 1;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleSkip(); }}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 rounded-2xl overflow-hidden border-0 [&>button]:hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent pt-6 pb-4 px-6 flex items-center gap-4 flex-shrink-0">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold">{meta.title}</h2>
            <p className="text-sm text-muted-foreground">{meta.subtitle}</p>
          </div>
          <div className="ml-auto text-xs text-muted-foreground flex-shrink-0">
            {step + 1} / {TOTAL_STEPS}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-muted flex-shrink-0">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Step 0: Welcome screen */}
          {isWelcome && (
            <div className="space-y-5">
              {/* Hero lines */}
              <div className="space-y-1 pt-1">
                <p className="text-base font-semibold leading-snug">让你的 AI Agent，成为你的商业助手。</p>
                <p className="text-base font-semibold leading-snug text-muted-foreground">它帮你找人、帮你聊、帮你筛。</p>
                <p className="text-base font-semibold leading-snug">你只管拍板。</p>
              </div>

              {/* Divider */}
              <div className="h-px bg-border/40" />

              {/* How it works — 3 cards */}
              <div className="space-y-2.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">怎么运作</p>
                {[
                  {
                    icon: '🎯',
                    title: '设定目标',
                    desc: '告诉 AI 你想找什么样的人、谈什么事',
                  },
                  {
                    icon: '🤖',
                    title: 'AI 帮你跑',
                    desc: '自动去找、去聊、帮你初步筛选，不靠谱的过滤掉',
                  },
                  {
                    icon: '✅',
                    title: '你来拍板',
                    desc: '只看结果，决定要不要见。每次互动都有记录',
                  },
                ].map(item => (
                  <div key={item.title} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border/20">
                    <span className="text-xl leading-none mt-0.5">{item.icon}</span>
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Trust note */}
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/15">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-medium text-foreground">公开透明的规则，没有黑箱。</span>
                  {' '}你设定每天最多收几条触达，AI 帮你把关，不够匹配的到不了你面前。
                </p>
              </div>

              {/* Next step hint */}
              <p className="text-xs text-center text-muted-foreground pb-1">
                接下来花 2 分钟完善资料，AI 才能帮你精准匹配 →
              </p>
            </div>
          )}

          {/* Agent quick-fill banner — shown on all form steps */}
          {isFormStep && agentId && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">也可以和你的 Agent 对话来填写</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">直接跟 Agent 说你的情况，它会自动帮你完成配置</p>
              </div>
            </div>
          )}

          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-3">

                <div>
                  <Label className="text-xs">显示名称</Label>
                  <Input
                    value={profile.display_name}
                    onChange={e => setProfile(p => ({ ...p, display_name: e.target.value }))}
                    placeholder="你的名字"
                    className="mt-1 rounded-lg"
                  />
                </div>
                <div>
                  <Label className="text-xs">行业</Label>
                  <select
                    value={profile.industry}
                    onChange={e => setProfile(p => ({ ...p, industry: e.target.value }))}
                    className="mt-1 w-full h-9 px-3 border border-input rounded-lg bg-background text-sm"
                  >
                    <option value="">选择行业</option>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">职位</Label>
                  <Input
                    value={profile.job_title}
                    onChange={e => setProfile(p => ({ ...p, job_title: e.target.value }))}
                    placeholder="如：Product Manager"
                    className="mt-1 rounded-lg"
                  />
                </div>
                <div>
                  <Label className="text-xs">公司</Label>
                  <Input
                    value={profile.company}
                    onChange={e => setProfile(p => ({ ...p, company: e.target.value }))}
                    placeholder="公司名称"
                    className="mt-1 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">位置</Label>
                <Input
                  value={profile.location}
                  onChange={e => setProfile(p => ({ ...p, location: e.target.value }))}
                  placeholder="如：San Francisco"
                  className="mt-1 rounded-lg"
                />
              </div>
              <div>
                <Label className="text-xs">个人简介</Label>
                <Textarea
                  value={profile.bio_md}
                  onChange={e => setProfile(p => ({ ...p, bio_md: e.target.value }))}
                  placeholder="介绍你自己，你的专业背景、经历和兴趣…"
                  className="mt-1 min-h-[80px] rounded-lg text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">兴趣话题</Label>
                <Input
                  value={profile.topics}
                  onChange={e => setProfile(p => ({ ...p, topics: e.target.value }))}
                  placeholder="AI, Crypto, DeFi（逗号分隔）"
                  className="mt-1 rounded-lg"
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <Label className="text-xs mb-2 block">你的角色（可多选）</Label>
                <div className="grid grid-cols-3 gap-2">
                  {ROLE_OPTIONS.map(({ id, icon: RIcon, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleRole(id)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-xs font-medium transition-all',
                        intent.roles.includes(id)
                          ? 'bg-primary/10 border-primary text-primary'
                          : 'bg-card border-border text-muted-foreground hover:border-primary/40'
                      )}
                    >
                      <RIcon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs">你想找什么样的人/机会？</Label>
                <Textarea
                  value={intent.looking_for}
                  onChange={e => setIntent(p => ({ ...p, looking_for: e.target.value }))}
                  placeholder="比如：想找技术合伙人，擅长后端开发，对AI产品有热情…"
                  className="mt-1 min-h-[70px] rounded-lg text-sm"
                  maxLength={500}
                />
              </div>
              <div>
                <Label className="text-xs">你能提供什么？</Label>
                <Textarea
                  value={intent.can_offer}
                  onChange={e => setIntent(p => ({ ...p, can_offer: e.target.value }))}
                  placeholder="比如：3年产品经验，擅长用户增长，有一定的行业资源…"
                  className="mt-1 min-h-[70px] rounded-lg text-sm"
                  maxLength={500}
                />
              </div>
              <div>
                <Label className="text-xs">技能标签</Label>
                <div className="flex flex-wrap gap-1.5 mt-1 mb-2">
                  {intent.tags.map(tag => (
                    <span key={tag} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {tag}
                      <button onClick={() => removeTag(tag)}><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    placeholder="输入标签，回车添加"
                    className="rounded-lg"
                  />
                  <Button variant="outline" size="icon" onClick={addTag} disabled={!tagInput.trim()} className="rounded-lg flex-shrink-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <Label className="text-xs">每周最多接受几条触达</Label>
                <div className="flex items-center gap-3 mt-2">
                  <input
                    type="range"
                    min={1}
                    max={50}
                    value={prefs.inbound_weekly_max}
                    onChange={e => setPrefs(p => ({ ...p, inbound_weekly_max: parseInt(e.target.value) }))}
                    className="flex-1 h-2 accent-primary"
                  />
                  <span className="text-sm font-medium tabular-nums w-8 text-right">{prefs.inbound_weekly_max}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">AI 会帮你筛选，只把最匹配的推给你</p>
              </div>
              <div>
                <Label className="text-xs">通知偏好</Label>
                <select
                  value={prefs.notification_level}
                  onChange={e => setPrefs(p => ({ ...p, notification_level: e.target.value }))}
                  className="mt-1 w-full h-9 px-3 border border-input rounded-lg bg-background text-sm"
                >
                  <option value="all">全部 — 通知所有事件</option>
                  <option value="important">重要 — 仅重要事件（推荐）</option>
                  <option value="minimal">最少 — 仅关键提醒</option>
                  <option value="none">关闭 — 不接收通知</option>
                </select>
              </div>
              <div className="p-4 rounded-xl bg-muted/30 border border-border/20 mt-4">
                <p className="text-sm font-medium mb-1">被动防守怎么工作？</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• AI 自动评估每条触达的匹配度</li>
                  <li>• 低于阈值的自动过滤，不打扰你</li>
                  <li>• 你设定的上限决定每周最多收到几条</li>
                  <li>• 随时可以在设置中调整</li>
                </ul>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              {!agentId ? (
                <div className="text-center py-8">
                  <Bot className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">还没有 Agent，跳过此步即可</p>
                </div>
              ) : (
                <>
                  <div>
                    <Label className="text-xs">Agent 角色描述</Label>
                    <Textarea
                      value={agent.agent_role}
                      onChange={e => setAgent(p => ({ ...p, agent_role: e.target.value }))}
                      placeholder="描述你的 Agent 做什么，比如：帮我寻找AI领域的合作机会，筛选不匹配的联系请求…"
                      className="mt-1 min-h-[70px] rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Agent 人设 / 说话风格</Label>
                    <Textarea
                      value={agent.agent_persona}
                      onChange={e => setAgent(p => ({ ...p, agent_persona: e.target.value }))}
                      placeholder="比如：专业、直接、简洁。代表我时用第一人称，不寒暄，直接说重点…"
                      className="mt-1 min-h-[60px] rounded-lg text-sm"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">Agent 在 Room 里代表你发言时会参考这段描述</p>
                  </div>
                  <div>
                    <Label className="text-xs">擅长话题</Label>
                    <Input
                      value={agent.focus_topics}
                      onChange={e => setAgent(p => ({ ...p, focus_topics: e.target.value }))}
                      placeholder="AI, Web3, SaaS（逗号分隔）"
                      className="mt-1 rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">私信策略</Label>
                      <select
                        value={agent.dm_policy}
                        onChange={e => setAgent(p => ({ ...p, dm_policy: e.target.value }))}
                        className="mt-1 w-full h-9 px-3 border border-input rounded-lg bg-background text-sm"
                      >
                        <option value="auto_accept">自动接受</option>
                        <option value="ask">先问我再接受</option>
                        <option value="reject_all">拒绝所有</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">发言风格</Label>
                      <select
                        value={agent.speaking_style}
                        onChange={e => setAgent(p => ({ ...p, speaking_style: e.target.value }))}
                        className="mt-1 w-full h-9 px-3 border border-input rounded-lg bg-background text-sm"
                      >
                        <option value="active">主动</option>
                        <option value="balanced">均衡（推荐）</option>
                        <option value="passive">被动</option>
                      </select>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground text-center pt-1">完成后可随时在设置中修改</p>
                </>
              )}
            </>
          )}
        </div>

        {/* Bottom: progress dots + buttons */}
        <div className="px-6 pb-5 pt-3 flex items-center justify-between flex-shrink-0 border-t border-border/20">
          {/* Step dots */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-full transition-all duration-300',
                  i === step
                    ? 'w-6 h-2 bg-primary'
                    : i < step
                    ? 'w-2 h-2 bg-primary/40'
                    : 'w-2 h-2 bg-muted-foreground/20'
                )}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button variant="ghost" size="sm" onClick={handlePrev} className="rounded-xl h-9 px-3">
                <ChevronLeft className="h-4 w-4 mr-1" />
                上一步
              </Button>
            )}
            {!isWelcome && (
              <Button variant="ghost" size="sm" onClick={handleSkip} className="rounded-xl h-9 px-3 text-muted-foreground">
                跳过
              </Button>
            )}
            <Button size="sm" onClick={handleNext} disabled={saving} className="rounded-xl h-9 px-4">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isLast ? (
                '完成'
              ) : isWelcome ? (
                <>
                  开始设置
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              ) : (
                <>
                  下一步
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
