import type { NextConfig } from "next";
import path from "path";

const normalizeBasePath = (value?: string) => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
};

const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

const nextConfig: NextConfig = {
  // Only use standalone output for production builds
  ...(process.env.NODE_ENV === 'production' ? { output: 'standalone' } : {}),
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  // Ensure Turbopack uses this project as root
  // (avoids picking a parent lockfile and serving nothing)
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Note: Don't use env block here as it overrides .env.local values at build time
  // Environment variables are loaded automatically from .env.local at runtime
};

export default nextConfig;
