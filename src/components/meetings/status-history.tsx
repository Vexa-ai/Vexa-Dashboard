"use client";

import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { ChevronDown, Clock, ArrowRight, User, Bot, Zap } from "lucide-react";
import { cn, parseUTCTimestamp } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { StatusTransition, MeetingStatus } from "@/types/vexa";
import { MEETING_STATUS_CONFIG } from "@/types/vexa";

interface StatusHistoryProps {
  transitions?: StatusTransition[];
  className?: string;
}

// Status icon mapping
const getStatusIcon = (status: string) => {
  switch (status) {
    case "requested":
      return <Zap className="h-3 w-3" />;
    case "joining":
      return <Bot className="h-3 w-3" />;
    case "awaiting_admission":
      return <Clock className="h-3 w-3" />;
    case "active":
      return <div className="h-2 w-2 rounded-full bg-current animate-pulse" />;
    case "completed":
      return <div className="h-2 w-2 rounded-full bg-current" />;
    case "failed":
      return <div className="h-2 w-2 rounded-full bg-current" />;
    default:
      return <div className="h-2 w-2 rounded-full bg-current" />;
  }
};

// Get status config with fallback
const getStatusConfig = (status: string) => {
  if (status in MEETING_STATUS_CONFIG) {
    return MEETING_STATUS_CONFIG[status as MeetingStatus];
  }
  return { label: status, color: "text-gray-600", bgColor: "bg-gray-100" };
};

// Get source icon
const getSourceIcon = (source?: string) => {
  switch (source) {
    case "user":
      return <User className="h-3 w-3 text-muted-foreground" />;
    case "bot_callback":
      return <Bot className="h-3 w-3 text-muted-foreground" />;
    default:
      return null;
  }
};

export function StatusHistory({ transitions, className }: StatusHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!transitions || transitions.length === 0) {
    return null;
  }

  // Sort transitions by timestamp (oldest first)
  const sortedTransitions = [...transitions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors group">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>Status History</span>
            <span className="text-xs text-muted-foreground font-normal">
              ({transitions.length} transitions)
            </span>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pt-2 pb-1">
          <div className="relative pl-4">
            {/* Timeline line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

            {/* Timeline items */}
            <div className="space-y-3">
              {sortedTransitions.map((transition, index) => {
                const toConfig = getStatusConfig(transition.to);
                const timestamp = parseUTCTimestamp(transition.timestamp);
                const isLast = index === sortedTransitions.length - 1;

                return (
                  <div key={index} className="relative flex items-start gap-3">
                    {/* Timeline dot */}
                    <div
                      className={cn(
                        "absolute left-0 w-[15px] h-[15px] rounded-full border-2 bg-background flex items-center justify-center",
                        isLast ? "border-primary" : "border-muted-foreground/30"
                      )}
                    >
                      <div
                        className={cn(
                          "w-[7px] h-[7px] rounded-full",
                          isLast ? "bg-primary" : "bg-muted-foreground/30"
                        )}
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pl-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Status badges */}
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
                              toConfig.bgColor,
                              toConfig.color
                            )}
                          >
                            {getStatusIcon(transition.to)}
                            {toConfig.label}
                          </span>
                        </div>

                        {/* Source indicator */}
                        {transition.source && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            {getSourceIcon(transition.source)}
                            <span className="capitalize">{transition.source.replace("_", " ")}</span>
                          </div>
                        )}
                      </div>

                      {/* Timestamp */}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {format(timestamp, "HH:mm:ss")}
                        </span>
                        <span className="text-xs text-muted-foreground/60">
                          {formatDistanceToNow(timestamp, { addSuffix: true })}
                        </span>
                      </div>

                      {/* Reason if present */}
                      {(transition.reason || transition.completion_reason) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {transition.reason || transition.completion_reason}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
