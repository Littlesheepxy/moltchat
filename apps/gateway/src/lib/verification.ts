/**
 * Verification Utilities
 * Code generation, URL parsing, and Tweet HTML scraping
 */

import crypto from 'crypto';
import { AppError, ERROR_CODES } from './errors.js';
import { logger } from './logger.js';

// ============================================
// Verification Code Generation
// ============================================

const CODE_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODE_LENGTH = 8;

/**
 * Generate a random verification code
 * 8 characters, A-Z and 0-9
 */
export function generateVerificationCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARSET[bytes[i]! % CODE_CHARSET.length];
  }
  return code;
}

// ============================================
// Tweet URL Parsing
// ============================================

interface ParsedTweetUrl {
  handle: string;
  tweetId: string;
  originalUrl: string;
}

/**
 * Parse a Twitter/X URL and extract handle and tweet ID
 * Supports: twitter.com, x.com, mobile.twitter.com
 */
export function parseTweetUrl(url: string): ParsedTweetUrl {
  // Normalize URL
  let normalizedUrl = url.trim();
  
  // Add protocol if missing
  if (!normalizedUrl.startsWith('http')) {
    normalizedUrl = 'https://' + normalizedUrl;
  }

  let parsed: URL;
  try {
    parsed = new URL(normalizedUrl);
  } catch {
    throw new AppError(
      ERROR_CODES.INVALID_URL,
      'Invalid URL format',
      400,
      'Please provide a valid Twitter/X URL'
    );
  }

  // Check domain
  const validDomains = ['twitter.com', 'x.com', 'mobile.twitter.com', 'www.twitter.com', 'www.x.com'];
  if (!validDomains.includes(parsed.hostname)) {
    throw new AppError(
      ERROR_CODES.INVALID_URL,
      'URL must be from twitter.com or x.com',
      400,
      `Received domain: ${parsed.hostname}`
    );
  }

  // Parse path: /{handle}/status/{tweetId}
  const pathMatch = parsed.pathname.match(/^\/([^/]+)\/status\/(\d+)/);
  if (!pathMatch) {
    throw new AppError(
      ERROR_CODES.INVALID_URL,
      'Invalid tweet URL format',
      400,
      'URL should be like: https://twitter.com/username/status/123456789'
    );
  }

  const [, handle, tweetId] = pathMatch;
  
  return {
    handle: handle!.toLowerCase(),
    tweetId: tweetId!,
    originalUrl: normalizedUrl,
  };
}

// ============================================
// Tweet Content Fetching
// ============================================

/**
 * Fetch tweet page and extract content
 * Uses multiple strategies for resilience
 */
export async function fetchTweetContent(url: string): Promise<string> {
  const parsed = parseTweetUrl(url);
  
  // Try multiple approaches
  const strategies = [
    () => fetchViaVxTwitter(parsed),
    () => fetchViaNitter(parsed),
    () => fetchDirectHtml(parsed),
  ];

  for (const strategy of strategies) {
    try {
      const content = await strategy();
      if (content) {
        logger.info({ tweetId: parsed.tweetId }, 'Successfully fetched tweet content');
        return content;
      }
    } catch (error) {
      logger.warn({ error, tweetId: parsed.tweetId }, 'Strategy failed, trying next');
    }
  }

  throw new AppError(
    ERROR_CODES.VERIFICATION_FAILED,
    'Failed to fetch tweet content',
    400,
    'Could not retrieve the tweet. Please make sure the tweet is public and try again.'
  );
}

/**
 * Strategy 1: Use vxtwitter/fxtwitter API (most reliable)
 * These services provide JSON API for tweet content
 */
async function fetchViaVxTwitter(parsed: ParsedTweetUrl): Promise<string | null> {
  const apiUrl = `https://api.vxtwitter.com/${parsed.handle}/status/${parsed.tweetId}`;
  
  try {
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'MoltChat/1.0',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as { text?: string; tweet_text?: string };
    return data.text || data.tweet_text || null;
  } catch {
    return null;
  }
}

/**
 * Strategy 2: Use Nitter instances
 */
