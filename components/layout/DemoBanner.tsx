import { exitDemoMode } from "@/app/auth/demo/actions";

export function DemoBanner() {
  return (
    <form
      action={exitDemoMode}
      role="status"
      className="flex items-center justify-between gap-3 px-4 py-2 text-[13px] font-bold border-b"
      style={{
        background: "var(--color-warning)",
        color: "var(--color-warning-ink)",
        borderColor: "var(--color-warning-border)",
        paddingTop: "max(8px, env(safe-area-inset-top, 0px))",
      }}
    >
      <span>Demo mode — nothing is saved</span>
      <button type="submit" className="min-h-[32px] px-3 rounded-full bg-white font-extrabold">
        Exit
      </button>
    </form>
  );
}
