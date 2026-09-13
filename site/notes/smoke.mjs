// End-to-end smoke test. Builds are assumed done (`npm run build` first).
// Starts the production server on a throwaway data dir (no real DB, no email),
// crawls the public pages, and checks the admin is locked down.
//
//   npm run build && npm run smoke
//
// Prints PASS or FAIL and exits non-zero on failure.

import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 3199;
const BASE = `http://localhost:${PORT}`;
const dataDir = mkdtempSync(join(tmpdir(), "mo-smoke-"));

const env = {
  ...process.env,
  PORT: String(PORT),
  DATA_DIR: dataDir,
  DATABASE_URL: "", // force the JSON fallback — never touch a real DB
  RESEND_API_KEY: "", // never send mail
  ADMIN_PASSWORD: "smoke-test-pass",
  ADMIN_SESSION_SECRET: "smoke-test-secret-smoke-test-secret",
  NEXT_PUBLIC_SITE_URL: BASE,
};

const server = spawn("node", ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
  env,
  stdio: process.env.SMOKE_VERBOSE ? "inherit" : "ignore",
});

let failures = 0;
const fail = (m) => { console.error("  ✗ " + m); failures++; };
const ok = (m) => console.log("  ✓ " + m);

async function waitForReady() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(BASE + "/", { redirect: "manual" });
      if (r.status < 500) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

const PAGES = ["/", "/projects", "/about", "/hobbies", "/hire", "/contact", "/library", "/privacy", "/terms"];

async function run() {
  if (!(await waitForReady())) { fail("server never came up"); return; }

  for (const p of PAGES) {
    try {
      const r = await fetch(BASE + p);
      const html = await r.text();
      if (r.status !== 200) fail(`${p} → ${r.status}`);
      else if (!/<title>[^<]+<\/title>/.test(html)) fail(`${p} has no <title>`);
      else ok(`${p} 200 + title`);
    } catch (e) {
      fail(`${p} threw: ${e.message}`);
    }
  }

  // A seeded project renders.
  try {
    const r = await fetch(BASE + "/projects");
    const html = await r.text();
    if (/The Pooch Pit/.test(html)) ok("projects seeded and rendering"); else fail("seeded projects not found on /projects");
  } catch (e) { fail("projects check threw: " + e.message); }

  // Admin API is locked down.
  try {
    const r = await fetch(BASE + "/api/admin/projects");
    if (r.status === 401) ok("/api/admin/projects is 401 unauthenticated"); else fail(`admin API not guarded (got ${r.status})`);
  } catch (e) { fail("admin guard check threw: " + e.message); }

  // Wrong password is rejected; right password issues a cookie.
  try {
    const bad = await fetch(BASE + "/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: "nope" }) });
    if (bad.status === 401) ok("wrong password → 401"); else fail(`wrong password not rejected (${bad.status})`);
    const good = await fetch(BASE + "/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: "smoke-test-pass" }) });
    if (good.status === 200 && /mo_admin=/.test(good.headers.get("set-cookie") || "")) ok("correct password issues a session"); else fail("correct password did not issue a session");
  } catch (e) { fail("login check threw: " + e.message); }

  // Robots / sitemap / llms exist.
  for (const p of ["/robots.txt", "/sitemap.xml", "/llms.txt"]) {
    try {
      const r = await fetch(BASE + p);
      const t = await r.text();
      if (r.status === 200 && t.trim().length > 0) ok(`${p} present`); else fail(`${p} missing/empty`);
    } catch (e) { fail(`${p} threw: ${e.message}`); }
  }
}

try {
  await run();
} finally {
  server.kill();
}

if (failures) { console.error(`\nFAIL — ${failures} problem(s).`); process.exit(1); }
console.log("\nPASS");
process.exit(0);
