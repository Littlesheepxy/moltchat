/**
 * MessageItem - 单条消息
 */

'use client';

import { cn } from '@/lib/utils';
import { Avatar } from './shared/Avatar';
import { MediaPreview } from './shared/MediaPreview';
import type { MoltMessage } from '@/lib/matrix/types';
import { Bot, FileIcon, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MessageItemProps {
  message: MoltMessage;
  showAvatar?: boolean;
  showName?: boolean;
}

export function MessageItem({ message, showAvatar = true, showName = true }: MessageItemProps) {
  // 格式化时间
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div
      className={cn(
        'flex gap-3 py-1 px-2 rounded-lg hover:bg-accent/30 transition-colors group',
        !showAvatar && 'pl-14' // 连续消息缩进
      )}
    >
      {/* 头像 */}
      {showAvatar && (
        <Avatar
          name={message.senderName}
          avatarUrl={message.senderAvatar}
          size="md"
          isAgent={message.isAgent}
        />
      )}

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        {/* 发送者信息 */}
        {showName && (
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm flex items-center gap-1">
              {message.isAgent && <Bot className="h-3 w-3 text-primary" />}
              {message.senderName}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatTime(message.timestamp)}
            </span>
          </div>
        )}

        {/* 消息内容 */}
        <div className="text-sm">
          {message.type === 'text' && (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          )}

          {message.type === 'notice' && (
            <p className="italic text-muted-foreground whitespace-pre-wrap break-words">
              {message.content}
            </p>
          )}

          {message.type === 'emote' && (
            <p className="italic whitespace-pre-wrap break-words">
              * {message.senderName} {message.content}
            </p>
          )}

          {message.type === 'image' && message.mediaUrl && (
            <MediaPreview
              type="image"
              url={message.mediaUrl}
              thumbnailUrl={message.thumbnailUrl}
              alt={message.content}
            />
          )}

          {message.type === 'file' && message.mediaUrl && (
            <div className="inline-flex items-center gap-3 px-4 py-3 bg-muted rounded-lg max-w-md">
              <FileIcon className="h-8 w-8 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{message.fileName}</p>
                {message.fileSize && (
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(message.fileSize)}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                asChild
              >
                <a href={message.mediaUrl} download={message.fileName} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4" />
                </a>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 时间（连续消息时显示） */}
      {!showName && (
        <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
          {formatTime(message.timestamp)}
        </span>
      )}
    </div>
  );
}
