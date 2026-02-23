'use client';

/**
 * CreatePostDialog — 发布临时需求卡片
 * 支持：组局 / 招聘 / 找资源 / 找合作 / 其他
 */

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Loader2, Coffee, Briefcase, Wrench, Link2, MoreHorizontal } from 'lucide-react';

// ============================================
// Types
// ============================================

type RequestType = 'meetup' | 'hiring' | 'resource' | 'collab' | 'other';

interface CreatePostDialogProps {
  roomId: string;
  roomName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const REQUEST_TYPES: { type: RequestType; icon: React.ElementType; label: string; placeholder: string; desc: string }[] = [
  {
    type: 'meetup',
    icon: Coffee,
    label: '组局',
    placeholder: '下周五上海，约 AI 创业者吃饭',
    desc: '约饭、线下见面、活动',
  },
  {
    type: 'hiring',
    icon: Briefcase,
    label: '招聘',
    placeholder: '招聘全栈工程师，base 上海，期权+薪资',
    desc: '招人、找联创、找实习生',
  },
  {
    type: 'resource',
    icon: Wrench,
    label: '找资源',
    placeholder: '需要一个能快速交付的 AI 外包团队',
    desc: '找供应商、找服务、找资金',
  },
  {
    type: 'collab',
    icon: Link2,
    label: '找合作',
    placeholder: '我们有流量，寻找 AI 产品合作分成',
    desc: '商务合作、联合运营、互推',
  },
  {
    type: 'other',
    icon: MoreHorizontal,
    label: '其他',
    placeholder: '描述你的需求...',
    desc: '其他临时需求',
  },
];

const EXPIRE_OPTIONS = [
  { days: 1, label: '1 天' },
  { days: 3, label: '3 天' },
  { days: 7, label: '7 天' },
  { days: 14, label: '14 天' },
];

// ============================================
// Component
// ============================================

export function CreatePostDialog({ roomId, roomName, open, onOpenChange, onCreated }: CreatePostDialogProps) {
  const [requestType, setRequestType] = useState<RequestType>('meetup');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [expireDays, setExpireDays] = useState(7);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const selectedType = REQUEST_TYPES.find(t => t.type === requestType)!;

  const handleSubmit = async () => {
    if (!title.trim()) { setError('请填写标题'); return; }
    if (!content.trim()) { setError('请填写需求内容'); return; }

    setIsSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/gateway/v1/rooms/${roomId}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_type: 'temp_request',
          request_type: requestType,
          title: title.trim(),
          content: content.trim(),
          expires_in_days: expireDays,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onCreated();
      } else {
        setError(data.error?.message || '发布失败，请重试');
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-lg">发布临时需求</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            在「{roomName}」发布一条有时效的需求，感兴趣的人会主动联系你
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5 overflow-y-auto max-h-[70vh]">
          {/* 需求类型 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">需求类型</Label>
            <div className="grid grid-cols-5 gap-2">
              {REQUEST_TYPES.map(({ type, icon: Icon, label }) => (
                <button
                  key={type}
                  onClick={() => setRequestType(type)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all',
                    requestType === type
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border/50 text-muted-foreground hover:border-primary/30 hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-[11px] font-medium">{label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{selectedType.desc}</p>
          </div>

          {/* 标题 */}
          <div className="space-y-2">
            <Label htmlFor="post-title" className="text-sm font-medium">标题</Label>
            <Input
              id="post-title"
              placeholder={selectedType.placeholder}
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="rounded-xl h-10"
              maxLength={100}
            />
          </div>

          {/* 详细描述 */}
          <div className="space-y-2">
            <Label htmlFor="post-content" className="text-sm font-medium">详细描述</Label>
            <Textarea
              id="post-content"
              placeholder="补充更多细节，比如时间、地点、要求、联系方式..."
              value={content}
              onChange={e => setContent(e.target.value)}
              className="rounded-xl resize-none"
              rows={4}
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground text-right">{content.length}/2000</p>
          </div>

          {/* 有效期 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">有效期</Label>
            <div className="flex gap-2">
              {EXPIRE_OPTIONS.map(({ days, label }) => (
                <button
                  key={days}
                  onClick={() => setExpireDays(days)}
                  className={cn(
                    'flex-1 py-2 rounded-xl border text-sm font-medium transition-all',
                    expireDays === days
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border/50 text-muted-foreground hover:border-primary/30'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 提示 */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border/30">
            <p className="text-xs text-muted-foreground leading-relaxed">
              💡 感兴趣的人点击「感兴趣」后，你会收到通知。你可以决定是否进一步私聊。
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-muted/30 border-t border-border/50 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl"
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            className="rounded-xl gap-2"
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            发布
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
