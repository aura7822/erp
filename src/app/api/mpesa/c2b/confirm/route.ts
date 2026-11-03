import { db } from "@/db";
import { paymentCallbacks } from "@/db/schema";
import { parseDarajaTime } from "@/lib/mpesa";
import { postPayment } from "@/lib/payments";
import { accepted, tokenOk } from "@/lib/webhook";

export async function POST(req: Request) {
  if (!tokenOk(req)) return new Response("forbidden", { status: 403 });
  const b = await req.json();
  await db.insert(paymentCallbacks).values({ source: "c2b", payload: b });
  await postPayment({
    reference: String(b.TransID),
    amount: Number(b.TransAmount).toFixed(2),
    method: "M-Pesa",
    billRef: String(b.BillRefNumber ?? ""),
    phone: String(b.MSISDN ?? ""),
    paidAt: parseDarajaTime(String(b.TransTime ?? "")),
  });
  return accepted();
}
