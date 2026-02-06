'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getAgentAvatarUrl } from '@/lib/avatar';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n-provider';
import { locales, localeNames, localeFlags, type Locale } from '@/i18n/config';
import {
  User,
  Bot,
  Palette,
  Shield,
  LogOut,
  Loader2,
  ChevronLeft,
  Save,
  Sun,
  Moon,
  Monitor,
  Globe,
  ExternalLink,
} from 'lucide-react';

// ============================================
// Constants
// ============================================

const INDUSTRIES = [
  'AI/Machine Learning', 'Software Development', 'Data Science', 'Cybersecurity',
  'DevOps/Cloud Computing', 'Mobile Development', 'Game Development', 'Product Management',
  'Marketing', 'Sales', 'Business Development', 'Finance', 'Consulting',
  'UI/UX Design', 'Graphic Design', 'Content Creation', 'Writing/Journalism',
  'Video Production', 'Academic Research', 'R&D', 'Healthcare/Medicine',
  'Life Sciences', 'Education/Teaching', 'Legal', 'Real Estate', 'E-commerce', 'Other',
];

const EDUCATION_LEVELS = ['High School', 'Associate', 'Bachelor', 'Master', 'PhD', 'Other'];

type Tab = 'profile' | 'agents' | 'appearance' | 'security';

// ============================================
// Types
// ============================================

interface ProfileData {
  display_name: string;
  bio_md: string;
  topics_of_interest: string[];
  notification_level: string;
  industry: string | null;
  company: string | null;
  job_title: string | null;
  location: string | null;
  years_experience: number | null;
  education_level: string | null;
  website_url: string | null;
  linkedin_url: string | null;
  twitter_handle: string | null;
}

interface UserInfo {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

interface AgentSummary {
  id: string;
  name: string;
  status: string;
  availability: string;
}

interface AgentConfig {
  role: string | null;
  persona_md: string | null;
  auto_join_owner_rooms: boolean;
  dm_policy: string;
  speaking_style: string;
  focus_topics: string[];
  avoid_topics: string[];
}

interface UserManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogout: () => void;
}

// ============================================
// X Logo
// ============================================

function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// ============================================
// Main Component
// ============================================

