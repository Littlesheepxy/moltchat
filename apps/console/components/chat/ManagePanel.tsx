/**
 * ManagePanel - 房间管理面板
 * 
 * 包含房间信息、成员列表、邀请 Agent、设置等
 */

'use client';

import { useState } from 'react';
import { useMatrixStore, selectActiveRoom, selectActiveMembers } from '@/stores/matrix-store';
import { useRoomMembers } from '@/lib/matrix/hooks';
import { Avatar } from './shared/Avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  X,
  Settings,
  Users,
  Bot,
  Eye,
  UserPlus,
  Crown,
  Mic,
  FileText,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

interface ManagePanelProps {
  roomId: string;
  onClose: () => void;
}

export function ManagePanel({ roomId, onClose }: ManagePanelProps) {
  const room = useMatrixStore(selectActiveRoom);
  const members = useMatrixStore(selectActiveMembers);
  const { agents, observers, refresh } = useRoomMembers(roomId);
  
  const [activeTab, setActiveTab] = useState<'members' | 'settings'>('members');

  if (!room) {
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="font-semibold">房间管理</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* 房间信息 */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Avatar name={room.name} avatarUrl={room.avatarUrl} size="lg" isRoom />
          <div className="flex-1 min-w-0">
            <h4 className="font-medium truncate">{room.name}</h4>
            <p className="text-sm text-muted-foreground">
              {room.memberCount} 成员 · {room.isPublic ? '公开' : '私密'}
            </p>
          </div>
        </div>
        {room.topic && (
          <p className="text-sm text-muted-foreground mt-3">{room.topic}</p>
        )}
      </div>

      {/* 标签页 */}
      <div className="flex border-b border-border">
        <button
          className={cn(
            'flex-1 py-2 text-sm font-medium transition-colors',
            activeTab === 'members'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setActiveTab('members')}
        >
          成员
        </button>
        <button
          className={cn(
            'flex-1 py-2 text-sm font-medium transition-colors',
            activeTab === 'settings'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setActiveTab('settings')}
        >
          设置
        </button>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'members' ? (
          <MembersTab agents={agents} observers={observers} roomId={roomId} />
        ) : (
          <SettingsTab room={room} />
        )}
      </div>
    </div>
  );
}

// 成员标签页
function MembersTab({
  agents,
  observers,
  roomId,
}: {
  agents: ReturnType<typeof selectActiveMembers>;
  observers: ReturnType<typeof selectActiveMembers>;
  roomId: string;
}) {
  return (
    <div className="p-4 space-y-6">
      {/* 邀请 Agent 按钮 */}
      <Button asChild className="w-full gap-2">
        <Link href={`/console/rooms/${encodeURIComponent(roomId)}/invite`}>
          <UserPlus className="h-4 w-4" />
          邀请 Agent
        </Link>
      </Button>

      {/* Agent 列表 */}
      <div>
        <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
          <Bot className="h-4 w-4" />
          Agent ({agents.length})
        </h5>
        <div className="space-y-2">
          {agents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">暂无 Agent</p>
          ) : (
            agents.map((member) => (
              <MemberItem key={member.userId} member={member} />
            ))
          )}
        </div>
      </div>

      {/* Observer 列表 */}
      <div>
        <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
          <Eye className="h-4 w-4" />
          观察者 ({observers.length})
        </h5>
        <div className="space-y-2">
          {observers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">暂无观察者</p>
          ) : (
            observers.map((member) => (
              <MemberItem key={member.userId} member={member} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// 成员项
function MemberItem({ member }: { member: ReturnType<typeof selectActiveMembers>[0] }) {
  // 根据 power level 判断角色
  const getRoleBadge = () => {
    if (member.powerLevel >= 100) {
      return <Badge variant="default" className="gap-1"><Crown className="h-3 w-3" /> Owner</Badge>;
    }
    if (member.powerLevel >= 50) {
      return <Badge variant="secondary" className="gap-1"><Mic className="h-3 w-3" /> Facilitator</Badge>;
    }
    if (member.powerLevel >= 30) {
      return <Badge variant="secondary" className="gap-1"><FileText className="h-3 w-3" /> Scribe</Badge>;
    }
    return null;
  };

  return (
    <div className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-accent/50">
      <Avatar
        name={member.displayName}
        avatarUrl={member.avatarUrl}
        size="sm"
        isAgent={member.isAgent}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{member.displayName}</span>
          {member.isTyping && (
            <span className="text-xs text-muted-foreground">正在输入...</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {getRoleBadge()}
          {member.isAgent && !getRoleBadge() && (
            <Badge variant="outline" className="gap-1">
              <Bot className="h-3 w-3" /> Agent
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

// 设置标签页
function SettingsTab({ room }: { room: ReturnType<typeof selectActiveRoom> }) {
  if (!room) return null;

  const settingsItems = [
    { icon: Settings, label: '房间设置', href: `/console/rooms/${encodeURIComponent(room.roomId)}/settings` },
    { icon: Users, label: '角色管理', href: `/console/rooms/${encodeURIComponent(room.roomId)}/roles` },
    { icon: Eye, label: '观察者 Token', href: `/console/rooms/${encodeURIComponent(room.roomId)}/observer` },
  ];

  return (
    <div className="p-4 space-y-2">
      {settingsItems.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className="flex items-center gap-3 py-3 px-3 rounded-lg hover:bg-accent/50 transition-colors"
        >
          <item.icon className="h-5 w-5 text-muted-foreground" />
          <span className="flex-1 text-sm">{item.label}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      ))}
    </div>
  );
}
