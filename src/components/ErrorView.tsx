"use client";
export function ErrorView({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="card mx-auto mt-10 max-w-lg p-8 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-alert/10 text-xl text-alert" aria-hidden>!</span>
      <h2 className="mt-4 font-display text-xl font-bold">Something went wrong</h2>
      <p className="mt-2 text-sm text-ink-mute">We couldn&apos;t load this page. Your data is safe. Try again, and if it keeps happening, contact the administrator.</p>
      {error.digest && <p className="mt-2 text-xs text-ink-mute">Reference: {error.digest}</p>}
      <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row"><button onClick={reset} className="btn-primary">Try again</button><a href="/" className="btn-ghost">Go home</a></div>
    </div>
  );
}
