"use client";

import { useState, useRef, useCallback } from "react";
import {
  useFloating,
  useHover,
  useClick,
  useDismiss,
  useInteractions,
  offset,
  flip,
  shift,
  autoUpdate,
  FloatingPortal,
} from "@floating-ui/react";
import { User, Building2, Package, Calendar, DollarSign, FileText, Hash, Loader2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

export type EntityType = "person" | "company" | "product" | "date" | "amount" | "document" | "topic";

export interface EntityData {
  id: string;
  type: EntityType;
  label: string;
  context?: string;
}

export interface EnrichmentData {
  summary?: string;
  key_facts?: string[];
  relevance?: string;
  links?: string[];
}

// ── Icons per type ─────────────────────────────────────────────────────────

const TYPE_ICONS: Record<EntityType, React.ReactNode> = {
  person: <User className="h-3 w-3" />,
  company: <Building2 className="h-3 w-3" />,
  product: <Package className="h-3 w-3" />,
  date: <Calendar className="h-3 w-3" />,
  amount: <DollarSign className="h-3 w-3" />,
  document: <FileText className="h-3 w-3" />,
  topic: <Hash className="h-3 w-3" />,
};

const TYPE_COLORS: Record<EntityType, string> = {
  person: "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/60",
  company: "bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300 dark:hover:bg-purple-950/60",
  product: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60",
  date: "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/60",
  amount: "bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950/40 dark:text-green-300 dark:hover:bg-green-950/60",
  document: "bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-950/40 dark:text-orange-300 dark:hover:bg-orange-950/60",
  topic: "bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-800/40 dark:text-gray-300 dark:hover:bg-gray-800/60",
};

// ── Decision listener URL ──────────────────────────────────────────────────

const DECISION_LISTENER_URL =
  process.env.NEXT_PUBLIC_DECISION_LISTENER_URL ?? "http://localhost:8765";

// ── Entity Chip Component ──────────────────────────────────────────────────

interface EntityChipProps {
  entity: EntityData;
  onEnrich?: (entity: EntityData) => void;
}

export function EntityChip({ entity, onEnrich }: EntityChipProps) {
  const [isHoverOpen, setIsHoverOpen] = useState(false);
  const [enrichment, setEnrichment] = useState<EnrichmentData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnriched, setIsEnriched] = useState(false);
  const enrichingRef = useRef(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isHoverOpen,
    onOpenChange: setIsHoverOpen,
    placement: "bottom-start",
    middleware: [offset(8), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context, { delay: { open: 200, close: 100 } });
  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, dismiss]);

  const handleClick = useCallback(async () => {
    if (enrichingRef.current || isEnriched) {
      // Already enriched or enriching — just toggle the panel
      setIsHoverOpen((v) => !v);
      return;
    }
    enrichingRef.current = true;
    setIsLoading(true);
    setIsHoverOpen(true);

    try {
      const params = new URLSearchParams({
        label: entity.label,
        context: entity.context || "",
      });
      const url = `${DECISION_LISTENER_URL}/enrich/${entity.type}/${entity.id}?${params}`;
      const es = new EventSource(url);

      es.addEventListener("enrichment", (ev) => {
        try {
          const data = JSON.parse(ev.data);
          setEnrichment(data.enrichment || data);
          setIsEnriched(true);
        } catch { /* ignore */ }
      });

      es.addEventListener("cached", (ev) => {
        try {
          const data = JSON.parse(ev.data);
          setEnrichment(data.enrichment || data);
          setIsEnriched(true);
        } catch { /* ignore */ }
      });

      es.addEventListener("complete", () => {
        setIsLoading(false);
        enrichingRef.current = false;
        es.close();
      });

      es.addEventListener("error", () => {
        setIsLoading(false);
        enrichingRef.current = false;
        es.close();
      });

      // Fallback timeout
      setTimeout(() => {
        if (enrichingRef.current) {
          setIsLoading(false);
          enrichingRef.current = false;
          es.close();
        }
      }, 30000);
    } catch {
      setIsLoading(false);
      enrichingRef.current = false;
    }
  }, [entity, isEnriched]);

  return (
    <>
      <span
        ref={refs.setReference}
        {...getReferenceProps()}
        onClick={handleClick}
        className={cn(
          "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-xs font-medium cursor-pointer transition-colors",
          TYPE_COLORS[entity.type],
          isEnriched && "ring-1 ring-current/20"
        )}
      >
        {TYPE_ICONS[entity.type]}
        <span>{entity.label}</span>
        {isLoading && <Loader2 className="h-2.5 w-2.5 animate-spin ml-0.5" />}
      </span>

      {isHoverOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className={cn(
              "z-[100] w-80 rounded-lg border bg-popover p-3 shadow-lg",
              "animate-in fade-in-0 zoom-in-95 duration-150"
            )}
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                  TYPE_COLORS[entity.type]
                )}
              >
                {TYPE_ICONS[entity.type]}
                {entity.type}
              </span>
              <span className="font-semibold text-sm">{entity.label}</span>
            </div>

            {/* Content */}
            {isLoading && !enrichment && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Researching…
              </div>
            )}

            {enrichment && (
              <div className="space-y-2">
                {enrichment.summary && (
                  <p className="text-xs leading-relaxed text-foreground/90">
                    {enrichment.summary}
                  </p>
                )}

                {enrichment.key_facts && enrichment.key_facts.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Key Facts
                    </p>
                    <ul className="space-y-0.5">
                      {enrichment.key_facts.map((fact, i) => (
                        <li key={i} className="text-xs text-foreground/80 flex gap-1.5">
                          <span className="text-muted-foreground shrink-0">•</span>
                          <span>{fact}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {enrichment.relevance && (
                  <p className="text-[10px] text-muted-foreground italic">
                    {enrichment.relevance}
                  </p>
                )}

                {enrichment.links && enrichment.links.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {enrichment.links.slice(0, 3).map((link, i) => (
                      <a
                        key={i}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-[10px] text-blue-600 hover:underline"
                      >
                        <ExternalLink className="h-2.5 w-2.5" />
                        {new URL(link).hostname.replace("www.", "")}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!isLoading && !enrichment && (
              <p className="text-xs text-muted-foreground">
                Click to research this entity
              </p>
            )}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
