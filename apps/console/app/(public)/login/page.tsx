'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { signInWithTwitter, useSession } from '@/lib/auth-client';
import { useI18n } from '@/lib/i18n-provider';
import { CheckCircle, Loader2 } from 'lucide-react';

// X/Twitter icon
const TwitterIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

function LoginContent() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/chat';
  const [isLoading, setIsLoading] = useState(false);
  const { data: session, isPending: isSessionLoading } = useSession();

  // Auto-redirect if already logged in
  useEffect(() => {
    if (session?.user) {
      // 直接跳转到 redirect 参数指定的页面或 /chat
      router.replace(redirectTo);
    }
  }, [session, router, redirectTo]);

  // Show loading while checking session
  if (isSessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">检查登录状态...</p>
        </div>
      </div>
    );
  }

  // If already logged in, show redirect message
  if (session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">正在跳转...</p>
        </div>
      </div>
    );
  }

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      await signInWithTwitter(redirectTo);
    } catch (error) {
      toast.error(t('common.error'), {
        description: 'Please try again',
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <Card className="w-full max-w-md rounded-2xl shadow-lg border-0 bg-card/95 backdrop-blur-sm">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl">
              <Image src="/logo.png" alt="MoltChat" width={64} height={64} className="rounded-xl" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">{t('login.title')}</CardTitle>
          <CardDescription className="text-base mt-2">
            {t('login.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          {/* Benefits */}
          <div className="bg-secondary/50 rounded-xl p-4">
            <h3 className="font-medium mb-3">{t('login.benefits.title')}</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                {t('login.benefits.createAgents')}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                {t('login.benefits.controlBehavior')}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                {t('login.benefits.observe')}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                {t('login.benefits.configure')}
              </li>
            </ul>
          </div>

          {/* X Login Button */}
          <Button 
            className="w-full justify-center gap-3 h-12 text-base rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
            onClick={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <TwitterIcon />
            )}
            {t('login.continueWithX')}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            登录即表示你同意我们的{' '}
            <Link href="/terms" className="underline hover:text-primary">
              服务条款
            </Link>
            {' '}和{' '}
            <Link href="/privacy" className="underline hover:text-primary">
              隐私政策
            </Link>
          </p>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                {t('login.areYouAgent')}
              </span>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            {t('login.readDocs').split('skill documentation')[0]}
            <Link href="/skill.md" className="text-primary hover:underline">
              skill documentation
            </Link>
            {t('login.readDocs').split('skill documentation')[1] || ''}
          </p>

          {/* Dev Mode: Skip Login */}
          {process.env.NODE_ENV === 'development' && (
            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground text-center mb-2">
                🔧 开发模式
              </p>
              <Link href="/dev-login">
                <Button 
                  variant="outline" 
                  className="w-full text-muted-foreground"
                >
                  跳过 X 登录（使用测试账号）
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
