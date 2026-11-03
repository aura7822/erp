export type ActionState = { ok?: string; error?: string; details?: string[] } | null;

/** Throw this for problems the user can fix; the message is shown as-is. */
export class UserError extends Error {}

type Result = string | { ok: string; details?: string[] } | void;

/** Wraps a server action body: friendly errors, but lets redirect()/notFound() through. */
export async function run(fn: () => Promise<Result>): Promise<ActionState> {
  try {
    const r = await fn();
    if (r && typeof r === "object") return r;
    return { ok: r || "Saved." };
  } catch (e) {
    const digest = (e as { digest?: string })?.digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_")) throw e;
    if (e instanceof UserError) return { error: e.message };
    const code = (e as { code?: string })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;
    if (code === "23505") return { error: "That already exists. Check for a duplicate (admission number, code, email…)." };
    if (code === "23503") return { error: "That record is still linked to other data, so it can't be changed this way." };
    if (code === "22P02" || code === "22007") return { error: "One of the values has an invalid format." };
    console.error(e);
    return { error: "Something went wrong on our side. Please try again." };
  }
}

export const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
export const opt = (fd: FormData, k: string) => str(fd, k) || null;
export const int = (fd: FormData, k: string) => {
  const n = Number.parseInt(str(fd, k), 10);
  if (!Number.isFinite(n)) throw new UserError("A required selection is missing.");
  return n;
};
export const optInt = (fd: FormData, k: string) => (str(fd, k) ? int(fd, k) : null);
export function need(v: string | null | undefined, label: string): string {
  if (!v) throw new UserError(`${label} is required.`);
  return v;
}
