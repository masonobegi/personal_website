import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getStorageStatus } from "@/lib/pagesStore";

export async function GET() {
  const jar = await cookies();
  if (!verifySessionToken(jar.get(SESSION_COOKIE)?.value)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  return Response.json(await getStorageStatus());
}
