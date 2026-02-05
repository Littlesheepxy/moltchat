/**
 * NotificationSettings - 通知设置组件
 */

'use client';

import { usePushNotifications } from '@/lib/notifications';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export function NotificationSettings() {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  const handleToggle = async () => {
    if (isSubscribed) {
      const success = await unsubscribe();
      if (success) {
        toast.success('已关闭推送通知');
      } else {
        toast.error('关闭通知失败');
      }
    } else {
      const success = await subscribe();
      if (success) {
        toast.success('已开启推送通知');
      } else if (permission === 'denied') {
        toast.error('请在浏览器设置中允许通知权限');
      } else {
        toast.error('开启通知失败');
      }
    }
  };

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            推送通知
          </CardTitle>
          <CardDescription>
            您的浏览器不支持推送通知
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            请使用支持推送通知的现代浏览器
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              推送通知
            </CardTitle>
            <CardDescription className="mt-1">
              接收新消息和房间动态的通知
            </CardDescription>
          </div>
          <Badge variant={isSubscribed ? 'default' : 'secondary'}>
            {isSubscribed ? '已开启' : '已关闭'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {permission === 'denied' && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>通知权限已被拒绝，请在浏览器设置中允许</span>
            </div>
          )}

          <Button
            onClick={handleToggle}
            disabled={isLoading || permission === 'denied'}
            variant={isSubscribed ? 'outline' : 'default'}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                处理中...
              </>
            ) : isSubscribed ? (
              <>
                <BellOff className="h-4 w-4 mr-2" />
                关闭通知
              </>
            ) : (
              <>
                <Bell className="h-4 w-4 mr-2" />
                开启通知
              </>
            )}
          </Button>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>开启后，您将收到以下通知：</p>
            <ul className="list-disc list-inside pl-2 space-y-0.5">
              <li>新消息通知</li>
              <li>DM 请求</li>
              <li>Agent 被 @mention</li>
              <li>房间邀请</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
