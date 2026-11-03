// Dependency-free charts (server-renderable). Each has an aria-label that reads out the data.
type D = { label: string; value: number };
const compact = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + "K" : String(Math.round(n)));

export function BarChart({ data, label, fmt = compact, tone = "vulcan" }: { data: D[]; label: string; fmt?: (n: number) => string; tone?: "vulcan" | "sand" }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div role="img" aria-label={`${label}: ${data.map((d) => `${d.label} ${fmt(d.value)}`).join(", ")}`} className="flex h-44 items-end gap-1.5">
      {data.map((d) => (
        <div key={d.label} className="flex h-full min-w-0 flex-1 flex-col items-center gap-1">
          <span className="h-4 text-[10px] tabular-nums text-ink-mute">{d.value ? fmt(d.value) : ""}</span>
          <div className="flex w-full flex-1 items-end"><div className={`w-full rounded-t-xl ${tone === "vulcan" ? "bar-clay" : "bar-sand"}`} style={{ height: `${d.value ? Math.max((d.value / max) * 100, 5) : 1.5}%` }} /></div>
          <span className="w-full truncate text-center text-[10px] text-ink-mute">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function HBars({ data, label, fmt = compact }: { data: D[]; label: string; fmt?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <ul aria-label={label} className="space-y-3">
      {data.map((d) => (
        <li key={d.label}>
          <div className="mb-1 flex justify-between text-sm"><span className="truncate pr-3">{d.label}</span><span className="tabular-nums text-ink-mute">{fmt(d.value)} · {Math.round((d.value / total) * 100)}%</span></div>
          <div className="h-3 rounded-full" style={{ background: "#e1d8b8", boxShadow: "inset 2px 2px 4px rgba(110,92,48,.3)" }}>
            <div className="bar-clay h-3 rounded-full" style={{ width: `${Math.max((d.value / max) * 100, 3)}%`, background: "linear-gradient(90deg,#e8c466,#c9962b)" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Stat({ label, value, hint, warn }: { label: string; value: string; hint?: string; warn?: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-ink-mute">{label}</p>
      <p className={`mt-1 font-display text-xl font-bold ${warn ? "text-alert" : ""}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-mute">{hint}</p>}
    </div>
  );
}

export function monthKeys(n: number): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push({ key: `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`, label: x.toLocaleString("en", { month: "short" }) });
  }
  return out;
}
