import crypto from "node:crypto";
import { USE_PG, getPool, readJson, writeJson, once } from "@/lib/db";

// -----------------------------------------------------------------------------
//  Every form submission on the site — the contact form, consultation
//  requests, and ad landing pages — saved so none is ever lost to a bad email
//  setting, and listed in the dashboard's Inbox.
//
//  Record: { id, kind: "contact"|"lead", status: "new"|"read"|"archived",
//            createdAt, name, email, phone, message, source, landing, quiz,
//            attribution, emailStatus, notified }
// -----------------------------------------------------------------------------


export const STATUSES = ["new", "read", "archived"];

function ensurePgSchema() {
  return once("__olsSubmissionsReady", () => getPool().query(`
      CREATE TABLE IF NOT EXISTS submissions (
        id          TEXT PRIMARY KEY,
        data        JSONB NOT NULL,
        status      TEXT NOT NULL DEFAULT 'new',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS submissions_created_idx ON submissions (created_at DESC);
    `));
}

export function newSubmissionId() {
  return `s_${Date.now().toString(36)}${crypto.randomBytes(5).toString("hex")}`;
}

export async function addSubmission(rec) {
  const record = {
    status: "new",
    createdAt: new Date().toISOString(),
    ...rec,
    id: rec.id || newSubmissionId(),
  };
  if (USE_PG) {
    await ensurePgSchema();
    await getPool().query(
      "INSERT INTO submissions (id, data, status, created_at) VALUES ($1, $2, $3, $4)",
      [record.id, record, record.status, record.createdAt]
    );
    return record;
  }
  const list = await readJson("submissions.json", []);
  list.unshift(record);
  await writeJson("submissions.json", list);
  return record;
}

// Saves the email outcome onto a record once sending finishes.
export async function patchSubmission(id, patch) {
  if (USE_PG) {
    await ensurePgSchema();
    const status = patch.status && STATUSES.includes(patch.status) ? patch.status : null;
    await getPool().query(
      `UPDATE submissions
         SET data = data || $2::jsonb,
             status = COALESCE($3, status)
       WHERE id = $1`,
      [id, JSON.stringify(patch), status]
    );
    return;
  }
  const list = await readJson("submissions.json", []);
  const idx = list.findIndex((s) => s.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...patch };
    await writeJson("submissions.json", list);
  }
}

export async function listSubmissions({ limit = 1000 } = {}) {
  if (USE_PG) {
    await ensurePgSchema();
    const { rows } = await getPool().query(
      "SELECT data, status FROM submissions ORDER BY created_at DESC LIMIT $1",
      [limit]
    );
    return rows.map((r) => ({ ...r.data, status: r.status }));
  }
  return (await readJson("submissions.json", [])).slice(0, limit);
}

export async function countUnread() {
  if (USE_PG) {
    await ensurePgSchema();
    const { rows } = await getPool().query("SELECT count(*)::int AS n FROM submissions WHERE status = 'new'");
    return rows[0]?.n || 0;
  }
  return (await readJson("submissions.json", [])).filter((s) => s.status === "new").length;
}

export async function deleteSubmission(id) {
  if (USE_PG) {
    await ensurePgSchema();
    return (await getPool().query("DELETE FROM submissions WHERE id = $1", [id])).rowCount > 0;
  }
  const list = await readJson("submissions.json", []);
  await writeJson("submissions.json", list.filter((s) => s.id !== id));
  return true;
}

// For backup restore: writes a record exactly as exported (skipping ones that
// already exist, so restoring twice doesn't duplicate anything).
export async function restoreSubmission(rec) {
  if (!rec?.id || !/^s_[a-z0-9]+$/i.test(rec.id)) return false;
  const status = STATUSES.includes(rec.status) ? rec.status : "read";
  const createdAt = Number.isNaN(Date.parse(rec.createdAt)) ? new Date().toISOString() : rec.createdAt;
  if (USE_PG) {
    await ensurePgSchema();
    const res = await getPool().query(
      "INSERT INTO submissions (id, data, status, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING",
      [rec.id, { ...rec, status, createdAt }, status, createdAt]
    );
    return res.rowCount > 0;
  }
  const list = await readJson("submissions.json", []);
  if (list.some((s) => s.id === rec.id)) return false;
  list.push({ ...rec, status, createdAt });
  list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  await writeJson("submissions.json", list);
  return true;
}
