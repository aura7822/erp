"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function chooseRole(fd: FormData) {
  const role = String(fd.get("role") ?? "parent");
  const ok = ["parent", "teacher", "bursar"].includes(role) ? role : "parent";
  (await cookies()).set("join_role", ok, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24, path: "/" });
  const next = String(fd.get("next") ?? "/sign-up");
  redirect(next === "/onboarding" ? "/onboarding" : "/sign-up");
}
