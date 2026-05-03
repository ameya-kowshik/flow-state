import { use } from "react";
import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Auth.js error codes → user-friendly messages
const AUTH_ERRORS: Record<string, string> = {
  OAuthSignin: "Could not start Google sign-in. Please try again.",
  OAuthCallback: "Something went wrong during Google sign-in. Please try again.",
  OAuthCreateAccount: "Could not create your account with Google. Please try again.",
  EmailCreateAccount: "Could not create your account. Please try again.",
  Callback: "An error occurred during sign-in. Please try again.",
  OAuthAccountNotLinked:
    "This email is already linked to a different sign-in method.",
  EmailSignin: "Could not send the sign-in email. Please try again.",
  CredentialsSignin: "Invalid credentials. Please check your details.",
  SessionRequired: "Please sign in to access that page.",
  Default: "An unexpected error occurred. Please try again.",
};

function getErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  return AUTH_ERRORS[code] ?? AUTH_ERRORS.Default;
}

async function signInWithGoogle() {
  "use server";
  await signIn("google", { redirectTo: "/today" });
}

export default function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = use(searchParams);
  const errorMessage = getErrorMessage(error);

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-background px-4 py-16">
      <main className="flex w-full max-w-md flex-col items-center gap-10">
        {/* Hero */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-8 w-8 text-primary-foreground"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.818a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .845-.143Z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="flex flex-col gap-2">
            <Badge variant="secondary" className="mx-auto w-fit">
              Now in beta
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight text-foreground">
              Flow State
            </h1>
            <p className="text-base text-muted-foreground">
              Focus deeply. Track what matters. Link every session to the work
              that counts.
            </p>
          </div>
        </div>

        {/* Sign-in card */}
        <Card className="w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-lg">Get started</CardTitle>
            <CardDescription>
              Sign in to access your boards, timer, and analytics.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Error alert */}
            {errorMessage && (
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                {errorMessage}
              </div>
            )}

            <form action={signInWithGoogle}>
              <Button type="submit" variant="outline" size="lg" className="w-full gap-3">
                {/* Google "G" logo */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="size-5 shrink-0"
                  aria-hidden="true"
                >
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Continue with Google
              </Button>
            </form>

            <p className="text-center text-xs text-muted-foreground">
              By continuing, you agree to our terms of service and privacy
              policy.
            </p>
          </CardContent>
        </Card>

        {/* Feature highlights */}
        <div className="grid w-full grid-cols-3 gap-3 text-center">
          {[
            { label: "Pomodoro timer", icon: "⏱" },
            { label: "Kanban boards", icon: "📋" },
            { label: "Focus analytics", icon: "📊" },
          ].map(({ label, icon }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-4"
            >
              <span className="text-2xl" aria-hidden="true">
                {icon}
              </span>
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
