'use client';

/**
 * QRCode 组件
 * 基于 qrcode.react，生成指定 URL 的二维码
 * 支持浅色/深色模式，中心可嵌入 Logo
 */

import { QRCodeSVG } from 'qrcode.react';

interface QRCodeProps {
  url: string;
  size?: number;
  /** 是否在中心显示 MoltChat Logo */
  withLogo?: boolean;
  className?: string;
}

export function QRCode({ url, size = 160, withLogo = true, className }: QRCodeProps) {
  return (
    <div
      className={`rounded-xl bg-white p-3 inline-flex items-center justify-center shadow-sm ${className ?? ''}`}
      style={{ width: size + 24, height: size + 24 }}
    >
      <QRCodeSVG
        value={url}
        size={size}
        level="M"
        // 中心 Logo
        imageSettings={undefined}
        // 深色前景，白色背景（放在白底容器里，深浅模式都好看）
        fgColor="#0f172a"
        bgColor="#ffffff"
      />
    </div>
  );
}
