"use client";
import { useActionState, useState } from "react";
import type { ActionState } from "@/lib/action";
import { SUPPORT_DEPARTMENTS, SUPPORT_EMPLOYMENT, SUPPORT_TITLES, TEACHING_DEPARTMENTS, TEACHING_EMPLOYMENT } from "@/lib/constants";
import { FormMessage, SubmitButton } from "./ui";

export type StaffInit = {
  id?: number; kind: "teaching" | "non_teaching"; role: string; employmentType: string; name: string; email: string; phone: string; nationalId: string;
  tscNumber: string; qualification: string; department: string; jobTitle: string; subjectIds: number[]; gradeIds: number[];
};
type Subj = { id: number; name: string; category: string | null };
type Cls = { id: number; name: string; level: number };

const BANDS: [string, number, number][] = [["Lower (1-3)", 1, 3], ["Upper (4-6)", 4, 6], ["Junior (7-9)", 7, 9], ["Senior (10-12)", 10, 12]];

export function StaffForm({ mode, action, subjects, classes, initial, submitLabel, lockedEmail }: {
  mode: "admin" | "self"; action: (p: ActionState, fd: FormData) => Promise<ActionState>; subjects: Subj[]; classes: Cls[]; initial: StaffInit; submitLabel: string; lockedEmail?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const [kind, setKind] = useState(initial.kind);
  const [role, setRole] = useState(initial.role);
  const [emp, setEmp] = useState(initial.employmentType);
  const [grades, setGrades] = useState<Set<number>>(new Set(initial.gradeIds));
  const teaching = kind === "teaching";
  const roles = teaching ? ["teacher", "principal"] : ["admin", "bursar", "support"];
  const empOptions = teaching ? TEACHING_EMPLOYMENT : SUPPORT_EMPLOYMENT;
  const tscRequired = teaching && emp === "TSC";
  const cats = [...new Set(subjects.map((s) => s.category ?? "Other"))];
  const chosen = new Set(initial.subjectIds);

  const switchKind = (k: "teaching" | "non_teaching") => { setKind(k); setRole(k === "teaching" ? "teacher" : "support"); setEmp(""); };
  const toggleGrade = (id: number) => setGrades((g) => { const n = new Set(g); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleBand = (a: number, b: number) => setGrades((g) => {
    const ids = classes.filter((c) => c.level >= a && c.level <= b).map((c) => c.id);
    const all = ids.every((i) => g.has(i)); const n = new Set(g);
    ids.forEach((i) => (all ? n.delete(i) : n.add(i)));
    return n;
  });

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="kind" value={kind} />
      {mode === "self" && <input type="hidden" name="role" value={role} />}

      {mode === "admin" && (
        <>
          <div className="sm:col-span-2">
            <p className="label">Staff type</p>
            <div className="flex gap-2" role="radiogroup" aria-label="Staff type">
              {([["teaching", "Teaching staff"], ["non_teaching", "Non-teaching staff"]] as const).map(([k, l]) => (
                <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => switchKind(k)} className={kind === k ? "btn-primary" : "btn-ghost"}>{l}</button>
              ))}
            </div>
          </div>
          <div><label className="label" htmlFor="sr">Role</label>
            <select id="sr" name="role" value={role} onChange={(e) => setRole(e.target.value)} className="field">{roles.map((r) => <option key={r} value={r}>{r === "support" ? "support (no login)" : r}</option>)}</select></div>
        </>
      )}

      <div><label className="label" htmlFor="sn">Full name</label><input id="sn" name="name" defaultValue={initial.name} className="field" required /></div>
      <div><label className="label" htmlFor="se">Email{lockedEmail ? "" : " (they sign in with this)"}</label><input id="se" name="email" type="email" defaultValue={initial.email} className="field" readOnly={lockedEmail} required={mode === "admin" && role !== "support"} /></div>
      <div><label className="label" htmlFor="sp">Phone</label><input id="sp" name="phone" type="tel" defaultValue={initial.phone} placeholder="0712 345 678" className="field" required={mode === "self"} /></div>
      <div><label className="label" htmlFor="si">National ID</label><input id="si" name="nationalId" defaultValue={initial.nationalId} className="field" required={mode === "self"} /></div>

      <div><label className="label" htmlFor="sem">Employed by</label>
        <select id="sem" name="employmentType" value={emp} onChange={(e) => setEmp(e.target.value)} className="field" required={teaching}>
          <option value="">{teaching ? "Choose…" : "Not specified"}</option>{empOptions.map((o) => <option key={o} value={o}>{o === "TSC" ? "TSC (Teachers Service Commission)" : o === "BOM" ? "BOM (Board of Management)" : o}</option>)}
        </select></div>

      {teaching && (
        <div><label className="label" htmlFor="st">TSC number {tscRequired ? <span className="text-alert">*</span> : <span className="font-normal text-ink-mute">(not required for BOM)</span>}</label>
          <input id="st" name="tscNumber" defaultValue={initial.tscNumber} className="field" required={tscRequired} placeholder={emp === "BOM" ? "Optional for BOM" : "e.g. 123456"} /></div>
      )}
      {!teaching && <div><label className="label" htmlFor="sj">Job title</label><input id="sj" name="jobTitle" list="titles" defaultValue={initial.jobTitle} className="field" required /><datalist id="titles">{SUPPORT_TITLES.map((t) => <option key={t} value={t} />)}</datalist></div>}

      <div><label className="label" htmlFor="sd">{teaching ? "Teaching department" : "Department"}</label>
        <input id="sd" name="department" list="deps" defaultValue={initial.department} className="field" /><datalist id="deps">{(teaching ? TEACHING_DEPARTMENTS : SUPPORT_DEPARTMENTS).map((d) => <option key={d} value={d} />)}</datalist></div>
      <div><label className="label" htmlFor="sq">Qualification</label><input id="sq" name="qualification" defaultValue={initial.qualification} placeholder="e.g. B.Ed (Science)" className="field" /></div>

      {teaching && (
        <>
          <fieldset className="sm:col-span-2">
            <legend className="label">Grades taught {grades.size > 0 && <span className="font-normal text-ink-mute">({grades.size} selected)</span>}</legend>
            <div className="mb-2 flex flex-wrap gap-2">{BANDS.map(([l, a, b]) => <button key={l} type="button" className="btn-ghost btn-sm" onClick={() => toggleBand(a, b)}>{l}</button>)}</div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {classes.map((c) => (
                <label key={c.id} className={`flex cursor-pointer items-center justify-center px-2 py-2 text-sm font-medium ${grades.has(c.id) ? "bg-brand text-white" : "clay-tile"}`}>
                  <input type="checkbox" className="sr-only" checked={grades.has(c.id)} onChange={() => toggleGrade(c.id)} />{c.name.replace("Grade ", "Gr ")}
                </label>
              ))}
            </div>
            {[...grades].map((id) => <input key={id} type="hidden" name="gradeId" value={id} />)}
          </fieldset>

          <fieldset className="sm:col-span-2">
            <legend className="label">Subjects taught</legend>
            <p className="mb-2 text-xs text-ink-mute">Subjects and grades together feed the automatic timetable. A teacher is matched to every selected subject in every selected grade that offers it.</p>
            <div className="max-h-64 space-y-1 overflow-auto border border-paper-line bg-paper-light p-2">
              {cats.map((c) => (
                <details key={c} open={subjects.some((s) => (s.category ?? "Other") === c && chosen.has(s.id))}>
                  <summary className="cursor-pointer px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-mute">{c}</summary>
                  <div className="grid gap-1 px-2 pb-2 sm:grid-cols-2">
                    {subjects.filter((s) => (s.category ?? "Other") === c).map((s) => (
                      <label key={s.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="subjectId" value={s.id} defaultChecked={chosen.has(s.id)} className="h-4 w-4 accent-[#550605]" />{s.name}</label>
                    ))}
                  </div>
                </details>
              ))}
              {subjects.length === 0 && <p className="p-2 text-sm text-ink-mute">No subjects yet. Load the CBC subjects under Academics → Subjects first.</p>}
            </div>
          </fieldset>
        </>
      )}

      <div className="sm:col-span-2"><SubmitButton className="w-full sm:w-auto" pendingText="Saving…">{submitLabel}</SubmitButton></div>
      <FormMessage state={state} />
    </form>
  );
}
