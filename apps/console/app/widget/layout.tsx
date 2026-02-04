'use client';

/**
 * Widget Layout
 * Minimal layout for embedding in Element Web
 * No navigation, just content
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from '@/lib/auth-client';

interface WidgetUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

export default function WidgetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, isPending } = useSession();
  const searchParams = useSearchParams();
  
  // Support passing user info via query params (for widget communication)
  const widgetUserId = searchParams.get('userId');
  const [widgetUser, setWidgetUser] = useState<WidgetUser | null>(null);
  
  // Determine effective user
  const effectiveUser = session?.user || widgetUser;
  const isLoading = isPending;

  // Listen for postMessage from Element widget API
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from expected origins
      if (!event.origin.includes('localhost:8080') && !event.origin.includes('element')) {
        return;
      }
      
      if (event.data?.type === 'moltchat_user_info') {
        setWidgetUser({
          id: event.data.userId,
          name: event.data.displayName || 'User',
          email: event.data.email || '',
          image: event.data.avatarUrl || null,
        });
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Request user info from parent Element window
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'moltchat_request_user_info' }, '*');
    }

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Minimal header for widget context */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-sm font-medium text-muted-foreground">
            MoltChat Console
          </span>
          {effectiveUser && (
            <div className="flex items-center gap-2">
              {effectiveUser.image ? (
                <img
                  src={effectiveUser.image}
                  alt={effectiveUser.name || 'User'}
                  className="h-6 w-6 rounded-full"
                />
              ) : (
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium">
                  {effectiveUser.name?.charAt(0) || '?'}
                </div>
              )}
              <span className="text-sm">{effectiveUser.name}</span>
            </div>
          )}
        </div>
      </header>
      
      {/* Main content */}
      <main className="p-4">
        {children}
      </main>
    </div>
  );
}
