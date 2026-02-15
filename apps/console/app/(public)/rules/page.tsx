'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useSession } from '@/lib/auth-client';
import {
  getProtocolRules,
  getProtocolPrompts,
  getRuleFeedback,
  submitRuleFeedback,
  voteOnFeedback,
  type ProtocolRule,
  type PromptTemplate,
  type RuleFeedbackItem,
} from '@/lib/api';
import {
  BookOpen, Code, History, ChevronDown, ChevronUp,
  ThumbsUp, ThumbsDown, MessageSquare, ArrowLeft, Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function RulesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [rules, setRules] = useState<ProtocolRule[]>([]);
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'rules' | 'prompts' | 'changelog'>('rules');
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, RuleFeedbackItem[]>>({});
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRuleId, setFeedbackRuleId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [rulesRes, promptsRes] = await Promise.all([
      getProtocolRules(),
      getProtocolPrompts(),
    ]);
    if (rulesRes.success) setRules(rulesRes.data.rules);
    if (promptsRes.success) setPrompts(promptsRes.data.prompts);
    setLoading(false);
  }

  async function loadFeedback(ruleId: string) {
    const res = await getRuleFeedback(ruleId);
    if (res.success) {
      setFeedbackMap(prev => ({ ...prev, [ruleId]: res.data.feedback }));
    }
  }

  async function handleSubmitFeedback(ruleId: string) {
    if (!feedbackText.trim() || feedbackText.length < 10) return;
    setSubmitting(true);
    const res = await submitRuleFeedback(ruleId, 'suggestion', feedbackText);
    if (res.success) {
      setFeedbackText('');
      setFeedbackRuleId(null);
      await loadFeedback(ruleId);
    }
    setSubmitting(false);
  }

  async function handleVote(feedbackId: string, ruleId: string, vote: 1 | -1) {
    await voteOnFeedback(feedbackId, vote);
    await loadFeedback(ruleId);
  }

  function toggleRule(ruleId: string) {
    if (expandedRule === ruleId) {
      setExpandedRule(null);
    } else {
      setExpandedRule(ruleId);
      if (!feedbackMap[ruleId]) {
        loadFeedback(ruleId);
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Market-Driven Protocol
            </h1>
          </div>
          <p className="text-muted-foreground ml-12">
            所有规则和 AI 提示词完全透明公开，欢迎社区反馈
          </p>
        </div>

        <div className="w-full">
          <div className="grid w-full grid-cols-3 mb-6 bg-muted rounded-lg p-1">
            {([
              { key: 'rules' as const, label: '协议规则', icon: BookOpen },
              { key: 'prompts' as const, label: 'AI Prompts', icon: Code },
              { key: 'changelog' as const, label: '变更记录', icon: History },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  'flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors',
                  activeTab === key
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Rules Tab */}
          {activeTab === 'rules' && (
          <div className="space-y-4">
            {rules.map((rule) => (
              <Card key={rule.id} className="overflow-hidden">
                <button
                  onClick={() => toggleRule(rule.id)}
                  className="w-full text-left"
                >
                  <CardHeader className="flex flex-row items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-base">{rule.title}</CardTitle>
                      <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                        v{rule.version}
                      </span>
                    </div>
                    {expandedRule === rule.id ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </CardHeader>
                </button>

                {expandedRule === rule.id && (
                  <CardContent className="pt-0">
                    {/* Render markdown as pre-formatted text */}
                    <div className="prose prose-sm dark:prose-invert max-w-none mb-6">
                      <pre className="whitespace-pre-wrap text-sm font-sans bg-muted/50 p-4 rounded-lg">
                        {rule.content_md}
                      </pre>
                    </div>

                    {/* Feedback Section */}
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        社区反馈
                      </h4>

                      {/* Existing feedback */}
                      {feedbackMap[rule.id]?.length ? (
                        <div className="space-y-3 mb-4">
                          {feedbackMap[rule.id].map((fb) => (
                            <div key={fb.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-medium">{fb.author_name || 'Anonymous'}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {fb.feedback_type}
                                  </span>
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-muted">{fb.status}</span>
                                </div>
                                <p className="text-sm">{fb.content}</p>
                              </div>
                              {session && (
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => handleVote(fb.id, rule.id, 1)}
                                  >
                                    <ThumbsUp className="h-3 w-3" />
                                  </Button>
                                  <span className="text-xs font-mono">{fb.upvotes - fb.downvotes}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => handleVote(fb.id, rule.id, -1)}
                                  >
                                    <ThumbsDown className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground mb-4">暂无反馈</p>
                      )}

                      {/* Submit feedback */}
                      {session ? (
                        feedbackRuleId === rule.id ? (
                          <div className="space-y-2">
                            <Textarea
                              placeholder="你的建议或问题（至少 10 个字符）..."
                              value={feedbackText}
                              onChange={(e) => setFeedbackText(e.target.value)}
                              rows={3}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSubmitFeedback(rule.id)}
                                disabled={submitting || feedbackText.length < 10}
                              >
                                提交
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setFeedbackRuleId(null); setFeedbackText(''); }}
                              >
                                取消
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setFeedbackRuleId(rule.id)}
                          >
                            提交反馈
                          </Button>
                        )
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          <Link href="/login" className="text-primary hover:underline">登录</Link> 后可提交反馈
                        </p>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
          )}

          {/* Prompts Tab */}
          {activeTab === 'prompts' && (
          <div className="space-y-4">
            {prompts.map((prompt) => (
              <Card key={prompt.id}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base">{prompt.title}</CardTitle>
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                      v{prompt.version}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap text-sm font-mono bg-muted/50 p-4 rounded-lg overflow-x-auto">
                    {prompt.template_md}
                  </pre>
                  {prompt.variables.length > 0 && (
                    <div className="mt-3">
                      <span className="text-xs text-muted-foreground">Variables: </span>
                      {prompt.variables.map((v: string) => (
                        <span key={v} className="inline-block text-xs bg-primary/10 text-primary px-2 py-0.5 rounded mr-1 mb-1">
                          {`{${v}}`}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          )}

          {/* Changelog Tab */}
          {activeTab === 'changelog' && (
          <div className="space-y-3">
            {rules.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">暂无变更记录</p>
            ) : (
              [...rules, ...prompts as (ProtocolRule | PromptTemplate)[]]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((item) => {
                  const isRule = 'rule_key' in item;
                  return (
                    <div key={item.id} className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-mono text-primary">v{item.version}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{item.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {isRule ? 'Rule' : 'Prompt'} |{' '}
                          {item.change_summary || 'Initial version'} |{' '}
                          {new Date(item.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
