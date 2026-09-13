import { isAdminRequest } from "@/lib/auth";
import { countUnread, deleteSubmission, listSubmissions, patchSubmission, STATUSES } from "@/lib/submissionsStore";

const unauthorized = () => Response.json({ error: "Unauthorized." }, { status: 401 });

// CSV cells: quoted, with quotes doubled, and a leading apostrophe on anything
// a spreadsheet would treat as a formula (=, +, -, @).
function cell(v) {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

// GET → the Inbox. ?format=csv downloads everything as a spreadsheet.
export async function GET(request) {
  if (!(await isAdminRequest())) return unauthorized();
  if (new URL(request.url).searchParams.get("summary")) {
    return Response.json({ unread: await countUnread() });
  }
  const subs = await listSubmissions({ limit: 5000 });

  if (new URL(request.url).searchParams.get("format") === "csv") {
    const header = [
      "Received", "Status", "Type", "Name", "Email", "Phone", "Message", "Source",
      "Landing page", "Score", "Max score", "Result", "Answers",
      "UTM source", "UTM medium", "UTM campaign", "UTM content", "Referrer", "Email notification",
    ];
    const rows = subs.map((s) => [
      s.createdAt,
      s.status,
      s.kind,
      s.name,
      s.email,
      s.phone,
      s.message,
      s.source,
      s.landing?.headline || "",
      s.quiz?.score ?? "",
      s.quiz?.max ?? "",
      s.quiz?.band?.title || "",
      (s.quiz?.answers || []).map((a) => `${a.question}: ${a.answer}${a.points === null ? "" : ` (${a.points})`}`).join(" | "),
      s.attribution?.utm_source,
      s.attribution?.utm_medium,
      s.attribution?.utm_campaign,
      s.attribution?.utm_content,
      s.attribution?.referrer,
      s.emailStatus,
    ]);
    const csv = [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response("\uFEFF" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="olp-inbox-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return Response.json({ submissions: subs });
}

// PATCH { id, status } → mark read / unread / archived.
export async function PATCH(request) {
  if (!(await isAdminRequest())) return unauthorized();
  const { id, status } = await request.json().catch(() => ({}));
  if (!id || !STATUSES.includes(status)) return Response.json({ error: "Invalid request." }, { status: 400 });
  await patchSubmission(id, { status });
  return Response.json({ ok: true });
}

export async function DELETE(request) {
  if (!(await isAdminRequest())) return unauthorized();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Missing id." }, { status: 400 });
  await deleteSubmission(id);
  return Response.json({ ok: true });
}
