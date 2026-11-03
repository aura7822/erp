import { redirect } from "next/navigation";
import { BackLink } from "@/components/nav";
import { getSession, homeFor } from "@/lib/auth";
import { RoleCards } from "./RoleCards";

export default async function Join() {
  const s = await getSession();
  if (s) redirect(homeFor(s.role));
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <BackLink href="/" />
      <h1 className="mt-6 font-display text-3xl font-bold">Create your account</h1>
      <p className="mb-8 mt-2 text-ink-mute">First tell us who you are, so we can set things up for you.</p>
      <RoleCards />
      <p className="mt-6 text-sm text-ink-mute">Already registered? <a href="/sign-in" className="font-semibold underline">Sign in</a>. Administrator accounts are created by the school, not here.</p>
    </main>
  );
}
