'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { previewAlignment, type AlignmentResult } from '@/lib/api';
import { Target, CheckCircle, XCircle } from 'lucide-react';

interface AlignmentPreviewProps {
  targetUserId: string;
  activityId?: string;
  onProceed: () => void;
  onCancel: () => void;
}

const DIMENSION_LABELS: Record<string, string> = {
  intent_match: '意图匹配',
  value_exchange: '价值交换',
  industry_overlap: '行业重叠',
  tag_overlap: '标签重叠',
  behavior_history: '行为历史',
};

export default function AlignmentPreview({ targetUserId, activityId, onProceed, onCancel }: AlignmentPreviewProps) {
  const [result, setResult] = useState<AlignmentResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlignment();
  }, [targetUserId, activityId]);

  async function loadAlignment() {
    setLoading(true);
    const res = await previewAlignment(targetUserId, activityId);
    if (res.success) {
      setResult(res.data);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          <span className="ml-2 text-sm text-muted-foreground">计算对齐度...</span>
        </CardContent>
      </Card>
    );
  }

  if (!result) return null;

  const { alignment, threshold, would_pass } = result;
  const scorePercent = Math.round(alignment.score * 100);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4" />
          对齐度预览
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Score */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`text-3xl font-bold ${would_pass ? 'text-green-500' : 'text-red-500'}`}>
              {scorePercent}%
            </div>
            {would_pass ? (
              <div className="flex items-center gap-1 text-green-500 text-sm">
                <CheckCircle className="h-4 w-4" />
                通过
              </div>
            ) : (
              <div className="flex items-center gap-1 text-red-500 text-sm">
                <XCircle className="h-4 w-4" />
                未达标
              </div>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            阈值: {Math.round(threshold * 100)}%
          </div>
        </div>

        {/* Dimension Bars */}
        <div className="space-y-2">
          {Object.entries(alignment.details).filter(([k]) => k !== 'final_score').map(([key, value]) => (
            <div key={key} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{DIMENSION_LABELS[key] || key}</span>
                <span className="font-mono">{Math.round(value * 100)}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${value >= 0.5 ? 'bg-green-500' : value >= 0.3 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${value * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button variant="ghost" className="flex-1" onClick={onCancel}>
            取消
          </Button>
          <Button
            className="flex-1"
            onClick={onProceed}
            disabled={!would_pass}
          >
            {would_pass ? '继续发起' : '对齐度不足'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
