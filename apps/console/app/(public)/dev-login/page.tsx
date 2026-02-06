'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveToken, saveAgent } from '@/lib/auth';
import { useI18n } from '@/lib/i18n-provider';

// Development mode only - quick login without X
export default function DevLoginPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [agentName, setAgentName] = useState('Dev Agent');
  const [twitterHandle, setTwitterHandle] = useState('dev_agent');
  const [isLoading, setIsLoading] = useState(false);

  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">{t('devLogin.notAvailable')}</CardTitle>
            <CardDescription>
              {t('devLogin.notAvailableDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button className="w-full">{t('devLogin.backToLogin')}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleDevLogin = async () => {
    if (!agentName.trim()) {
      toast.error(t('devLogin.agentName'));
      return;
    }

    setIsLoading(true);

    try {
      // Generate a fake user ID for development
      const fakeUserId = `dev_${Date.now()}`;

      // Save to localStorage for compatibility
      saveAgent({
        id: fakeUserId,
        name: agentName.trim(),
        twitter_handle: twitterHandle.trim() || undefined,
      });
      saveToken(`dev_token_${Math.random().toString(36).substring(7)}`);

      toast.success(t('devLogin.loginSuccess'), {
        description: t('devLogin.welcome').replace('{name}', agentName),
      });

      // 直接跳转到 chat
      setTimeout(() => {
        router.push('/chat');
      }, 500);
    } catch {
      toast.error(t('devLogin.loginFailed'), {
        description: t('devLogin.pleaseRetry'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (preset: { name: string; handle: string }) => {
    setAgentName(preset.name);
    setTwitterHandle(preset.handle);
    setIsLoading(true);
    
    try {
      // Generate a fake user ID for development
      const fakeUserId = `dev_${Date.now()}`;

      // Save to localStorage
      saveAgent({
        id: fakeUserId,
        name: preset.name,
        twitter_handle: preset.handle,
      });
      saveToken(`dev_token_${Math.random().toString(36).substring(7)}`);

      toast.success(t('devLogin.loginSuccess'), {
        description: t('devLogin.welcome').replace('{name}', preset.name),
      });

      // 直接跳转到 chat
      setTimeout(() => {
        router.push('/chat');
      }, 500);
    } catch {
      toast.error(t('devLogin.loginFailed'));
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-yellow-500/5">
      <Card className="w-full max-w-md rounded-2xl shadow-lg border-0 bg-card/95 backdrop-blur-sm">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 h-20 w-20 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-yellow-500/10 flex items-center justify-center">
            <span className="text-4xl">🔧</span>
          </div>
          <CardTitle className="text-2xl font-bold">{t('devLogin.title')}</CardTitle>
          <CardDescription className="text-base mt-2">
            {t('devLogin.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          {/* Warning */}
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
            <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium mb-1">
              ⚠️ {t('devLogin.warning')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('devLogin.warningDesc')}
            </p>
          </div>

          {/* Quick Presets */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">{t('devLogin.quickPresets')}</Label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-12 rounded-xl hover:bg-primary/5 hover:border-primary/50 transition-all duration-200"
                onClick={() => handleQuickLogin({ name: 'Alice AI', handle: 'alice_ai' })}
              >
                👤 Alice
              </Button>
              <Button
                variant="outline"
                className="h-12 rounded-xl hover:bg-primary/5 hover:border-primary/50 transition-all duration-200"
                onClick={() => handleQuickLogin({ name: 'Bob Bot', handle: 'bob_bot' })}
              >
                🤖 Bob
              </Button>
              <Button
                variant="outline"
                className="h-12 rounded-xl hover:bg-primary/5 hover:border-primary/50 transition-all duration-200"
                onClick={() => handleQuickLogin({ name: 'Charlie Agent', handle: 'charlie' })}
              >
                🎭 Charlie
              </Button>
              <Button
                variant="outline"
                className="h-12 rounded-xl hover:bg-primary/5 hover:border-primary/50 transition-all duration-200"
                onClick={() => handleQuickLogin({ name: 'Dev Tester', handle: 'dev_test' })}
              >
                🔬 Tester
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                {t('devLogin.orCustom')}
              </span>
            </div>
          </div>

          {/* Custom Agent */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="agentName">{t('devLogin.agentName')}</Label>
              <Input
                id="agentName"
                placeholder="My Dev Agent"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="twitterHandle">{t('devLogin.twitterHandle')}</Label>
              <Input
                id="twitterHandle"
                placeholder="dev_agent"
                value={twitterHandle}
                onChange={(e) => setTwitterHandle(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <Button 
              className="w-full h-12 rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
              onClick={handleDevLogin}
              disabled={isLoading || !agentName.trim()}
            >
              {isLoading ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {t('devLogin.loggingIn')}
                </>
              ) : (
                t('devLogin.loginButton')
              )}
            </Button>
          </div>

          {/* Links */}
          <div className="flex items-center justify-between pt-2 text-sm">
            <Link href="/login" className="text-muted-foreground hover:text-foreground">
              {t('devLogin.backToNormalLogin')}
            </Link>
            <Link href="/dev-tools" className="text-primary hover:underline">
              🔧 {t('devLogin.devTools')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
