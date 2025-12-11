import { NextResponse } from "next/server";

/**
 * Public configuration endpoint that exposes runtime environment variables to the client.
 * This solves the Next.js limitation where NEXT_PUBLIC_* vars are only available at build time.
 */
export async function GET() {
  const apiUrl = process.env.VEXA_API_URL || process.env.NEXT_PUBLIC_VEXA_API_URL || "http://localhost:18056";

  // Derive WebSocket URL from API URL
  let wsUrl = process.env.NEXT_PUBLIC_VEXA_WS_URL;

  if (!wsUrl) {
    // Convert http(s) to ws(s)
    wsUrl = apiUrl.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');
    // Append /ws if not already there
    wsUrl = wsUrl.endsWith('/ws') ? wsUrl : `${wsUrl.replace(/\/$/, '')}/ws`;
  }

  return NextResponse.json({
    wsUrl,
    apiUrl: process.env.NEXT_PUBLIC_VEXA_API_URL || apiUrl,
  });
}
