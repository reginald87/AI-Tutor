/**
 * Runs a long AI generation task after the HTTP response has been sent.
 * The app runs as a single pm2 instance, so in-process background promises
 * survive until completion (generation is short-lived, 1–8 minutes).
 * Any rejection is logged; callers mark the DB row FAILED themselves.
 */
export function runInBackground(fn: () => Promise<void>): void {
  fn().catch((err) => {
    console.error("[generate] background job failed:", err);
  });
}