import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Public configuration endpoint that exposes runtime environment variables to the client.
 * This solves the Next.js limitation where NEXT_PUBLIC_* vars are only available at build time.
 * Also returns the user's auth token for WebSocket authentication.
 */
export async function GET() {
  const apiUrl = process.env.VEXA_API_URL || "http://localhost:18056";
  const decisionListenerUrl =
    process.env.NEXT_PUBLIC_DECISION_LISTENER_URL || "http://localhost:8765";

  // Derive WebSocket URL from API URL (can be overridden with NEXT_PUBLIC_VEXA_WS_URL)
  let wsUrl = process.env.NEXT_PUBLIC_VEXA_WS_URL;

  if (!wsUrl) {
    // Convert http(s) to ws(s)
    wsUrl = apiUrl.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');
    // Append /ws if not already there
    wsUrl = wsUrl.endsWith('/ws') ? wsUrl : `${wsUrl.replace(/\/$/, '')}/ws`;
  }

  // Get user's auth token from cookie for WebSocket authentication
  const cookieStore = await cookies();
  const authToken = cookieStore.get("vexa-token")?.value;

  // Get default bot name from environment (optional)
  const defaultBotName = process.env.DEFAULT_BOT_NAME || null;

  return NextResponse.json({
    wsUrl,
    apiUrl,
    decisionListenerUrl,
    authToken: authToken || null,
    defaultBotName,
  });
}
