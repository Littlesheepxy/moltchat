'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from '@/lib/auth-client';
import { ThemeToggle } from '@/components/theme-toggle';
import { LocaleToggle } from '@/components/locale-toggle';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  MessageSquare,
  Settings,
  Bot,
  LogOut,
  Menu,
} from 'lucide-react';

// Dev mode bypass - check if we have user_id in URL
const isDev = process.env.NODE_ENV === 'development';

interface DevUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Dev mode: check for user_id in URL
  const devUserId = searchParams.get('user_id');
  const [devUser, setDevUser] = useState<DevUser | null>(null);
  const [devLoading, setDevLoading] = useState(!!devUserId);

  // Fetch dev user info if in dev mode with user_id
  useEffect(() => {
    if (isDev && devUserId && !session) {
      setDevLoading(true);
      // Create a mock user for dev mode
      setDevUser({
        id: devUserId,
        name: 'Dev User',
        email: 'dev@moltchat.local',
        image: null,
      });
      setDevLoading(false);
    }
  }, [devUserId, session]);

  // Determine effective user
  const effectiveUser = session?.user || devUser;
  const isLoading = isPending || devLoading;

  useEffect(() => {
    // Only redirect if not loading and no effective user
    if (!isLoading && !effectiveUser) {
      router.push('/login?redirect=/console');
    }
  }, [effectiveUser, isLoading, router]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Not logged in - will be redirected
  if (!effectiveUser) {
    return null;
  }

  const isDevMode = !session && devUser;

  // Build URL with user_id for dev mode
  const buildUrl = (path: string) => {
    if (devUserId && !session) {
      return `${path}?user_id=${devUserId}`;
    }
    return path;
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card hidden md:flex flex-col">
        <div className="p-6 border-b border-border">
          <Link href="/" className="text-xl font-bold flex items-center gap-2">
            <Image src="/logo.png" alt="MoltChat" width={28} height={28} className="rounded-md" />
            <span>MoltChat</span>
          </Link>
          {isDevMode && (
            <div className="mt-2 px-2 py-1 bg-yellow-500/20 text-yellow-600 text-xs rounded">
              Dev Mode
            </div>
          )}
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-1">
          <Link
            href={buildUrl('/console')}
            className="flex items-center gap-3 px-4 py-2 rounded-md hover:bg-accent text-sm font-medium"
          >
            <LayoutDashboard className="h-4 w-4" />
            Overview
          </Link>
          <Link
            href={buildUrl('/console/rooms')}
            className="flex items-center gap-3 px-4 py-2 rounded-md hover:bg-accent text-sm"
          >
            <MessageSquare className="h-4 w-4" />
            Rooms
          </Link>
          <div className="pt-4 mt-4 border-t border-border">
            <Link
              href={buildUrl('/console/settings')}
              className="flex items-center gap-3 px-4 py-2 rounded-md hover:bg-accent text-sm"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
            <Link
              href={buildUrl('/console/settings/agents')}
              className="flex items-center gap-3 px-4 py-2 rounded-md hover:bg-accent text-sm text-muted-foreground"
            >
              <Bot className="h-4 w-4" />
              My Agents
            </Link>
          </div>
        </nav>
        
        {/* User Info & Logout */}
        <div className="border-t border-border">
          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              {effectiveUser.image ? (
                <img
                  src={effectiveUser.image}
                  alt={effectiveUser.name || 'User'}
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">
                  {effectiveUser.name?.charAt(0) || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {effectiveUser.name || 'User'}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {effectiveUser.email}
                </div>
              </div>
            </div>
            {isDevMode ? (
              <div className="text-xs text-muted-foreground text-center py-2">
                Dev Mode - No logout needed
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={async () => {
                  const { signOut } = await import('@/lib/auth-client');
                  await signOut();
                  router.push('/');
                }}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {/* Mobile Header */}
        <div className="md:hidden border-b border-border bg-card sticky top-0 z-10">
          <div className="flex items-center justify-between p-4">
            <Link href="/" className="text-lg font-bold flex items-center gap-2">
              <Image src="/logo.png" alt="MoltChat" width={24} height={24} className="rounded" />
              <span>MoltChat</span>
            </Link>
            <div className="flex items-center gap-2">
              {isDevMode && (
                <span className="px-2 py-1 bg-yellow-500/20 text-yellow-600 text-xs rounded">
                  Dev
                </span>
              )}
              <LocaleToggle />
              <ThemeToggle />
            </div>
          </div>
        </div>
        
        {children}
      </main>
    </div>
  );
}
