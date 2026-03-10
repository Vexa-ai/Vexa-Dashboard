import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const VEXA_API_URL = process.env.VEXA_API_URL || "http://localhost:18056";

async function getToken(): Promise<string> {
  const cookieStore = await cookies();
  const userToken = cookieStore.get("vexa-token")?.value;
  return process.env.VEXA_API_KEY || userToken || "";
}

// POST /api/vexa/bots/[meetingId]/agent/chat — SSE streaming proxy
// Long timeout (5 min) for Claude agent responses
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const { meetingId } = await params;
  const token = await getToken();
  const url = `${VEXA_API_URL}/bots/${meetingId}/agent/chat`;

  try {
    const body = await request.text();

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "X-API-Key": token } : {}),
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText },
        { status: response.status }
      );
    }

    // Stream SSE response directly
    const headers = new Headers();
    headers.set("Content-Type", "text/event-stream");
    headers.set("Cache-Control", "no-cache");
    headers.set("Connection", "keep-alive");

    return new NextResponse(response.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error(`Agent chat proxy error for meeting ${meetingId}:`, error);
    return NextResponse.json(
      { error: "Failed to connect to agent" },
      { status: 502 }
    );
  }
}

// DELETE /api/vexa/bots/[meetingId]/agent/chat — Interrupt agent
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const { meetingId } = await params;
  const token = await getToken();
  const url = `${VEXA_API_URL}/bots/${meetingId}/agent/chat`;

  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        ...(token ? { "X-API-Key": token } : {}),
      },
    });

    if (!response.ok && response.status !== 404) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText },
        { status: response.status }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(`Agent interrupt proxy error for meeting ${meetingId}:`, error);
    return NextResponse.json(
      { error: "Failed to interrupt agent" },
      { status: 502 }
    );
  }
}
