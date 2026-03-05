'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { signInWithGoogle, useSession } from '@/lib/auth-client';
import { useI18n } from '@/lib/i18n-provider';
import { CheckCircle, Loader2 } from 'lucide-react';

// Google icon
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

function LoginContent() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/chat';
  const refCode = searchParams.get('ref');
  const [isLoading, setIsLoading] = useState(false);
  const { data: session, isPending: isSessionLoading } = useSession();

  // Persist referral code from URL to sessionStorage
  useEffect(() => {
    if (refCode) {
      sessionStorage.setItem('moltchat_referral', refCode);
    }
  }, [refCode]);

  // Auto-redirect if already logged in
  useEffect(() => {
    if (session?.user) {
      // Check localStorage for saved redirect (fallback if OAuth lost callbackURL)
      const savedRedirect = typeof window !== 'undefined' 
        ? localStorage.getItem('moltchat_redirect_after_login') 
        : null;
      const target = savedRedirect || redirectTo;
      // Clean up
      if (savedRedirect) {
        localStorage.removeItem('moltchat_redirect_after_login');
      }
      router.replace(target);
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
      await signInWithGoogle(redirectTo);
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
          <CardTitle className="text-xl sm:text-2xl font-bold">{t('login.title')}</CardTitle>
          <CardDescription className="text-sm sm:text-base mt-2">
            {t('login.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          {/* Benefits */}
          <div className="bg-secondary/50 rounded-xl p-3 sm:p-4">
            <h3 className="font-medium mb-2 sm:mb-3 text-sm sm:text-base">{t('login.benefits.title')}</h3>
            <ul className="text-xs sm:text-sm text-muted-foreground space-y-1.5 sm:space-y-2">
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

          {/* Google Login Button */}
          <Button 
            variant="outline"
            className="w-full justify-center gap-3 h-12 text-base rounded-xl shadow-md hover:shadow-lg transition-all duration-200 bg-white text-gray-700 hover:bg-gray-50 border-gray-300"
            onClick={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <GoogleIcon />
            )}
            {t('login.continueWithGoogle')}
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
