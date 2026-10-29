// SET-07: what deleting your account does, so the screen can say it before anyone confirms.
// The database enforces the same rule in delete_my_account().

export type AccountDeletion =
  /** The demo: clears this browser's sample data and leaves. */
  | "demo"
  /** The only member: the household and everything in it go too. */
  | "sole"
  /** Other members remain and nobody else is an admin: make someone an admin first. */
  | "last_admin"
  /** Leaves the household; entries stay, labeled with this person's name. */
  | "leave";

export function accountDeletion(
  mode: "live" | "demo",
  members: { id: string; role: string }[],
  me: { id: string; role: string },
): AccountDeletion {
  if (mode === "demo") return "demo";
  const others = members.filter((m) => m.id !== me.id);
  if (!others.length) return "sole";
  if (me.role === "admin" && !others.some((m) => m.role === "admin")) return "last_admin";
  return "leave";
}
