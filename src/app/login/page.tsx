"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Mail, Loader2, CheckCircle, ArrowLeft, AlertTriangle, XCircle } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";

type LoginState = "email" | "sent";

interface HealthStatus {
  status: "ok" | "degraded" | "error";
  authMode: "direct" | "magic-link" | "google";
  checks: {
    smtp: { configured: boolean; optional?: boolean; error?: string };
    googleOAuth: { configured: boolean; optional?: boolean; error?: string };
    adminApi: { configured: boolean; reachable: boolean; error?: string };
    vexaApi: { configured: boolean; reachable: boolean; error?: string };
  };
  missingConfig: string[];
}

export default function LoginPage() {
  const router = useRouter();
  const { sendMagicLink, isLoading, isAuthenticated } = useAuthStore();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<LoginState>("email");
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  // Check server health on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch("/api/health");
        const data = await response.json();
        setHealthStatus(data);
      } catch {
        setHealthStatus({
          status: "error",
          authMode: "direct",
          checks: {
            smtp: { configured: false, optional: true, error: "Cannot reach server" },
            adminApi: { configured: false, reachable: false, error: "Cannot reach server" },
            vexaApi: { configured: false, reachable: false, error: "Cannot reach server" },
          },
          missingConfig: [],
        });
      } finally {
        setHealthLoading(false);
      }
    };

    checkHealth();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error("Please enter your email");
      return;
    }

    const result = await sendMagicLink(email);

    if (result.success) {
      if (result.mode === "direct") {
        // Direct login mode - user is authenticated, redirect to dashboard
        toast.success(result.isNewUser ? "Account created! Welcome to Vexa." : "Welcome back!");
        router.push("/");
      } else {
        // Magic link mode - show "check your email" screen
        setState("sent");
        toast.success("Magic link sent! Check your email.");
      }
    } else {
      toast.error(result.error || "Failed to send magic link");
    }
  };

  const handleResend = async () => {
    const result = await sendMagicLink(email);

    if (result.success) {
      toast.success("Magic link sent again! Check your email.");
    } else {
      toast.error(result.error || "Failed to resend magic link");
    }
  };

  const handleBack = () => {
    setState("email");
  };

  const handleGoogleSignIn = async () => {
    try {
      await signIn("google", {
        callbackUrl: "/",
        redirect: true,
      });
    } catch (error) {
      console.error("Google sign-in error:", error);
      toast.error("Failed to sign in with Google");
    }
  };

  const isConfigError = healthStatus?.status === "error";
  const hasWarnings = healthStatus?.status === "degraded";
  const isDirectMode = healthStatus?.authMode === "direct";
  const isGoogleAuthEnabled = healthStatus?.checks.googleOAuth.configured === true;
  const isEmailAuthEnabled = !isGoogleAuthEnabled && (healthStatus?.authMode === "magic-link" || healthStatus?.authMode === "direct");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center justify-center gap-2 mb-8">
          <Logo size="lg" showText={true} />
          <p className="text-sm text-muted-foreground">Meeting Transcription</p>
        </div>

        {/* Configuration Error Banner */}
        {!healthLoading && isConfigError && (
          <div className="mb-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-medium text-destructive">Server Configuration Error</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  The server is not properly configured. Please contact the administrator.
                </p>
                {healthStatus?.missingConfig && healthStatus.missingConfig.length > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    <span className="font-medium">Missing:</span> {healthStatus.missingConfig.join(", ")}
                  </div>
                )}
                {healthStatus?.checks.adminApi.error && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {healthStatus.checks.adminApi.error}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Warning Banner */}
        {!healthLoading && hasWarnings && (
          <div className="mb-4 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-medium text-yellow-600 dark:text-yellow-500">Connection Warning</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Some services may be unavailable. Login should still work.
                </p>
              </div>
            </div>
          </div>
        )}

        <Card className="border-0 shadow-xl">
          {state === "email" ? (
            <>
              <CardHeader className="text-center">
                <CardTitle className="text-xl">Welcome</CardTitle>
                <CardDescription>
                  {isGoogleAuthEnabled
                    ? "Sign in to continue"
                    : isDirectMode
                    ? "Enter your email to sign in"
                    : "Enter your email to receive a sign-in link"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isGoogleAuthEnabled && (
                  <>
                    <Button
                      type="button"
                      onClick={handleGoogleSignIn}
                      className="w-full"
                      disabled={isConfigError}
                      variant="default"
                    >
                      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Sign in with Google
                    </Button>
                    {isEmailAuthEnabled && (
                      <>
                        <div className="relative my-4">
                          <div className="absolute inset-0 flex items-center">
                            <Separator />
                          </div>
                          <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}

                {isEmailAuthEnabled && (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10"
                          disabled={isLoading || isConfigError}
                          autoFocus={!isGoogleAuthEnabled}
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoading || healthLoading || isConfigError}
                      variant={isGoogleAuthEnabled ? "outline" : "default"}
                    >
                      {healthLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Checking server...
                        </>
                      ) : isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {isDirectMode ? "Signing in..." : "Sending link..."}
                        </>
                      ) : isConfigError ? (
                        "Server Unavailable"
                      ) : isDirectMode ? (
                        "Sign In"
                      ) : (
                        "Send Magic Link"
                      )}
                    </Button>
                  </form>
                )}
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <CardTitle className="text-xl">Check your email</CardTitle>
                <CardDescription>
                  We sent a magic link to <span className="font-medium text-foreground">{email}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                  <p className="mb-2">Click the link in the email to sign in.</p>
                  <p>The link will expire in 15 minutes.</p>
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    onClick={handleResend}
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Resend magic link"
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={handleBack}
                    className="w-full"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Use a different email
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Vexa Dashboard - Open Source Meeting Transcription
        </p>
      </div>
    </div>
  );
}
