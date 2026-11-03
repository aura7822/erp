import { db } from "@/db";
import { students } from "@/db/schema";
import { postPayment } from "./payments";

export const bankConfigured = () => !!(process.env.BANK_API_BASE_URL && process.env.BANK_API_KEY);

type Tx = { reference: string; amount: number; hint: string; paidAt: Date };
const pick = (o: Record<string, unknown>, keys: string[]) => { for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k]; return undefined; };

/** Generic statement fetch. Banks differ, so field names are matched loosely; adjust the key lists below if yours differs. */
async function fetchTransactions(from: Date, to: Date): Promise<Tx[]> {
  const path = (process.env.BANK_API_TX_PATH ?? "/transactions").replace("{account}", encodeURIComponent(process.env.BANK_ACCOUNT_NUMBER ?? ""));
  const url = new URL(path, process.env.BANK_API_BASE_URL);
  url.searchParams.set("from", from.toISOString().slice(0, 10));
  url.searchParams.set("to", to.toISOString().slice(0, 10));
  const key = process.env.BANK_API_KEY!;
  const headers: Record<string, string> = process.env.BANK_API_AUTH === "x-api-key" ? { "x-api-key": key } : { Authorization: `Bearer ${key}` };
  if (process.env.BANK_API_SECRET) headers["x-api-secret"] = process.env.BANK_API_SECRET;

  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`Bank API responded ${res.status}`);
  const j = await res.json();
  const arr: Record<string, unknown>[] = Array.isArray(j) ? j : (j.transactions ?? j.data ?? j.items ?? j.results ?? []);

  const out: Tx[] = [];
  for (const t of arr) {
    const type = String(pick(t, ["type", "transactionType", "drCr", "creditDebit"]) ?? "").toLowerCase();
    if (/^(d|dr|debit|withdrawal)$/.test(type)) continue; // only money coming in
    const amount = Number(pick(t, ["amount", "creditAmount", "credit", "transactionAmount"]));
    const reference = String(pick(t, ["reference", "transactionReference", "transactionId", "id", "refNo"]) ?? "");
    if (!reference || !(amount > 0)) continue;
    const hint = [pick(t, ["account", "accountReference", "billRef", "billRefNumber"]), pick(t, ["narration", "description", "details", "remarks"])].filter(Boolean).join(" ");
    const when = pick(t, ["date", "valueDate", "postedAt", "transactionDate", "bookingDate"]);
    out.push({ reference, amount, hint, paidAt: when ? new Date(String(when)) : new Date() });
  }
  return out;
}

/** Pulls recent credits and posts each to the right student ledger. Safe to run repeatedly (idempotent by reference). */
export async function syncBankPayments(days = 7) {
  const to = new Date(), from = new Date(Date.now() - days * 864e5);
  const txs = await fetchTransactions(from, to);
  const adm = new Set((await db.select({ a: students.admissionNumber }).from(students)).map((r) => r.a.toUpperCase()));
  let matched = 0, unmatched = 0;
  for (const t of txs) {
    const tokens = t.hint.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
    const billRef = tokens.find((x) => adm.has(x)) ?? (t.hint.slice(0, 40) || null);
    const p = await postPayment({ reference: `BANK-${t.reference}`, amount: t.amount.toFixed(2), method: "Bank", billRef, paidAt: t.paidAt });
    if (p) matched++; else unmatched++;
  }
  return { fetched: txs.length, matched, unmatched };
}
