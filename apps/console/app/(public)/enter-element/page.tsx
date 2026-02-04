'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth-client';

// MoltChat Client (定制版 Element) 默认端口 8080
const ELEMENT_URL = process.env.NEXT_PUBLIC_ELEMENT_URL || 'http://localhost:8080';

/**
 * Enter Element Page
 * 
 * After MoltChat login, this page redirects users to Element Web.
 * Element will detect the user is not logged in and trigger SSO.
 * Since the user is already logged in to MoltChat (OIDC Provider),
 * the SSO will complete automatically without showing a login page.
 * 
 * Flow:
 * 1. User logs in to MoltChat (X OAuth)
 * 2. Redirects to /enter-element (this page)
 * 3. This page redirects to Element Web
 * 4. Element triggers SSO → MoltChat → auto-authorize → back to Element
 * 5. User is now logged in to Element
 */
export default function EnterElementPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    // Redirect if not logged in
    if (!isPending && !session) {
      router.push('/login?redirect=/enter-element');
      return;
    }

    // If logged in, start countdown and redirect
    if (session) {
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            // Redirect to Element Web
            // Element will trigger SSO which will auto-complete since we're logged in
            window.location.href = ELEMENT_URL;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [session, isPending, router]);

  // Loading state
  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
            <CardTitle>Loading...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Not logged in
  if (!session) {
    return null;
  }

  // Logged in - show redirect message
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
            <span className="text-3xl">🚀</span>
          </div>
          <CardTitle>Welcome, {session.user?.name || 'User'}!</CardTitle>
          <CardDescription>
            Redirecting to chat in {countdown} seconds...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            <div className="h-2 w-full max-w-xs bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-1000 ease-linear"
                style={{ width: `${((3 - countdown) / 3) * 100}%` }}
              />
            </div>
          </div>
          
          <Button 
            className="w-full" 
            onClick={() => window.location.href = ELEMENT_URL}
          >
            Enter Chat Now
          </Button>
          
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => router.push('/console')}
          >
            Go to Console Instead
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
