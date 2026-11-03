import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, homeFor } from "@/lib/auth";

export default async function Home() {
  const s = await getSession();
  if (s) redirect(s.role === "parent" && s.staffStatus === "pending" ? "/onboarding" : homeFor(s.role));
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="card max-w-md p-8 text-center">
        <span className="bg-brand mx-auto grid h-14 w-14 place-items-center font-display text-2xl font-bold text-gold-light">{(process.env.SCHOOL_NAME ?? "S")[0]}</span>
        <h1 className="mt-5 font-display text-3xl font-bold text-oxblood">{process.env.SCHOOL_NAME ?? "School portal"}</h1>
        <p className="mt-3 text-ink-mute">Fees, attendance and report cards for parents. Marks, registers and timetables for teachers.</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/sign-in" className="btn-primary">Sign in</Link><Link href="/join" className="btn-ghost">Create account</Link></div>
      </div>
    </main>
  );
}
