/**
 * Proxy route for claim verification
 * 
 * Problem: The session cookie is httpOnly + sameSite:lax, so:
 *   1. JavaScript cannot read it (httpOnly)
 *   2. Cross-origin POST won't include it (sameSite:lax → moltchat.live → api.moltchat.live)
 * 
 * Solution: This same-origin API route receives the request with the cookie attached,
 * extracts the session token server-side, and forwards it to the Gateway.
 */

import { NextRequest, NextResponse } from 'next/server';

// Use internal Docker network URL for server-side calls, fall back to public URL
const GATEWAY_INTERNAL_URL = process.env.GATEWAY_INTERNAL_URL 
  || process.env.NEXT_PUBLIC_GATEWAY_URL 
  || 'http://localhost:3002';

export async function POST(
  request: NextRequest,
  { params }: { params: { claimId: string } }
) {
  try {
    const { claimId } = params;
    const body = await request.json();

    // Extract session token from httpOnly cookie (server-side can read it)
    const sessionToken = request.cookies.get('moltchat.session_token')?.value;

    // Debug logging
    const allCookies = request.cookies.getAll().map(c => `${c.name}=${c.value.substring(0, 8)}...`);
    console.log('[ClaimProxy] cookies found:', allCookies);
    console.log('[ClaimProxy] session token found:', !!sessionToken, sessionToken ? `(${sessionToken.length} chars, starts: ${sessionToken.substring(0, 8)})` : '');
    console.log('[ClaimProxy] forwarding to:', `${GATEWAY_INTERNAL_URL}/v1/claims/${claimId}/verify`);

    // Build headers - ONLY use Authorization header, don't forward cookie
    // (cookie forwarding can cause conflicts when gateway parses wrong cookie)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }

    // Forward to Gateway
    const gatewayRes = await fetch(`${GATEWAY_INTERNAL_URL}/v1/claims/${claimId}/verify`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await gatewayRes.json();

    console.log('[ClaimProxy] gateway response:', gatewayRes.status, JSON.stringify(data).substring(0, 200));

    return NextResponse.json(data, { status: gatewayRes.status });
  } catch (error) {
    console.error('[ClaimProxy] error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal proxy error' },
      { status: 500 }
    );
  }
}
