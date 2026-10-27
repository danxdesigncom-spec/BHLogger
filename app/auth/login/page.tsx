import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="font-display text-display-2 text-center">
          Behavior Logger
        </h1>
        <p className="text-muted-foreground text-body text-center">
          Sign-in flow — coming in M3.
        </p>
      </div>
    </main>
  );
}
