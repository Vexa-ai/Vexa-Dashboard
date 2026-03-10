"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Send,
  Loader2,
  StopCircle,
  RotateCcw,
  Trash2,
  Bot,
  User,
  Wrench,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { vexaAPI } from "@/lib/api";
import { toast } from "sonner";
import type { AgentChatEvent } from "@/types/vexa";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  tools?: string[];
  costUsd?: number;
  durationMs?: number;
}

// Persist chat history across navigations (module-level cache)
const chatCache = new Map<string, ChatMessage[]>();

interface AgentChatProps {
  meetingId: string;
  className?: string;
}

export function AgentChat({ meetingId, className }: AgentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => chatCache.get(meetingId) || []);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingTools, setStreamingTools] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages, streamingText, streamingTools]);

  // Sync messages to cache
  useEffect(() => {
    if (messages.length > 0) {
      chatCache.set(meetingId, messages);
    } else {
      chatCache.delete(meetingId);
    }
  }, [messages, meetingId]);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      // If already streaming, interrupt first
      if (isStreaming) {
        abortControllerRef.current?.abort();
        try { await vexaAPI.agentInterrupt(meetingId); } catch { /* ignore */ }
      }

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text.trim(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsStreaming(true);
      setStreamingText("");
      setStreamingTools([]);
      setError(null);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await vexaAPI.agentChatStream(
          meetingId,
          text.trim(),
          { signal: controller.signal }
        );

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";
        let tools: string[] = [];
        let costUsd: number | undefined;
        let durationMs: number | undefined;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            let event: AgentChatEvent;
            try {
              event = JSON.parse(jsonStr);
            } catch {
              continue;
            }

            switch (event.type) {
              case "text_delta":
                fullText += event.text;
                setStreamingText(fullText);
                break;
              case "tool_use":
                tools = [...tools, event.summary];
                setStreamingTools([...tools]);
                break;
              case "done":
                costUsd = event.cost_usd;
                durationMs = event.duration_ms;
                break;
              case "error":
                setError(event.message);
                break;
            }
          }
        }

        // Finalize the assistant message
        if (fullText) {
          const assistantMessage: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: fullText,
            tools: tools.length > 0 ? tools : undefined,
            costUsd,
            durationMs,
          };
          setMessages((prev) => [...prev, assistantMessage]);
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          // User interrupted — save partial response
          const currentText = fullTextRef.current;
          if (currentText) {
            setMessages((prev) => [
              ...prev,
              {
                id: `assistant-${Date.now()}`,
                role: "assistant",
                content: currentText + "\n\n*[interrupted]*",
              },
            ]);
          }
        } else {
          setError((err as Error).message);
        }
      } finally {
        setIsStreaming(false);
        setStreamingText("");
        setStreamingTools([]);
        abortControllerRef.current = null;
      }
    },
    [meetingId, isStreaming]
  );

  // Use a ref to track streaming text for the abort handler
  const fullTextRef = useRef("");
  useEffect(() => {
    fullTextRef.current = streamingText;
  }, [streamingText]);

  const handleInterrupt = useCallback(async () => {
    abortControllerRef.current?.abort();
    try {
      await vexaAPI.agentInterrupt(meetingId);
    } catch {
      // Ignore interrupt errors
    }
  }, [meetingId]);

  const handleReset = useCallback(async () => {
    try {
      await vexaAPI.agentResetSession(meetingId);
      setMessages([]);
      chatCache.delete(meetingId);
      setError(null);
      toast.success("Session reset");
    } catch {
      toast.error("Failed to reset session");
    }
  }, [meetingId]);

  const handleClear = useCallback(() => {
    setMessages([]);
    chatCache.delete(meetingId);
    setError(null);
  }, [meetingId]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      handleSend(input);
    },
    [input, handleSend]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend(input);
      }
    },
    [input, handleSend]
  );

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-purple-100 dark:bg-purple-950 flex items-center justify-center">
            <Bot className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-sm font-medium">Claude Agent</p>
            <p className="text-xs text-muted-foreground">
              {isStreaming ? "Responding..." : "Ready"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-7 gap-1 text-xs text-muted-foreground"
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-7 gap-1 text-xs text-muted-foreground"
            title="Reset Claude session (fresh conversation)"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
          <p className="text-sm text-destructive flex-1">{error}</p>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setError(null)}
            className="h-6 w-6 text-destructive shrink-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
        <div className="p-4 space-y-4">
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center text-center py-12">
              <div className="h-14 w-14 rounded-full bg-purple-100 dark:bg-purple-950 flex items-center justify-center mb-4">
                <Bot className="h-7 w-7 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-sm font-medium mb-1">
                Claude Agent
              </h3>
              <p className="text-xs text-muted-foreground max-w-[280px]">
                Chat with the Claude agent running inside the bot container. It
                has full access to Playwright browser and the bot source code.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Streaming response */}
          {isStreaming && (
            <div className="space-y-2">
              {/* Tool indicators */}
              {streamingTools.map((tool, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs text-muted-foreground px-1"
                >
                  <Wrench className="h-3 w-3 animate-spin" />
                  <span className="font-mono">{tool}</span>
                </div>
              ))}

              {/* Streaming text */}
              {streamingText ? (
                <div className="flex gap-3">
                  <div className="h-7 w-7 rounded-full bg-purple-100 dark:bg-purple-950 flex items-center justify-center shrink-0">
                    <Bot className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-muted prose-pre:border">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {streamingText}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground px-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="text-xs">Thinking...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="px-4 py-3 border-t shrink-0">
        <form onSubmit={handleSubmit}>
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message the agent..."
              className="min-h-[40px] max-h-32 resize-none text-sm"
              rows={1}
            />
            {isStreaming ? (
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={handleInterrupt}
                className="shrink-0 h-10 w-10"
                title="Interrupt"
              >
                <StopCircle className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim()}
                className="shrink-0 h-10 w-10"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
            Enter to send, Shift+Enter for new line
          </p>
        </form>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="flex gap-3">
      <div
        className={cn(
          "h-7 w-7 rounded-full flex items-center justify-center shrink-0",
          message.role === "user"
            ? "bg-foreground text-background"
            : "bg-purple-100 dark:bg-purple-950"
        )}
      >
        {message.role === "user" ? (
          <User className="h-3.5 w-3.5" />
        ) : (
          <Bot className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
        )}
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        {/* Tool activity */}
        {message.tools && message.tools.length > 0 && (
          <div className="mb-2 space-y-1">
            {message.tools.map((tool, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
              >
                <Wrench className="h-3 w-3" />
                <span className="font-mono truncate">{tool}</span>
              </div>
            ))}
          </div>
        )}

        {/* Message content */}
        {message.role === "user" ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-muted prose-pre:border prose-headings:font-semibold">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Cost/duration meta */}
        {message.durationMs && (
          <p className="text-[10px] text-muted-foreground mt-1">
            {(message.durationMs / 1000).toFixed(1)}s
            {message.costUsd
              ? ` · $${message.costUsd.toFixed(4)}`
              : ""}
          </p>
        )}
      </div>
    </div>
  );
}
