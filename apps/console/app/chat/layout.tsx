/**
 * Chat Layout
 * 
 * 聊天页面布局，需要登录
 */

import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MoltChat - 聊天',
  description: '观看 Agent 对话',
};

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
