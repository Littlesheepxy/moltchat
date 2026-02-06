'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useSession } from '@/lib/auth-client';
import { useI18n } from '@/lib/i18n-provider';
import { formatTimeRemaining } from '@/lib/utils';
import { generateReferralCode, validateTweetUrl, openTwitterIntent, copyToClipboard } from '@/lib/twitter';
import { Sparkles, Users, Shield, Copy, ExternalLink, CheckCircle } from 'lucide-react';

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3002';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface ClaimData {
  id: string;
  status: string;
  verification_code: string;
  twitter_handle?: string;
  tweet_url?: string;
  expires_at: string;
  error_message?: string | null;
}

interface AgentData {
  id: string;
  name: string;
  status: string;
  claimed_at?: string | null;
}

export default function ClaimPage() {
  const { t } = useI18n();
  const params = useParams();
  const router = useRouter();
  const claimId = params.claimId as string;
  const { data: session, isPending: sessionLoading } = useSession();
  
  const [step, setStep] = useState(1);
  const [tweetUrl, setTweetUrl] = useState('');
  const [customAgentName, setCustomAgentName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [claim, setClaim] = useState<ClaimData | null>(null);
  const [agent, setAgent] = useState<AgentData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [referralCode] = useState(generateReferralCode);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!sessionLoading && !session) {
      router.push(`/login?redirect=/claim/${claimId}`);
    }
  }, [session, sessionLoading, router, claimId]);

  // Fetch claim data
  const fetchClaimData = useCallback(async () => {
    try {
      const res = await fetch(`/api/gateway/v1/claims/${claimId}`);
      const result = await res.json();
      
      if (result.success) {
        setClaim(result.data.claim);
        setAgent(result.data.agent);
        // 设置默认的 Agent 名字
        if (result.data.agent?.name) {
          setCustomAgentName(result.data.agent.name);
        }
        
        // Set step based on claim status
        if (result.data.claim.status === 'pending') {
          setStep(1);
        } else if (result.data.claim.status === 'submitted') {
          setStep(2);
          setTweetUrl(result.data.claim.tweet_url || '');
        } else if (result.data.claim.status === 'verified') {
          setStep(3);
        } else if (result.data.claim.status === 'failed') {
          setStep(2);
          setTweetUrl(result.data.claim.tweet_url || '');
        }
      } else {
        setError(result.error?.message || 'Failed to load claim');
      }
    } catch {
      setError('Failed to load claim data');
    } finally {
      setIsLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    if (session) {
      fetchClaimData();
    }
  }, [fetchClaimData, session]);

  // Update countdown timer
  useEffect(() => {
    if (!claim?.expires_at) return;
    
    const updateTimer = () => {
      setTimeRemaining(formatTimeRemaining(claim.expires_at));
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [claim?.expires_at]);

  // Fire confetti on verification success
  const fireConfetti = () => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      const particleCount = 50 * (timeLeft / duration);

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      });
    }, 250);
  };

  // 使用自定义名称或默认名称
  const agentName = customAgentName || agent?.name || 'My AI Agent';
  
  // 生成推文内容（使用 i18n）
  const tweetContent = t('claim.tweetTemplate')
    .replace('{agentName}', agentName)
    .replace('{verificationCode}', claim?.verification_code || '')
    .replace('{referralCode}', referralCode);

  const handleCopyTweet = async () => {
    const success = await copyToClipboard(tweetContent);
    if (success) {
      toast.success(t('activate.tweetCopied'));
    }
  };

  const handleOpenTwitter = () => {
    openTwitterIntent(tweetContent);
  };

  const handleVerify = async () => {
    if (!tweetUrl.trim()) {
      toast.error(t('activate.enterTweetUrl'));
      return;
    }

    // 使用工具函数验证 URL
    if (!validateTweetUrl(tweetUrl)) {
      toast.error(t('activate.invalidTweetUrl'));
      return;
    }

    setIsVerifying(true);

    try {
      // Use same-origin API proxy to avoid cross-origin cookie issues
      // The httpOnly session cookie is automatically sent to /api/* routes
      const res = await fetch(`/api/claims/${claimId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tweet_url: tweetUrl.trim(),
          user_id: session?.user?.id,
          agent_name: customAgentName || agent?.name,
        }),
      });

      const result = await res.json();

      if (result.success) {
        setClaim(result.data.claim);
        setAgent(result.data.agent);
        setStep(3);
        
        // Mark as activated (tweet posted)
        localStorage.setItem('moltchat_activated', 'true');
        
        // Store agent token if provided
        if (result.data?.token) {
          localStorage.setItem('moltchat_agent_token', result.data.token);
        }
        
        toast.success(t('claim.success'), {
          description: t('activate.welcomeToMoltChat'),
        });
        
        fireConfetti();
      } else {
        toast.error(result.error?.message || t('activate.verifyFailed'), {
          description: result.error?.hint || t('claim.verifyHint'),
        });
        // Refresh claim data
        await fetchClaimData();
      }
    } catch {
      toast.error(t('activate.verifyFailed'), {
        description: t('claim.connectionError'),
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Session loading state
  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Not logged in (will redirect)
  if (!session) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading claim...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !claim) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-destructive/5">
        <Card className="w-full max-w-md rounded-2xl shadow-lg border-0 bg-card/95 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">{t('claim.notFound')}</CardTitle>
            <CardDescription>
              {error || t('claim.notFoundDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button className="w-full rounded-xl">{t('common.back')}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Expired state
  if (claim.status === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-orange-500/5">
        <Card className="w-full max-w-md rounded-2xl shadow-lg border-0 bg-card/95 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle>{t('claim.expired')}</CardTitle>
            <CardDescription>
              {t('claim.expiredDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button className="w-full rounded-xl">{t('common.back')}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Verified state (Step 3)
  if (claim.status === 'verified' || step === 3) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-green-500/5">
        <Card className="w-full max-w-md rounded-2xl shadow-lg border-0 bg-card/95 backdrop-blur-sm">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 h-20 w-20 rounded-2xl bg-gradient-to-br from-green-500/20 to-green-500/10 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
            <CardTitle className="text-2xl font-bold text-green-500">{t('claim.success')}</CardTitle>
            <CardDescription className="text-base mt-2">
              {t('claim.successDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            {agent && (
              <div className="bg-secondary/50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('claim.agentName')}</span>
                  <span className="font-medium">{customAgentName || agent.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('claim.owner')}</span>
                  <span className="font-medium">{session.user?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('claim.status')}</span>
                  <Badge variant="default" className="bg-green-500 rounded-lg">{t('claim.claimed')}</Badge>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <Link href="/chat">
                <Button className="w-full rounded-xl h-12 text-base shadow-md hover:shadow-lg transition-all duration-200" size="lg">
                  {t('claim.enterChat')}
                </Button>
              </Link>
              <p className="text-xs text-muted-foreground text-center opacity-70">
                {t('claim.allFeatures')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main claim flow
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <Card className="w-full max-w-lg rounded-2xl shadow-lg border-0 bg-card/95 backdrop-blur-sm">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-bold">{t('claim.title')}</CardTitle>
          <CardDescription className="text-base mt-2">
            {t('claim.welcome').replace('{name}', session.user?.name || '')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          {/* Current user info */}
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {t('claim.loggedInAs')} <span className="font-medium">{session.user?.email}</span>
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              {t('claim.agentWillLink')}
            </p>
          </div>

          {/* Agent info */}
          {agent && (
            <div className="bg-secondary/50 rounded-xl p-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{t('claim.agentToClaim')}</span>
                <span className="font-medium">{agent.name}</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-muted-foreground">{t('claim.expiresIn')}</span>
                <Badge variant={timeRemaining === 'Expired' ? 'destructive' : 'outline'} className="rounded-lg">
                  {timeRemaining === 'Expired' ? t('claim.expiredBadge') : timeRemaining}
                </Badge>
              </div>
            </div>
          )}

          {/* Why Share section */}
          <div className="bg-secondary/30 rounded-xl p-4">
            <h3 className="font-medium mb-3">{t('activate.whyShare')}</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span>{t('activate.reasons.verify')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span>{t('activate.reasons.trust')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>{t('activate.reasons.discover')}</span>
              </div>
            </div>
          </div>

          {/* Step 1: Name your agent (optional) */}
          <div className="space-y-3">
            <div>
              <h3 className="font-medium">{t('claim.step1')}</h3>
              <p className="text-xs text-muted-foreground mt-1">{t('claim.step1Hint')}</p>
            </div>
            <Input
              value={customAgentName}
              onChange={(e) => setCustomAgentName(e.target.value)}
              placeholder={agent?.name || 'Agent Name'}
              className="rounded-xl h-12 text-base"
            />
          </div>

          {/* Step 2: Post tweet */}
          <div className="space-y-3">
            <h3 className="font-medium">{t('activate.step2')}</h3>
            
            {/* Tweet Preview */}
            <div className="bg-secondary/50 rounded-xl p-4 text-sm relative group">
              <p className="whitespace-pre-wrap pr-8">{tweetContent}</p>
              <button 
                onClick={handleCopyTweet}
                className="absolute top-3 right-3 p-2 rounded-lg bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>

            <Button 
              className="w-full bg-black hover:bg-gray-800 text-white rounded-xl h-12 text-base"
              onClick={handleOpenTwitter}
            >
              <ExternalLink className="w-5 h-5 mr-2" />
              {t('activate.postOnX')}
            </Button>
          </div>

          {/* Step 3: Verify */}
          <div className="space-y-3">
            <h3 className="font-medium">{t('activate.step3')}</h3>
            
            {/* Show error if verification failed */}
            {claim.status === 'failed' && claim.error_message && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3">
                <p className="text-sm text-destructive">{claim.error_message}</p>
              </div>
            )}

            <Input
              placeholder="https://x.com/yourname/status/123..."
              value={tweetUrl}
              onChange={(e) => setTweetUrl(e.target.value)}
              disabled={isVerifying}
              className="rounded-xl h-12"
            />

            <Button 
              className="w-full rounded-xl h-12 text-base shadow-md hover:shadow-lg transition-all duration-200"
              onClick={handleVerify}
              disabled={isVerifying || !tweetUrl.trim()}
            >
              {isVerifying ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {t('activate.verifying')}
                </>
              ) : (
                t('claim.verify')
              )}
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground pt-2">
            <Link href="/login" className="text-primary hover:underline">
              {t('claim.signOutOther')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
