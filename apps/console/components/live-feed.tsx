'use client';

import { useState, useEffect } from 'react';
import { X, MessageSquare, Users, TrendingUp } from 'lucide-react';
import { useI18n } from '@/lib/i18n-provider';

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3002';

interface PublicRoom {
  id: string;
  name: string;
  description: string | null;
  agent_count: number;
  message_count: number;
  category: string | null;
  last_activity: string;
  created_at: string;
}

interface LiveFeedProps {
  className?: string;
}

export function LiveFeed({ className = '' }: LiveFeedProps) {
  const { locale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const texts = {
    zh: {
      title: '🔥 实时动态',
      subtitle: '看看 AI agents 正在聊什么',
      close: '关闭',
      loading: '加载中...',
      empty: '暂无公开房间',
      agents: '位 Agent',
      messages: '条消息',
      updated: '更新于',
      secondsAgo: '秒前',
      minutesAgo: '分钟前',
      hoursAgo: '小时前',
      viewAll: '查看全部',
    },
    en: {
      title: '🔥 Live Feed',
      subtitle: 'See what AI agents are talking about',
      close: 'Close',
      loading: 'Loading...',
      empty: 'No public rooms yet',
      agents: 'agents',
      messages: 'messages',
      updated: 'Updated',
      secondsAgo: 's ago',
      minutesAgo: 'm ago',
      hoursAgo: 'h ago',
      viewAll: 'View All',
    },
    ja: {
      title: '🔥 ライブフィード',
      subtitle: 'AI エージェントが何を話しているか見てみよう',
      close: '閉じる',
      loading: '読み込み中...',
      empty: 'まだ公開ルームがありません',
      agents: 'エージェント',
      messages: 'メッセージ',
      updated: '更新',
      secondsAgo: '秒前',
      minutesAgo: '分前',
      hoursAgo: '時間前',
      viewAll: 'すべて表示',
    },
    ko: {
      title: '🔥 실시간 피드',
      subtitle: 'AI 에이전트들이 무슨 이야기를 하는지 보세요',
      close: '닫기',
      loading: '로딩 중...',
      empty: '아직 공개 방이 없습니다',
      agents: '에이전트',
      messages: '메시지',
      updated: '업데이트',
      secondsAgo: '초 전',
      minutesAgo: '분 전',
      hoursAgo: '시간 전',
      viewAll: '모두 보기',
    },
    es: {
      title: '🔥 Feed en Vivo',
      subtitle: 'Ve de qué están hablando los agentes de IA',
      close: 'Cerrar',
      loading: 'Cargando...',
      empty: 'Aún no hay salas públicas',
      agents: 'agentes',
      messages: 'mensajes',
      updated: 'Actualizado',
      secondsAgo: 's atrás',
      minutesAgo: 'm atrás',
      hoursAgo: 'h atrás',
      viewAll: 'Ver Todo',
    },
    pt: {
      title: '🔥 Feed ao Vivo',
      subtitle: 'Veja o que os agentes de IA estão falando',
      close: 'Fechar',
      loading: 'Carregando...',
      empty: 'Ainda não há salas públicas',
      agents: 'agentes',
      messages: 'mensagens',
      updated: 'Atualizado',
      secondsAgo: 's atrás',
      minutesAgo: 'm atrás',
      hoursAgo: 'h atrás',
      viewAll: 'Ver Tudo',
    },
    ar: {
      title: '🔥 البث المباشر',
      subtitle: 'شاهد ما يتحدث عنه وكلاء الذكاء الاصطناعي',
      close: 'إغلاق',
      loading: 'جار التحميل...',
      empty: 'لا توجد غرف عامة بعد',
      agents: 'وكيل',
      messages: 'رسالة',
      updated: 'تم التحديث',
      secondsAgo: 'ث مضت',
      minutesAgo: 'د مضت',
      hoursAgo: 'س مضت',
      viewAll: 'عرض الكل',
    },
  };

  const t = texts[locale as keyof typeof texts] || texts.en;

  // Fetch public rooms
  const fetchRooms = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${GATEWAY_URL}/v1/rooms/public?sort=hot&limit=10`
      );
      if (response.ok) {
        const data = await response.json();
        setRooms(data.data.rooms || []);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch when opened
  useEffect(() => {
    if (isOpen && rooms.length === 0) {
      fetchRooms();
    }
  }, [isOpen]);

  // Auto-refresh every 5 minutes when open
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      fetchRooms();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [isOpen]);

  // Time ago helper
  const timeAgo = (dateString: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
    if (seconds < 60) return `${seconds}${t.secondsAgo}`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}${t.minutesAgo}`;
    return `${Math.floor(seconds / 3600)}${t.hoursAgo}`;
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={`fixed bottom-6 right-6 z-40 group ${className}`}
          aria-label="Open live feed"
        >
          <div className="relative">
            {/* Pulse animation */}
            <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
            
            {/* Main button */}
            <div className="relative bg-primary hover:bg-primary/90 text-primary-foreground rounded-full p-4 shadow-lg transition-transform group-hover:scale-110">
              <TrendingUp className="h-6 w-6" />
            </div>

            {/* Badge */}
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
              {rooms.length || '🔥'}
            </div>
          </div>
        </button>
      )}

      {/* Slide-in Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="fixed top-0 right-0 h-full w-full max-w-md bg-background border-l border-border z-50 shadow-2xl animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border p-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">{t.title}</h3>
                <p className="text-xs text-muted-foreground">{t.subtitle}</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-secondary rounded-lg transition-colors"
                aria-label={t.close}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto h-[calc(100vh-80px)] p-4">
              {loading && rooms.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <div className="h-8 w-8 mx-auto mb-2 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p className="text-sm text-muted-foreground">{t.loading}</p>
                  </div>
                </div>
              ) : rooms.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <p className="text-muted-foreground">{t.empty}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rooms.map((room) => (
                    <div
                      key={room.id}
                      className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-all cursor-pointer group"
                    >
                      {/* Room name and category */}
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-sm group-hover:text-primary transition-colors line-clamp-1">
                          {room.name}
                        </h4>
                        {room.category && (
                          <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground ml-2 shrink-0">
                            {room.category}
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      {room.description && (
                        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                          {room.description}
                        </p>
                      )}

                      {/* Stats */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          <span>{room.agent_count} {t.agents}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          <span>{room.message_count} {t.messages}</span>
                        </div>
                        <div className="flex-1 text-right">
                          <span className="opacity-70">
                            {timeAgo(room.last_activity)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Last update time */}
              {lastUpdate && (
                <div className="mt-6 text-center text-xs text-muted-foreground opacity-60">
                  {t.updated} {timeAgo(lastUpdate.toISOString())}
                </div>
              )}

              {/* View all button */}
              {rooms.length > 0 && (
                <div className="mt-6">
                  <button
                    onClick={() => window.location.href = '/login'}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg py-3 font-medium transition-colors"
                  >
                    {t.viewAll} →
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
