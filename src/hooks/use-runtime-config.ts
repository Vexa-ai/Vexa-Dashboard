"use client";

import { useState, useEffect } from "react";

interface RuntimeConfig {
  wsUrl: string;
  apiUrl: string;
}

// Global cache to avoid refetching on every component mount
let cachedConfig: RuntimeConfig | null = null;
let configPromise: Promise<RuntimeConfig> | null = null;

async function fetchConfig(): Promise<RuntimeConfig> {
  const response = await fetch("/api/config");
  if (!response.ok) {
    throw new Error("Failed to fetch runtime config");
  }
  return response.json();
}

/**
 * Hook to get runtime configuration (WebSocket URL, etc.)
 * This solves the Next.js limitation where NEXT_PUBLIC_* vars are only available at build time.
 */
export function useRuntimeConfig() {
  const [config, setConfig] = useState<RuntimeConfig | null>(cachedConfig);
  const [isLoading, setIsLoading] = useState(!cachedConfig);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedConfig) {
      setConfig(cachedConfig);
      setIsLoading(false);
      return;
    }

    if (!configPromise) {
      configPromise = fetchConfig();
    }

    configPromise
      .then((cfg) => {
        cachedConfig = cfg;
        setConfig(cfg);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setIsLoading(false);
        // Reset promise to allow retry
        configPromise = null;
      });
  }, []);

  return { config, isLoading, error };
}

/**
 * Get the WebSocket URL synchronously (returns cached value or fallback)
 * For use in non-hook contexts or when you need immediate access
 */
export function getWsUrl(): string {
  if (cachedConfig) {
    return cachedConfig.wsUrl;
  }
  // Fallback to build-time env vars or default
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_VEXA_WS_URL || "ws://localhost:18056/ws";
  }
  return "ws://localhost:18056/ws";
}

/**
 * Prefetch config - call this early in app initialization
 */
export async function prefetchConfig(): Promise<RuntimeConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }
  if (!configPromise) {
    configPromise = fetchConfig();
  }
  cachedConfig = await configPromise;
  return cachedConfig;
}
