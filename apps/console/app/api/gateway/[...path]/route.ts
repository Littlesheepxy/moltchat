/**
 * Catch-all API proxy for Gateway requests
 * 
 * Routes: /api/gateway/v1/... → http://gateway:3002/v1/...
 * 
 * Why: Session cookies are httpOnly + set on moltchat.live domain.
 * Cross-origin requests to api.moltchat.live don't receive cookies.
 * This same-origin proxy receives cookies automatically and forwards
 * the session token as an Authorization header to the gateway.
 */

import { NextRequest, NextResponse } from 'next/server';

// Use internal Docker network URL for server-to-server calls
const GATEWAY_URL = process.env.GATEWAY_INTERNAL_URL
  || process.env.NEXT_PUBLIC_GATEWAY_URL
  || 'http://localhost:3002';

function extractToken(request: NextRequest): string | null {
  const cookie = request.cookies.get('moltchat.session_token')?.value
    || request.cookies.get('__Secure-moltchat.session_token')?.value;
  
  if (cookie) {
    // Strip Better Auth cookieCache suffix (token.cachedData → token)
    const dotIndex = cookie.indexOf('.');
    return dotIndex > 0 ? cookie.substring(0, dotIndex) : cookie;
  }
  return null;
}

async function proxyRequest(request: NextRequest, method: string) {
  try {
    // Extract the gateway path from the URL
    const url = new URL(request.url);
    const gatewayPath = url.pathname.replace('/api/gateway', '');
    const queryString = url.search;
    const targetUrl = `${GATEWAY_URL}${gatewayPath}${queryString}`;

    // Build headers
    const headers: Record<string, string> = {};
    
    // Forward content-type
    const contentType = request.headers.get('content-type');
    if (contentType) {
      headers['Content-Type'] = contentType;
    }

    // Add auth token from cookie
    const token = extractToken(request);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Forward request
    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    // Include body for non-GET requests
    if (method !== 'GET' && method !== 'HEAD') {
      try {
        const body = await request.text();
        if (body) {
          fetchOptions.body = body;
        }
      } catch {
        // No body
      }
    }

    const res = await fetch(targetUrl, fetchOptions);
    const data = await res.text();

    // Return response with same status and content-type
    return new NextResponse(data, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('content-type') || 'application/json',
      },
    });
  } catch (error) {
    console.error('[GatewayProxy] error:', error);
    return NextResponse.json(
      { success: false, error: 'Gateway proxy error' },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest) {
  return proxyRequest(request, 'GET');
}

export async function POST(request: NextRequest) {
  return proxyRequest(request, 'POST');
}

export async function PUT(request: NextRequest) {
  return proxyRequest(request, 'PUT');
}

export async function PATCH(request: NextRequest) {
  return proxyRequest(request, 'PATCH');
}

export async function DELETE(request: NextRequest) {
  return proxyRequest(request, 'DELETE');
}
