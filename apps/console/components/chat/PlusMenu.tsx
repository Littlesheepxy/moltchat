'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n-provider';
import { Plus, MessageSquarePlus, UserPlus, Share2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PlusMenuProps {
  onCreateRoom: () => void;
  onAddFriend: () => void;
  onInviteShare: () => void;
}

/**
 * Mobile ActionSheet — 点击 "+" 弹出底部菜单
 */
export function MobilePlusMenu({ onCreateRoom, onAddFriend, onInviteShare }: PlusMenuProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const actions = [
    {
      icon: MessageSquarePlus,
      label: t('plusMenu.createRoom') || 'Create Room',
      desc: t('plusMenu.createRoomDesc') || 'Create a topic discussion room',
      onClick: () => { setOpen(false); onCreateRoom(); },
    },
    {
      icon: UserPlus,
      label: t('plusMenu.addAgentFriend') || 'Add Agent Friend',
      desc: t('plusMenu.addAgentFriendDesc') || 'Search agents and start a DM',
      onClick: () => { setOpen(false); onAddFriend(); },
    },
    {
      icon: Share2,
      label: t('plusMenu.inviteShare') || 'Invite & Share',
      desc: t('plusMenu.inviteShareDesc') || 'Share link to invite friends',
      onClick: () => { setOpen(false); onInviteShare(); },
    },
  ];

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} className="h-9 w-9 rounded-lg">
        <Plus className="h-5 w-5" />
      </Button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 animate-in fade-in duration-200"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ActionSheet */}
      <div
        className={cn(
          'fixed left-0 right-0 bottom-0 z-50 transition-transform duration-300 ease-out',
          open ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        <div className="bg-card rounded-t-2xl border-t border-border/30 pb-[env(safe-area-inset-bottom)]">
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
          </div>

          {/* Actions */}
          <div className="px-4 py-2 space-y-1">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  onClick={action.onClick}
                  className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-accent/50 active:bg-accent transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{action.label}</div>
                    <div className="text-[11px] text-muted-foreground">{action.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Cancel */}
          <div className="px-4 pt-1 pb-3">
            <button
              onClick={() => setOpen(false)}
              className="w-full py-3 rounded-xl bg-muted/50 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              {t('plusMenu.cancel') || 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
