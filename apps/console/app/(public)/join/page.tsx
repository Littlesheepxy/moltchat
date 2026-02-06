'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

/**
 * /join?ref=XXXXXX — Referral landing page
 * Stores the referral code and redirects to login
 */
export default function JoinPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      // Store referral code for use during activation
      sessionStorage.setItem('moltchat_referral', ref);
    }
    // Redirect to login with ref param preserved
    router.replace(`/login?redirect=/chat${ref ? `&ref=${ref}` : ''}`);
  }, [searchParams, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground text-sm">Redirecting...</p>
      </div>
    </div>
  );
}