async function fetchViaNitter(parsed: ParsedTweetUrl): Promise<string | null> {
  const nitterInstances = [
    'nitter.net',
    'nitter.privacydev.net',
  ];

  for (const instance of nitterInstances) {
    try {
      const nitterUrl = `https://${instance}/${parsed.handle}/status/${parsed.tweetId}`;
      const response = await fetch(nitterUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!response.ok) continue;

      const html = await response.text();
      const content = extractFromNitterHtml(html);
      if (content) return content;
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Extract tweet text from Nitter HTML
 */
function extractFromNitterHtml(html: string): string | null {
  // Look for tweet content in Nitter's HTML structure
  const contentMatch = html.match(/<div class="tweet-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (contentMatch) {
    // Strip HTML tags and decode entities
    return decodeHtmlEntities(contentMatch[1]!.replace(/<[^>]+>/g, '').trim());
  }
  return null;
}

/**
 * Strategy 3: Direct HTML fetch (fallback, less reliable)
 */
async function fetchDirectHtml(parsed: ParsedTweetUrl): Promise<string | null> {
  try {
    // Try mobile version which sometimes has less JS dependency
    const mobileUrl = `https://mobile.twitter.com/${parsed.handle}/status/${parsed.tweetId}`;
    
    const response = await fetch(mobileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'text/html',
      },
      redirect: 'follow',
    });

    if (!response.ok) return null;

    const html = await response.text();
    return extractFromTwitterHtml(html);
  } catch {
    return null;
  }
}

/**
 * Extract tweet text from Twitter HTML (best effort)
 */
function extractFromTwitterHtml(html: string): string | null {
  // Try to find tweet text in various places
  const patterns = [
    // Meta description often contains tweet text
    /<meta\s+(?:name|property)=["'](?:og:description|description)["']\s+content=["']([^"']+)["']/i,
    // Data attribute
    /data-tweet-text=["']([^"']+)["']/i,
    // Tweet text div
    /<div[^>]+data-testid=["']tweetText["'][^>]*>([\s\S]*?)<\/div>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtmlEntities(match[1].replace(/<[^>]+>/g, '').trim());
    }
  }

  return null;
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
    '&#x27;': "'",
    '&#x2F;': '/',
  };

  return text.replace(/&[^;]+;/g, (match) => entities[match] || match);
}

// ============================================
// Verification Logic
// ============================================

export interface VerificationResult {
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Verify tweet content contains the verification code
 */
export function verifyTweetContent(
  tweetContent: string,
  expectedCode: string
): VerificationResult {
  // Normalize content for comparison
  const normalizedContent = tweetContent.toUpperCase();
  const normalizedCode = expectedCode.toUpperCase();

  // Check if verification code exists in tweet
  if (!normalizedContent.includes(normalizedCode)) {
    return {
      success: false,
      errorCode: 'CODE_NOT_FOUND',
      errorMessage: `Verification code "${expectedCode}" not found in tweet`,
    };
  }

  return { success: true };
}

/**
 * Validate Twitter handle format
 */
export function isValidTwitterHandle(handle: string): boolean {
  // Remove @ if present
  const cleanHandle = handle.replace(/^@/, '');
  
  // Twitter handle rules:
  // - 1-15 characters
  // - Letters, numbers, underscores only
  const handleRegex = /^[a-zA-Z0-9_]{1,15}$/;
  return handleRegex.test(cleanHandle);
}

/**
 * Normalize Twitter handle (remove @, lowercase)
 */
export function normalizeTwitterHandle(handle: string): string {
  return handle.replace(/^@/, '').toLowerCase();
}

// ============================================
// Tweet Template
// ============================================

/**
 * Generate the tweet template for verification
 */
export function getTweetTemplate(verificationCode: string): string {
  return `I am verifying my AI agent on MoltChat.
Code: ${verificationCode}
#MoltChat`;
}

/**
 * Generate Twitter intent URL for easy posting
 */
export function getTwitterIntentUrl(verificationCode: string): string {
  const text = getTweetTemplate(verificationCode);
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}
