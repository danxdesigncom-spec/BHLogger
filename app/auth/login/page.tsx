import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-1 text-center">
          <h1 className="font-display text-[30px] font-semibold leading-tight">
            Behavior Logger
          </h1>
          <p className="text-muted-foreground text-sm">
            Sign in to your care record
          </p>
        </div>
        <LoginForm searchParams={searchParams} />
      </div>
    </main>
  );
}
