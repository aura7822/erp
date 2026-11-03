import { DAYS, SLOTS } from "@/lib/constants";

export type Cell = { title: string; sub: string; tint: number } | null;
const TINTS = ["#f3e7c2", "#ead5d2", "#e3e6cf", "#e9dfc4", "#ecdac9", "#dde4d6", "#efe3d0", "#e6d8d3"];

export function TimetableGrid({ cell }: { cell: (day: number, period: number) => Cell }) {
  return (
    <div className="card overflow-x-auto p-2 print:border-0 print:p-0">
      <table className="w-full min-w-[720px] border-separate border-spacing-1.5 text-sm">
        <thead><tr><th className="w-24 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-mute">Time</th>{DAYS.map((d) => <th key={d} className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-ink-mute">{d}</th>)}</tr></thead>
        <tbody>
          {SLOTS.map((s, i) => s.type === "break" ? (
            <tr key={i}><td className="px-2 py-1 text-xs text-ink-mute">{s.start}–{s.end}</td>
              <td colSpan={DAYS.length} className="rounded-xl py-1.5 text-center text-xs font-semibold uppercase tracking-widest text-ink-mute" style={{ background: "#e1d8b8" }}>{s.label}</td></tr>
          ) : (
            <tr key={i}>
              <td className="px-2 py-1 text-xs leading-tight text-ink-mute"><span className="font-semibold text-ink">P{s.period + 1}</span><br />{s.start}–{s.end}</td>
              {DAYS.map((_, d) => {
                const c = cell(d, s.period);
                return <td key={d} className="h-14 rounded-xl px-2 py-1.5 align-top" style={c ? { background: TINTS[c.tint % TINTS.length], WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } : { background: "#f3eedb" }}>
                  {c ? <><p className="font-semibold leading-tight">{c.title}</p><p className="text-xs text-ink-soft">{c.sub}</p></> : <span className="text-xs text-ink-mute/60">Free</span>}
                </td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
