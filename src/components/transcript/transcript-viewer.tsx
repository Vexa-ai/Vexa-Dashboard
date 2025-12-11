"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { Search, Download, FileText, FileJson, FileVideo, X, Users, MessageSquare, Wifi, WifiOff, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { TranscriptSegment } from "./transcript-segment";
import type { Meeting, TranscriptSegment as TranscriptSegmentType } from "@/types/vexa";
import { getSpeakerColor } from "@/types/vexa";
import {
  exportToTxt,
  exportToJson,
  exportToSrt,
  exportToVtt,
  downloadFile,
  generateFilename,
} from "@/lib/export";
import { cn } from "@/lib/utils";

interface TranscriptViewerProps {
  meeting: Meeting;
  segments: TranscriptSegmentType[];
  isLoading?: boolean;
  isLive?: boolean;
  // WebSocket connection state (only relevant when isLive=true)
  wsConnecting?: boolean;
  wsConnected?: boolean;
  wsError?: string | null;
  wsReconnectAttempts?: number;
}

export function TranscriptViewer({
  meeting,
  segments,
  isLoading,
  isLive,
  wsConnecting,
  wsConnected,
  wsError,
  wsReconnectAttempts,
}: TranscriptViewerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpeakers, setSelectedSpeakers] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut for search (Cmd/Ctrl + F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
        setSearchQuery("");
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Get unique speakers in order of appearance
  const speakerOrder = useMemo(() => {
    const speakers: string[] = [];
    for (const segment of segments) {
      if (!speakers.includes(segment.speaker)) {
        speakers.push(segment.speaker);
      }
    }
    return speakers;
  }, [segments]);

  // Filter segments by search query and selected speakers
  const filteredSegments = useMemo(() => {
    let result = segments;

    // Filter by selected speakers
    if (selectedSpeakers.length > 0) {
      result = result.filter((s) => selectedSpeakers.includes(s.speaker));
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.text.toLowerCase().includes(query) ||
          s.speaker.toLowerCase().includes(query)
      );
    }

    return result;
  }, [segments, searchQuery, selectedSpeakers]);

  // Toggle speaker selection
  const toggleSpeaker = useCallback((speaker: string) => {
    setSelectedSpeakers((prev) =>
      prev.includes(speaker)
        ? prev.filter((s) => s !== speaker)
        : [...prev, speaker]
    );
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedSpeakers([]);
  }, []);

  const hasActiveFilters = searchQuery.trim() || selectedSpeakers.length > 0;

  // Auto-scroll to bottom when live and new segments arrive
  useEffect(() => {
    if (isLive && scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [segments.length, isLive]);

  // Export handlers
  const handleExport = (format: "txt" | "json" | "srt" | "vtt") => {
    let content: string;
    let mimeType: string;

    switch (format) {
      case "txt":
        content = exportToTxt(meeting, segments);
        mimeType = "text/plain";
        break;
      case "json":
        content = exportToJson(meeting, segments);
        mimeType = "application/json";
        break;
      case "srt":
        content = exportToSrt(segments);
        mimeType = "text/plain";
        break;
      case "vtt":
        content = exportToVtt(segments);
        mimeType = "text/vtt";
        break;
    }

    const filename = generateFilename(meeting, format);
    downloadFile(content, filename, mimeType);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transcript</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex-shrink-0 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CardTitle>Transcript</CardTitle>
            {isLive && (
              <Badge variant="destructive" className="animate-pulse">
                <span className="relative flex h-2 w-2 mr-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                </span>
                Live
              </Badge>
            )}
            {/* WebSocket connection indicator */}
            {isLive && (
              <div className="flex items-center gap-1.5">
                {wsConnecting ? (
                  <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-300 bg-yellow-50">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Connecting...
                  </Badge>
                ) : wsConnected ? (
                  <Badge variant="outline" className="gap-1 text-green-600 border-green-300 bg-green-50">
                    <Wifi className="h-3 w-3" />
                    Connected
                  </Badge>
                ) : wsError ? (
                  <Badge variant="outline" className="gap-1 text-red-600 border-red-300 bg-red-50">
                    <AlertCircle className="h-3 w-3" />
                    {wsReconnectAttempts && wsReconnectAttempts > 0
                      ? `Reconnecting (${wsReconnectAttempts})...`
                      : "Polling"}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-gray-600 border-gray-300 bg-gray-50">
                    <WifiOff className="h-3 w-3" />
                    Disconnected
                  </Badge>
                )}
              </div>
            )}
            {segments.length > 0 && (
              <Badge variant="secondary" className="font-normal">
                <MessageSquare className="h-3 w-3 mr-1" />
                {segments.length} segments
              </Badge>
            )}
          </div>

          {/* Export */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("txt")}>
                <FileText className="h-4 w-4 mr-2" />
                Text (.txt)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("json")}>
                <FileJson className="h-4 w-4 mr-2" />
                JSON (.json)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("srt")}>
                <FileVideo className="h-4 w-4 mr-2" />
                Subtitles (.srt)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("vtt")}>
                <FileVideo className="h-4 w-4 mr-2" />
                WebVTT (.vtt)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search transcript... (Cmd+F)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "pl-9 pr-9 transition-all",
                searchQuery && "ring-2 ring-primary/20"
              )}
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Speaker Filter */}
          {speakerOrder.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "gap-2",
                    selectedSpeakers.length > 0 && "border-primary text-primary"
                  )}
                >
                  <Users className="h-4 w-4" />
                  Speakers
                  {selectedSpeakers.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                      {selectedSpeakers.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {speakerOrder.map((speaker) => {
                  const color = getSpeakerColor(speaker, speakerOrder);
                  return (
                    <DropdownMenuCheckboxItem
                      key={speaker}
                      checked={selectedSpeakers.includes(speaker)}
                      onCheckedChange={() => toggleSpeaker(speaker)}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", color.avatar)} />
                        <span className="truncate">{speaker || "Unknown"}</span>
                      </div>
                    </DropdownMenuCheckboxItem>
                  );
                })}
                {selectedSpeakers.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setSelectedSpeakers([])}>
                      Clear selection
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Clear all filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              Clear filters
            </Button>
          )}
        </div>

        {/* Filter results info */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground animate-fade-in">
            <span>
              Showing {filteredSegments.length} of {segments.length} segments
            </span>
            {searchQuery && (
              <Badge variant="outline" className="font-normal">
                &quot;{searchQuery}&quot;
              </Badge>
            )}
            {selectedSpeakers.map((speaker) => (
              <Badge
                key={speaker}
                variant="secondary"
                className="font-normal cursor-pointer hover:bg-destructive/20"
                onClick={() => toggleSpeaker(speaker)}
              >
                {speaker}
                <X className="h-3 w-3 ml-1" />
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 min-h-0">
        <ScrollArea className="h-[500px] pr-4" ref={scrollRef}>
          {filteredSegments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
              {hasActiveFilters ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                    <Search className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <h3 className="font-medium mb-1">No results found</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Try adjusting your search or filters
                  </p>
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear all filters
                  </Button>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                    <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <h3 className="font-medium mb-1">No transcript yet</h3>
                  <p className="text-sm text-muted-foreground">
                    {isLive
                      ? "Waiting for speech to transcribe..."
                      : "No transcript available for this meeting"}
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredSegments.map((segment, index) => (
                <div
                  key={segment.id || `${segment.absolute_start_time}-${index}`}
                  className="animate-fade-in"
                  style={{
                    animationDelay: isLive ? "0ms" : `${Math.min(index * 20, 200)}ms`,
                    animationFillMode: "backwards",
                  }}
                >
                  <TranscriptSegment
                    segment={segment}
                    speakerColor={getSpeakerColor(segment.speaker, speakerOrder)}
                    searchQuery={searchQuery}
                    isHighlighted={searchQuery.length > 0}
                  />
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
