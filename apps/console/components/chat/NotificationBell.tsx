'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useI18n } from '@/lib/i18n-provider';
import { getAgentAvatarUrl } from '@/lib/avatar';
import {
  Bell, X, Check, XCircle, UserPlus, UserCheck, Gift, Info,
  Loader2, CheckCheck, Shield, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Notification {
  id: string;
  agent_id: string | null;
  type: string;
  title: string;
  content: string | null;
  metadata: any;
  is_read: boolean;
  created_at: string;
}

/**
 * Shared hook: poll unread notification count every 15s.
 * Reusable by BottomTabBar, MeTab, etc.
 */
export function useUnreadNotificationCount() {
  const [unreadCount, setUnreadCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/gateway/v1/notifications/unread-count');
      const result = await res.json();
      if (result.success) {
        setUnreadCount(result.data.unread_count);
      }
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    pollRef.current = setInterval(fetchUnreadCount, 15000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchUnreadCount]);

  return { unreadCount, setUnreadCount, refresh: fetchUnreadCount };
}

export function NotificationBell({ collapsed = false, iconOnly = false }: { collapsed?: boolean; iconOnly?: boolean }) {
  const { t, locale } = useI18n();
  const { unreadCount, setUnreadCount, refresh: refreshUnread } = useUnreadNotificationCount();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch full notifications when opening
  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/gateway/v1/notifications?limit=30');
      const result = await res.json();
      if (result.success && result.data?.notifications) {
        setNotifications(result.data.notifications);
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleOpen = () => {
    setIsOpen(true);
    fetchNotifications();
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/gateway/v1/notifications/read-all', { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // Silently fail
    }
  };

  const handleApprove = async (requestId: string, notificationId: string) => {
    setActionLoading(notificationId);
    try {
      const res = await fetch(`/api/gateway/v1/dm/requests/${requestId}/approve`, { method: 'POST' });
      const result = await res.json();
      if (result.success) {
        toast.success(t('notifications.accepted') || 'Friend request accepted');
        // Mark notification as read and update locally
        setNotifications(prev => prev.map(n =>
          n.id === notificationId ? { ...n, is_read: true, type: 'dm_accepted' } : n
        ));
        setUnreadCount(prev => Math.max(0, prev - 1));
        await fetch(`/api/gateway/v1/notifications/${notificationId}/read`, { method: 'POST' });
      } else {
        toast.error(result.error?.message || 'Failed');
      }
    } catch {
      toast.error(t('notifications.networkError') || 'Network error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (requestId: string, notificationId: string) => {
    setActionLoading(notificationId);
    try {
      const res = await fetch(`/api/gateway/v1/dm/requests/${requestId}/reject`, { method: 'POST' });
      const result = await res.json();
      if (result.success) {
        toast.info(t('notifications.declined') || 'Friend request declined');
        setNotifications(prev => prev.map(n =>
          n.id === notificationId ? { ...n, is_read: true, type: 'dm_rejected' } : n
        ));
        setUnreadCount(prev => Math.max(0, prev - 1));
        await fetch(`/api/gateway/v1/notifications/${notificationId}/read`, { method: 'POST' });
      } else {
        toast.error(result.error?.message || 'Failed');
      }
    } catch {
      toast.error(t('notifications.networkError') || 'Network error');
    } finally {
      setActionLoading(null);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'dm_request': return <UserPlus className="h-4 w-4 text-blue-500" />;
      case 'dm_accepted': return <UserCheck className="h-4 w-4 text-green-500" />;
      case 'dm_rejected': return <XCircle className="h-4 w-4 text-red-400" />;
      case 'referral_registered': return <Gift className="h-4 w-4 text-purple-500" />;
      case 'exploration_ready': return <Sparkles className="h-4 w-4 text-amber-500" />;
      case 'rule_change': return <Shield className="h-4 w-4 text-indigo-500" />;
      default: return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('notifications.justNow') || 'Just now';
    if (mins < 60) return (t('notifications.minutesAgo') || '{count}m ago').replace('{count}', String(mins));
    const hours = Math.floor(mins / 60);
    if (hours < 24) return (t('notifications.hoursAgo') || '{count}h ago').replace('{count}', String(hours));
    const days = Math.floor(hours / 24);
    return (t('notifications.daysAgo') || '{count}d ago').replace('{count}', String(days));
  };

  return (
    <>
      {/* Bell button */}
      {iconOnly ? (
        /* Mobile / standalone icon button */
        <Button
          variant="ghost"
          size="icon"
          onClick={handleOpen}
          className="relative h-9 w-9 rounded-lg"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      ) : (
        /* Sidebar button — matches ghost Button style */
        <Button
          variant="ghost"
          onClick={handleOpen}
          className={cn(
            'relative rounded-xl',
            collapsed ? 'w-full h-10 p-0' : 'w-full justify-start gap-2.5 h-10 px-3'
          )}
        >
          <Bell className="h-[18px] w-[18px] text-primary" />
          {!collapsed && (
            <span className="text-sm">{t('notifications.title') || 'Notifications'}</span>
          )}
          {unreadCount > 0 && (
            <span className={cn(
              'absolute bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center leading-none',
              collapsed ? 'top-0.5 right-0.5' : 'top-1 right-1'
            )}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      )}

      {/* Modal */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/50 animate-in fade-in duration-200"
            onClick={handleClose}
          />

          {/* Center modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div
              className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border/30 pointer-events-auto animate-in zoom-in-95 fade-in duration-200 flex flex-col max-h-[80vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-5 pt-5 pb-3 flex items-center justify-between flex-shrink-0 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-semibold">
                    {t('notifications.title') || 'Notifications'}
                  </h3>
                  {unreadCount > 0 && (
                    <span className="text-xs bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full font-medium">
                      {(t('notifications.unread') || '{count} unread').replace('{count}', String(unreadCount))}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
                      title={t('notifications.markAllRead') || 'Mark all read'}
                    >
                      <CheckCheck className="h-4 w-4" />
                    </button>
                  )}
                  <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                    <X className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* Notification list */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Bell className="h-10 w-10 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">{t('notifications.noNotifications') || 'No notifications'}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/20">
                    {notifications.map((n) => {
                      const isAction = n.type === 'dm_request' && !n.is_read;
                      const requestId = n.metadata?.request_id;
                      const loading = actionLoading === n.id;

                      return (
                        <div
                          key={n.id}
                          className={cn(
                            'px-5 py-3.5 transition-colors',
                            !n.is_read && 'bg-primary/[0.03]'
                          )}
                        >
                          <div className="flex gap-3">
                            {/* Icon / Avatar */}
                            <div className="flex-shrink-0 mt-0.5">
                              {n.metadata?.from_agent_name ? (
                                <img
                                  src={getAgentAvatarUrl(n.metadata.from_agent_name)}
                                  alt=""
                                  className="w-9 h-9 rounded-full"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                                  {getNotificationIcon(n.type)}
                                </div>
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-medium leading-snug">{n.title}</p>
                                {!n.is_read && (
                                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                                )}
                              </div>
                              {n.content && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.content}</p>
                              )}
                              <p className="text-[11px] text-muted-foreground/60 mt-1">{formatTime(n.created_at)}</p>

                              {/* Action buttons for pending DM requests */}
                              {isAction && requestId && (
                                <div className="flex gap-2 mt-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleApprove(requestId, n.id)}
                                    disabled={loading}
                                    className="rounded-full h-7 px-3 text-xs gap-1"
                                  >
                                    {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                    {t('notifications.accept') || 'Accept'}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleReject(requestId, n.id)}
                                    disabled={loading}
                                    className="rounded-full h-7 px-3 text-xs gap-1"
                                  >
                                    <XCircle className="h-3 w-3" />
                                    {t('notifications.decline') || 'Decline'}
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ============================================
// Mobile-optimised full-page notification list
// Reused by MeTab → "notifications" sub-view
// ============================================
export function MobileNotificationList() {
  const { t, locale } = useI18n();
  const { unreadCount, setUnreadCount } = useUnreadNotificationCount();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/gateway/v1/notifications?limit=50')
      .then(r => r.json())
      .then(result => {
        if (result.success && result.data?.notifications) {
          setNotifications(result.data.notifications);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/gateway/v1/notifications/read-all', { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
  };

  const handleApprove = async (requestId: string, notificationId: string) => {
    setActionLoading(notificationId);
    try {
      const res = await fetch(`/api/gateway/v1/dm/requests/${requestId}/approve`, { method: 'POST' });
      const result = await res.json();
      if (result.success) {
        toast.success(t('notifications.accepted') || 'Friend request accepted');
        setNotifications(prev => prev.map(n =>
          n.id === notificationId ? { ...n, is_read: true, type: 'dm_accepted' } : n
        ));
        setUnreadCount(prev => Math.max(0, prev - 1));
        await fetch(`/api/gateway/v1/notifications/${notificationId}/read`, { method: 'POST' });
      } else {
        toast.error(result.error?.message || 'Failed');
      }
    } catch {
      toast.error(t('notifications.networkError') || 'Network error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (requestId: string, notificationId: string) => {
    setActionLoading(notificationId);
    try {
      const res = await fetch(`/api/gateway/v1/dm/requests/${requestId}/reject`, { method: 'POST' });
      const result = await res.json();
      if (result.success) {
        toast.info(t('notifications.declined') || 'Friend request declined');
        setNotifications(prev => prev.map(n =>
          n.id === notificationId ? { ...n, is_read: true, type: 'dm_rejected' } : n
        ));
        setUnreadCount(prev => Math.max(0, prev - 1));
        await fetch(`/api/gateway/v1/notifications/${notificationId}/read`, { method: 'POST' });
      } else {
        toast.error(result.error?.message || 'Failed');
      }
    } catch {
      toast.error(t('notifications.networkError') || 'Network error');
    } finally {
      setActionLoading(null);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'dm_request': return <UserPlus className="h-4 w-4 text-blue-500" />;
      case 'dm_accepted': return <UserCheck className="h-4 w-4 text-green-500" />;
      case 'dm_rejected': return <XCircle className="h-4 w-4 text-red-400" />;
      case 'referral_registered': return <Gift className="h-4 w-4 text-purple-500" />;
      case 'exploration_ready': return <Sparkles className="h-4 w-4 text-amber-500" />;
      case 'rule_change': return <Shield className="h-4 w-4 text-indigo-500" />;
      default: return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('notifications.justNow') || 'Just now';
    if (mins < 60) return (t('notifications.minutesAgo') || '{count}m ago').replace('{count}', String(mins));
    const hours = Math.floor(mins / 60);
    if (hours < 24) return (t('notifications.hoursAgo') || '{count}h ago').replace('{count}', String(hours));
    const days = Math.floor(hours / 24);
    return (t('notifications.daysAgo') || '{count}d ago').replace('{count}', String(days));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="pb-4">
      {/* Mark-all-read bar */}
      {unreadCount > 0 && (
        <div className="px-4 py-2 flex items-center justify-between border-b border-border/20">
          <span className="text-xs text-muted-foreground">
            {(t('notifications.unread') || '{count} unread').replace('{count}', String(unreadCount))}
          </span>
          <button
            onClick={handleMarkAllRead}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            {t('notifications.markAllRead') || 'Mark all read'}
          </button>
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Bell className="h-12 w-12 mx-auto mb-3 opacity-15" />
          <p className="text-sm">{t('notifications.noNotifications') || 'No notifications yet'}</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {t('notifications.noNotificationsHint') || 'Friend requests and alerts will appear here'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/20">
          {notifications.map((n) => {
            const isAction = n.type === 'dm_request' && !n.is_read;
            const requestId = n.metadata?.request_id;
            const loading = actionLoading === n.id;

            return (
              <div
                key={n.id}
                className={cn(
                  'px-4 py-3.5 transition-colors',
                  !n.is_read && 'bg-primary/[0.03]'
                )}
              >
                <div className="flex gap-3">
                  {/* Avatar / Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {n.metadata?.from_agent_name ? (
                      <img
                        src={getAgentAvatarUrl(n.metadata.from_agent_name)}
                        alt=""
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        {getIcon(n.type)}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug">{n.title}</p>
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                    {n.content && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.content}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground/60 mt-1">{formatTime(n.created_at)}</p>

                    {/* Action buttons for pending DM requests */}
                    {isAction && requestId && (
                      <div className="flex gap-2 mt-2.5">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(requestId, n.id)}
                          disabled={loading}
                          className="rounded-full h-8 px-4 text-xs gap-1.5"
                        >
                          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          {t('notifications.accept') || 'Accept'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReject(requestId, n.id)}
                          disabled={loading}
                          className="rounded-full h-8 px-4 text-xs gap-1.5"
                        >
                          <XCircle className="h-3 w-3" />
                          {t('notifications.decline') || 'Decline'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
