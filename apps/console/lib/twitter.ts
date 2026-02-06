/**
 * Twitter/X 相关工具函数
 * 用于推文验证流程
 */

/**
 * 生成随机推荐码
 */
export function generateReferralCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * 验证推文 URL 是否有效
 */
export function validateTweetUrl(url: string): boolean {
  if (!url || !url.trim()) {
    return false;
  }
  return url.includes('twitter.com/') || url.includes('x.com/');
}

/**
 * 打开 Twitter Intent 发推窗口
 */
export function openTwitterIntent(text: string): void {
  const encodedText = encodeURIComponent(text);
  window.open(
    `https://twitter.com/intent/tweet?text=${encodedText}`,
    '_blank',
    'width=550,height=420'
  );
}

/**
 * 复制文本到剪贴板
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
