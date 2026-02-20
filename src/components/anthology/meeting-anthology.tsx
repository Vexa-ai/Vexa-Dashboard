"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  BookOpen,
  Loader2,
  CheckCircle2,
  ClipboardList,
  Cpu,
  TrendingUp,
  User,
  Building2,
  Package,
  Calendar,
  DollarSign,
  FileText,
  Hash,
  Lightbulb,
  Timer,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { EntityChip, type EntityData, type EntityType } from "./entity-chip";

// ── Types ──────────────────────────────────────────────────────────────────

type ItemType = "decision" | "action_item" | "architecture_statement" | "key_insight" | "commitment";

interface EntityRef {
  type: EntityType;
  label: string;
  id: string;
}

interface AnthologyItem {
  id: string;
  type: ItemType;
  summary: string;
  speaker?: string;
  confidence?: number;
  entities: EntityRef[];
  receivedAt: number;
}

interface SummaryData {
  lede: string;
  theme: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const DECISION_LISTENER_URL =
  process.env.NEXT_PUBLIC_DECISION_LISTENER_URL ?? "http://localhost:8765";

const SUMMARY_REFRESH_INTERVAL = 10_000;

const TYPE_META: Record<
  ItemType,
  { label: string; icon: React.ReactNode; accentClass: string; bgClass: string }
> = {
  decision: {
    label: "Decision",
    icon: <CheckCircle2 className="h-3 w-3" />,
    accentClass: "text-green-600 dark:text-green-400",
    bgClass:
      "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800/40",
  },
  action_item: {
    label: "Action",
    icon: <ClipboardList className="h-3 w-3" />,
    accentClass: "text-blue-600 dark:text-blue-400",
    bgClass:
      "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800/40",
  },
  architecture_statement: {
    label: "Architecture",
    icon: <Cpu className="h-3 w-3" />,
    accentClass: "text-purple-600 dark:text-purple-400",
    bgClass:
      "bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800/40",
  },
  key_insight: {
    label: "Insight",
    icon: <Lightbulb className="h-3 w-3" />,
    accentClass: "text-amber-600 dark:text-amber-400",
    bgClass:
      "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/40",
  },
  commitment: {
    label: "Commitment",
    icon: <Timer className="h-3 w-3" />,
    accentClass: "text-rose-600 dark:text-rose-400",
    bgClass:
      "bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800/40",
  },
};

// Entity type icons for the entity index
const ENTITY_TYPE_ICONS: Record<EntityType, React.ReactNode> = {
  person: <User className="h-3 w-3" />,
  company: <Building2 className="h-3 w-3" />,
  product: <Package className="h-3 w-3" />,
  date: <Calendar className="h-3 w-3" />,
  amount: <DollarSign className="h-3 w-3" />,
  document: <FileText className="h-3 w-3" />,
  topic: <Hash className="h-3 w-3" />,
};

const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  person: "People",
  company: "Companies",
  product: "Products",
  date: "Dates",
  amount: "Amounts",
  document: "Documents",
  topic: "Topics",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function isSimilar(a: string, b: string): boolean {
  const tokenize = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 3)
    );
  const wa = tokenize(a);
  const wb = tokenize(b);
  if (wa.size === 0 && wb.size === 0) return true;
  if (wa.size === 0 || wb.size === 0) return false;
  const intersection = [...wa].filter((w) => wb.has(w)).length;
  const union = new Set([...wa, ...wb]).size;
  const jaccard = union === 0 ? 0 : intersection / union;
  if (jaccard >= 0.50) return true;
  // Containment: what fraction of the smaller set is covered?
  const smaller = Math.min(wa.size, wb.size);
  const containment = smaller === 0 ? 0 : intersection / smaller;
  return containment >= 0.70;
}

// ── Text with inline entity highlighting ─────────────────────────────────────

/**
 * Renders summary text with entity labels replaced by interactive EntityChip
 * components inline. Entities are matched case-insensitively in the text.
 */
