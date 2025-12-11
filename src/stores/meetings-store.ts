import { create } from "zustand";
import type { Meeting, TranscriptSegment, Platform, MeetingStatus } from "@/types/vexa";
import { vexaAPI } from "@/lib/api";

interface MeetingsState {
  // Data
  meetings: Meeting[];
  currentMeeting: Meeting | null;
  transcripts: TranscriptSegment[];

  // Loading states
  isLoadingMeetings: boolean;
  isLoadingMeeting: boolean;
  isLoadingTranscripts: boolean;

  // Error states
  error: string | null;

  // Actions
  fetchMeetings: () => Promise<void>;
  fetchMeeting: (id: string, options?: { silent?: boolean }) => Promise<void>;
  refreshMeeting: (id: string) => Promise<void>;
  fetchTranscripts: (platform: Platform, nativeId: string) => Promise<void>;
  setCurrentMeeting: (meeting: Meeting | null) => void;
  clearCurrentMeeting: () => void;

  // Real-time updates
  addTranscriptSegment: (segment: TranscriptSegment) => void;
  updateTranscriptSegment: (segment: TranscriptSegment) => void;
  updateMeetingStatus: (meetingId: string, status: MeetingStatus) => void;

  // Utilities
  clearError: () => void;
}

export const useMeetingsStore = create<MeetingsState>((set, get) => ({
  // Initial state
  meetings: [],
  currentMeeting: null,
  transcripts: [],
  isLoadingMeetings: false,
  isLoadingMeeting: false,
  isLoadingTranscripts: false,
  error: null,

  // Fetch all meetings
  fetchMeetings: async () => {
    set({ isLoadingMeetings: true, error: null });
    try {
      const meetings = await vexaAPI.getMeetings();
      // Sort by created_at descending (most recent first)
      meetings.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      set({ meetings, isLoadingMeetings: false });
    } catch (error) {
      set({
        error: (error as Error).message,
        isLoadingMeetings: false
      });
    }
  },

  // Fetch single meeting (from list since API doesn't support /meetings/{id})
  // Use silent: true to avoid showing loading state (for polling/refresh)
  fetchMeeting: async (id: string, options?: { silent?: boolean }) => {
    const { silent = false } = options || {};

    // Only show loading state on initial load (when no currentMeeting exists)
    if (!silent) {
      set({ isLoadingMeeting: true, error: null });
    }

    try {
      // Always fetch fresh data from the API to ensure we have the latest meeting state
      const meetings = await vexaAPI.getMeetings();
      meetings.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      set({ meetings });

      const meeting = meetings.find((m) => m.id.toString() === id);

      if (meeting) {
        set({ currentMeeting: meeting, isLoadingMeeting: false });
      } else {
        set({
          error: `Meeting with ID ${id} not found`,
          isLoadingMeeting: false
        });
      }
    } catch (error) {
      set({
        error: (error as Error).message,
        isLoadingMeeting: false
      });
    }
  },

  // Silently refresh meeting data (for polling without UI flicker)
  refreshMeeting: async (id: string) => {
    try {
      const meetings = await vexaAPI.getMeetings();
      meetings.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      const meeting = meetings.find((m) => m.id.toString() === id);

      if (meeting) {
        // Only update if something changed
        const { currentMeeting } = get();
        if (currentMeeting?.status !== meeting.status ||
            currentMeeting?.updated_at !== meeting.updated_at) {
          set({ meetings, currentMeeting: meeting });
        } else {
          set({ meetings });
        }
      }
    } catch (error) {
      // Silent refresh - don't show errors for polling failures
      console.error("Failed to refresh meeting:", error);
    }
  },

  // Fetch transcripts for a meeting
  fetchTranscripts: async (platform: Platform, nativeId: string) => {
    set({ isLoadingTranscripts: true, error: null });
    try {
      const transcripts = await vexaAPI.getTranscripts(platform, nativeId);
      // Sort by start_time
      transcripts.sort((a, b) => a.start_time - b.start_time);
      set({ transcripts, isLoadingTranscripts: false });
    } catch (error) {
      set({
        error: (error as Error).message,
        isLoadingTranscripts: false
      });
    }
  },

  setCurrentMeeting: (meeting: Meeting | null) => {
    set({ currentMeeting: meeting });
  },

  clearCurrentMeeting: () => {
    set({ currentMeeting: null, transcripts: [] });
  },

  // Real-time: Add new transcript segment
  addTranscriptSegment: (segment: TranscriptSegment) => {
    const { transcripts } = get();

    // Check if segment already exists (by absolute_start_time)
    const existingIndex = transcripts.findIndex(
      (t) => t.absolute_start_time === segment.absolute_start_time
    );

    if (existingIndex !== -1) {
      // Update existing segment
      const updated = [...transcripts];
      updated[existingIndex] = segment;
      set({ transcripts: updated });
    } else {
      // Add new segment and sort
      const updated = [...transcripts, segment].sort(
        (a, b) => a.start_time - b.start_time
      );
      set({ transcripts: updated });
    }
  },

  // Real-time: Update existing transcript segment
  updateTranscriptSegment: (segment: TranscriptSegment) => {
    const { transcripts } = get();
    const updated = transcripts.map((t) =>
      t.absolute_start_time === segment.absolute_start_time ? segment : t
    );
    set({ transcripts: updated });
  },

  // Update meeting status from WebSocket
  updateMeetingStatus: (meetingId: string, status: MeetingStatus) => {
    const { meetings, currentMeeting } = get();

    // Update in meetings list
    const updatedMeetings = meetings.map((m) =>
      m.id === meetingId ? { ...m, status } : m
    );
    set({ meetings: updatedMeetings });

    // Update current meeting if it matches
    if (currentMeeting?.id === meetingId) {
      set({ currentMeeting: { ...currentMeeting, status } });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
