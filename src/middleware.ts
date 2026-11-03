import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public: landing, auth pages, and gateway webhooks (those use their own token/HMAC checks)
const isPublic = createRouteMatcher([
  "/", "/sign-in(.*)", "/sign-up(.*)", "/api/mpesa(.*)", "/api/bank(.*)", "/api/cron(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) await auth.protect();
});

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
