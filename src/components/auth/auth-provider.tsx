"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { Loader2 } from "lucide-react";
import { stripBasePath } from "@/lib/base-path";

// Routes that don't require authentication
const publicRoutes = ["/login", "/auth/verify"];

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const [shouldRedirect, setShouldRedirect] = useState(false);

  // Check if current route is public
  const normalizedPathname = stripBasePath(pathname || "/");
  const isPublicRoute = publicRoutes.some((route) => normalizedPathname.startsWith(route));

  // Only verify session on protected routes to avoid 401 in console on /login, /auth/zoom/callback
  useEffect(() => {
    if (pathname == null) {
      checkAuth(); // path not yet known
    } else if (!publicRoutes.some((route) => pathname.startsWith(route))) {
      checkAuth(); // protected route
    }
  }, [pathname, checkAuth]);

  // Handle redirect in useEffect to avoid React render warning
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isPublicRoute) {
      setShouldRedirect(true);
    }
  }, [isLoading, isAuthenticated, isPublicRoute]);

  useEffect(() => {
    if (shouldRedirect) {
      router.push("/login");
    }
  }, [shouldRedirect, router]);

  // If on a public route, just render children
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // If loading or need to redirect, show loading state
  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // User is authenticated, render children
  return <>{children}</>;
}
