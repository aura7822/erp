import { eq } from "drizzle-orm";
import { db } from "@/db";
import { paymentCallbacks, stkRequests } from "@/db/schema";
import { parseDarajaTime } from "@/lib/mpesa";
import { postPayment } from "@/lib/payments";
import { accepted, tokenOk } from "@/lib/webhook";

export async function POST(req: Request) {
  if (!tokenOk(req)) return new Response("forbidden", { status: 403 });
  const payload = await req.json();
  await db.insert(paymentCallbacks).values({ source: "stk", payload });

  const cb = payload?.Body?.stkCallback;
  if (!cb) return accepted();
  const [stk] = await db.select().from(stkRequests).where(eq(stkRequests.checkoutRequestId, cb.CheckoutRequestID));
  if (!stk) return accepted();

  if (Number(cb.ResultCode) !== 0) {
    await db.update(stkRequests).set({ status: Number(cb.ResultCode) === 1032 ? "cancelled" : "failed", resultDesc: cb.ResultDesc }).where(eq(stkRequests.id, stk.id));
    return accepted();
  }

  const items: Record<string, string | number> = Object.fromEntries((cb.CallbackMetadata?.Item ?? []).map((i: { Name: string; Value: string | number }) => [i.Name, i.Value]));
  // Post first, then mark success: if posting throws, Safaricom's retry will try again
  await postPayment({
    reference: String(items.MpesaReceiptNumber),
    amount: Number(items.Amount).toFixed(2),
    method: "M-Pesa",
    phone: String(items.PhoneNumber ?? ""),
    paidAt: parseDarajaTime(String(items.TransactionDate ?? "")),
    invoiceId: stk.invoiceId,
  });
  await db.update(stkRequests).set({ status: "success", resultDesc: cb.ResultDesc }).where(eq(stkRequests.id, stk.id));
  return accepted();
}
