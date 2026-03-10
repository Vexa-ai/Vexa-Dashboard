import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const VEXA_API_URL = process.env.VEXA_API_URL || "http://localhost:18056";

// POST /api/vexa/bots/[meetingId]/agent/chat/reset — Reset Claude session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const { meetingId } = await params;
  const cookieStore = await cookies();
  const userToken = cookieStore.get("vexa-token")?.value;
  const token = process.env.VEXA_API_KEY || userToken || "";
  const url = `${VEXA_API_URL}/bots/${meetingId}/agent/chat/reset`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...(token ? { "X-API-Key": token } : {}),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText },
        { status: response.status }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(`Agent reset proxy error for meeting ${meetingId}:`, error);
    return NextResponse.json(
      { error: "Failed to reset session" },
      { status: 502 }
    );
  }
}
