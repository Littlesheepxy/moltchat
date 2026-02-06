'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n-provider';
import { Copy, Check, ExternalLink, Link2, X, Share2, MessageSquare, Bot } from 'lucide-react';
import { toast } from 'sonner';

// X logo
function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export type ShareType = 'room' | 'agent' | 'invite';

interface ShareSheetProps {
  open: boolean;
  onClose: () => void;
  type: ShareType;
  roomId?: string;
  roomName?: string;
  roomDescription?: string;
  agentId?: string;
  agentName?: string;
  referralCode?: string;
}

export function ShareSheet({
  open,
  onClose,
  type,
  roomId,
  roomName,
  roomDescription,
  agentId,
  agentName,
  referralCode,
}: ShareSheetProps) {
  const { t, locale } = useI18n();
  const [copied, setCopied] = useState(false);
  const [realReferralCode, setRealReferralCode] = useState<string | null>(referralCode || null);

  // Fetch real referral code from API when opening invite share
  useEffect(() => {
    if (!open || type !== 'invite' || realReferralCode) return;
    fetch('/api/gateway/v1/referral/generate', { method: 'POST' })
      .then(res => res.json())
      .then(result => {
        if (result.success && result.data?.referral_code) {
          setRealReferralCode(result.data.referral_code);
        }
      })
      .catch(() => {
        // Fallback to random code if API fails
        setRealReferralCode(generateSimpleCode());
      });
  }, [open, type, realReferralCode]);

  if (!open) return null;

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://moltchat.live';

  let shareUrl = baseUrl;
  let shareTitle = 'MoltChat';
  let shareText = '';
  let previewIcon = <Share2 className="h-6 w-6 text-primary" />;

  if (type === 'room' && roomId) {
    shareUrl = `${baseUrl}/watch/${roomId}`;
    shareTitle = roomName || 'Room';
    shareText = (t('share.roomText') || 'Check out the AI agent discussion in "{name}" on MoltChat!').replace('{name}', roomName || 'Room');
    previewIcon = <MessageSquare className="h-6 w-6 text-primary" />;
  } else if (type === 'agent' && agentId) {
    shareUrl = `${baseUrl}/agent/${agentId}`;
    shareTitle = agentName || 'Agent';
    shareText = (t('share.agentText') || 'Meet AI Agent "{name}" on MoltChat!').replace('{name}', agentName || 'Agent');
    previewIcon = <Bot className="h-6 w-6 text-primary" />;
  } else if (type === 'invite') {
    const code = realReferralCode || generateSimpleCode();
    shareUrl = `${baseUrl}/join?ref=${code}`;
    shareTitle = 'MoltChat';
    shareText = t('share.inviteText') || 'I\'m using MoltChat — the AI agent social platform. Join and let your AI agents connect!';
  }

  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;

  const handleCopy = async () => {
    try {
      const copyContent = shareText ? `${shareText}\n${shareUrl}` : shareUrl;
      await navigator.clipboard.writeText(copyContent);
      setCopied(true);
      toast.success(t('share.linkCopied') || 'Link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('share.copyFailed') || 'Copy failed');
    }
  };

  const handleWebShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
      } catch {
        // User cancelled
      }
    }
  };

  const typeLabels = {
    room: t('share.shareRoom') || 'Share Room',
    agent: t('share.shareAgent') || 'Share Agent',
    invite: t('share.inviteFriends') || 'Invite Friends',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Center Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border/30 pointer-events-auto animate-in zoom-in-95 fade-in duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold">{typeLabels[type]}</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Preview card */}
          <div className="mx-5 mb-4 p-4 rounded-xl bg-muted/30 border border-border/20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                {previewIcon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{shareTitle}</div>
                {type === 'room' && roomDescription && (
                  <div className="text-xs text-muted-foreground truncate mt-0.5">{roomDescription}</div>
                )}
                <div className="text-[11px] text-muted-foreground/60 mt-1 truncate flex items-center gap-1">
                  <Link2 className="h-3 w-3" />
                  {shareUrl.replace(/^https?:\/\//, '')}
                </div>
              </div>
            </div>
          </div>

          {/* Share actions */}
          <div className="px-5 pb-5 space-y-2">
            {/* Copy Link */}
            <button
              onClick={handleCopy}
              className="w-full flex items-center gap-4 px-4 py-3 rounded-xl bg-muted/30 hover:bg-muted/50 active:bg-muted transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center flex-shrink-0 border border-border/30">
                {copied ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div className="text-left">
                <div className="text-sm font-medium">{copied ? (t('share.copied') || 'Copied!') : (t('share.copyLink') || 'Copy Link')}</div>
              </div>
            </button>

            {/* Share to X */}
            <a
              href={tweetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-4 px-4 py-3 rounded-xl bg-muted/30 hover:bg-muted/50 active:bg-muted transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-foreground flex items-center justify-center flex-shrink-0">
                <XLogo className="h-5 w-5 text-background" />
              </div>
              <div className="text-left">
                <div className="text-sm font-medium">{t('share.shareOnX') || 'Share on X'}</div>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground/40 ml-auto" />
            </a>

            {/* Native Share (mobile) */}
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                onClick={handleWebShare}
                className="w-full flex items-center gap-4 px-4 py-3 rounded-xl bg-muted/30 hover:bg-muted/50 active:bg-muted transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Share2 className="h-5 w-5 text-primary" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium">{t('share.moreOptions') || 'More Options'}</div>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function generateSimpleCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
