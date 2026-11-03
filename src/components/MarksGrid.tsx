"use client";
import { useState, useTransition } from "react";
import { saveMarks } from "@/app/teacher/actions";
import { gradeFor } from "@/lib/grading";

type S = { id: number; name: string; adm: string; marks: string };

export function MarksGrid(p: { assignmentId: number; termId: number; examType: string; students: S[] }) {
  const [marks, setMarks] = useState<Record<number, string>>(Object.fromEntries(p.students.map((s) => [s.id, s.marks])));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const save = () => start(async () => {
    const r = await saveMarks(p.assignmentId, p.termId, p.examType, marks);
    setMsg("error" in r ? { ok: false, text: r.error } : { ok: true, text: `Saved ${r.saved} marks at ${new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}` });
  });

  return (
    <div className="card mt-4 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-paper"><tr><th className="th">Adm. no.</th><th className="th">Student</th><th className="th w-32">Marks /100</th><th className="th w-16">Grade</th></tr></thead>
        <tbody className="divide-y divide-paper-line">
          {p.students.map((s, i) => {
            const v = marks[s.id] ?? "";
            const n = parseFloat(v);
            const bad = v !== "" && (isNaN(n) || n < 0 || n > 100);
            return (
              <tr key={s.id}>
                <td className="td tabular-nums text-ink-mute">{s.adm}</td>
                <td className="td">{s.name}</td>
                <td className="px-4 py-1.5">
                  <input data-i={i} type="number" inputMode="decimal" step="0.5" min={0} max={100} value={v}
                    aria-label={`Marks for ${s.name}`} aria-invalid={bad}
                    onChange={(e) => setMarks((m) => ({ ...m, [s.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); document.querySelector<HTMLInputElement>(`input[data-i="${i + 1}"]`)?.focus(); } }}
                    className={`field !py-1.5 tabular-nums ${bad ? "!border-alert" : ""}`} />
                </td>
                <td className="td font-semibold">{v !== "" && !isNaN(n) && !bad ? gradeFor(n) : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="sticky bottom-0 flex items-center justify-between border-t border-paper-line bg-white px-4 py-3">
        <span role="status" className={`text-sm ${msg && !msg.ok ? "text-alert" : "text-ink-mute"}`}>{msg?.text ?? "Press Enter to jump to the next student."}</span>
        <button onClick={save} disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save marks"}</button>
      </div>
    </div>
  );
}
