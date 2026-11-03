"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startStkPush } from "@/app/portal/actions";

export function PayForm({ invoiceId, balance, defaultPhone }: { invoiceId: number; balance: number; defaultPhone: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState(defaultPhone);
  const [amount, setAmount] = useState(String(Math.ceil(balance)));
  const [error, setError] = useState<string | null>(null);
  const [stkId, setStkId] = useState<number | null>(null);
  const [state, setState] = useState<"idle" | "pending" | "success" | "failed" | "cancelled">("idle");
  const [detail, setDetail] = useState("");
  const [busy, start] = useTransition();

  useEffect(() => {
    if (!stkId || state !== "pending") return;
    let tries = 0;
    const t = setInterval(async () => {
      tries++;
      const r = await fetch(`/api/stk-status/${stkId}`, { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        if (j.status !== "pending") { setState(j.status); setDetail(j.resultDesc ?? ""); clearInterval(t); if (j.status === "success") setTimeout(() => router.refresh(), 1500); }
      }
      if (tries > 40) { clearInterval(t); setState("failed"); setDetail("We did not hear back from M-Pesa. If money left your phone, it will appear here shortly."); }
    }, 3000);
    return () => clearInterval(t);
  }, [stkId, state, router]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    start(async () => {
      const r = await startStkPush(invoiceId, phone, Number(amount));
      if ("error" in r) setError(r.error); else { setStkId(r.stkId); setState("pending"); }
    });
  };

  return (
    <div className="card p-5" id="pay">
      <h2 className="font-display text-lg font-bold">Pay with M-Pesa</h2>
      {state === "idle" && (
        <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="phone">M-Pesa phone number</label>
            <input id="phone" className="field" type="tel" inputMode="tel" autoComplete="tel" placeholder="0712 345 678" value={phone} onChange={(e) => setPhone(e.target.value)} required /></div>
          <div><label className="label" htmlFor="amt">Amount (KES)</label>
            <input id="amt" className="field" type="number" inputMode="numeric" min={1} max={Math.ceil(balance)} value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
          {error && <p role="alert" className="text-sm text-alert sm:col-span-2">{error}</p>}
          <div className="sm:col-span-2">
            <button className="btn-accent w-full sm:w-auto" disabled={busy}>{busy ? "Sending…" : "Send payment request"}</button>
            <p className="mt-2 text-sm text-ink-mute">You'll get a prompt on your phone. Enter your M-Pesa PIN to confirm.</p>
          </div>
        </form>
      )}
      {state === "pending" && <div role="status" className="mt-4"><p className="font-semibold">Check your phone</p><p className="mt-1 text-ink-mute">Enter your M-Pesa PIN to pay KES {Number(amount).toLocaleString()}. This updates when payment arrives.</p></div>}
      {state === "success" && <div role="status" className="mt-4"><p className="font-semibold text-ok">Payment received</p><p className="mt-1 text-ink-mute">A receipt is on its way to your email. Updating your balance…</p></div>}
      {(state === "failed" || state === "cancelled") && (
        <div role="alert" className="mt-4">
          <p className="font-semibold text-alert">{state === "cancelled" ? "Payment cancelled" : "Payment did not go through"}</p>
          <p className="mt-1 text-ink-mute">{detail || "No money was taken."} You can try again.</p>
          <button className="btn-ghost mt-3" onClick={() => { setState("idle"); setStkId(null); }}>Try again</button>
        </div>
      )}
    </div>
  );
}
