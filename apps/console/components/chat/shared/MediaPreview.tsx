/**
 * MediaPreview - 媒体预览组件
 * 
 * 支持图片预览、放大查看
 */

'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { X, ZoomIn, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MediaPreviewProps {
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  alt?: string;
  className?: string;
}

export function MediaPreview({ type, url, thumbnailUrl, alt, className }: MediaPreviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className={cn('flex items-center justify-center bg-muted rounded-lg p-4', className)}>
        <span className="text-sm text-muted-foreground">加载失败</span>
      </div>
    );
  }

  if (type === 'image') {
    return (
      <>
        {/* 缩略图 */}
        <div
          className={cn(
            'relative inline-block max-w-sm rounded-lg overflow-hidden cursor-pointer group',
            className
          )}
          onClick={() => setIsFullscreen(true)}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          <img
            src={thumbnailUrl || url}
            alt={alt || '图片'}
            className={cn(
              'max-w-full max-h-80 object-contain',
              isLoading && 'opacity-0'
            )}
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* 全屏预览 */}
        {isFullscreen && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setIsFullscreen(false)}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-white hover:bg-white/20"
              onClick={() => setIsFullscreen(false)}
            >
              <X className="h-6 w-6" />
            </Button>
            <img
              src={url}
              alt={alt || '图片'}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </>
    );
  }

  // 视频预览
  return (
    <video
      src={url}
      controls
      className={cn('max-w-sm rounded-lg', className)}
    >
      您的浏览器不支持视频播放
    </video>
  );
}
