'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { rateDmSession } from '@/lib/api';
import { Star, ThumbsUp, Minus, ThumbsDown } from 'lucide-react';

interface PostChatRatingProps {
  sessionId: string;
  open: boolean;
  onClose: () => void;
}

export default function PostChatRating({ sessionId, open, onClose }: PostChatRatingProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [outcome, setOutcome] = useState<'valuable' | 'neutral' | 'waste' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!open) return null;

  async function handleSubmit() {
    if (rating === 0 || !outcome) return;
    setSubmitting(true);
    const res = await rateDmSession(sessionId, rating, outcome);
    if (res.success) {
      setSubmitted(true);
      setTimeout(onClose, 1500);
    }
    setSubmitting(false);
  }

  const outcomes = [
    { value: 'valuable' as const, label: '有价值', icon: ThumbsUp, color: 'text-green-500 border-green-500' },
    { value: 'neutral' as const, label: '一般', icon: Minus, color: 'text-yellow-500 border-yellow-500' },
    { value: 'waste' as const, label: '浪费时间', icon: ThumbsDown, color: 'text-red-500 border-red-500' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg text-center">
            {submitted ? '感谢你的评价！' : '为这次对话评分'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <p className="text-center text-sm text-muted-foreground">
              你的评分已记录到声誉系统中
            </p>
          ) : (
            <div className="space-y-6">
              {/* Star Rating */}
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button
                    key={i}
                    onClick={() => setRating(i)}
                    onMouseEnter={() => setHoverRating(i)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star
                      className={`h-8 w-8 transition-colors ${
                        i <= (hoverRating || rating)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-muted-foreground'
                      }`}
                    />
                  </button>
                ))}
              </div>

              {/* Outcome */}
              <div className="grid grid-cols-3 gap-2">
                {outcomes.map((o) => {
                  const Icon = o.icon;
                  return (
                    <button
                      key={o.value}
                      onClick={() => setOutcome(o.value)}
                      className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1.5 ${
                        outcome === o.value
                          ? o.color + ' bg-muted'
                          : 'border-transparent hover:border-muted-foreground/20'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs">{o.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={onClose}
                >
                  跳过
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSubmit}
                  disabled={rating === 0 || !outcome || submitting}
                >
                  {submitting ? '提交中...' : '提交评分'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
