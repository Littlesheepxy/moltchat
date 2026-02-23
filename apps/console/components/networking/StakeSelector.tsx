'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Shield, Clock, Award } from 'lucide-react';

export interface StakeData {
  type: 'commitment' | 'time' | 'reputation';
  commitment_description?: string;
  reputation_points?: number;
}

interface StakeSelectorProps {
  value: StakeData | null;
  onChange: (stake: StakeData | null) => void;
}

const STAKE_OPTIONS = [
  {
    type: 'commitment' as const,
    label: '承诺押金',
    description: '承诺为对方做一件小事',
    icon: Award,
    color: 'border-blue-500 bg-blue-500/5',
  },
  {
    type: 'time' as const,
    label: '时间押金',
    description: '愿意先回答验证问题',
    icon: Clock,
    color: 'border-green-500 bg-green-500/5',
  },
  {
    type: 'reputation' as const,
    label: '声誉押金',
    description: '质押声誉分，好评返还',
    icon: Shield,
    color: 'border-purple-500 bg-purple-500/5',
  },
];

export default function StakeSelector({ value, onChange }: StakeSelectorProps) {
  const [commitmentText, setCommitmentText] = useState(value?.commitment_description || '');
  const [repPoints, setRepPoints] = useState(value?.reputation_points || 10);

  function selectType(type: StakeData['type']) {
    if (value?.type === type) {
      onChange(null);
      return;
    }

    if (type === 'commitment') {
      onChange({ type, commitment_description: commitmentText });
    } else if (type === 'reputation') {
      onChange({ type, reputation_points: repPoints });
    } else {
      onChange({ type });
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">触达押金（可选）</p>
      <div className="grid grid-cols-3 gap-2">
        {STAKE_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = value?.type === opt.type;

          return (
            <button
              key={opt.type}
              onClick={() => selectType(opt.type)}
              className={`p-3 rounded-lg border-2 text-left transition-all ${
                isSelected ? opt.color : 'border-transparent hover:border-muted-foreground/20'
              }`}
            >
              <Icon className="h-5 w-5 mb-1.5" />
              <div className="text-xs font-medium">{opt.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{opt.description}</div>
            </button>
          );
        })}
      </div>

      {/* Commitment detail */}
      {value?.type === 'commitment' && (
        <Textarea
          placeholder="描述你的承诺（如：帮你分析竞品、介绍一位投资人...）"
          value={commitmentText}
          onChange={(e) => {
            setCommitmentText(e.target.value);
            onChange({ type: 'commitment', commitment_description: e.target.value });
          }}
          rows={2}
          className="text-sm"
        />
      )}

      {/* Reputation detail */}
      {value?.type === 'reputation' && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">质押</span>
          <Input
            type="number"
            min={1}
            max={50}
            value={repPoints}
            onChange={(e) => {
              const pts = Math.min(50, Math.max(1, parseInt(e.target.value) || 10));
              setRepPoints(pts);
              onChange({ type: 'reputation', reputation_points: pts });
            }}
            className="w-20 text-center"
          />
          <span className="text-sm text-muted-foreground">声誉分</span>
        </div>
      )}
    </div>
  );
}
