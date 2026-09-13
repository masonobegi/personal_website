// Runs once when the server starts. Kicks off one-time data upgrades in the
// background — deliberately not awaited, so a slow or unreachable database can
// never hold up the server coming online.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { runStartupTasks } = await import("./lib/startupTasks");
  runStartupTasks().catch((e) => {
    console.error("[startup] Data upgrade failed; it will retry on the next start:", e?.message || e);
  });
}
