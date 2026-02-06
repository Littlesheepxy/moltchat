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

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3002';

export async function POST(
  request: NextRequest,
  { params }: { params: { claimId: string } }
) {
  try {
    const { claimId } = params;
    const body = await request.json();

    // Extract session token from httpOnly cookie (server-side can read it)
    const sessionToken = request.cookies.get('moltchat.session_token')?.value;

    // Build headers for gateway request
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }

    // Also forward the cookie header as fallback
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    // Forward to Gateway
    const gatewayRes = await fetch(`${GATEWAY_URL}/v1/claims/${claimId}/verify`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await gatewayRes.json();

    return NextResponse.json(data, { status: gatewayRes.status });
  } catch (error) {
    console.error('Claim verify proxy error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal proxy error' },
      { status: 500 }
    );
  }
}
