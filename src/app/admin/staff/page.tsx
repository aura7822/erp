import Link from "next/link";
import { eq } from "drizzle-orm";
import { LuUserCog } from "react-icons/lu";
import { db } from "@/db";
import { classes, staff, staffAttendance, staffGrades, staffSubjects, subjects } from "@/db/schema";
import { PageTitle, Tabs } from "@/components/Shell";
import { StaffForm, type StaffInit } from "@/components/StaffForm";
import { ActionForm, Modal, SubmitButton } from "@/components/ui";
import { CAN, requireRole } from "@/lib/auth";
import { STAFF_GROUPS, fmtDate, timeEAT, todayEAT } from "@/lib/constants";
import { adminClock, approveStaff, rejectStaff, revokeStaff, saveStaff, setStaffRole } from "../_actions/staff";

type S = typeof staff.$inferSelect;
const ALL_ROLES = ["admin", "principal", "bursar", "teacher", "support"];

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const me = await requireRole(["admin", "principal"]);
  const admin = CAN.manageSchool.includes(me.role);
  const sp = await searchParams;
  const type = sp.type === "non-teaching" ? "non_teaching" : "teaching";

  const [all, subs, cls, ss, sg, att] = await Promise.all([
    db.select().from(staff).orderBy(staff.name), db.select().from(subjects).orderBy(subjects.name), db.select().from(classes).orderBy(classes.level),
    db.select().from(staffSubjects), db.select().from(staffGrades), db.select().from(staffAttendance).where(eq(staffAttendance.date, todayEAT())),
  ]);
  const attOf = new Map(att.map((a) => [a.staffId, a]));
  const subName = new Map(subs.map((s) => [s.id, s.name])), clsName = new Map(cls.map((c) => [c.id, c.className]));
  const activeStaff = all.filter((s) => s.status === "active");
  const activeNow = activeStaff.filter((s) => attOf.has(s.id) && !attOf.get(s.id)!.clockOut).length;
  const teachingN = activeStaff.filter((s) => s.kind === "teaching").length, nonN = activeStaff.filter((s) => s.kind === "non_teaching").length;
  const pending = all.filter((s) => s.status === "pending");
  const revoked = all.filter((s) => s.status === "revoked");

  const init = (m?: S): StaffInit => ({
    id: m?.id, kind: m?.kind ?? type, role: m?.role ?? (type === "teaching" ? "teacher" : "support"), employmentType: m?.employmentType ?? "", name: m?.name ?? "", email: m?.email ?? "",
    phone: m?.phone ?? "", nationalId: m?.nationalId ?? "", tscNumber: m?.tscNumber ?? "", qualification: m?.qualification ?? "", department: m?.department ?? "", jobTitle: m?.jobTitle ?? "",
    subjectIds: m ? ss.filter((x) => x.staffId === m.id).map((x) => x.subjectId) : [], gradeIds: m ? sg.filter((x) => x.staffId === m.id).map((x) => x.classId) : [],
  });
  const formProps = { subjects: subs.map((s) => ({ id: s.id, name: s.name, category: s.category })), classes: cls.map((c) => ({ id: c.id, name: c.className, level: c.level })) };

  const presence = (m: S) => {
    const a = attOf.get(m.id);
    const on = !!a && !a.clockOut;
    const label = !a ? "Not clocked in" : a.clockOut ? `Left ${timeEAT(a.clockOut)}` : `Active · in ${timeEAT(a.clockIn)}`;
    return <span className="inline-flex items-center gap-1.5 text-xs font-semibold"><span className={`h-2 w-2 ${on ? "bg-ok" : "bg-ink-mute/50"}`} aria-hidden />{label}</span>;
  };

  return (
    <>
      <PageTitle title="Staff & roles" sub={`${activeNow} of ${activeStaff.length} staff active today (clocked in)`} back="/admin" icon={<LuUserCog />}>
        {admin && (
          <Modal label="Add staff member" title="Add staff member" variant="primary">
            <StaffForm key={type} mode="admin" action={saveStaff} initial={init()} submitLabel="Add staff member" {...formProps} />
          </Modal>
        )}
      </PageTitle>

      <Tabs current={`/admin/staff?type=${type === "teaching" ? "teaching" : "non-teaching"}`}
        tabs={[{ href: "/admin/staff?type=teaching", label: `Teaching staff (${teachingN})` }, { href: "/admin/staff?type=non-teaching", label: `Non-teaching staff (${nonN})` }]} />

      {pending.length > 0 && (
        <section className="card mb-6 border-2 border-gold p-5">
          <h2 className="font-display text-lg font-bold text-oxblood">Pending registrations ({pending.length})</h2>
          <p className="text-sm text-ink-mute">People who signed up and asked for a staff role. They have no access until you approve.</p>
          <ul className="mt-3 space-y-3">
            {pending.map((p) => (
              <li key={p.id} className="clay-tile flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div><p className="font-semibold">{p.name} <span className="chip ml-1">wants {p.requestedRole}</span> {p.employmentType && <span className="chip">{p.employmentType}</span>}</p>
                  <p className="text-ink-mute">{p.email} · {p.phone} · ID {p.nationalId}{p.tscNumber ? ` · TSC ${p.tscNumber}` : ""}</p>
                  <p className="text-ink-mute">{[p.qualification, p.department].filter(Boolean).join(" · ")}{ss.filter((x) => x.staffId === p.id).length ? ` · Subjects: ${ss.filter((x) => x.staffId === p.id).map((x) => subName.get(x.subjectId)).join(", ")}` : ""}</p></div>
                {admin && (
                  <div className="flex flex-wrap gap-2">
                    <ActionForm action={approveStaff} className="flex gap-2"><input type="hidden" name="id" value={p.id} /><select name="role" defaultValue={p.requestedRole ?? "teacher"} className="field !w-32 !py-1.5" aria-label="Role to grant">{ALL_ROLES.map((r) => <option key={r}>{r}</option>)}</select><SubmitButton size="sm">Approve</SubmitButton></ActionForm>
                    <ActionForm action={rejectStaff}><input type="hidden" name="id" value={p.id} /><SubmitButton size="sm" variant="danger" confirm={`Decline ${p.name}'s request?`}>Decline</SubmitButton></ActionForm>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {STAFF_GROUPS[type].map((g) => {
          const members = activeStaff.filter((s) => s.role === g.role && s.kind === type);
          const candidates = all.filter((s) => s.status !== "pending" && !(s.status === "active" && s.role === g.role));
          return (
            <section key={g.role} className="card flex flex-col p-5">
              <div className="flex items-start justify-between gap-3"><div><h2 className="font-display text-lg font-bold text-oxblood">{g.title}</h2><p className="text-sm text-ink-mute">{g.blurb}</p></div><span className="clay-tile px-3 py-1.5 font-display text-lg font-bold">{members.length}</span></div>
              <ul className="mt-4 flex-1 space-y-2">
                {members.map((m) => {
                  const mSubs = ss.filter((x) => x.staffId === m.id).map((x) => subName.get(x.subjectId)).filter(Boolean) as string[];
                  const mGrades = sg.filter((x) => x.staffId === m.id).map((x) => clsName.get(x.classId)?.replace("Grade ", "Gr ")).filter(Boolean) as string[];
                  return (
                    <li key={m.id}>
                      <details className="clay-tile px-3 py-2 text-sm">
                        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">{m.name}{m.employmentType && <span className="chip ml-2">{m.employmentType}</span>}</span>{presence(m)}
                        </summary>
                        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                          <div><dt className="text-ink-mute">Email</dt><dd className="break-all">{m.email}</dd></div><div><dt className="text-ink-mute">Phone</dt><dd>{m.phone ?? "-"}</dd></div>
                          <div><dt className="text-ink-mute">National ID</dt><dd>{m.nationalId ?? "-"}</dd></div><div><dt className="text-ink-mute">Employee ID</dt><dd>{m.employeeId}</dd></div>
                          {m.kind === "teaching" ? (<>
                            <div><dt className="text-ink-mute">Employed by</dt><dd>{m.employmentType ?? "-"}</dd></div><div><dt className="text-ink-mute">TSC no.</dt><dd>{m.tscNumber ?? (m.employmentType === "BOM" ? "Not required (BOM)" : "-")}</dd></div>
                          </>) : (<>
                            <div><dt className="text-ink-mute">Job title</dt><dd>{m.jobTitle ?? "-"}</dd></div><div><dt className="text-ink-mute">Employment</dt><dd>{m.employmentType ?? "-"}</dd></div>
                          </>)}
                          <div><dt className="text-ink-mute">{m.kind === "teaching" ? "Teaching department" : "Department"}</dt><dd>{m.department ?? "-"}</dd></div><div><dt className="text-ink-mute">Qualification</dt><dd>{m.qualification ?? "-"}</dd></div>
                          <div><dt className="text-ink-mute">Joined</dt><dd>{fmtDate(m.joinedOn)}</dd></div><div><dt className="text-ink-mute">Signed in</dt><dd>{m.clerkUserId ? "Yes" : "Not yet"}</dd></div>
                        </dl>
                        {m.kind === "teaching" && (
                          <div className="mt-3 space-y-2 text-xs">
                            <div><p className="mb-1 font-semibold uppercase tracking-wide text-ink-mute">Subjects</p><div className="flex flex-wrap gap-1.5">{mSubs.length ? mSubs.map((x) => <span key={x} className="chip">{x}</span>) : <span className="text-ink-mute">None selected</span>}</div></div>
                            <div><p className="mb-1 font-semibold uppercase tracking-wide text-ink-mute">Grades</p><div className="flex flex-wrap gap-1.5">{mGrades.length ? mGrades.map((x) => <span key={x} className="chip">{x}</span>) : <span className="text-alert">None selected: the timetable can&apos;t use this teacher yet</span>}</div></div>
                          </div>
                        )}
                        {admin && (
                          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-paper-line pt-3">
                            <Modal label="Edit details" title={`Edit ${m.name}`} variant="accent"><StaffForm mode="admin" action={saveStaff} initial={init(m)} submitLabel="Save changes" {...formProps} /></Modal>
                            <ActionForm action={adminClock}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="dir" value={attOf.get(m.id) && !attOf.get(m.id)!.clockOut ? "out" : "in"} />
                              <SubmitButton size="sm" variant="ghost">{attOf.get(m.id) && !attOf.get(m.id)!.clockOut ? "Clock out" : "Clock in"}</SubmitButton></ActionForm>
                            <ActionForm action={setStaffRole} className="flex gap-2"><input type="hidden" name="id" value={m.id} /><select name="role" defaultValue={m.role} className="field !w-28 !py-1.5" aria-label="Change role">{ALL_ROLES.map((x) => <option key={x}>{x}</option>)}</select><SubmitButton size="sm" variant="ghost">Change</SubmitButton></ActionForm>
                            <ActionForm action={revokeStaff}><input type="hidden" name="id" value={m.id} /><SubmitButton size="sm" variant="danger" confirm={`Revoke ${m.name}'s access?`}>Revoke</SubmitButton></ActionForm>
                          </div>
                        )}
                      </details>
                    </li>
                  );
                })}
                {members.length === 0 && <li className="text-sm text-ink-mute">No one has this role yet.</li>}
              </ul>
              {admin && candidates.length > 0 && (
                <ActionForm action={setStaffRole} className="mt-4 flex gap-2 border-t border-paper-line pt-4">
                  <input type="hidden" name="role" value={g.role} />
                  <select name="id" className="field" aria-label={`Add to ${g.title}`} defaultValue=""><option value="" disabled>Add existing staff…</option>{candidates.map((c) => <option key={c.id} value={c.id}>{c.name}{c.status === "active" ? ` (${c.role})` : " (revoked)"}</option>)}</select>
                  <SubmitButton size="sm">Add</SubmitButton>
                </ActionForm>
              )}
            </section>
          );
        })}
      </div>

      {revoked.length > 0 && (
        <section className="card mt-6 p-5">
          <h2 className="font-display text-lg font-bold text-oxblood">Revoked access</h2>
          <ul className="mt-3 divide-y divide-paper-line/70 text-sm">{revoked.map((m) => <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span>{m.name} · <span className="text-ink-mute">{m.email}</span></span>
            {admin && <ActionForm action={setStaffRole} className="flex gap-2"><input type="hidden" name="id" value={m.id} /><select name="role" defaultValue={m.role} className="field !w-32 !py-1.5" aria-label="Reinstate as">{ALL_ROLES.map((x) => <option key={x}>{x}</option>)}</select><SubmitButton size="sm" variant="ghost">Reinstate</SubmitButton></ActionForm>}</li>)}</ul>
        </section>
      )}
      <p className="mt-6 text-xs text-ink-mute print:hidden">Clock-in: staff with a login clock in from the sidebar (clock icon); admins can clock anyone in or out here. Today is {fmtDate(todayEAT())}. <Link href="/admin/academics/teachers" className="underline">See teachers by subject and grade</Link></p>
    </>
  );
}