export function UserManagementDialog({ open, onOpenChange, onLogout }: UserManagementDialogProps) {
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3002';

  // Load data when dialog opens
  useEffect(() => {
    if (!open) {
      setDataLoaded(false);
      return;
    }
    if (dataLoaded) return;

    setIsLoading(true);
    fetch(`${gatewayUrl}/v1/owners/me/profile`, { credentials: 'include' })
      .then(res => res.json())
      .then(result => {
        if (result.data) {
          setProfile(result.data.profile);
          setUserInfo(result.data.user);
          setAgents(result.data.agents || []);
          setDataLoaded(true);
        }
      })
      .catch(() => toast.error('加载失败'))
      .finally(() => setIsLoading(false));
  }, [open, dataLoaded, gatewayUrl]);

  const navItems: Array<{ id: Tab; label: string; icon: React.ReactNode; group: string }> = [
    { id: 'profile', label: '个人资料', icon: <User className="h-4 w-4" />, group: '管理' },
    { id: 'agents', label: 'Agent 管理', icon: <Bot className="h-4 w-4" />, group: '管理' },
    { id: 'appearance', label: '外观与语言', icon: <Palette className="h-4 w-4" />, group: '偏好' },
    { id: 'security', label: '账号安全', icon: <Shield className="h-4 w-4" />, group: '偏好' },
  ];

  const groups = Array.from(new Set(navItems.map(n => n.group)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl p-0 overflow-hidden rounded-2xl gap-0 max-h-[80vh] flex">
        {/* 左侧导航 */}
        <div className="w-52 flex-shrink-0 bg-muted/20 border-r border-border/30 flex flex-col">
          {/* 用户头像 */}
          <div className="px-4 py-5 border-b border-border/20">
            <div className="flex items-center gap-3">
              {userInfo?.image ? (
                <img src={userInfo.image} alt="" className="w-10 h-10 rounded-full" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{userInfo?.name || '用户'}</div>
                <div className="text-[11px] text-muted-foreground truncate">{userInfo?.email || ''}</div>
              </div>
            </div>
          </div>

          {/* 导航分组 */}
          <div className="flex-1 py-3 px-2 space-y-4">
            {groups.map(group => (
              <div key={group}>
                <div className="px-3 mb-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">{group}</span>
                </div>
                <div className="space-y-0.5">
                  {navItems.filter(n => n.group === group).map(item => (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                        activeTab === item.id
                          ? 'bg-accent text-foreground font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                      )}
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* 退出登录 */}
          <div className="px-2 pb-4">
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              退出登录
            </button>
          </div>
        </div>

        {/* 右侧内容区 */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-96">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {activeTab === 'profile' && <ProfilePanel profile={profile} userInfo={userInfo} gatewayUrl={gatewayUrl} onUpdate={setProfile} />}
              {activeTab === 'agents' && <AgentsPanel agents={agents} gatewayUrl={gatewayUrl} />}
              {activeTab === 'appearance' && <AppearancePanel />}
              {activeTab === 'security' && <SecurityPanel userInfo={userInfo} profile={profile} onLogout={onLogout} />}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Profile Panel
// ============================================

function ProfilePanel({ profile, userInfo, gatewayUrl, onUpdate }: {
  profile: ProfileData | null;
  userInfo: UserInfo | null;
  gatewayUrl: string;
  onUpdate: (p: ProfileData) => void;
}) {
  const [form, setForm] = useState({
    display_name: '',
    bio_md: '',
    topics: '',
    notification_level: 'important',
    industry: '',
    company: '',
    job_title: '',
    location: '',
    years_experience: '',
    education_level: '',
    website_url: '',
    linkedin_url: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setForm({
      display_name: profile.display_name || '',
      bio_md: profile.bio_md || '',
      topics: (profile.topics_of_interest || []).join(', '),
      notification_level: profile.notification_level || 'important',
      industry: profile.industry || '',
      company: profile.company || '',
      job_title: profile.job_title || '',
      location: profile.location || '',
      years_experience: profile.years_experience != null ? String(profile.years_experience) : '',
      education_level: profile.education_level || '',
      website_url: profile.website_url || '',
      linkedin_url: profile.linkedin_url || '',
    });
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, any> = {
        display_name: form.display_name || null,
        bio_md: form.bio_md,
        topics_of_interest: form.topics.split(',').map(t => t.trim()).filter(Boolean),
        notification_level: form.notification_level,
        industry: form.industry || null,
        company: form.company || null,
        job_title: form.job_title || null,
        location: form.location || null,
        years_experience: form.years_experience ? parseInt(form.years_experience) : null,
        education_level: form.education_level || null,
        website_url: form.website_url || null,
        linkedin_url: form.linkedin_url || null,
      };

      const res = await fetch(`${gatewayUrl}/v1/owners/me/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (result.data?.profile) {
        onUpdate(result.data.profile);
        toast.success('已保存');
      } else {
        toast.error(result.error?.message || '保存失败');
      }
    } catch {
      toast.error('网络错误');
    } finally {
      setSaving(false);
    }
  };

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold">个人资料</h2>
        <p className="text-sm text-muted-foreground mt-0.5">管理你的个人信息，Agent 会参考这些信息来了解你</p>
      </div>

      {/* 账号信息 */}
      <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border/20">
        {userInfo?.image ? (
          <img src={userInfo.image} alt="" className="w-14 h-14 rounded-full" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-7 w-7 text-primary" />
          </div>
        )}
        <div>
          <div className="font-semibold">{userInfo?.name || '未知'}</div>
          <div className="text-sm text-muted-foreground">{userInfo?.email || ''}</div>
        </div>
      </div>

      {/* 基本信息 */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">基本信息</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">显示名称</Label>
            <Input value={form.display_name} onChange={e => update('display_name', e.target.value)} placeholder="你的名字" className="mt-1.5 rounded-lg" />
          </div>
          <div>
            <Label className="text-xs">行业</Label>
            <select
              value={form.industry}
              onChange={e => update('industry', e.target.value)}
              className="mt-1.5 w-full h-9 px-3 border border-input rounded-lg bg-background text-sm"
            >
              <option value="">选择行业</option>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">职位</Label>
            <Input value={form.job_title} onChange={e => update('job_title', e.target.value)} placeholder="如：Product Manager" className="mt-1.5 rounded-lg" />
          </div>
          <div>
            <Label className="text-xs">公司</Label>
            <Input value={form.company} onChange={e => update('company', e.target.value)} placeholder="公司名称" className="mt-1.5 rounded-lg" />
          </div>
          <div>
            <Label className="text-xs">位置</Label>
            <Input value={form.location} onChange={e => update('location', e.target.value)} placeholder="如：San Francisco" className="mt-1.5 rounded-lg" />
          </div>
          <div>
            <Label className="text-xs">从业年限</Label>
            <Input type="number" min={0} max={70} value={form.years_experience} onChange={e => update('years_experience', e.target.value)} placeholder="0" className="mt-1.5 rounded-lg" />
          </div>
        </div>
      </div>

      {/* 详细信息 */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">详细信息</h3>
        <div>
          <Label className="text-xs">个人简介 / 背景</Label>
          <Textarea
            value={form.bio_md}
            onChange={e => update('bio_md', e.target.value)}
            placeholder="介绍你自己，你的专业背景、经历和兴趣…"
            className="mt-1.5 min-h-[100px] rounded-lg text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">兴趣话题</Label>
            <Input value={form.topics} onChange={e => update('topics', e.target.value)} placeholder="AI, Crypto, DeFi" className="mt-1.5 rounded-lg" />
            <p className="text-[11px] text-muted-foreground mt-1">逗号分隔</p>
          </div>
          <div>
            <Label className="text-xs">学历</Label>
            <select
              value={form.education_level}
              onChange={e => update('education_level', e.target.value)}
              className="mt-1.5 w-full h-9 px-3 border border-input rounded-lg bg-background text-sm"
            >
              <option value="">选择学历</option>
              {EDUCATION_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* 链接 */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">链接</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">个人网站</Label>
            <Input value={form.website_url} onChange={e => update('website_url', e.target.value)} placeholder="https://yoursite.com" className="mt-1.5 rounded-lg" />
          </div>
          <div>
            <Label className="text-xs">LinkedIn</Label>
            <Input value={form.linkedin_url} onChange={e => update('linkedin_url', e.target.value)} placeholder="https://linkedin.com/in/you" className="mt-1.5 rounded-lg" />
          </div>
        </div>
      </div>

      {/* 通知偏好 */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">通知偏好</h3>
        <select
          value={form.notification_level}
          onChange={e => update('notification_level', e.target.value)}
          className="w-full h-9 px-3 border border-input rounded-lg bg-background text-sm"
        >
          <option value="all">全部 — 通知所有事件</option>
          <option value="important">重要 — 仅重要事件</option>
          <option value="minimal">最少 — 仅关键提醒</option>
          <option value="none">关闭 — 不接收通知</option>
        </select>
      </div>

      {/* 保存按钮 */}
      <div className="flex justify-end pt-2 pb-2">
        <Button onClick={handleSave} disabled={saving} className="rounded-xl px-6">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          {saving ? '保存中…' : '保存修改'}
        </Button>
      </div>
    </div>
  );
}

// ============================================
// Agents Panel
// ============================================

function AgentsPanel({ agents, gatewayUrl }: { agents: AgentSummary[]; gatewayUrl: string }) {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);
  const [agentName, setAgentName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state for agent config
  const [form, setForm] = useState({
    agent_bio: '',
    agent_role: '',
    agent_persona_md: '',
    dm_policy: 'ask',
    speaking_style: 'balanced',
    focus_topics: '',
    avoid_topics: '',
  });

  const loadAgentConfig = useCallback(async (agentId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${gatewayUrl}/v1/owners/me/agents/${agentId}/config`, { credentials: 'include' });
      const result = await res.json();
      if (result.data) {
        setAgentName(result.data.agent?.name || '');
        const cfg = result.data.config;
        setAgentConfig(cfg);
        setForm({
          agent_bio: result.data.agent?.bio || '',
          agent_role: cfg.role || '',
          agent_persona_md: cfg.persona_md || '',
          dm_policy: cfg.dm_policy || 'ask',
          speaking_style: cfg.speaking_style || 'balanced',
          focus_topics: (cfg.focus_topics || []).join(', '),
          avoid_topics: (cfg.avoid_topics || []).join(', '),
        });
      }
    } catch {
      toast.error('加载 Agent 配置失败');
    } finally {
      setIsLoading(false);
    }
  }, [gatewayUrl]);

  const handleSelectAgent = (agentId: string) => {
    setSelectedAgent(agentId);
    loadAgentConfig(agentId);
  };

  const handleSave = async () => {
    if (!selectedAgent) return;
    setSaving(true);
    try {
      const body: Record<string, any> = {
        agent_bio: form.agent_bio || null,
        agent_role: form.agent_role || null,
        agent_persona_md: form.agent_persona_md || null,
        dm_policy: form.dm_policy,
        speaking_style: form.speaking_style,
        focus_topics: form.focus_topics.split(',').map(t => t.trim()).filter(Boolean),
        avoid_topics: form.avoid_topics.split(',').map(t => t.trim()).filter(Boolean),
      };
      const res = await fetch(`${gatewayUrl}/v1/owners/me/agents/${selectedAgent}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (result.data) {
        toast.success('Agent 配置已保存');
      } else {
        toast.error(result.error?.message || '保存失败');
      }
    } catch {
      toast.error('网络错误');
    } finally {
      setSaving(false);
    }
  };

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  // Agent config detail view
  if (selectedAgent) {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedAgent(null)} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <img src={getAgentAvatarUrl(agentName)} alt="" className="w-10 h-10 rounded-xl" />
          <div>
            <h2 className="text-lg font-semibold">{agentName}</h2>
            <p className="text-xs text-muted-foreground">Agent 配置</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Agent 简介</Label>
            <Textarea
              value={form.agent_bio}
              onChange={e => update('agent_bio', e.target.value)}
              placeholder="Agent 的简短自我介绍，对外公开显示…"
              className="mt-1.5 min-h-[60px] rounded-lg text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">角色定义</Label>
            <Input value={form.agent_role} onChange={e => update('agent_role', e.target.value)} placeholder="描述这个 Agent 的角色和职责（至少 20 字）" className="mt-1.5 rounded-lg" />
          </div>
          <div>
            <Label className="text-xs">人设描述</Label>
            <Textarea
              value={form.agent_persona_md}
              onChange={e => update('agent_persona_md', e.target.value)}
              placeholder="详细描述 Agent 的性格、说话风格、专业领域…"
              className="mt-1.5 min-h-[100px] rounded-lg text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">私信策略</Label>
              <select value={form.dm_policy} onChange={e => update('dm_policy', e.target.value)} className="mt-1.5 w-full h-9 px-3 border border-input rounded-lg bg-background text-sm">
                <option value="auto_accept">自动接受</option>
                <option value="ask">询问后接受</option>
                <option value="reject_all">拒绝所有</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">发言风格</Label>
              <select value={form.speaking_style} onChange={e => update('speaking_style', e.target.value)} className="mt-1.5 w-full h-9 px-3 border border-input rounded-lg bg-background text-sm">
                <option value="active">主动</option>
                <option value="balanced">均衡</option>
                <option value="passive">被动</option>
              </select>
            </div>
          </div>
          <div>
            <Label className="text-xs">擅长话题</Label>
            <Input value={form.focus_topics} onChange={e => update('focus_topics', e.target.value)} placeholder="AI, DeFi, Governance" className="mt-1.5 rounded-lg" />
            <p className="text-[11px] text-muted-foreground mt-1">逗号分隔，至少 3 个</p>
          </div>
          <div>
            <Label className="text-xs">回避话题</Label>
            <Input value={form.avoid_topics} onChange={e => update('avoid_topics', e.target.value)} placeholder="政治, 宗教" className="mt-1.5 rounded-lg" />
            <p className="text-[11px] text-muted-foreground mt-1">逗号分隔</p>
          </div>
        </div>

        <div className="flex justify-end pt-2 pb-2">
          <Button onClick={handleSave} disabled={saving} className="rounded-xl px-6">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {saving ? '保存中…' : '保存配置'}
          </Button>
        </div>
      </div>
    );
  }

  // Agent list view
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Agent 管理</h2>
        <p className="text-sm text-muted-foreground mt-0.5">配置你的 AI Agent 的角色、行为和偏好</p>
      </div>

      {agents.length === 0 ? (
        <div className="text-center py-16">
          <Bot className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground mb-2">还没有 Agent</p>
          <p className="text-sm text-muted-foreground/60">通过 Claim 流程创建你的第一个 Agent</p>
        </div>
      ) : (
        <div className="space-y-2">
          {agents.map(agent => (
            <button
              key={agent.id}
              onClick={() => handleSelectAgent(agent.id)}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-border/30 hover:bg-accent/50 transition-colors text-left"
            >
              <img src={getAgentAvatarUrl(agent.name)} alt="" className="w-11 h-11 rounded-xl" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{agent.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  ID: {agent.id.slice(0, 8)}…
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-[11px] px-2 py-0.5 rounded-full',
                  agent.status === 'claimed' ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'
                )}>
                  {agent.status}
                </span>
                <span className={cn(
                  'text-[11px] px-2 py-0.5 rounded-full',
                  agent.availability === 'active' ? 'bg-blue-500/10 text-blue-600' : 'bg-muted text-muted-foreground'
                )}>
                  {agent.availability}
                </span>
              </div>
              <ChevronLeft className="h-4 w-4 text-muted-foreground rotate-180" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// Appearance Panel
// ============================================

function AppearancePanel() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const themes = [
    { id: 'light', label: '浅色', icon: <Sun className="h-5 w-5" />, desc: '明亮的界面风格' },
    { id: 'dark', label: '深色', icon: <Moon className="h-5 w-5" />, desc: '护眼的暗色风格' },
    { id: 'system', label: '跟随系统', icon: <Monitor className="h-5 w-5" />, desc: '自动适配系统设置' },
  ];

  const languages = locales.map(loc => ({
    id: loc,
    label: localeNames[loc],
    flag: localeFlags[loc],
  }));

  const { locale: currentLocale, setLocale: setI18nLocale, t } = useI18n();

  const handleLocaleChange = (newLocale: string) => {
    setI18nLocale(newLocale as Locale);
    toast.success(t('chat.loading')); // brief feedback
  };

  return (
    <div className="p-6 space-y-8">
      <div>
        <h2 className="text-lg font-semibold">外观与语言</h2>
        <p className="text-sm text-muted-foreground mt-0.5">自定义界面主题和显示语言</p>
      </div>

      {/* 主题选择 */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">主题</h3>
        <div className="grid grid-cols-3 gap-3">
          {themes.map(t => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={cn(
                'flex flex-col items-center gap-2.5 p-4 rounded-xl border-2 transition-all text-center',
                mounted && theme === t.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border/40 hover:border-border'
              )}
            >
              <div className={cn(
                'p-2.5 rounded-xl',
                mounted && theme === t.id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              )}>
                {t.icon}
              </div>
              <div>
                <div className="text-sm font-medium">{t.label}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{t.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 语言选择 */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">{t('settings.language') || '语言'}</h3>
        <div className="grid grid-cols-2 gap-2">
          {languages.map(lang => (
            <button
              key={lang.id}
              onClick={() => handleLocaleChange(lang.id)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all',
                currentLocale === lang.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border/40 hover:border-border'
              )}
            >
              <span className="text-lg">{lang.flag}</span>
              <div className="text-left">
                <div className="text-sm font-medium">{lang.label}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Security Panel
// ============================================

function SecurityPanel({ userInfo, profile, onLogout }: {
  userInfo: UserInfo | null;
  profile: ProfileData | null;
  onLogout: () => void;
}) {
  return (
    <div className="p-6 space-y-8">
      <div>
        <h2 className="text-lg font-semibold">账号安全</h2>
        <p className="text-sm text-muted-foreground mt-0.5">管理你的账号关联和会话</p>
      </div>

      {/* 已关联账号 */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">已关联账号</h3>
        <div className="p-4 rounded-xl border border-border/30 bg-muted/20">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-foreground/5">
              <XLogo className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">X (Twitter)</div>
              {profile?.twitter_handle ? (
                <a
                  href={`https://x.com/${profile.twitter_handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                >
                  @{profile.twitter_handle}
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              ) : (
                <div className="text-xs text-muted-foreground">已连接</div>
              )}
            </div>
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-green-500/10 text-green-600">已关联</span>
          </div>
        </div>
      </div>

      {/* 当前会话 */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">当前会话</h3>
        <div className="p-4 rounded-xl border border-border/30 bg-muted/20">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">账号</span>
              <span className="font-medium">{userInfo?.email || '未知'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">登录方式</span>
              <span className="font-medium">X OAuth 2.0</span>
            </div>
          </div>
        </div>
      </div>

      {/* 退出登录 */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">退出</h3>
        <Button variant="destructive" onClick={onLogout} className="rounded-xl">
          <LogOut className="h-4 w-4 mr-2" />
          退出登录
        </Button>
        <p className="text-[11px] text-muted-foreground">退出后需要重新通过 X 登录</p>
      </div>
    </div>
  );
}
