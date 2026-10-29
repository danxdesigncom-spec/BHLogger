/**
 * The page to open after signing in, from `?next=`. Only a path on this site is allowed; anything else
 * ("https://…", "//host", "/\host", "@host", control characters) falls back to "/", so a sign-in link
 * can't be used to send someone to another site.
 */
export function safeNext(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/")) return "/";
  if (value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return "/";
  return value;
}
