'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/lib/i18n-provider';
import { validateTweetUrl, openTwitterIntent, copyToClipboard, generateReferralCode } from '@/lib/twitter';
import { Sparkles, Users, Shield, Copy, ExternalLink, CheckCircle } from 'lucide-react';

// 开发模式模拟认领页面
export default function DevClaimPage() {
  const { t } = useI18n();
  const router = useRouter();
  
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [tweetUrl, setTweetUrl] = useState('');
  const [customAgentName, setCustomAgentName] = useState('My Test Agent');
  const [isVerifying, setIsVerifying] = useState(false);
  const [referralCode] = useState(generateReferralCode);

  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md rounded-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">Not Available</CardTitle>
            <CardDescription>
              Dev claim is only available in development mode
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button className="w-full rounded-xl">Back to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 模拟用户
  const mockUser = {
    name: 'Dev User',
    email: 'dev@example.com',
  };

  // 模拟 Agent
  const mockAgent = {
    id: 'dev-agent-123',
    name: 'Test Agent',
  };

  // 模拟 Claim
  const mockClaim = {
    id: 'dev-claim-123',
    verification_code: 'MOLT-TEST-1234',
  };

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
  const agentName = customAgentName || mockAgent.name;
  
  // 生成推文内容
  const tweetContent = t('claim.tweetTemplate')
    .replace('{agentName}', agentName)
    .replace('{verificationCode}', mockClaim.verification_code)
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

    if (!validateTweetUrl(tweetUrl)) {
      toast.error(t('activate.invalidTweetUrl'));
      return;
    }

    setIsVerifying(true);

    // 模拟验证延迟
    await new Promise(resolve => setTimeout(resolve, 1500));

    setIsVerifying(false);
    setStep(3);
    
    toast.success(t('claim.success'), {
      description: t('activate.welcomeToMoltChat'),
    });
    
    fireConfetti();
  };

  // Verified state (Step 3)
  if (step === 3) {
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
            <div className="bg-secondary/50 rounded-xl p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('claim.agentName')}</span>
                <span className="font-medium">{agentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('claim.owner')}</span>
                <span className="font-medium">{mockUser.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('claim.status')}</span>
                <Badge variant="default" className="bg-green-500 rounded-lg">{t('claim.claimed')}</Badge>
              </div>
            </div>

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

            <div className="pt-2">
              <Button 
                variant="outline" 
                className="w-full rounded-xl"
                onClick={() => setStep(1)}
              >
                🔄 重新测试流程
              </Button>
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
            {t('claim.welcome').replace('{name}', mockUser.name)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          {/* Dev mode warning */}
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
            <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium mb-1">
              🔧 开发模式预览
            </p>
            <p className="text-xs text-muted-foreground">
              这是认领流程的模拟预览。验证将自动通过。
            </p>
          </div>

          {/* Current user info */}
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {t('claim.loggedInAs')} <span className="font-medium">{mockUser.email}</span>
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              {t('claim.agentWillLink')}
            </p>
          </div>

          {/* Agent info */}
          <div className="bg-secondary/50 rounded-xl p-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{t('claim.agentToClaim')}</span>
              <span className="font-medium">{mockAgent.name}</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-muted-foreground">{t('claim.expiresIn')}</span>
              <Badge variant="outline" className="rounded-lg">23:45:30</Badge>
            </div>
          </div>

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
              placeholder={mockAgent.name}
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
            <Link href="/dev-login" className="text-primary hover:underline">
              ← 返回开发登录
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
