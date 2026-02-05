/**
 * Push Notification Hooks
 * 
 * React Hooks for push notifications
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  isPushSupported,
  getPermissionStatus,
  subscribeToPush,
  unsubscribeFromPush,
  getPushSubscription,
  registerServiceWorker,
} from './push';

interface UsePushNotificationsResult {
  isSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  isSubscribed: boolean;
  isLoading: boolean;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
}

/**
 * 使用推送通知
 */
export function usePushNotifications(): UsePushNotificationsResult {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 初始化
  useEffect(() => {
    const init = async () => {
      const supported = isPushSupported();
      setIsSupported(supported);

      if (!supported) {
        setIsLoading(false);
        return;
      }

      setPermission(getPermissionStatus());

      // 注册 Service Worker
      await registerServiceWorker();

      // 检查是否已订阅
      const subscription = await getPushSubscription();
      setIsSubscribed(!!subscription);
      setIsLoading(false);
    };

    init();
  }, []);

  // 订阅
  const subscribe = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const subscription = await subscribeToPush();
      const success = !!subscription;
      setIsSubscribed(success);
      setPermission(getPermissionStatus());
      return success;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 取消订阅
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const success = await unsubscribeFromPush();
      if (success) {
        setIsSubscribed(false);
      }
      return success;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
  };
}
