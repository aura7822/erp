import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { classes, subjects } from "@/db/schema";
import { StaffForm } from "@/components/StaffForm";
import { getSession, homeFor } from "@/lib/auth";
import { RoleCards } from "../join/RoleCards";
import { submitStaffRegistration } from "./actions";

export default async function Onboarding() {
  const s = await getSession();
  if (!s) redirect("/sign-in");
  if (s.staffStatus === "active" || s.role !== "parent") redirect(homeFor(s.role));
  const wrap = (c: React.ReactNode) => <main className="mx-auto max-w-3xl px-4 py-12">{c}</main>;

  if (s.staffStatus === "pending") return wrap(
    <div className="card p-8 text-center"><h1 className="font-display text-2xl font-bold text-oxblood">Request received</h1>
      <p className="mt-2 text-ink-mute">An administrator will review your details and approve your role. Sign in again once you hear from them.</p><Link href="/" className="btn-ghost mt-6">Refresh status</Link></div>);
  if (s.staffStatus === "revoked") return wrap(<div className="card p-8 text-center"><h1 className="font-display text-2xl font-bold text-oxblood">Access removed</h1><p className="mt-2 text-ink-mute">Your staff access was revoked. Contact the school office.</p></div>);

  const role = (await cookies()).get("join_role")?.value;
  if (role === "parent") redirect("/portal");
  if (role !== "teacher" && role !== "bursar") return wrap(<><h1 className="mb-6 font-display text-3xl font-bold text-oxblood">Welcome. Who are you?</h1><RoleCards next="/onboarding" /></>);

  const [subs, cls] = await Promise.all([db.select().from(subjects).orderBy(subjects.name), db.select().from(classes).orderBy(classes.level)]);
  return wrap(
    <>
      <h1 className="font-display text-3xl font-bold text-oxblood">Staff registration</h1>
      <p className="mb-6 mt-2 text-ink-mute">Tell us a little about you. An administrator reviews every request before granting access.</p>
      <div className="card p-6">
        <StaffForm mode="self" action={submitStaffRegistration} lockedEmail submitLabel="Send request"
          subjects={subs.map((x) => ({ id: x.id, name: x.name, category: x.category }))} classes={cls.map((c) => ({ id: c.id, name: c.className, level: c.level }))}
          initial={{ kind: role === "teacher" ? "teaching" : "non_teaching", role, employmentType: "", name: s.name, email: s.email, phone: "", nationalId: "", tscNumber: "", qualification: "", department: "", jobTitle: role === "bursar" ? "Bursar" : "", subjectIds: [], gradeIds: [] }} />
      </div>
    </>,
  );
}
