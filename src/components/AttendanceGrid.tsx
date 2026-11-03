"use client";
import { useState, useTransition } from "react";
import { saveAttendance } from "@/app/teacher/actions";

type Status = "present" | "late" | "excused" | "absent";
const OPTS: [Status, string][] = [["present", "P"], ["late", "L"], ["excused", "E"], ["absent", "A"]];
type S = { id: number; name: string; adm: string; status: Status };

export function AttendanceGrid(p: { classId: number; date: string; students: S[] }) {
  const [st, setSt] = useState<Record<number, Status>>(Object.fromEntries(p.students.map((s) => [s.id, s.status])));
  const [notify, setNotify] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const all = (v: Status) => setSt(Object.fromEntries(p.students.map((s) => [s.id, v])));
  const counts = Object.values(st).reduce<Record<string, number>>((a, v) => ((a[v] = (a[v] ?? 0) + 1), a), {});

  const save = () => start(async () => {
    const r = await saveAttendance(p.classId, p.date, st, notify);
    setMsg("error" in r ? { ok: false, text: r.error } : { ok: true, text: `Saved ${r.saved} records` });
  });

  return (
    <div className="card mt-4 overflow-hidden">
      <div className="flex gap-2 border-b border-paper-line p-3">
        <button type="button" className="btn-ghost btn-sm" onClick={() => all("present")}>All present</button>
        <button type="button" className="btn-ghost btn-sm" onClick={() => all("absent")}>All absent</button>
      </div>
      <ul className="divide-y divide-paper-line">
        {p.students.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2">
            <span className="min-w-0 truncate">{s.name}<span className="ml-2 text-sm text-ink-mute">{s.adm}</span></span>
            <div className="flex shrink-0 overflow-hidden rounded-lg border border-paper-line" role="radiogroup" aria-label={`Attendance for ${s.name}`}>
              {OPTS.map(([v, abbr]) => (
                <button key={v} type="button" role="radio" aria-checked={st[s.id] === v} title={v} onClick={() => setSt((m) => ({ ...m, [s.id]: v }))}
                  className={`w-10 py-2 text-sm font-semibold ${st[s.id] === v ? (v === "absent" ? "bg-alert text-white" : "bg-ink text-white") : "text-ink-mute hover:bg-paper"}`}>{abbr}</button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-paper-line bg-white px-4 py-3">
        <span role="status" className={`text-sm ${msg && !msg.ok ? "text-alert" : "text-ink-mute"}`}>
          {counts.present ?? 0} present · {counts.late ?? 0} late · {counts.absent ?? 0} absent{msg?.ok ? ` · ${msg.text}` : msg ? ` · ${msg.text}` : ""}
        </span>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Notify parents of absences</label>
          <button onClick={save} disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save register"}</button>
        </div>
      </div>
    </div>
  );
}
