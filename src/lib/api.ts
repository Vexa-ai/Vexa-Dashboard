import type {
  Meeting,
  TranscriptSegment,
  CreateBotRequest,
  BotConfigUpdate,
  Platform,
} from "@/types/vexa";

class VexaAPIError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message);
    this.name = "VexaAPIError";
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorText = await response.text();
    let details: unknown;
    let errorMessage = `API request failed: ${response.statusText}`;

    try {
      details = JSON.parse(errorText);
      // Extract error message from common API error formats
      if (typeof details === "object" && details !== null) {
        const errorObj = details as Record<string, unknown>;
        // FastAPI style: { "detail": "error message" }
        if (typeof errorObj.detail === "string") {
          errorMessage = errorObj.detail;
        }
        // Alternative: { "error": "error message" }
        else if (typeof errorObj.error === "string") {
          errorMessage = errorObj.error;
        }
        // Alternative: { "message": "error message" }
        else if (typeof errorObj.message === "string") {
          errorMessage = errorObj.message;
        }
      }
    } catch {
      details = errorText;
      if (errorText) {
        errorMessage = errorText;
      }
    }

    throw new VexaAPIError(errorMessage, response.status, details);
  }
  return response.json();
}

// Map raw API meeting to our Meeting type
interface RawMeeting {
  id: number;
  user_id?: number;
  platform: Platform;
  native_meeting_id: string;
  constructed_meeting_url?: string;
  status: string;
  start_time: string | null;
  end_time: string | null;
  bot_container_id: string | null;
  data: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

function mapMeeting(raw: RawMeeting): Meeting {
  return {
    id: raw.id.toString(),
    platform: raw.platform,
    platform_specific_id: raw.native_meeting_id,
    status: raw.status as Meeting["status"],
    start_time: raw.start_time,
    end_time: raw.end_time,
    bot_container_id: raw.bot_container_id,
    data: raw.data as Meeting["data"],
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

export const vexaAPI = {
  // Meetings
  async getMeetings(): Promise<Meeting[]> {
    const response = await fetch("/api/vexa/meetings");
    const data = await handleResponse<{ meetings: RawMeeting[] }>(response);
    return (data.meetings || []).map(mapMeeting);
  },

  async getMeeting(id: string): Promise<Meeting> {
    const response = await fetch(`/api/vexa/meetings/${id}`);
    return handleResponse<Meeting>(response);
  },

  // Transcripts
  async getTranscripts(
    platform: Platform,
    nativeId: string
  ): Promise<TranscriptSegment[]> {
    const response = await fetch(`/api/vexa/transcripts/${platform}/${nativeId}`);
    interface RawSegment {
      start: number;
      end: number;
      text: string;
      speaker: string;
      language: string;
      absolute_start_time: string;
      absolute_end_time: string;
      created_at: string;
    }
    interface RawTranscriptResponse {
      segments: RawSegment[];
    }
    const data = await handleResponse<RawTranscriptResponse>(response);
    // Map API fields to our types (start -> start_time, end -> end_time)
    return (data.segments || []).map((seg, index) => ({
      id: `${index}`,
      meeting_id: nativeId,
      start_time: seg.start,
      end_time: seg.end,
      absolute_start_time: seg.absolute_start_time,
      absolute_end_time: seg.absolute_end_time,
      text: seg.text,
      speaker: seg.speaker,
      language: seg.language,
      session_uid: "",
      created_at: seg.created_at,
    }));
  },

  // Bots
  async createBot(request: CreateBotRequest): Promise<Meeting> {
    const response = await fetch("/api/vexa/bots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const raw = await handleResponse<RawMeeting>(response);
    return mapMeeting(raw);
  },

  async stopBot(platform: Platform, nativeId: string): Promise<void> {
    const response = await fetch(`/api/vexa/bots/${platform}/${nativeId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new VexaAPIError(
        "Failed to stop bot",
        response.status,
        await response.text()
      );
    }
  },

  async updateBotConfig(
    platform: Platform,
    nativeId: string,
    config: BotConfigUpdate
  ): Promise<void> {
    const response = await fetch(`/api/vexa/bots/${platform}/${nativeId}/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (!response.ok) {
      throw new VexaAPIError(
        "Failed to update bot config",
        response.status,
        await response.text()
      );
    }
  },

  // Bot status - check if bots are actually running
  async getBotStatus(): Promise<{ running_bots: Array<{ container_id: string; meeting_id: number; platform: string; native_meeting_id: string }> }> {
    const response = await fetch("/api/vexa/bots/status");
    return handleResponse<{ running_bots: Array<{ container_id: string; meeting_id: number; platform: string; native_meeting_id: string }> }>(response);
  },

  // Check if a specific bot is running
  async isBotRunning(platform: Platform, nativeId: string): Promise<boolean> {
    try {
      const status = await this.getBotStatus();
      return status.running_bots.some(
        (bot) => bot.platform === platform && bot.native_meeting_id === nativeId
      );
    } catch {
      return false;
    }
  },

  // Connection test
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch("/api/vexa/meetings");
      if (response.ok) {
        return { success: true };
      }
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
};

export { VexaAPIError };
