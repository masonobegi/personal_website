import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  checkPassword,
  createSessionToken,
} from "@/lib/auth";
import { clientIp, readJsonBody } from "@/lib/mailer";
import {
  attackDelay,
  loginWaitMs,
  recordFailure,
  recordSuccess,
  sleep,
  totpEnabled,
  verifyTotp,
} from "@/lib/loginGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function waitMessage(ms) {
  const mins = Math.ceil(ms / 60000);
  return mins > 1
    ? `Too many sign-in attempts. Try again in about ${mins} minutes.`
    : "Too many sign-in attempts. Try again in a minute.";
}

export async function POST(request) {
  const ip = clientIp(request);

  // Already locked out. Nothing is read from the request, so a locked-out
  // caller cannot make the server do any work either.
  const wait = loginWaitMs(ip);
  if (wait > 0) {
    return Response.json({ error: waitMessage(wait) }, { status: 429 });
  }

  const parsed = await readJsonBody(request, { maxBytes: 4 * 1024 });
  if (parsed.tooLarge) {
    return Response.json({ error: "That request is too large." }, { status: 413 });
  }
  if (parsed.invalid) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const body = parsed.body;

  // While the site as a whole is being swept, every attempt costs two seconds.
  // A delay rather than a refusal, so this can never lock the real admin out.
  await sleep(attackDelay());

  const passwordOk = checkPassword(body?.password);
  // Both are checked every time, so a response never reveals which half was
  // wrong or how far a guess got.
  const codeOk = verifyTotp(body?.code);

  if (!passwordOk || !codeOk) {
    const entry = recordFailure(ip);
    const next = Math.max(0, entry.until - Date.now());
    return Response.json(
      {
        error: next > 0 ? waitMessage(next) : "Incorrect details.",
        // So the form knows to show the code field, without revealing whether
        // this particular attempt got the password right.
        totp: totpEnabled(),
      },
      { status: 401 }
    );
  }

  recordSuccess(ip);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return Response.json({ ok: true });
}

// Lets the sign-in form know whether to ask for a code, without anyone having
// to guess. Reveals only that a second factor is switched on.
export async function GET() {
  return Response.json({ totp: totpEnabled() });
}