function HighlightedText({
  text,
  entities,
  context,
}: {
  text: string;
  entities: EntityRef[];
  context: string;
}) {
  if (!entities.length) {
    return <>{text}</>;
  }

  // Sort entities by label length (longest first) to avoid partial matches
  const sorted = [...entities].sort((a, b) => b.label.length - a.label.length);

  // Build a regex that matches any entity label (case-insensitive)
  // Escape special regex chars in labels
  const escaped = sorted.map((e) =>
    e.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");

  // Create a map from lowercase label -> entity for quick lookup
  const labelMap = new Map<string, EntityRef>();
  for (const ent of sorted) {
    labelMap.set(ent.label.toLowerCase(), ent);
  }

  const parts = text.split(pattern);
  const result: React.ReactNode[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;

    const ent = labelMap.get(part.toLowerCase());
    if (ent) {
      result.push(
        <EntityChip
          key={`${ent.id}-${i}`}
          entity={{
            id: ent.id,
            type: ent.type,
            label: part, // preserve original casing from text
            context,
          }}
        />
      );
    } else {
      result.push(<span key={i}>{part}</span>);
    }
  }

  return <>{result}</>;
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ItemCard({ item, isNew }: { item: AnthologyItem; isNew: boolean }) {
  const meta = TYPE_META[item.type] || TYPE_META.decision;

  return (
    <div
      className={cn(
        "rounded-lg border p-2.5 transition-all duration-500",
        meta.bgClass,
        isNew && "animate-in slide-in-from-top-2 fade-in-0 duration-300"
      )}
    >
      <div className="flex items-start gap-2">
        <span className={cn("mt-0.5 shrink-0", meta.accentClass)}>
          {meta.icon}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm leading-snug font-medium">
            <HighlightedText
              text={item.summary}
              entities={item.entities}
              context={item.summary}
            />
          </p>

          <div className="flex items-center gap-2 mt-1">
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wider",
                meta.accentClass
              )}
            >
              {meta.label}
            </span>
            {item.speaker && (
              <span className="text-[10px] text-muted-foreground">
                — {item.speaker}
              </span>
            )}
            {item.confidence != null && (
              <span className="text-[10px] text-muted-foreground ml-auto">
                {Math.round(item.confidence * 100)}%
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryLede({
  summary,
  itemCount,
  isLoading,
}: {
  summary: SummaryData | null;
  itemCount: number;
  isLoading: boolean;
}) {
  if (!summary?.lede && !isLoading) return null;

  return (
    <div className="rounded-lg bg-gradient-to-r from-amber-50/80 to-orange-50/60 dark:from-amber-950/20 dark:to-orange-950/15 border border-amber-200/60 dark:border-amber-800/30 p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <TrendingUp className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
          {summary?.theme || "Meeting Summary"}
        </span>
        {isLoading && (
          <Loader2 className="h-3 w-3 animate-spin text-amber-500 ml-auto" />
        )}
      </div>
      {summary?.lede ? (
        <p className="text-sm leading-relaxed font-medium text-foreground/90">
          {summary.lede}
        </p>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground italic">
          Generating summary…
        </p>
      ) : null}
      <div className="flex items-center gap-3 mt-1.5">
        <span className="text-[10px] text-muted-foreground">
          {itemCount} item{itemCount !== 1 ? "s" : ""} detected
        </span>
      </div>
    </div>
  );
}

/** Deduplicated entity index across all items */
function EntityIndex({ items }: { items: AnthologyItem[] }) {
  const grouped = useMemo(() => {
    const entityMap = new Map<string, EntityData>();
    for (const item of items) {
      for (const ent of item.entities) {
        if (!entityMap.has(ent.id)) {
          entityMap.set(ent.id, {
            id: ent.id,
            type: ent.type,
            label: ent.label,
            context: item.summary,
          });
        }
      }
    }

    // Group by type
    const groups: Record<string, EntityData[]> = {};
    for (const entity of entityMap.values()) {
      if (!groups[entity.type]) groups[entity.type] = [];
      groups[entity.type].push(entity);
    }
    return groups;
  }, [items]);

  const typeOrder: EntityType[] = [
    "person",
    "company",
    "product",
    "date",
    "amount",
    "document",
    "topic",
  ];

  const typesPresent = typeOrder.filter((t) => grouped[t]?.length);
  if (typesPresent.length === 0) return null;

  return (
    <div className="space-y-3">
      <Separator />
      <div className="flex items-center gap-2">
        <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Entities
        </span>
      </div>
      {typesPresent.map((type) => (
        <div key={type} className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">
              {ENTITY_TYPE_ICONS[type]}
            </span>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {ENTITY_TYPE_LABELS[type]}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {grouped[type].map((ent) => (
              <EntityChip key={ent.id} entity={ent} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

interface MeetingAnthologyProps {
  meetingId: string;
  isActive: boolean;
  segments: any[];
  participants?: string[];
}

export function MeetingAnthology({
  meetingId,
  isActive,
  segments,
  participants,
}: MeetingAnthologyProps) {
  const [items, setItems] = useState<AnthologyItem[]>([]);
  const [connected, setConnected] = useState(false);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set());

  const esRef = useRef<EventSource | null>(null);
  const itemsRef = useRef<AnthologyItem[]>([]);
  itemsRef.current = items;

  const lastSummaryCountRef = useRef(0);
  const summaryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load existing items on mount ───────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(
          `${DECISION_LISTENER_URL}/decisions/${meetingId}/all`
        );
        if (!res.ok) return;
        const data = await res.json();
        const loaded: AnthologyItem[] = (data.items ?? [])
          .filter((d: { type?: string }) => d.type && d.type !== "no_match")
          .map((d: any) => ({
            id: uid(),
            type: d.type as ItemType,
            summary: d.summary ?? "",
            speaker: d.speaker,
            confidence: d.confidence,
            entities: (d.entities ?? []).map((e: any) => ({
              type: e.type as EntityType,
              label: e.label ?? "",
              id: e.id ?? e.label?.toLowerCase().replace(/\s+/g, "-") ?? "",
            })),
            receivedAt: Date.now(),
          }));
        if (loaded.length > 0) {
          setItems(loaded.reverse());
        }
      } catch {
        // silently ignore
      }
    };
    load();
  }, [meetingId]);

  // ── SSE connection ─────────────────────────────────────────────────────

  const connectSSE = useCallback(() => {
    if (esRef.current) return;
    const url = `${DECISION_LISTENER_URL}/decisions/${meetingId}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (!data.type || data.type === "no_match") return;

        const incomingSummary = (data.summary ?? "").trim();

        // Cross-type dedup: check against ALL existing items
        const alreadyExists = itemsRef.current.some((it) =>
          isSimilar(it.summary, incomingSummary)
        );
        if (alreadyExists) return;

        const newItem: AnthologyItem = {
          id: uid(),
          type: data.type as ItemType,
          summary: incomingSummary,
          speaker: data.speaker,
          confidence: data.confidence,
          entities: (data.entities ?? []).map((e: any) => ({
            type: e.type as EntityType,
            label: e.label ?? "",
            id: e.id ?? e.label?.toLowerCase().replace(/\s+/g, "-") ?? "",
          })),
          receivedAt: Date.now(),
        };

        setItems((prev) => [newItem, ...prev]);
        setNewItemIds((prev) => new Set(prev).add(newItem.id));
        setTimeout(() => {
          setNewItemIds((prev) => {
            const next = new Set(prev);
            next.delete(newItem.id);
            return next;
          });
        }, 2000);
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      esRef.current = null;
      setTimeout(() => {
        if (isActive) connectSSE();
      }, 2000);
    };
  }, [meetingId, isActive]);

  useEffect(() => {
    if (!isActive) return;
    connectSSE();
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [isActive, connectSSE]);

  // ── Periodic summary refresh ───────────────────────────────────────────

  const fetchSummary = useCallback(async () => {
    if (items.length === 0) return;
    setIsSummaryLoading(true);
    try {
      const res = await fetch(
        `${DECISION_LISTENER_URL}/summary/${meetingId}`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.summary) {
        setSummary(data.summary);
        lastSummaryCountRef.current = data.item_count;
      }
    } catch {
      // ignore
    } finally {
      setIsSummaryLoading(false);
    }
  }, [meetingId, items.length]);

  useEffect(() => {
    if (items.length === 0) return;

    if (items.length !== lastSummaryCountRef.current) {
      if (summaryTimeoutRef.current) clearTimeout(summaryTimeoutRef.current);
      summaryTimeoutRef.current = setTimeout(fetchSummary, 1500);
    }

    const interval = setInterval(() => {
      if (items.length !== lastSummaryCountRef.current) {
        fetchSummary();
      }
    }, SUMMARY_REFRESH_INTERVAL);

    return () => {
      clearInterval(interval);
      if (summaryTimeoutRef.current) clearTimeout(summaryTimeoutRef.current);
    };
  }, [items.length, fetchSummary]);

  useEffect(() => {
    if (items.length > 0 && !summary) {
      fetchSummary();
    }
  }, [items.length, summary, fetchSummary]);

  // ── Grouped items ──────────────────────────────────────────────────────

  const decisions = items.filter((i) => i.type === "decision");
  const actionItems = items.filter((i) => i.type === "action_item");
  const keyInsights = items.filter((i) => i.type === "key_insight");
  const commitments = items.filter((i) => i.type === "commitment");
  const archStatements = items.filter(
    (i) => i.type === "architecture_statement"
  );

  // Check if any items have entities
  const hasEntities = items.some((i) => i.entities.length > 0);

  // ── Empty state ────────────────────────────────────────────────────────

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-3">
        <BookOpen className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground text-center">
          {isActive
            ? "Listening for decisions, actions, and key moments…"
            : "No items detected for this meeting."}
        </p>
        {isActive && connected && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            live
          </span>
        )}
      </div>
    );
  }

  // ── Rendered view ──────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Connection status */}
      {isActive && (
        <div className="flex items-center justify-between">
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[10px] font-medium",
              connected ? "text-green-600" : "text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                connected
                  ? "bg-green-500 animate-pulse"
                  : "bg-muted-foreground"
              )}
            />
            {connected ? "live — auto-updating" : "connecting…"}
          </span>
          <Badge variant="secondary" className="text-[10px] h-5">
            {items.length} item{items.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      )}

      {/* AI Summary lede */}
      <SummaryLede
        summary={summary}
        itemCount={items.length}
        isLoading={isSummaryLoading}
      />

      {/* Decisions */}
      {decisions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Decisions ({decisions.length})
            </span>
          </div>
          {decisions.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              isNew={newItemIds.has(item.id)}
            />
          ))}
        </div>
      )}

      {/* Action Items */}
      {actionItems.length > 0 && (
        <div className="space-y-2">
          {decisions.length > 0 && <Separator />}
          <div className="flex items-center gap-2">
            <ClipboardList className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Action Items ({actionItems.length})
            </span>
          </div>
          {actionItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              isNew={newItemIds.has(item.id)}
            />
          ))}
        </div>
      )}

      {/* Key Insights */}
      {keyInsights.length > 0 && (
        <div className="space-y-2">
          {(decisions.length > 0 || actionItems.length > 0) && <Separator />}
          <div className="flex items-center gap-2">
            <Lightbulb className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Key Insights ({keyInsights.length})
            </span>
          </div>
          {keyInsights.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              isNew={newItemIds.has(item.id)}
            />
          ))}
        </div>
      )}

      {/* Commitments */}
      {commitments.length > 0 && (
        <div className="space-y-2">
          {(decisions.length > 0 || actionItems.length > 0 || keyInsights.length > 0) && <Separator />}
          <div className="flex items-center gap-2">
            <Timer className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Commitments ({commitments.length})
            </span>
          </div>
          {commitments.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              isNew={newItemIds.has(item.id)}
            />
          ))}
        </div>
      )}

      {/* Architecture Statements */}
      {archStatements.length > 0 && (
        <div className="space-y-2">
          {(decisions.length > 0 || actionItems.length > 0 || keyInsights.length > 0 || commitments.length > 0) && <Separator />}
          <div className="flex items-center gap-2">
            <Cpu className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Architecture ({archStatements.length})
            </span>
          </div>
          {archStatements.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              isNew={newItemIds.has(item.id)}
            />
          ))}
        </div>
      )}

      {/* Entity index — all unique entities across all items */}
      {hasEntities && <EntityIndex items={items} />}
    </div>
  );
}
